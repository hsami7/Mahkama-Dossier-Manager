import os
import time
import argparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

def sync_dossiers(year, output_dir="data/downloads", debug=False, log_callback=None, username=None, password=None):
    # Ensure output directory exists
    target_dir = os.path.join(output_dir, str(year))
    os.makedirs(target_dir, exist_ok=True)
    
    import sys
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    def log(msg):
        msg_str = str(msg)
        try:
            print(msg_str, flush=True)
        except UnicodeEncodeError:
            try:
                # Fallback print replacing non-encodable chars so stdout doesn't crash
                print(msg_str.encode(sys.stdout.encoding or 'ascii', errors='replace').decode(sys.stdout.encoding or 'ascii'), flush=True)
            except Exception:
                pass
        if log_callback:
            try:
                log_callback(msg_str)
            except Exception:
                pass

    # Clear existing xlsx files in the target directory to avoid stale duplicates
    log(f"[*] Cleaning download directory: {target_dir}")
    if os.path.exists(target_dir):
        for item in os.listdir(target_dir):
            if item.lower().endswith('.xlsx'):
                try:
                    os.remove(os.path.join(target_dir, item))
                except Exception as e:
                    error_msg = f"تعذر حذف الملف القديم (\u202A{item}\u202C) لأن الملف مفتوح. يرجى إغلاقه والمحاولة مرة أخرى."
                    log(f"[-] {error_msg}")
                    sys.exit(1)
                    
    log(f"[*] Starting sync for year {year}...")
    log(f"[*] Target directory: {target_dir}")
    
    with sync_playwright() as p:
        # Launch browser (headless=False if debug is True so user can see what's happening)
        # We add arguments to completely disable Chrome's "Insecure download blocked" warnings over HTTP
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
                log("[*] Chromium browser not found. Installing, please wait... (This may take a few minutes)")
                try:
                    import sys
                    import playwright.__main__
                    orig_argv = sys.argv
                    sys.argv = ["playwright", "install", "chromium"]
                    playwright.__main__.main()
                    sys.argv = orig_argv
                    log("[+] Chromium browser installed successfully! Retrying launch...")
                    browser = p.chromium.launch(
                        headless=not debug, 
                        slow_mo=500 if debug else 0,
                        args=chromium_args
                    )
                except Exception as install_err:
                    log(f"[-] Browser installation failed: {install_err}")
                    raise e
            else:
                raise e
        context = browser.new_context(accept_downloads=True, ignore_https_errors=True)
        page = context.new_page()
        
        try:
            log("[*] Opening login page...")
            page.goto("http://10.250.1.26/", wait_until="domcontentloaded", timeout=60000)
            
            # --- 1. Login ---
            log(f"[*] Attempting to log in with {username}...")
            # Wait for all visible inputs
            page.locator('input:not([type="hidden"]):not([type="submit"])').first.wait_for(timeout=10000)
            all_inputs = page.locator('input:not([type="hidden"]):not([type="submit"])').all()
            
            if len(all_inputs) >= 2:
                username_input = all_inputs[0]
                password_input = all_inputs[1]
                
                username_input.fill(username)
                password_input.fill(password)
                
                # Try to find a submit button and click it
                submit_btn = page.locator('input[type="submit"], button[type="submit"], a:has-text("دخول")').first
                if submit_btn.count() > 0:
                    submit_btn.click()
                else:
                    password_input.press("Enter")
            else:
                log("[-] Could not find enough input fields. Trying fallback method...")
                page.get_by_placeholder("اسم المستخدم").fill(username)
                page.get_by_placeholder("كلمة المرور").fill(password)
                page.keyboard.press("Enter")
            
            # Wait for navigation after login (increase timeout in case server is slow)
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                # If networkidle times out, check if we moved past the login page
                if page.locator('input[type="password"]').count() > 0:
                    log("[-] Still on login page, forcing submit button click...")
                    # Fallback click
                    page.locator('input[type="submit"], button:has-text("دخول"), input[value="دخول"]').first.click(force=True)
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeoutError:
                        pass
            
            if page.locator('input[type="password"]').count() > 0 or "Login" in page.url:
                raise Exception("فشل تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.")
                        
            log("[+] Logged in successfully.")
            
            # --- 2. Navigate to RegistreDossier ---
            log("[*] Navigating to Registries page...")
            page.goto("http://10.250.1.26/Outils/Productivite/RegistreDossierResponsable", wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_load_state("networkidle", timeout=3000)
            except PlaywrightTimeoutError:
                pass # Just proceed if networkidle hangs
            
            # --- 3. Select Year ---
            log(f"[*] Selecting year {year}...")
            # Try to find a select element
            select_element = page.locator('select#AnneeEnregistrement, select').first
            if select_element.count() > 0:
                select_element.select_option(label=str(year))
                log(f"[+] Year {year} selected.")
                
                # Now we must click the load button
                load_btn = page.locator('#charger, input[value="تحميل لائحة السجلات"]').first
                if load_btn.count() > 0:
                    load_btn.click()
                    log("[*] Loading registries grid, please wait...")
                    # Wait for the grid to populate (it should have a table inside)
                    try:
                        page.wait_for_selector("#gridDossiersEnregistres table, #gridDossiersEnregistres a", timeout=20000)
                    except PlaywrightTimeoutError:
                        log("[-] Timeout waiting for grid. It might be empty or there's a connection issue.")
                else:
                    log("[-] Could not find the load button.")
            else:
                log("[-] Could not find the year dropdown.")
            
            # --- DEBUG: Save HTML to inspect if needed ---
            with open("debug_registre_page.html", "w", encoding="utf-8") as f:
                f.write(page.content())
            log("[*] Saved debug_registre_page.html in case of errors.")
            
            # --- 4. Download Files ---
            log("[*] Searching for download links...")
            
            # Let's find headers first
            headers = []
            try:
                header_elements = page.locator('#gridDossiersEnregistres table th, #gridDossiersEnregistres th').all()
                for h in header_elements:
                    headers.append(h.text_content().strip())
            except Exception:
                pass
                
            count_col_idx = -1
            name_col_idx = -1
            for idx, h in enumerate(headers):
                h_clean = h.replace('\n', ' ').strip()
                if "عدد" in h_clean or "العدد" in h_clean or "الملفات" in h_clean:
                    count_col_idx = idx
                if "نوع" in h_clean or "السجل" in h_clean or "اسم" in h_clean:
                    name_col_idx = idx
            
            # Now find all rows containing download buttons/links
            rows = page.locator('#gridDossiersEnregistres table tr, #gridDossiersEnregistres tr').all()
            
            download_tasks = []
            for r in rows:
                # Find download button/link inside this row
                link = r.locator('*[onclick*="ExportToExcel"], img[src*="excel"], a:has-text("تحميل"), input[type="image"]').first
                if link.count() > 0:
                    # Get all cell texts in this row
                    cells = r.locator('td').all()
                    cell_texts = [c.text_content().strip() for c in cells]
                    
                    # Extract registry name (for better filename naming)
                    reg_name = ""
                    if name_col_idx != -1 and name_col_idx < len(cell_texts):
                        reg_name = cell_texts[name_col_idx]
                    else:
                        # Fallback: look at first text column
                        for cell_txt in cell_texts:
                            if cell_txt and not cell_txt.isdigit() and len(cell_txt) > 3:
                                reg_name = cell_txt
                                break
                    
                    # Extract count value
                    count_val = None
                    if count_col_idx != -1 and count_col_idx < len(cell_texts):
                        count_val = cell_texts[count_col_idx]
                    else:
                        # Fallback: look for a cell with a numeric value
                        for cell_txt in cell_texts:
                            if cell_txt.isdigit():
                                count_val = cell_txt
                                # If it's the year (e.g. 2025/2026), don't treat it as the count
                                if int(cell_txt) == year:
                                    continue
                                break
                    
                    download_tasks.append({
                        'link': link,
                        'name': reg_name,
                        'count': count_val
                    })
            
            # If no tasks found with row strategy, fall back to old locator strategy
            if not download_tasks:
                fallback_links = page.locator('#gridDossiersEnregistres *[onclick*="ExportToExcel"], #gridDossiersEnregistres img[src*="excel"], #gridDossiersEnregistres a:has-text("تحميل"), #gridDossiersEnregistres input[type="image"]').all()
                for i, link in enumerate(fallback_links):
                    download_tasks.append({
                        'link': link,
                        'name': f"registry_{i+1}",
                        'count': None
                    })
            
            log(f"[*] Found {len(download_tasks)} potential registries.")
            
            downloaded_count = 0
            import re
            
            def sanitize_filename(name):
                # Clean up filename for Windows
                cleaned = re.sub(r'[\\/*?:"<>|]', '_', name)
                # Remove extra spaces/newlines
                return " ".join(cleaned.split())
                
            for i, task in enumerate(download_tasks):
                display_index = i + 1  # 1-based index for logs
                reg_name = sanitize_filename(task['name'] or f"registry_{display_index}")
                count_str = task['count']
                
                # Check if empty (count is 0)
                is_empty = False
                if count_str is not None:
                    count_clean = count_str.strip()
                    if count_clean == '0' or count_clean == '٠' or count_clean == '':
                        is_empty = True
                
                if is_empty:
                    log(f"[*] Registry {display_index} ({reg_name}): Skipped (empty - 0 files).")
                    continue
                
                log(f"[*] Registry {display_index} ({reg_name}): Downloading...")
                
                try:
                    with page.expect_download(timeout=15000) as download_info:
                        task['link'].click(force=True)
                    
                    download = download_info.value
                    
                    suggested = download.suggested_filename
                    if suggested:
                        ext = os.path.splitext(suggested)[1] or ".xlsx"
                        file_name = f"registry_{display_index}_{reg_name}{ext}"
                    else:
                        file_name = f"registry_{display_index}_{reg_name}.xlsx"
                        
                    file_path = os.path.join(target_dir, file_name)
                    download.save_as(file_path)
                    log(f"[+] Registry {display_index} ({reg_name}): Successfully downloaded: {file_name}")
                    downloaded_count += 1
                    
                except PlaywrightTimeoutError:
                    error_msg = f"Registry {display_index} ({reg_name}): Did not trigger a download (Timeout). Please check your connection or try again."
                    log(f"[-] {error_msg}")
                    raise RuntimeError(error_msg)
                except Exception as e:
                    error_msg = f"Registry {display_index} ({reg_name}): Error during download: {e}. Please check and try again."
                    log(f"[-] {error_msg}")
                    raise RuntimeError(error_msg)
                    
            log(f"\n[+] Operation completed. Downloaded {downloaded_count} files successfully into {target_dir}")
            
        except Exception as e:
            log(f"[-] خطأ غير متوقع: {e}")
            # Take screenshot for debugging
            page.screenshot(path="debug_error.png")
            log("[*] Captured error screenshot in debug_error.png")
            sys.exit(1)
            
        finally:
            browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='مزامنة ملفات السجل العام من بوابة محاكم')
    parser.add_argument('year', type=int, help='السنة المطلوب تحميل سجلاتها (مثال: 2026)')
    parser.add_argument('--output-dir', type=str, default='data/downloads', help='مجلد الحفظ')
    parser.add_argument('--debug', action='store_true', help='إظهار المتصفح أثناء العمل')
    parser.add_argument('--username', type=str, default=None, help='اسم المستخدم للبوابة')
    parser.add_argument('--password', type=str, default=None, help='كلمة المرور للبوابة')
    args = parser.parse_args()
    
    sync_dossiers(args.year, output_dir=args.output_dir, debug=args.debug, username=args.username, password=args.password)

