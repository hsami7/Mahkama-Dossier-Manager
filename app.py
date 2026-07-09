import os
import sys
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

if getattr(sys, 'frozen', False):
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"
from flask import Flask, jsonify, request, render_template
import engine
import urllib.request
import json

CURRENT_VERSION = "v1.1.6" 

def write_log(msg):
    log_dir = engine.get_data_dir()
    log_path = os.path.join(log_dir, 'operations.log')
    import datetime
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    formatted_msg = f"[{timestamp}] {msg}"
    try:
        os.makedirs(log_dir, exist_ok=True)
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(formatted_msg + '\n')
    except Exception as e:
        print(f"Error writing log: {e}")

app = Flask(__name__, template_folder='templates', static_folder='static')

import tempfile
import threading
import time

update_status = {"status": "idle", "progress": 0, "version": None, "error": None}
update_lock = threading.Lock()
update_thread = None

def download_update_worker(download_url, version):
    global update_status
    with update_lock:
        update_status["status"] = "downloading"
        update_status["progress"] = 0
        update_status["version"] = version
        update_status["error"] = None
        
    try:
        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(temp_dir, 'mahkama_update.exe')
        
        # Download chunk-by-chunk to calculate progress
        req = urllib.request.Request(
            download_url,
            headers={'User-Agent': 'Mahkama-Dossier-Manager'}
        )
        with urllib.request.urlopen(req) as response:
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            block_size = 8192
            
            with open(temp_file, 'wb') as f:
                while True:
                    buffer = response.read(block_size)
                    if not buffer:
                        break
                    f.write(buffer)
                    downloaded += len(buffer)
                    if total_size > 0:
                        progress = int((downloaded / total_size) * 100)
                        with update_lock:
                            update_status["progress"] = progress
                            
        with update_lock:
            update_status["status"] = "ready"
            update_status["progress"] = 100
            
    except Exception as e:
        with update_lock:
            update_status["status"] = "failed"
            update_status["error"] = str(e)

def parse_version(v_str):
    if not v_str:
        return (0, 0, 0)
    cleaned = v_str.lower().lstrip('v').split('-')[0]
    try:
        return tuple(int(x) for x in cleaned.split('.'))
    except Exception:
        return (0, 0, 0)

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
            
            assets = data.get('assets', [])
            download_url = None
            for asset in assets:
                name = asset.get('name', '')
                if name.endswith('.exe') and 'Setup' not in name:
                    download_url = asset.get('browser_download_url')
                    break
                    
            if not download_url:
                download_url = html_url
                
            if latest_version and parse_version(latest_version) > parse_version(CURRENT_VERSION):
                # Trigger background download if idle
                global update_thread
                with update_lock:
                    if update_status["status"] == "idle" or (update_status["status"] == "failed" and update_status["version"] != latest_version):
                        if download_url and download_url.endswith('.exe') and 'Setup' not in download_url:
                            update_thread = threading.Thread(target=download_update_worker, args=(download_url, latest_version))
                            update_thread.daemon = True
                            update_thread.start()
                            
                return jsonify({
                    "has_update": True,
                    "latest_version": latest_version,
                    "download_url": html_url
                })
    except Exception:
        pass
        
    return jsonify({"has_update": False})

@app.route('/api/update-status', methods=['GET'])
def api_update_status():
    with update_lock:
        return jsonify(update_status)

@app.route('/api/trigger-update', methods=['POST'])
def api_trigger_update():
    global update_status
    with update_lock:
        if update_status["status"] != "ready":
            return jsonify({"error": "التحديث ليس جاهزاً بعد."}), 400
            
    try:
        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(temp_dir, 'mahkama_update.exe')
        
        if not os.path.exists(temp_file):
            return jsonify({"error": "ملف التحديث غير موجود."}), 404
            
        is_frozen = getattr(sys, 'frozen', False)
        if is_frozen:
            import subprocess
            # Use DETACHED_PROCESS and CREATE_NEW_PROCESS_GROUP so the updater
            # survives this process exiting and isn't tied to our console/handles
            creation_flags = (
                subprocess.DETACHED_PROCESS |
                subprocess.CREATE_NEW_PROCESS_GROUP
            )
            subprocess.Popen(
                [temp_file, '--replace-and-start', sys.executable, str(os.getpid())],
                creationflags=creation_flags,
                close_fds=True
            )
            # Give Flask time to send the response, then exit
            threading.Thread(target=lambda: (time.sleep(2), os._exit(0))).start()
        else:
            # Dev mode: just run it
            import subprocess
            subprocess.Popen([temp_file])
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_default_workspace():
    workspace = os.path.join(engine.get_data_dir(), 'ملفات المحاكم')
    if not os.path.exists(workspace):
        try:
            os.makedirs(workspace)
        except Exception:
            return os.path.expanduser('~')
    return workspace

