import os
import sys
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"
from flask import Flask, jsonify, request, render_template
import engine
import urllib.request
import json

CURRENT_VERSION = "v1.1.1" 

app = Flask(__name__, template_folder='templates', static_folder='static')

@app.route('/api/check-update', methods=['GET'])
def api_check_update():
    try:
        req = urllib.request.Request(
            'https://api.github.com/repos/hsami7/Mahkama-Dossier-Manager/releases/latest',
            headers={'User-Agent': 'Mahkama-Dossier-Manager'}
        )
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode())
            latest_version = data.get('tag_name')
            html_url = data.get('html_url')
            
            if latest_version and latest_version != CURRENT_VERSION:
                return jsonify({
                    "has_update": True,
                    "latest_version": latest_version,
                    "download_url": html_url
                })
    except Exception:
        pass # Silently fail if offline or rate-limited
        
    return jsonify({"has_update": False})

def get_default_workspace():
    # Use robust method to find real Desktop path on Windows (ignores language)
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        CSIDL_DESKTOP = 0
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOP, None, 0, buf)
        desktop = buf.value
    else:
        desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
        if not os.path.exists(desktop):
            desktop = os.path.join(os.path.expanduser('~'), 'Bureau') # French Linux fallback
            
    workspace = os.path.join(desktop, 'ملفات المحاكم')
    if not os.path.exists(workspace):
        try:
            os.makedirs(workspace)
        except Exception:
            return os.path.expanduser('~')
    return workspace
@app.route('/')
def index():
    # In Phase 1 we serve a basic status check/placeholder,
    # which will be replaced by the beautiful RTL interface in Phase 2
    if os.path.exists(os.path.join(app.template_folder, 'index.html')):
        return render_template('index.html')
    return """
    <html>
        <head><title>مدير ملفات المحاكم</title></head>
        <body style='text-align:center; padding-top:10%; font-family: sans-serif;'>
            <h1>مدير ملفات المحاكم (Mahkama Dossier Manager)</h1>
            <p>خادم الباك اند يعمل بنجاح. سيتم توفير الواجهة بالكامل في المرحلة الثانية.</p>
        </body>
    </html>
    """

@app.route('/api/scan', methods=['POST'])
def api_scan():
    data = request.get_json() or {}
    directory = data.get('directory')
    target_years = data.get('target_years')
    
    if not directory:
        return jsonify({"error": "يرجى تحديد مسار المجلد الصالح."}), 400
        
    # Resolve home relative paths (like ~)
    directory = os.path.expanduser(directory)
    
    dossiers, warnings = engine.scan_directory(directory, target_years=target_years)
    return jsonify({
        "dossiers": dossiers,
        "warnings": warnings
    })
import threading

sync_thread = None
sync_logs = []
sync_active = False
sync_lock = threading.Lock()
sync_dir = ""
sync_target_years = []

def run_sync(years, base_download_dir):
    global sync_active, sync_logs, sync_dir, sync_target_years
    with sync_lock:
        sync_active = True
        sync_logs.clear()
        sync_dir = base_download_dir
        sync_target_years = years
        
    def log_cb(msg):
        with sync_lock:
            sync_logs.append(msg)
            
    try:
        import sync_dossiers
        for year in years:
            try:
                yr_int = int(year)
                sync_dossiers.sync_dossiers(yr_int, output_dir=base_download_dir, debug=False, log_callback=log_cb)
            except Exception as e:
                log_cb(f"[-] خطأ في مزامنة سنة {year}: {str(e)}")
    except Exception as e:
        log_cb(f"[-] خطأ عام: {str(e)}")
    finally:
        with sync_lock:
            sync_active = False

