import os
import json
import zipfile
import xml.etree.ElementTree as ET
import re
from datetime import datetime, timedelta

DEFAULT_SETTINGS = {
    "7201": {"limit": 40, "red": 5, "orange": 15}, "7202": {"limit": 60, "red": 5, "orange": 15},
    "7203": {"limit": 30, "red": 5, "orange": 15}, "7204": {"limit": 30, "red": 5, "orange": 15},
    "7205": {"limit": 120, "red": 5, "orange": 15}, "7206": {"limit": 160, "red": 5, "orange": 15},
    "7207": {"limit": 250, "red": 5, "orange": 15}, "7208": {"limit": 120, "red": 5, "orange": 15},
    "7209": {"limit": 180, "red": 5, "orange": 15}, "7210": {"limit": 120, "red": 5, "orange": 15},
    "7211": {"limit": 80, "red": 5, "orange": 15}, "7212": {"limit": 120, "red": 5, "orange": 15},
    "7213": {"limit": 120, "red": 5, "orange": 15}, "7214": {"limit": 60, "red": 5, "orange": 15},
    "7215": {"limit": 30, "red": 5, "orange": 15}
}

def get_data_dir():
    if os.name == 'nt':
        appdata = os.environ.get('LOCALAPPDATA')
        if not appdata:
            appdata = os.environ.get('APPDATA')
        if not appdata:
            appdata = os.path.expanduser('~')
        path = os.path.join(appdata, 'MahkamaDossierManager')
    else:
        path = os.path.join(os.path.expanduser('~'), '.config', 'mahkama')
    
    os.makedirs(path, exist_ok=True)
    return path

DATA_DIR = get_data_dir()
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
COMPLETED_CASES_FILE = os.path.join(DATA_DIR, 'completed_cases.json')

def migrate_old_data():
    # If there is old data in the same directory as this script, copy it to the persistent AppData folder
    try:
        old_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
        old_settings = os.path.join(old_dir, 'settings.json')
        old_completed = os.path.join(old_dir, 'completed_cases.json')
        
        import shutil
        if os.path.exists(old_settings) and not os.path.exists(SETTINGS_FILE):
            shutil.copy2(old_settings, SETTINGS_FILE)
        if os.path.exists(old_completed) and not os.path.exists(COMPLETED_CASES_FILE):
            shutil.copy2(old_completed, COMPLETED_CASES_FILE)
    except Exception:
        pass

migrate_old_data()

def get_completed_cases(fpath=None):
    """Read completed case codes from global completed_cases.json."""
    if not os.path.exists(COMPLETED_CASES_FILE):
        return set()
    try:
        with open(COMPLETED_CASES_FILE, 'r', encoding='utf-8') as f:
            return set(json.load(f))
    except Exception:
        pass
    return set()

