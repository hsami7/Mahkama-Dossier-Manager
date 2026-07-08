import os
import time
import argparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

def sync_dossiers(year, output_dir="data/downloads", debug=False, log_callback=None):
    # Ensure output directory exists
    target_dir = os.path.join(output_dir, str(year))
    os.makedirs(target_dir, exist_ok=True)
    
    def log(msg):
        print(msg)
        if log_callback:
            try:
                log_callback(msg)
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
                    log(f"[-] Could not remove stale file {item}: {e}")
                    
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
        
        browser = p.chromium.launch(
            headless=not debug, 
            slow_mo=500 if debug else 0,
            args=chromium_args
        )
        context = browser.new_context(accept_downloads=True, ignore_https_errors=True)
        page = context.new_page()
        
        try:
            log("[*] Opening login page...")
            page.goto("http://10.250.1.26/", wait_until="domcontentloaded", timeout=60000)
            
            # --- 1. Login ---
            log("[*] Attempting to log in...")
            # Wait for all visible inputs
            page.locator('input:not([type="hidden"]):not([type="submit"])').first.wait_for(timeout=10000)
            all_inputs = page.locator('input:not([type="hidden"]):not([type="submit"])').all()
            
            if len(all_inputs) >= 2:
                username_input = all_inputs[0]
                password_input = all_inputs[1]
                
                username_input.fill("nelissaoui")
                password_input.fill("Admin.123")
                
                # Try to find a submit button and click it
                submit_btn = page.locator('input[type="submit"], button[type="submit"], a:has-text("دخول")').first
                if submit_btn.count() > 0:
                    submit_btn.click()
                else:
                    password_input.press("Enter")
            else:
                log("[-] Could not find enough input fields. Trying fallback method...")
                page.get_by_placeholder("اسم المستخدم").fill("nelissaoui")
                page.get_by_placeholder("كلمة المرور").fill("Admin.123")
                page.keyboard.press("Enter")
            
            # Wait for navigation after login (increase timeout in case server is slow)
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                # If networkidle times out, check if we moved past the login page
                if "Outils" not in page.url and page.url == "http://10.250.1.26/":
                    log("[-] Still on login page, forcing submit button click...")
                    # Fallback click
                    page.locator('input[type="submit"], button:has-text("دخول"), input[value="دخول"]').first.click(force=True)
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeoutError:
                        pass
                    
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
            
            # Strategy: Find any element that triggers ExportToExcel, or any excel icon
            # We specifically look inside the grid to avoid clicking side-menu links
            download_links = page.locator('#gridDossiersEnregistres *[onclick*="ExportToExcel"], #gridDossiersEnregistres img[src*="excel"]').all()
            
            if len(download_links) == 0:
                # Fallback: any link in the grid that has text "تحميل" but not "القرارات"
                download_links = page.locator('#gridDossiersEnregistres a:has-text("تحميل"), #gridDossiersEnregistres input[type="image"]').all()
                
            log(f"[*] Found {len(download_links)} potential download links.")
            
            downloaded_count = 0
            for i, link in enumerate(download_links):
                try:
                    # Start waiting for the download with a 15-second timeout (server needs time to generate Excel files)
                    with page.expect_download(timeout=15000) as download_info:
                        # Perform the action that initiates download
                        # Some links require forcing the click
                        link.click(force=True)
                    
                    download = download_info.value
                    
                    # Save the download to the target directory
                    # Prepend index to prevent overwriting if all files have the same name (e.g., السجل العام.xlsx)
                    file_name = download.suggested_filename
                    if not file_name:
                        file_name = f"registry_{year}_{i}.xlsx"
                    else:
                        file_name = f"registry_{i}_{file_name}"
                        
                    file_path = os.path.join(target_dir, file_name)
                    download.save_as(file_path)
                    log(f"[+] Successfully downloaded: {file_name}")
                    downloaded_count += 1
                    
                except PlaywrightTimeoutError:
                    log(f"[-] Link {i+1} did not trigger a download.")
                except Exception as e:
                    log(f"[-] Error on link {i+1}: {e}")
                    
            log(f"\n[+] Operation completed. Downloaded {downloaded_count} files successfully into {target_dir}")
            
        except Exception as e:
            log(f"[-] Unexpected error occurred: {e}")
            # Take screenshot for debugging
            page.screenshot(path="debug_error.png")
            log("[*] Captured error screenshot in debug_error.png")
            
        finally:
            browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='مزامنة ملفات السجل العام من بوابة محاكم')
    parser.add_argument('year', type=int, help='السنة المطلوب تحميل سجلاتها (مثال: 2026)')
    parser.add_argument('--debug', action='store_true', help='إظهار المتصفح أثناء العمل')
    args = parser.parse_args()
    
    sync_dossiers(args.year, debug=args.debug)
