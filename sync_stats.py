import os
import re
import sys
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import engine

def log_msg(msg, log_callback=None):
    msg_str = str(msg)
    try:
        print(msg_str)
        sys.stdout.flush()
    except Exception:
        pass
    if log_callback:
        try:
            log_callback(msg_str)
        except Exception:
            pass

def parse_excel_date(date_val):
    if date_val is None:
        return None
    val_str = str(date_val).strip()
    if not val_str:
        return None
    # Try string formats
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    # Try float serial number
    try:
        serial = float(val_str)
        from datetime import timedelta
        base_date = datetime(1899, 12, 30)
        return base_date + timedelta(days=serial)
    except ValueError:
        return None

def download_stats_files(target_year, output_dir="data/stats_downloads", debug=False, log_callback=None, start_date=None, end_date=None):
    os.makedirs(output_dir, exist_ok=True)
    
    if start_date and end_date:
        end_year = end_date.year
        years_to_download = [y for y in [2024, 2025, 2026] if y <= end_year]
    else:
        years_to_download = [y for y in [2024, 2025, 2026] if y <= target_year]
    
    downloaded_files = {}
    registered_count_target = 0
    
    log_msg(f"[*] Starting scraper for years: {years_to_download}", log_callback)
    
    with sync_playwright() as p:
        chromium_args = [
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--disable-features=InsecureDownloadWarnings',
            '--safebrowsing-disable-download-protection'
        ]
        
        try:
            browser = p.chromium.launch(
                headless=not debug,
                slow_mo=500 if debug else 0,
                args=chromium_args
            )
        except Exception as e:
            if "Executable doesn't exist" in str(e) or "Looks like Playwright was just installed" in str(e) or "playwright install" in str(e):
                log_msg("[*] Chromium browser not found. Installing, please wait... (This may take a few minutes)", log_callback)
                try:
                    import sys
                    import playwright.__main__
                    orig_argv = sys.argv
                    sys.argv = ["playwright", "install", "chromium"]
                    playwright.__main__.main()
                    sys.argv = orig_argv
                    log_msg("[+] Chromium browser installed successfully! Retrying launch...", log_callback)
                    browser = p.chromium.launch(
                        headless=not debug,
                        slow_mo=500 if debug else 0,
                        args=chromium_args
                    )
                except Exception as install_err:
                    log_msg(f"[-] Browser installation failed: {install_err}", log_callback)
                    raise e
            else:
                raise e
        context = browser.new_context(accept_downloads=True, ignore_https_errors=True)
        page = context.new_page()
        
        try:
            log_msg("[*] Opening login page...", log_callback)
            page.goto("http://10.250.1.26/Outils/Productivite/RegistreDossierMI", wait_until="domcontentloaded", timeout=60000)
            
            # --- Login ---
            log_msg("[*] Logging in with nelissaoui2...", log_callback)
            page.locator('input:not([type="hidden"]):not([type="submit"])').first.wait_for(timeout=10000)
            all_inputs = page.locator('input:not([type="hidden"]):not([type="submit"])').all()
            
            if len(all_inputs) >= 2:
                all_inputs[0].fill("nelissaoui2")
                all_inputs[1].fill("password")
                submit_btn = page.locator('input[type="submit"], button[type="submit"], a:has-text("دخول")').first
                if submit_btn.count() > 0:
                    submit_btn.click()
                else:
                    all_inputs[1].press("Enter")
            else:
                page.get_by_placeholder("اسم المستخدم").fill("nelissaoui2")
                page.get_by_placeholder("كلمة المرور").fill("password")
                page.keyboard.press("Enter")
                
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                if "Outils" not in page.url and page.url == "http://10.250.1.26/":
                    page.locator('input[type="submit"], button:has-text("دخول"), input[value="دخول"]').first.click(force=True)
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeoutError:
                        pass
                        
            log_msg("[+] Logged in successfully.", log_callback)
            
            # Navigate explicitly if needed
            if "RegistreDossierMI" not in page.url:
                page.goto("http://10.250.1.26/Outils/Productivite/RegistreDossierMI", wait_until="domcontentloaded", timeout=30000)
            
            for yr in years_to_download:
                log_msg(f"[*] Loading data for year {yr}...", log_callback)
                select_element = page.locator('select#AnneeEnregistrement, select').first
                if select_element.count() > 0:
                    select_element.select_option(label=str(yr))
                    load_btn = page.locator('#charger, input[value="تحميل لائحة السجلات"]').first
                    if load_btn.count() > 0:
                        load_btn.click()
                        # Wait 2 seconds for AJAX request to initiate and start updating the DOM
                        time.sleep(2)
                        try:
                            page.wait_for_load_state("networkidle", timeout=10000)
                        except PlaywrightTimeoutError:
                            pass
                        try:
                            page.wait_for_selector("#gridDossiersEnregistres table, #gridDossiersEnregistres a", timeout=20000)
                        except PlaywrightTimeoutError:
                            log_msg(f"[-] Timeout waiting for year {yr} grid.", log_callback)
                            continue
                    else:
                        log_msg("[-] Load button not found.", log_callback)
                        continue
                else:
                    log_msg("[-] Year dropdown not found.", log_callback)
                    continue
                
                # Search for the expertise registry row
                rows = page.locator('#gridDossiersEnregistres table tr, #gridDossiersEnregistres tr').all()
                target_row = None
                for r in rows:
                    cells = r.locator('td').all()
                    if cells:
                        cell_texts = [c.text_content().strip() for c in cells]
                        # Look for row containing "الخبرة" or "خبرة"
                        if any("الخبرة" in txt or "خبرة" in txt for txt in cell_texts):
                            target_row = r
                            # Get count if it is the target year
                            if yr == target_year:
                                # Count is in index 3 (4th column)
                                if len(cell_texts) > 3:
                                    try:
                                        registered_count_target = int(cell_texts[3])
                                    except ValueError:
                                        pass
                            break
                            
                if target_row:
                    link = target_row.locator('*[onclick*="ExportToExcel"], img[src*="excel"], a:has-text("تحميل"), input[type="image"]').first
                    if link.count() > 0:
                        log_msg(f"[*] Downloading file for {yr}...", log_callback)
                        try:
                            with page.expect_download(timeout=90000) as download_info:
                                link.click(force=True)
                            download = download_info.value
                            file_name = f"stats_{yr}.xlsx"
                            file_path = os.path.join(output_dir, file_name)
                            download.save_as(file_path)
                            downloaded_files[yr] = file_path
                            log_msg(f"[+] Downloaded: {file_name}", log_callback)
                        except Exception as e:
                            error_msg = f"فشل تحميل ملف الإحصائيات لسنة {yr}: {e}. يرجى التحقق من الاتصال والمحاولة مرة أخرى."
                            log_msg(f"[-] {error_msg}", log_callback)
                            raise RuntimeError(error_msg)
                    else:
                        log_msg(f"[-] Download link not found for year {yr}", log_callback)
                else:
                    log_msg(f"[-] Expertise row not found for year {yr}", log_callback)
                    
        except Exception as e:
            log_msg(f"[-] Scraper error: {e}", log_callback)
            raise e
        finally:
            browser.close()
            
    return downloaded_files, registered_count_target