def set_case_completed(fpath, full_code, completed):
    """Add or remove a case's full code in global completed_cases.json."""
    try:
        cases = get_completed_cases()
        if completed:
            cases.add(full_code)
        else:
            cases.discard(full_code)
            
        os.makedirs(os.path.dirname(COMPLETED_CASES_FILE), exist_ok=True)
        with open(COMPLETED_CASES_FILE, 'w', encoding='utf-8') as f:
            json.dump(list(cases), f, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error setting case completed status: {e}")
        return False

def set_cases_completed_bulk(fpath, full_codes, completed):
    """Add or remove multiple case codes in global completed_cases.json."""
    try:
        cases = get_completed_cases()
        if completed:
            for code in full_codes:
                cases.add(code)
        else:
            for code in full_codes:
                cases.discard(code)
                
        os.makedirs(os.path.dirname(COMPLETED_CASES_FILE), exist_ok=True)
        with open(COMPLETED_CASES_FILE, 'w', encoding='utf-8') as f:
            json.dump(list(cases), f, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error setting bulk case completed status: {e}")
        return False

def load_settings():
    """Load settings from settings.json or return defaults."""
    settings = DEFAULT_SETTINGS.copy()
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                # Migrate old format if needed
                for k, v in loaded.items():
                    if isinstance(v, int):
                        settings[str(k)] = {"limit": v, "red": 5, "orange": 15}
                    elif isinstance(v, dict):
                        # Merge with defaults to ensure all keys exist
                        default_val = settings.get(str(k), {"limit": 30})
                        settings[str(k)] = {
                            "limit": v.get("limit", default_val.get("limit", 30)),
                            "red": v.get("red", 5),
                            "orange": v.get("orange", 15)
                        }
            return settings
        except Exception:
            pass
    return settings

def save_settings(settings):
    """Save settings to settings.json."""
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)

def parse_dossier_code(full_code):
    """
    Extract Year, Category Code, and Sequence Number from B column text.
    E.g. '2026/7205/11' -> ('2026', '7205', '11')
    Handles prefixes like '(محال للإختصاص أو مضموم)2026/7208/1'
    """
    if not full_code:
        return None, None, None
    
    match = re.search(r'(\d{4})[/\-](\d{3,4})[/\-](\d+)', str(full_code))
    if match:
        return match.group(1), match.group(2), match.group(3)
        
    return None, None, None

def parse_excel_date(date_val):
    """
    Parse Excel date values. Handles strings (DD/MM/YYYY) and Excel serial numbers.
    """
    if date_val is None:
        return None
        
    val_str = str(date_val).strip()
    if not val_str:
        return None
        
    # Check if string format date
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
            
    # Check if Excel serial float
    try:
        serial = float(val_str)
        # Excel bug: treats 1900 as leap year, so offset base is 1899-12-30
        base_date = datetime(1899, 12, 30)
        return base_date + timedelta(days=serial)
    except ValueError:
        return None

def calculate_urgency(reg_date, category_code, settings=None):
    """
    Calculate days remaining and assign urgency colors.
    """
    if not reg_date:
        return {
            "days_remaining": 9999,
            "expiry_date": "",
            "color": "green",
            "urgency_text": "غير محدد"
        }
        
    if settings is None:
        settings = load_settings()
        
    code_settings = settings.get(str(category_code), {"limit": 30, "red": 5, "orange": 15})
    limit_days = code_settings.get("limit", 30)
    red_days = code_settings.get("red", 5)
    orange_days = code_settings.get("orange", 15)
    
    expiry_date = reg_date + timedelta(days=limit_days)
    
    # Calculate difference from today (normalized to start of day)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    reg_date_norm = reg_date.replace(hour=0, minute=0, second=0, microsecond=0)
    expiry_date_norm = expiry_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    days_remaining = (expiry_date_norm - today).days
    
    if days_remaining <= red_days:
        color = "red"
        urgency_text = "عاجل جداً"
    elif days_remaining <= orange_days:
        color = "orange"
        urgency_text = "متوسط الاستعجال"
    else:
        color = "green"
        urgency_text = "آمن"
        
    return {
        "days_remaining": days_remaining,
        "expiry_date": expiry_date.strftime('%d/%m/%Y'),
        "color": color,
        "urgency_text": urgency_text
    }

def parse_excel_file(file_path):
    """
    Dependency-free Excel reader using zipfile and xml.etree.ElementTree.
    Reads first worksheet rows.
    """
    if not os.path.exists(file_path):
        return []
        
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Load shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in zip_ref.namelist():
                ss_data = zip_ref.read('xl/sharedStrings.xml')
                root = ET.fromstring(ss_data)
                for si in root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                    t_elms = si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                    t_text = "".join([t.text for t in t_elms if t.text])
                    shared_strings.append(t_text)
            
            # Load worksheet
            sheet_file = 'xl/worksheets/sheet1.xml'
            if sheet_file not in zip_ref.namelist():
                sheet_files = [name for name in zip_ref.namelist() if name.startswith('xl/worksheets/')]
                if sheet_files:
                    sheet_file = sheet_files[0]
                else:
                    return []
                    
            sheet_data = zip_ref.read(sheet_file)
            root = ET.fromstring(sheet_data)
            
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows_xml = root.findall('.//ns:row', ns)
            
            # Map column letters to values
            headers = {}
            parsed_rows = []
            
            for i, row in enumerate(rows_xml):
                cells = row.findall('ns:c', ns)
                row_data = {}
                for cell in cells:
                    r_ref = cell.get('r')
                    col_letter = "".join([c for c in r_ref if c.isalpha()])
                    t_type = cell.get('t')
                    
                    v_elem = cell.find('ns:v', ns)
                    val = None
                    if v_elem is not None:
                        raw_val = v_elem.text
                        if t_type == 's' and raw_val is not None:
                            try:
                                val = shared_strings[int(raw_val)]
                            except Exception:
                                val = ""
                        else:
                            val = raw_val
                    row_data[col_letter] = val
                
                # Use first row as header mapper if it looks like headers
                if i == 0:
                    headers = row_data
                else:
                    parsed_rows.append(row_data)
                    
            return parsed_rows
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return []

def rename_file_safely(file_path, year, category):
    """
    Rename Excel file to Year_Category.xlsx format.
    Handles locks and overwrites safely.
    """
    dir_name = os.path.dirname(file_path)
    base_name = os.path.basename(file_path)
    new_name = f"{year}_{category}.xlsx"
    new_path = os.path.join(dir_name, new_name)
    
    # If the file is already named correctly, do nothing
    if base_name == new_name:
        return True, file_path, None

    # Check for clashes
    if os.path.exists(new_path):
        try:
            # We simply remove the old file so we have a fresh state
            os.remove(new_path)
        except Exception as e:
            return False, file_path, f"error overwriting: {str(e)}"
        
    try:
        os.rename(file_path, new_path)
        return True, new_path, None
    except PermissionError:
        return False, file_path, "locked"
    except Exception as e:
        return False, file_path, f"error: {str(e)}"

def scan_directory(dir_path, target_years=None, skip_transferred=False):
    """
    Scan a directory for Excel files, rename them based on contents, and parse dossier details.
    If target_years is provided (list of strings), only dossiers matching those years are returned.
    """
    if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
        return [], ["المسار المحدد غير صالح أو غير موجود."]
        
    dossiers = []
    warnings = []
    settings = load_settings()
    seen_full_codes = set()
    
    # Find all excel files recursively
    files = []
    for root, _, filenames in os.walk(dir_path):
        for f in filenames:
            if f.lower().endswith('.xlsx') and not f.startswith('~$'):
                files.append(os.path.join(root, f))
    
    for fpath in files:
        rows = parse_excel_file(fpath)
        if not rows:
            continue
            
        # Find first row containing data in B to identify file type
        year, category = None, None
        for row in rows:
            full_code = row.get('B')
            if full_code:
                y, c, n = parse_dossier_code(full_code)
                if y and c:
                    year, category = y, c
                    break
                    
        active_fpath = fpath
        if year and category:
            # Attempt to rename file
            success, renamed_path, err_type = rename_file_safely(fpath, year, category)
            if success:
                active_fpath = renamed_path
            else:
                original_name = os.path.basename(fpath)
                if str(err_type).startswith("clash:"):
                    clash_name = err_type.split("clash: ")[1]
                    warnings.append(f"تنبيه: تم تخطي إعادة تسمية الملف '{original_name}' لوجود ملف آخر بنفس الاسم المالي والنوع والتاريخ ({clash_name}).")
                elif err_type == "locked":
                    warnings.append(f"تنبيه: تعذر إعادة تسمية الملف '{original_name}' لأنه مفتوح حالياً في برنامج آخر (مثل Excel).")
                else:
                    warnings.append(f"تنبيه: تعذر إعادة تسمية الملف '{original_name}': {err_type}")
                    
        abs_file_path = os.path.abspath(active_fpath)
        completed_cases = get_completed_cases(active_fpath)
        
        # Parse data rows (re-read or parse the rows we got)
        # Note: B = code, C = reg date, D = appellant, E = appellee, F = type, H = judge, K = ruling
        for idx, row in enumerate(rows):
            full_code = row.get('B')
            reg_date_raw = row.get('C')
            ruling_date_raw = row.get('J')
            
            if not full_code or full_code == 'الرقم الكامل للملف':
                continue
                
            # Skip if there is a ruling date in column J
            if ruling_date_raw and str(ruling_date_raw).strip():
                continue
                
            # Skip if full code indicates case is transferred/merged
            if skip_transferred and '(محال للإختصاص أو مضموم)' in str(full_code):
                continue
                
            y, c, n = parse_dossier_code(full_code)
            if y and c and n:
                full_code = f"{y}/{c}/{n}"
                
            # Filter by target years if provided
            if target_years and y not in target_years:
                continue
                
            if full_code in seen_full_codes:
                continue
            seen_full_codes.add(full_code)
            
            reg_date = parse_excel_date(reg_date_raw)
            
            if reg_date:
                urgency = calculate_urgency(reg_date, c, settings)
                days_rem = urgency["days_remaining"]
                expiry_dt = urgency["expiry_date"]
                color = urgency["color"]
                urgency_txt = urgency["urgency_text"]
            else:
                days_rem = 9999
                expiry_dt = "غير محدد"
                color = "green"
                urgency_txt = "غير محدد"
                
            dossiers.append({
                "number": n if n else "غير محدد",
                "full_code": full_code,
                "category": c if c else "غير معروف",
                "year": y if y else "غير معروف",
                "reg_date": reg_date.strftime('%d/%m/%Y') if reg_date else "غير محدد",
                "expiry_date": expiry_dt,
                "days_remaining": days_rem,
                "color": color,
                "urgency_text": urgency_txt,
                "appellant": row.get('D') or "",
                "appellee": row.get('E') or "",
                "case_type": row.get('F') or "",
                "judge": row.get('H') or "",
                "ruling": row.get('K') or "",
                "source_file": os.path.basename(active_fpath),
                "file_path": abs_file_path,
                "completed": full_code in completed_cases
            })
            
    # Sort dossiers: closest deadline first (ascending order of days_remaining)
    dossiers.sort(key=lambda x: x["days_remaining"])
    return dossiers, warnings