@app.route('/api/sync', methods=['POST'])
def api_sync():
    global sync_thread, sync_active
    data = request.get_json() or {}
    years = data.get('years', [])
    
    if not years:
        return jsonify({"error": "يرجى تحديد سنة واحدة على الأقل."}), 400
        
    with sync_lock:
        if sync_active:
            return jsonify({"error": "هناك عملية مزامنة جارية بالفعل."}), 400
            
    try:
        directory = data.get('directory')
        if not directory or not directory.strip():
            directory = get_default_workspace()
        else:
            directory = os.path.abspath(os.path.expanduser(directory.strip()))
            
        base_download_dir = directory
        
        sync_thread = threading.Thread(target=run_sync, args=(years, base_download_dir))
        sync_thread.daemon = True
        sync_thread.start()
        
        return jsonify({
            "success": True,
            "message": "بدأت عملية المزامنة في الخلفية."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sync/status', methods=['GET'])
def api_sync_status():
    with sync_lock:
        return jsonify({
            "active": sync_active,
            "logs": list(sync_logs),
            "directory": sync_dir,
            "years": sync_target_years
        })

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    if request.method == 'POST':
        new_settings = request.get_json() or {}
        cleaned = {}
        for k, v in new_settings.items():
            try:
                if isinstance(v, dict):
                    cleaned[str(k)] = {
                        "limit": int(v.get("limit", 30)),
                        "red": int(v.get("red", 5)),
                        "orange": int(v.get("orange", 15))
                    }
            except (ValueError, TypeError):
                pass
        engine.save_settings(cleaned)
        return jsonify({"success": True, "settings": cleaned})
    
    settings = engine.load_settings()
    return jsonify(settings)

@app.route('/api/browse', methods=['GET'])
def api_browse():
    default_ws = get_default_workspace()
    path = request.args.get('path', default_ws)
    if not path:
        path = default_ws
    else:
        path = os.path.abspath(os.path.expanduser(path))
        
    if not os.path.exists(path) or not os.path.isdir(path):
        path = default_ws
        
    try:
        directories = []
        # List only directory contents
        for item in os.scandir(path):
            try:
                if item.is_dir() and not item.name.startswith('.'):
                    directories.append({
                        "name": item.name,
                        "path": item.path
                    })
            except OSError:
                pass
                
        directories.sort(key=lambda x: x["name"].lower())
        
        return jsonify({
            "current_path": path,
            "parent_path": os.path.dirname(path) if path != '/' else None,
            "directories": directories
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/select-folder', methods=['POST'])
def api_select_folder():
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        # Create a hidden root window
        root = tk.Tk()
        root.withdraw()
        # Keep the dialog on top of the webview window
        root.attributes('-topmost', True)
        
        selected_path = filedialog.askdirectory(
            initialdir=get_default_workspace(),
            title="اختر مجلد ملفات المحاكم"
        )
        
        root.destroy()
        
        if selected_path:
            return jsonify({"path": selected_path})
        else:
            return jsonify({"path": None})
    except Exception as e:
        return jsonify({"error": f"تعذر فتح مستعرض الملفات: {str(e)}"}), 500

@app.route('/api/toggle-complete', methods=['POST'])
def api_toggle_complete():
    data = request.get_json() or {}
    file_path = data.get('file_path')
    full_code = data.get('full_code')
    completed = data.get('completed', False)
    
    if not file_path or not full_code:
        return jsonify({"error": "يرجى تحديد مسار الملف والرقم الكامل."}), 400
        
    try:
        abs_path = os.path.abspath(file_path)
        success = engine.set_case_completed(abs_path, full_code, completed)
        if success:
            return jsonify({"success": True, "completed": completed})
        return jsonify({"error": "فشلت عملية تحديث حالة الملف المكتمل."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/toggle-complete-bulk', methods=['POST'])
def api_toggle_complete_bulk():
    data = request.get_json() or {}
    items = data.get('items', []) # Should be a list of dicts: [{'file_path': x, 'full_code': y}, ...]
    completed = data.get('completed', False)
    
    if not items:
        return jsonify({"error": "يرجى تحديد العناصر."}), 400
        
    try:
        success_count = 0
        # Group by file_path to reduce zip operations
        from collections import defaultdict
        grouped = defaultdict(list)
        for item in items:
            grouped[item['file_path']].append(item['full_code'])
            
        for path, codes in grouped.items():
            abs_path = os.path.abspath(path)
            if engine.set_cases_completed_bulk(abs_path, codes, completed):
                success_count += len(codes)
                
        return jsonify({"success": True, "count": success_count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