def calculate_expert_stats(target_year, download_dir="data/stats_downloads", debug=False, log_callback=None, start_date=None, end_date=None):
    if start_date is None:
        start_date = os.environ.get("START_DATE")
    if end_date is None:
        end_date = os.environ.get("END_DATE")

    if isinstance(start_date, str) and start_date.strip():
        start_date = datetime.strptime(start_date.strip(), '%Y-%m-%d')
    else:
        start_date = None
        
    if isinstance(end_date, str) and end_date.strip():
        end_date = datetime.strptime(end_date.strip(), '%Y-%m-%d')
        target_year = end_date.year
    else:
        end_date = None

    # Step 1: Download files
    files, registered = download_stats_files(target_year, download_dir, debug, log_callback, start_date, end_date)
    
    if not files.get(target_year):
        raise Exception(f"تعذر تحميل ملف سنة {target_year} للحساب.")
        
    # Read files
    # Note: Column J = case status (حالة ملف الخبرة), Column K = status date (تاريخ حالة ملف الخبرة)
    # We parse Excel columns using engine.parse_excel_file
    
    target_rows = engine.parse_excel_file(files[target_year])
    
    prior_years = [y for y in [2024, 2025, 2026] if y < target_year]
    prior_files_rows = {}
    for yr in prior_years:
        if files.get(yr):
            prior_files_rows[yr] = engine.parse_excel_file(files[yr])
        else:
            prior_files_rows[yr] = []
            
    # Calculate:
    # 1. Registered (المسجل)
    # 2. Active workload (الرائج)
    # 3. Completed Normally (المنجز)
    # 4. Closed (المغلق)
    # 5. Remaining (الباقي)
    
    if start_date and end_date:
        # Collect all rows from all years loaded
        all_rows = []
        for r in target_rows:
            all_rows.append(r)
        for yr, rows in prior_files_rows.items():
            for r in rows:
                all_rows.append(r)
                
        # First filter by the start and end dates
        filtered_rows = []
        for r in all_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            reg_date = parse_excel_date(r.get('D'))
            res_date = parse_excel_date(r.get('K'))
            
            in_reg = (reg_date and start_date <= reg_date <= end_date)
            in_res = (res_date and start_date <= res_date <= end_date)
            if in_reg or in_res:
                filtered_rows.append(r)
                
        registered = 0
        active = 0
        munjaz = 0
        muglaq = 0
        
        durations = []
        for r in filtered_rows:
            reg_date = parse_excel_date(r.get('D'))
            res_date = parse_excel_date(r.get('K'))
            status = str(r.get('J') or '').strip()
            
            # Registered in period
            if reg_date and start_date <= reg_date <= end_date:
                registered += 1
                
            # Completed in period
            if res_date and start_date <= res_date <= end_date and "منجز" in status:
                munjaz += 1
                
            # Closed in period
            if res_date and start_date <= res_date <= end_date and "مغلق" in status:
                muglaq += 1

            # Duration for resolved dossiers
            if reg_date and res_date and start_date <= res_date <= end_date and ("منجز" in status or "مغلق" in status):
                diff = (res_date - reg_date).days
                if diff >= 0:
                    durations.append(diff)
                
        active = len(filtered_rows)
        remaining = active - (munjaz + muglaq)
        avg_duration = round(sum(durations) / len(durations)) if durations else 0
        start_date_str = start_date.strftime('%d/%m/%Y')
        end_date_str = end_date.strftime('%d/%m/%Y')
    else:
        # Helper to parse dates
        def get_row_date_year(row):
            k_val = row.get('K') # Column K
            dt = parse_excel_date(k_val)
            return dt.year if dt else None
            
        # a) المسجل
        real_registered = 0
        for r in target_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if code and code != 'الرقم الكامل للملف' and '/' in str(code):
                real_registered += 1
                
        if registered == 0:
            registered = real_registered
            
        # b) Munjaz (المنجز) & Muglaq (المغلق)
        munjaz = 0
        muglaq = 0
        
        # In target year Y file:
        for r in target_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            dt_yr = get_row_date_year(r)
            if dt_yr is not None:
                # Case is resolved
                status = str(r.get('J') or '').strip()
                if "مغلق" in status:
                    muglaq += 1
                elif "منجز" in status:
                    munjaz += 1
                    
        # In prior years files:
        for yr, rows in prior_files_rows.items():
            for r in rows:
                code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
                if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                    continue
                dt_yr = get_row_date_year(r)
                if dt_yr == target_year:
                    # Case resolved in target year
                    status = str(r.get('J') or '').strip()
                    if "مغلق" in status:
                        muglaq += 1
                    elif "منجز" in status:
                        munjaz += 1
                        
        # c) Active (الرائج)
        active = registered
        for yr, rows in prior_files_rows.items():
            for r in rows:
                code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
                if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                    continue
                dt_yr = get_row_date_year(r)
                if dt_yr is None:
                    # Still unresolved
                    active += 1
                elif dt_yr == target_year:
                    # Resolved in target year (so it was active in target year)
                    active += 1
                    
        # d) Remaining (الباقي)
        remaining = active - (munjaz + muglaq)
        
        # Find oldest date in target year file
        oldest_dates = []
        for r in target_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            d_val = r.get('D')
            dt = parse_excel_date(d_val)
            if dt:
                oldest_dates.append(dt)
                
        start_date_str = min(oldest_dates).strftime('%d/%m/%Y') if oldest_dates else f"01/01/{target_year}"
        
        # Find newest date in target year file
        newest_dates = []
        for r in target_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            d_val = r.get('D')
            dt = parse_excel_date(d_val)
            if dt:
                newest_dates.append(dt)
                
        end_date_str = max(newest_dates).strftime('%d/%m/%Y') if newest_dates else f"31/12/{target_year}"

        # Calculate average duration for target year
        durations = []
        for r in target_rows:
            code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            reg_date = parse_excel_date(r.get('D'))
            res_date = parse_excel_date(r.get('K'))
            status = str(r.get('J') or '').strip()
            if reg_date and res_date and ("منجز" in status or "مغلق" in status):
                diff = (res_date - reg_date).days
                if diff >= 0:
                    durations.append(diff)
                    
        for yr, rows in prior_files_rows.items():
            for r in rows:
                code = r.get('C') if '/' in str(r.get('C') or '') else r.get('B')
                if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                    continue
                dt_yr = get_row_date_year(r)
                if dt_yr == target_year:
                    reg_date = parse_excel_date(r.get('D'))
                    res_date = parse_excel_date(r.get('K'))
                    status = str(r.get('J') or '').strip()
                    if reg_date and res_date and ("منجز" in status or "مغلق" in status):
                        diff = (res_date - reg_date).days
                        if diff >= 0:
                            durations.append(diff)
                            
        avg_duration = round(sum(durations) / len(durations)) if durations else 0

    log_msg(f"[+] Total Registered (المسجل): {registered}", log_callback)
    log_msg(f"[+] Total Active (الرائج): {active}", log_callback)
    log_msg(f"[+] Total Completed (المنجز): {munjaz}", log_callback)
    log_msg(f"[+] Total Closed (المغلق): {muglaq}", log_callback)
    log_msg(f"[+] Total Remaining (الباقي): {remaining}", log_callback)
    log_msg(f"[+] Average Duration (متوسط المدة): {avg_duration} days", log_callback)
    log_msg(f"[+] Date Range: {start_date_str} to {end_date_str}", log_callback)
    
    return {
        "registered": registered,
        "active": active,
        "completed": munjaz,
        "closed": muglaq,
        "remaining": remaining,
        "avg_duration": avg_duration,
        "start_date": start_date_str,
        "end_date": end_date_str
    }



if __name__ == '__main__':
    import sys
    import json
    if len(sys.argv) < 3:
        print("Usage: python sync_stats.py <year> <download_dir>")
        sys.exit(1)
        
    try:
        # Reconfigure stdout/stderr to use UTF-8 encoding
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
        
    year = int(sys.argv[1])
    download_dir = sys.argv[2]
    
    try:
        res = calculate_expert_stats(year, download_dir, debug=False, log_callback=None)
        print(f"RESULT:{json.dumps(res)}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

