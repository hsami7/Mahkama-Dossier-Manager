import os
import json
import sys
import argparse
from sync_stats import download_stats_files
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
    parser.add_argument('--year', type=int)
    parser.add_argument('--start-date', type=str)
    parser.add_argument('--end-date', type=str)
    parser.add_argument('--username', type=str)
    parser.add_argument('--password', type=str)
    parser.add_argument('--local-only', action='store_true')
    parser.add_argument('--download-dir', type=str, required=True)
    args = parser.parse_args()
    
    if not args.local_only:
        print("[*] بدء جلب البيانات من محاكم...")
        try:
            download_stats_files(
                target_year=args.year,
                output_dir=args.download_dir,
                debug=False,
                start_date=args.start_date,
                end_date=args.end_date,
                username=args.username,
                password=args.password
            )
            print("[+] تم جلب البيانات بنجاح.")
        except Exception as e:
            print(f"[-] خطأ أثناء جلب البيانات: {str(e)}")
            print("ERROR:" + str(e))
            sys.exit(1)
            
    print("[*] جاري قراءة الملفات المحلية...")
    all_rows = []
    
    if args.start_date and args.end_date:
        try:
            end_year = int(args.end_date.split('-')[0])
            years = [y for y in [2024, 2025, 2026] if y <= end_year]
        except:
            years = [args.year] if args.year else [2026]
    else:
        years = [y for y in [2024, 2025, 2026] if y <= (args.year or 2026)]
        
    # parse dates for filtering
    sd = parse_date(args.start_date)
    ed = parse_date(args.end_date)
        
    for yr in years:
        yr_dir = os.path.join(args.download_dir, str(yr))
        if os.path.exists(yr_dir):
            for file in os.listdir(yr_dir):
                if file.endswith('.xlsx'):
                    file_path = os.path.join(yr_dir, file)
                    print(f"[*] قراءة الملف: {file}")
                    rows = engine.parse_excel_file_with_headers(file_path)
                    
                    if sd and ed:
                        # filter by date if needed. The column is usually 'تاريخ التسجيل'
                        # But wait, date parsing is complex, the frontend data table can filter dates better.
                        # We will just pass all rows and let DataTables filter, or we filter here? 
                        # Filtering here is safer for memory.
                        for r in rows:
                            date_val = engine.parse_excel_date(r.get('تاريخ التسجيل'))
                            if date_val:
                                if sd <= date_val <= ed:
                                    all_rows.append(r)
                            else:
                                all_rows.append(r) # keep rows without date just in case
                    else:
                        all_rows.extend(rows)
                    
    print("[+] اكتملت القراءة.")
    print(f"RESULT:{json.dumps(all_rows)}")

if __name__ == '__main__':
    main()
