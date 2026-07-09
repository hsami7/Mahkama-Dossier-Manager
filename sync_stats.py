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

def download_stats_files(target_year, output_dir="data/stats_downloads", debug=False, log_callback=None):
    os.makedirs(output_dir, exist_ok=True)
    
    # We need to download files for target_year down to 2024
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
        
        browser = p.chromium.launch(
            headless=not debug,
            slow_mo=500 if debug else 0,
            args=chromium_args
        )
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
                            log_msg(f"[-] Download failed for {yr}: {e}", log_callback)
                    else:
                        log_msg(f"[-] Download link not found for year {yr}", log_callback)
                else:
                    log_msg(f"[-] Expertise row not found for year {yr}", log_callback)
                    
        except Exception as e:
            log_msg(f"[-] Scraper error: {e}", log_callback)
        finally:
            browser.close()
            
    return downloaded_files, registered_count_target

def calculate_expert_stats(target_year, download_dir="data/stats_downloads", debug=False, log_callback=None):
    # Step 1: Download files
    files, registered = download_stats_files(target_year, download_dir, debug, log_callback)
    
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
    
    # Helper to parse dates
    def get_row_date_year(row):
        k_val = row.get('K') # Column K
        dt = parse_excel_date(k_val)
        return dt.year if dt else None
        
    # a) المسجل
    # We already got this from the website grid, or let's double check if we can fall back to row count of target_year
    # Let's clean headers/empty code rows from target_rows to get exact count
    real_registered = 0
    for r in target_rows:
        code = r.get('B')
        if code and code != 'الرقم الكامل للملف' and '/' in str(code):
            real_registered += 1
            
    if registered == 0:
        registered = real_registered
        
    log_msg(f"[+] Total Registered (المسجل): {registered}", log_callback)
    
    # b) Munjaz (المنجز) & Muglaq (المغلق)
    # For target year Y:
    # - non-empty Column K in Year Y file (which naturally falls in Y)
    # - Column K year == Y in prior files (Y-1, Y-2)
    munjaz = 0
    muglaq = 0
    
    # In target year Y file:
    for r in target_rows:
        code = r.get('B')
        if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
            continue
        dt_yr = get_row_date_year(r)
        if dt_yr is not None:
            # Case is resolved
            status = str(r.get('J') or '').strip()
            if status.startswith("مغلق"):
                muglaq += 1
            else:
                munjaz += 1
                
    # In prior years files:
    for yr, rows in prior_files_rows.items():
        for r in rows:
            code = r.get('B')
            if not code or code == 'الرقم الكامل للملف' or '/' not in str(code):
                continue
            dt_yr = get_row_date_year(r)
            if dt_yr == target_year:
                # Case resolved in target year
                status = str(r.get('J') or '').strip()
                if status.startswith("مغلق"):
                    muglaq += 1
                else:
                    munjaz += 1
                    
    # c) Active (الرائج)
    # Formula: prior files with empty K + prior files resolved in Year Y + total registered in Year Y
    active = registered
    for yr, rows in prior_files_rows.items():
        for r in rows:
            code = r.get('B')
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
    # Formula: Active - (Munjaz + Muglaq)
    remaining = active - (munjaz + muglaq)
    
    log_msg(f"[+] Total Active (الرائج): {active}", log_callback)
    log_msg(f"[+] Total Completed (المنجز): {munjaz}", log_callback)
    log_msg(f"[+] Total Closed (المغلق): {muglaq}", log_callback)
    log_msg(f"[+] Total Remaining (الباقي): {remaining}", log_callback)
    
    return {
        "registered": registered,
        "active": active,
        "completed": munjaz,
        "closed": muglaq,
        "remaining": remaining
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

