import os
import json
import sys
import argparse
from sync_dossiers import sync_dossiers
import engine


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
        
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, action='append')
    parser.add_argument('--username', type=str)
    parser.add_argument('--password', type=str)
    parser.add_argument('--local-only', action='store_true')
    parser.add_argument('--download-dir', type=str, required=True)
    args = parser.parse_args()
    
    years = args.year
    if not args.local_only:
        import datetime
        import shutil
        current_year = datetime.datetime.now().year
        # Update (تحديث): fetch from 2024 to current_year and clear existing folder
        years = list(range(2024, current_year + 1))
        
        if os.path.exists(args.download_dir):
            try:
                shutil.rmtree(args.download_dir)
            except Exception as e:
                pass
        os.makedirs(args.download_dir, exist_ok=True)
    else:
        # Saved (آخر حفظ): Just read what's there
        if not years:
            try:
                years = sorted([int(d) for d in os.listdir(args.download_dir) if os.path.isdir(os.path.join(args.download_dir, d)) and d.isdigit()])
            except Exception:
                years = []

    file_statuses = []

    fetch_error = None
    if not args.local_only:
        print("[*] بدء جلب البيانات من محاكم...")
        print("[*] جلب ملفات السجلات (Dossiers)...")
        import re as _re
        def dossiers_log(msg):
            if "تم التخطي (فارغ" in msg:
                m = _re.search(r'السجل \d+ \((.+?)\):', msg)
                if m:
                    file_statuses.append({"name": m.group(1), "status": "skipped", "reason": "فارغ (0 ملفات)"})
        try:
            sync_dossiers(
                years=years,
                output_dir=args.download_dir,
                debug=False,
                log_callback=dossiers_log,
                username=args.username,
                password=args.password
            )
            print("[+] انتهت محاولة جلب البيانات.")
        except Exception as e:
            fetch_error = str(e)
            print(f"[-] خطأ غير متوقع أثناء جلب البيانات: {fetch_error}")
            
    print("[*] جاري قراءة الملفات المحلية...")
    all_rows = []
        
    for yr in sorted(os.listdir(args.download_dir)):
        yr_dir = os.path.join(args.download_dir, yr)
        if not os.path.isdir(yr_dir) or not yr.isdigit():
            continue
        for file in sorted(os.listdir(yr_dir)):
            file_path = os.path.join(yr_dir, file)
            if not file.endswith('.xlsx'):
                file_statuses.append({"name": f"{yr}/{file}", "status": "skipped", "reason": "ليس ملف Excel"})
                continue
            try:
                rows = engine.parse_excel_file_with_headers(file_path)
                file_statuses.append({"name": f"{yr}/{file}", "status": "read", "rows": len(rows)})
                print(f"[+] قراءة الملف: {yr}/{file} ({len(rows)} سجل)")
                all_rows.extend(rows)
            except Exception as e:
                file_statuses.append({"name": f"{yr}/{file}", "status": "failed", "reason": str(e)})
                print(f"[-] فشل قراءة الملف: {yr}/{file} - {str(e)}")
                    
    print("[+] اكتملت القراءة.")
    print(f"RESULT:{json.dumps({'rows': all_rows, 'files': file_statuses, 'error': fetch_error})}")

if __name__ == '__main__':
    main()