@app.route('/api/open-workspace', methods=['POST'])
def api_open_workspace():
    try:
        data = request.json or {}
        directory = data.get('directory', '').strip()
        if not directory:
            directory = get_default_workspace()
            
        if os.path.exists(directory):
            if os.name == 'nt':
                os.startfile(directory)
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', directory])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', directory])
            return jsonify({"success": True})
        return jsonify({"error": "المجلد غير موجود."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/default-workspace', methods=['GET'])
def api_get_default_workspace():
    return jsonify({"directory": get_default_workspace()})

@app.route('/')
def index():
    # In Phase 1 we serve a basic status check/placeholder,
    # which will be replaced by the beautiful RTL interface in Phase 2
    if os.path.exists(os.path.join(app.template_folder, 'index.html')):
        return render_template('index.html')
    return """
    <html>
        <head><title>إدارة ملفات المحاكم</title></head>
        <body style='text-align:center; padding-top:10%; font-family: sans-serif;'>
            <h1>إدارة ملفات المحاكم</h1>
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
    write_log(f"[+] تم مسح المجلد: {directory} - عدد الملفات المستخرجة: {len(dossiers)}")
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
sync_process = None
stats_process = None

def run_sync(years, base_download_dir):
    global sync_active, sync_logs, sync_dir, sync_target_years, sync_process
    with sync_lock:
        sync_logs.clear()
        sync_dir = base_download_dir
        sync_target_years = list(years)
        
    def log_cb(msg):
        with sync_lock:
            sync_logs.append(msg)
        write_log(msg)
            
    write_log(f"[*] بدء عملية المزامنة التلقائية للسنوات: {years}")
    try:
        import subprocess
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_dossiers.py')
        
        env = os.environ.copy()
        if "PLAYWRIGHT_BROWSERS_PATH" in env and not getattr(sys, 'frozen', False):
            del env["PLAYWRIGHT_BROWSERS_PATH"]
            
        for year in years:
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                with sync_lock:
                    if not sync_active:
                        log_cb("[-] تم إلغاء عملية المزامنة من قبل المستخدم.")
                        break
                        
                if attempt > 1:
                    log_cb(f"[*] إعادة محاولة مزامنة سنة {year} ({attempt}/{max_retries})...")
                    import time
                    time.sleep(3)
                    
                log_cb(f"[*] بدء مزامنة سنة {year}...")
                cmd = [sys.executable, script_path, str(year), '--output-dir', base_download_dir]
                
                try:
                    with sync_lock:
                        sync_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', env=env)
                        
                    for line in iter(sync_process.stdout.readline, ''):
                        line_str = line.strip()
                        if line_str:
                            log_cb(line_str)
                            
                    sync_process.stdout.close()
                    return_code = sync_process.wait()
                    
                    with sync_lock:
                        sync_process = None
                        
                    if return_code == 0:
                        break
                    else:
                        raise Exception(f"فشل تشغيل السكربت كعملية فرعية. رمز الخروج: {return_code}")
                except Exception as e:
                    if attempt == max_retries:
                        raise e
                    else:
                        log_cb(f"[-] تنبيه: فشلت المحاولة {attempt} لمزامنة سنة {year} بسبب: {str(e)}. جاري إعادة المحاولة تلقائياً...")
                        
    except Exception as e:
        log_cb(f"[-] خطأ عام في المزامنة: {str(e)}")
    finally:
        with sync_lock:
            sync_active = False
            sync_process = None

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
        sync_active = True
            
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
        with sync_lock:
            sync_active = False
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

stats_thread = None
stats_logs = []
stats_active = False
stats_lock = threading.Lock()
stats_result = None

def run_stats_calculation(target_year, base_download_dir):
    global stats_active, stats_logs, stats_result, stats_process
    with stats_lock:
        stats_logs.clear()
        stats_result = None
        
    def log_cb(msg):
        with stats_lock:
            stats_logs.append(msg)
        write_log(msg)
            
    write_log(f"[*] بدء عملية احتساب إحصائيات سنة: {target_year}")
    try:
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            with stats_lock:
                if not stats_active:
                    log_cb("[-] تم إلغاء عملية احتساب الإحصائيات من قبل المستخدم.")
                    return
                    
            if attempt > 1:
                log_cb(f"[*] إعادة محاولة احتساب إحصائيات سنة {target_year} ({attempt}/{max_retries})...")
                import time
                time.sleep(3)
                
            try:
                import subprocess
                script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_stats.py')
                
                env = os.environ.copy()
                if "PLAYWRIGHT_BROWSERS_PATH" in env and not getattr(sys, 'frozen', False):
                    del env["PLAYWRIGHT_BROWSERS_PATH"]
                    
                cmd = [sys.executable, script_path, str(target_year), base_download_dir]
                
                with stats_lock:
                    stats_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', env=env)
                
                for line in iter(stats_process.stdout.readline, ''):
                    line_str = line.strip()
                    if not line_str:
                        continue
                    if line_str.startswith("RESULT:"):
                        try:
                            res_json = line_str[7:]
                            stats_result = json.loads(res_json)
                        except Exception as e:
                            log_cb(f"[-] خطأ في قراءة النتيجة: {e}")
                    elif line_str.startswith("ERROR:"):
                        log_cb(f"[-] خطأ: {line_str[6:]}")
                    else:
                        log_cb(line_str)
                        
                stats_process.stdout.close()
                return_code = stats_process.wait()
                
                with stats_lock:
                    stats_process = None
                    
                if return_code == 0 or stats_result:
                    break
                else:
                    raise Exception(f"فشل تشغيل السكربت كعملية فرعية. رمز الخروج: {return_code}")
                    
            except Exception as e:
                if attempt == max_retries:
                    raise e
                else:
                    log_cb(f"[-] تنبيه: فشلت المحاولة {attempt} بسبب: {str(e)}. جاري إعادة المحاولة تلقائياً...")
    except Exception as e:
        log_cb(f"[-] فشلت العملية نهائياً بعد {max_retries} محاولات: {str(e)}")
    finally:
        with stats_lock:
            stats_active = False
            stats_process = None

@app.route('/api/calculate-stats', methods=['POST'])
def api_calculate_stats():
    global stats_thread, stats_active
    data = request.get_json() or {}
    year = data.get('year')
    option = data.get('option')
    
    if not year or not option:
        return jsonify({"error": "يرجى تحديد الخيار والسنة."}), 400
        
    with stats_lock:
        if stats_active:
            return jsonify({"error": "هناك عملية احتساب إحصائيات جارية بالفعل."}), 400
        stats_active = True
            
    try:
        directory = data.get('directory')
        if not directory or not directory.strip():
            directory = get_default_workspace()
        else:
            directory = os.path.abspath(os.path.expanduser(directory.strip()))
            
        base_download_dir = os.path.join(directory, 'stats_downloads')
        
        stats_thread = threading.Thread(target=run_stats_calculation, args=(year, base_download_dir))
        stats_thread.daemon = True
        stats_thread.start()
        
        return jsonify({
            "success": True,
            "message": "بدأت عملية احتساب الإحصائيات."
        })
    except Exception as e:
        with stats_lock:
            stats_active = False
        return jsonify({"error": str(e)}), 500

@app.route('/api/calculate-stats/status', methods=['GET'])
def api_calculate_stats_status():
    with stats_lock:
        return jsonify({
            "active": stats_active,
            "logs": list(stats_logs),
            "result": stats_result
        })

@app.route('/api/logs', methods=['GET'])
def api_get_logs():
    log_path = os.path.join(engine.get_data_dir(), 'operations.log')
    if not os.path.exists(log_path):
        return jsonify({"logs": []})
    try:
        with open(log_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines()]
        return jsonify({"logs": lines})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/logs/clear', methods=['POST'])
def api_clear_logs():
    log_path = os.path.join(engine.get_data_dir(), 'operations.log')
    try:
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write("")
        write_log("[+] تم مسح سجل العمليات.")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/abort', methods=['POST'])
def api_abort():
    global stats_active, sync_active
    aborted_any = False
    
    with stats_lock:
        if stats_active:
            stats_active = False
            if stats_process:
                try:
                    import subprocess as sp
                    sp.run(['taskkill', '/F', '/T', '/PID', str(stats_process.pid)], capture_output=True)
                except Exception:
                    try:
                        stats_process.kill()
                    except Exception:
                        pass
            write_log("[-] تم إلغاء وإيقاف عملية احتساب الإحصائيات بالقوة من قبل المستخدم.")
            aborted_any = True
            
    with sync_lock:
        if sync_active:
            sync_active = False
            if sync_process:
                try:
                    import subprocess as sp
                    sp.run(['taskkill', '/F', '/T', '/PID', str(sync_process.pid)], capture_output=True)
                except Exception:
                    try:
                        sync_process.kill()
                    except Exception:
                        pass
            write_log("[-] تم إلغاء وإيقاف عملية مزامنة السجلات بالقوة من قبل المستخدم.")
            aborted_any = True
            
    return jsonify({"success": True, "aborted": aborted_any})


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
        write_log("[+] تم تحديث وحفظ إعدادات وآجال القضايا.")
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
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        write_log("[+] تم تشغيل التطبيق بنجاح.")
    app.run(host='127.0.0.1', port=5000, debug=True)
