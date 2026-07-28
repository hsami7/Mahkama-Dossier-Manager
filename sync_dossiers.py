import os
import time
import argparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

def sync_dossiers(years, output_dir="data/downloads", debug=False, log_callback=None, username=None, password=None):
    if not isinstance(years, list):
        years = [years]
        
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

    log(f"[*] بدء المزامنة للسنوات {years}...")
    
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
                log("[*] متصفح Chromium غير موجود. جاري التثبيت، يرجى الانتظار... (قد يستغرق بضع دقائق)")
                try:
                    import sys
                    import playwright.__main__
                    orig_argv = sys.argv
                    sys.argv = ["playwright", "install", "chromium"]
                    playwright.__main__.main()
                    sys.argv = orig_argv
                    log("[+] تم تثبيت المتصفح بنجاح! جاري إعادة التشغيل...")
                    browser = p.chromium.launch(
                        headless=not debug, 
                        slow_mo=500 if debug else 0,
                        args=chromium_args
                    )
                except Exception as install_err:
                    log(f"[-] فشل تثبيت المتصفح: {install_err}")
                    raise e
            else:
                raise e
        context = browser.new_context(accept_downloads=True, ignore_https_errors=True)
        page = context.new_page()
        
        try:
            log("[*] جاري فتح صفحة تسجيل الدخول...")
            page.goto("http://10.250.1.26/", wait_until="domcontentloaded", timeout=60000)
            
            # --- 1. Login ---
            log(f"[*] محاولة تسجيل الدخول باسم {username}...")
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
                log("[-] لم يتم العثور على الحقول الكافية. جاري محاولة طريقة بديلة...")
                page.get_by_placeholder("اسم المستخدم").fill(username)
                page.get_by_placeholder("كلمة المرور").fill(password)
                page.keyboard.press("Enter")
            
            # Wait for navigation after login (increase timeout in case server is slow)
            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeoutError:
                # If networkidle times out, check if we moved past the login page
                if page.locator('input[type="password"]').count() > 0:
                    log("[-] لا نزال في صفحة تسجيل الدخول، جاري محاولة النقر الإجباري على زر الدخول...")
                    # Fallback click
                    page.locator('input[type="submit"], button:has-text("دخول"), input[value="دخول"]').first.click(force=True)
                    try:
                        page.wait_for_load_state("networkidle", timeout=5000)
                    except PlaywrightTimeoutError:
                        pass
            
            if page.locator('input[type="password"]').count() > 0 or "Login" in page.url:
                raise Exception("فشل تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.")
                        
            log("[+] تم تسجيل الدخول بنجاح.")
            
            # --- 2. Navigate to RegistreDossier ---
            log("[*] جاري الانتقال إلى صفحة السجلات...")
            page.goto("http://10.250.1.26/Outils/Productivite/RegistreDossierResponsable", wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_load_state("networkidle", timeout=3000)
            except PlaywrightTimeoutError:
                pass # Just proceed if networkidle hangs
            
            # --- 3. Loop through Years ---
            for year in years:
                target_dir = os.path.join(output_dir, str(year))
                os.makedirs(target_dir, exist_ok=True)
                log(f"[*] جاري تنظيف مجلد التحميل للسنة {year}: {target_dir}")
                if os.path.exists(target_dir):
                    for item in os.listdir(target_dir):
                        if item.lower().endswith(".xlsx") and not item.startswith("stats_"):
                            try:
                                os.remove(os.path.join(target_dir, item))
                            except Exception as e:
                                log(f"[-] تعذر حذف الملف القديم ({item}) لأن الملف مفتوح.")
                
                # Select year in dropdown
                log(f"[*] جاري اختيار السنة {year}...")
                select_element = page.locator('select#AnneeEnregistrement, select').first
                if select_element.count() > 0:
                    select_element.select_option(label=str(year))
                    log(f"[+] تم اختيار السنة {year}.")
                    load_btn = page.locator('#charger, input[value="تحميل لائحة السجلات"]').first
                    if load_btn.count() > 0:
                        load_btn.click()
                        log("[*] جاري تحميل جدول السجلات، يرجى الانتظار...")
                
                # Wait for the grid to populate
                try:
                    page.wait_for_selector("#gridDossiersEnregistres table, #gridDossiersEnregistres a", timeout=20000)
                except PlaywrightTimeoutError:
                    log("[-] انتهى وقت الانتظار للجدول. قد يكون فارغاً أو هناك مشكلة في الاتصال.")
            
                # --- DEBUG: Save HTML to inspect if needed ---
                with open("debug_registre_page.html", "w", encoding="utf-8") as f:
                    f.write(page.content())
                log("[*] تم حفظ ملف debug_registre_page.html للفحص في حالة حدوث أخطاء.")
            
                # --- 4. Download Files ---
                log("[*] جاري البحث عن روابط التحميل...")
            
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
            
                log(f"[*] تم العثور على {len(download_tasks)} سجل محتمل.")
            
                downloaded_count = 0
                import re
            
                def sanitize_filename(name):
                    # Clean up filename for Windows
                    cleaned = re.sub(r'[\\/*?:"<>|]', '_', name)
                    # Remove extra spaces/newlines
                    return " ".join(cleaned.split())
                
                failed_tasks = []
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
                        log(f"[*] السجل {display_index} ({reg_name}): تم التخطي (فارغ - 0 ملفات).")
                        continue
                
                    log(f"[*] السجل {display_index} ({reg_name}): جاري التنزيل...")
                
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
                        log(f"[+] السجل {display_index} ({reg_name}): تم التنزيل بنجاح: {file_name}")
                        downloaded_count += 1
                    
                    except PlaywrightTimeoutError:
                        error_msg = f"السجل {display_index} ({reg_name}): لم يتم بدء التنزيل (انتهى الوقت)."
                        log(f"[-] {error_msg}")
                        failed_tasks.append((task, display_index, reg_name))
                        continue
                    except Exception as e:
                        error_msg = f"السجل {display_index} ({reg_name}): خطأ أثناء التنزيل: {e}."
                        log(f"[-] {error_msg}")
                        failed_tasks.append((task, display_index, reg_name))
                        continue
                        
                max_retries = 3
                for retry in range(1, max_retries + 1):
                    if not failed_tasks:
                        break
                    log(f"[*] محاولة إعادة تنزيل الملفات الفاشلة (المحاولة {retry}/{max_retries})...")
                    still_failed = []
                    for task, display_index, reg_name in failed_tasks:
                        log(f"[*] السجل {display_index} ({reg_name}): إعادة التنزيل...")
                        try:
                            with page.expect_download(timeout=20000) as download_info:
                                task['link'].click(force=True)
                            
                            download = download_info.value
                            suggested = download.suggested_filename
                            ext = os.path.splitext(suggested)[1] or ".xlsx" if suggested else ".xlsx"
                            file_name = f"registry_{display_index}_{reg_name}{ext}"
                            file_path = os.path.join(target_dir, file_name)
                            download.save_as(file_path)
                            log(f"[+] السجل {display_index} ({reg_name}): تم التنزيل بنجاح بعد إعادة المحاولة: {file_name}")
                            downloaded_count += 1
                        except PlaywrightTimeoutError:
                            log(f"[-] السجل {display_index} ({reg_name}): فشل مجددا (انتهى الوقت).")
                            still_failed.append((task, display_index, reg_name))
                        except Exception as e:
                            log(f"[-] السجل {display_index} ({reg_name}): فشل مجددا ({e}).")
                            still_failed.append((task, display_index, reg_name))
                    failed_tasks = still_failed
                    
                log(f"\n[+] اكتملت العملية. تم تنزيل {downloaded_count} ملف بنجاح إلى المجلد {target_dir}")
            
        except Exception as e:
            log(f"[-] خطأ غير متوقع: {e}")
            # Take screenshot for debugging
            page.screenshot(path="debug_error.png")
            log("[*] تم التقاط صورة للخطأ وحفظها في debug_error.png")
            raise Exception(str(e))
            
        finally:
            log("[+] اكتملت جميع العمليات للسنوات المحددة.")
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