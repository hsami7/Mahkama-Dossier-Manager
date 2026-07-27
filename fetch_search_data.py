import os
import json
import sys
import argparse
from sync_stats import download_stats_files
from sync_dossiers import sync_dossiers
import engine
from datetime import datetime

def parse_date(date_str):
    if not date_str: return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except:
        return None

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
        
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, action='append')
    parser.add_argument('--start-date', type=str)
    parser.add_argument('--end-date', type=str)
    parser.add_argument('--username', type=str)
    parser.add_argument('--password', type=str)
    parser.add_argument('--local-only', action='store_true')
    parser.add_argument('--download-dir', type=str, required=True)
    args = parser.parse_args()
    
    years = args.year
    if not years:
        if args.start_date and args.end_date:
            try:
                end_year = int(args.end_date.split('-')[0])
                years = [y for y in engine.AVAILABLE_YEARS if y <= end_year]
            except:
                years = [engine.AVAILABLE_YEARS[0]]
        else:
            years = [engine.AVAILABLE_YEARS[0]]

    if not args.local_only:
        print("[*] بدء جلب البيانات من محاكم...")
        try:
            print("[*] جلب ملفات الإحصائيات (Stats)...")
            try:
                target_year = years[0] if years else engine.AVAILABLE_YEARS[0]
                download_stats_files(
                    target_year=target_year,
                    output_dir=args.download_dir,
                    debug=False,
                    start_date=args.start_date,
                    end_date=args.end_date,
                    username=args.username,
                    password=args.password
                )
            except Exception as e:
                print(f"[-] تحذير: خطأ في جلب الإحصائيات: {str(e)}")
            
            print("[*] جلب ملفات السجلات (Dossiers)...")
            for yr in years:
                try:
                    sync_dossiers(
                        years=[yr],
                        output_dir=args.download_dir,
                        debug=False,
                        username=args.username,
                        password=args.password
                    )
                except Exception as e:
                    print(f"[-] تحذير: خطأ في جلب السجلات لسنة {yr}: {str(e)}")
                
            print("[+] انتهت محاولة جلب البيانات.")
        except Exception as e:
            print(f"[-] خطأ غير متوقع أثناء جلب البيانات: {str(e)}")
            
    print("[*] جاري قراءة الملفات المحلية...")
    all_rows = []
    file_statuses = []
        
    # parse dates for filtering
    sd = parse_date(args.start_date)
    ed = parse_date(args.end_date)
        
    for yr in years:
        yr_dir = os.path.join(args.download_dir, str(yr))
        if os.path.exists(yr_dir):
            for file in sorted(os.listdir(yr_dir)):
                file_path = os.path.join(yr_dir, file)
                if not file.endswith('.xlsx'):
                    file_statuses.append({"name": file, "status": "skipped", "reason": "ليس ملف Excel"})
                    continue
                try:
                    rows = engine.parse_excel_file_with_headers(file_path)
                    file_statuses.append({"name": file, "status": "read", "rows": len(rows)})
                    print(f"[+] قراءة الملف: {file} ({len(rows)} سجل)")
                    
                    if sd and ed:
                        for r in rows:
                            date_val = engine.parse_excel_date(r.get('تاريخ التسجيل'))
                            if date_val:
                                if sd <= date_val <= ed:
                                    all_rows.append(r)
                            else:
                                all_rows.append(r)
                    else:
                        all_rows.extend(rows)
                except Exception as e:
                    file_statuses.append({"name": file, "status": "failed", "reason": str(e)})
                    print(f"[-] فشل قراءة الملف: {file} - {str(e)}")
                    
    print("[+] اكتملت القراءة.")
    print(f"RESULT:{json.dumps({'rows': all_rows, 'files': file_statuses})}")

if __name__ == '__main__':
    main()
