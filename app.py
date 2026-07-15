import os
import sys
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

if getattr(sys, 'frozen', False):
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'ms-playwright')
from flask import Flask, jsonify, request, render_template, Response
import engine
import urllib.request
import json

CURRENT_VERSION = "v1.2.3"

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
        app_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else tempfile.gettempdir()
        temp_file = os.path.join(app_dir, 'mdm_next.exe')
        
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
                if name.endswith('.exe'):
                    download_url = asset.get('browser_download_url')
                    break
                    
            if not download_url:
                download_url = html_url
                
            if latest_version and parse_version(latest_version) > parse_version(CURRENT_VERSION):
                global update_thread
                with update_lock:
                    if update_status["status"] == "idle" or (update_status["status"] == "failed" and update_status["version"] != latest_version):
                        if download_url and download_url.endswith('.exe'):
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
            return jsonify({"error": "لا يوجد تحديث جاهز للتحميل."}), 400
    try:
        app_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else tempfile.gettempdir()
        temp_file = os.path.join(app_dir, 'mdm_next.exe')
        
        if not os.path.exists(temp_file):
            return jsonify({"error": "التحديث لم يتم تحميله بعد."}), 404
            
        is_frozen = getattr(sys, 'frozen', False)
        if is_frozen:
            import subprocess
            creation_flags = (
                subprocess.DETACHED_PROCESS |
                subprocess.CREATE_NEW_PROCESS_GROUP
            )
            env = os.environ.copy()
            for var in ['TCL_LIBRARY', 'TK_LIBRARY', 'PYI_CHILD_FILE', '_MEIPASS2']:
                env.pop(var, None)
            subprocess.Popen(
                [temp_file, '/SILENT', '/SP-'],
                creationflags=creation_flags,
                close_fds=True,
                env=env
            )
            threading.Thread(target=lambda: (time.sleep(2), os._exit(0))).start()
        else:
            import subprocess
            env = os.environ.copy()
            for var in ['TCL_LIBRARY', 'TK_LIBRARY', 'PYI_CHILD_FILE', '_MEIPASS2']:
                env.pop(var, None)
            subprocess.Popen([temp_file], env=env)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_default_workspace():
    workspace = os.path.join(engine.get_data_dir(), 'مساحة العمل الافتراضية')
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

        if not os.path.exists(directory) or not os.path.isdir(directory):
            return jsonify({'error': 'Directory not found.'}), 404

        try:
            if os.name == 'nt':
                os.startfile(directory)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', directory])
            else:
                subprocess.Popen(['xdg-open', directory])
        except OSError as e:
            err_code = getattr(e, 'winerror', None)
            if err_code is None:
                err_code = getattr(e, 'errno', 'unknown')
            err_msg = str(e) if str(e) else 'OS error code {}'.format(err_code)
            return jsonify({'error': 'Failed to open folder: {}'.format(err_msg)}), 500
        except Exception as e:
            return jsonify({'error': 'Failed to open folder: {}'.format(str(e))}), 500

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/default-workspace', methods=['GET'])
def api_get_default_workspace():
    return jsonify({"directory": get_default_workspace()})

@app.route('/')
def index():
    if os.path.exists(os.path.join(app.template_folder, 'index.html')):
        return render_template('index.html', version=CURRENT_VERSION)
    return """
    <html>
        <head><title>مدير ملفات المحاكم</title></head>
        <body style='text-align:center; padding-top:10%; font-family: sans-serif;'>
            <h1>مدير ملفات المحاكم</h1>
            <p>الرجاء تشغيل التطبيق من خلال النافذة الرئيسية. اضغط على زر فتح المجلد لاستعراض الملفات.</p>
        </body>
    </html>
    """

@app.route('/api/scan', methods=['POST'])
def api_scan():
    data = request.get_json() or {}
    directory = data.get('directory')
    target_years = data.get('target_years')
    
    if not directory:
        return jsonify({"error": "مسار المجلد مطلوب."}), 400
        
    directory = os.path.expanduser(directory)
    
    dossiers, warnings = engine.scan_directory(directory, target_years=target_years)
    write_log(f"[+] تم فحص المجلد: {directory} - عدد الملفات: {len(dossiers)}")
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
    global sync_active, sync_logs, sync_dir, sync_target_years, sync_process, sync_error
    with sync_lock:
        sync_logs.clear()
        sync_dir = base_download_dir
        sync_target_years = list(years)
        sync_error = False
        
    def log_cb(msg):
        with sync_lock:
            sync_logs.append(msg)
        write_log(msg)
            
    write_log(f"[*] بدء مزامنة السجلات للسنة: {years}")
    try:
        import subprocess
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_dossiers.py')
        
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        if "PLAYWRIGHT_BROWSERS_PATH" in env and not getattr(sys, 'frozen', False):
            del env["PLAYWRIGHT_BROWSERS_PATH"]
            
        for var in ['TCL_LIBRARY', 'TK_LIBRARY', 'PYI_CHILD_FILE', '_MEIPASS2']:
            env.pop(var, None)
            
        for year in years:
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                with sync_lock:
                    if not sync_active:
                        log_cb("[-] تم إيقاف المزامنة من قبل المستخدم.")
                        break
                        
                if attempt > 1:
                    log_cb(f"[*] إعادة المحاولة ({attempt}/{max_retries}) للسنة {year}...")
                    import time
                    time.sleep(3)
                    
                log_cb(f"[*] جاري مزامنة السنة {year}...")
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
                        raise Exception(f"خطأ في المزامنة. الرمز: {return_code}")
                except Exception as e:
                    if attempt == max_retries:
                        raise e
                    else:
                        log_cb(f"[-] محاولة {attempt} فشلت: {str(e)}. جاري المحاولة التالية...")
                        
    except Exception as e:
        log_cb(f"[-] خطأ في المزامنة: {str(e)}")
        with sync_lock:
            sync_error = True
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
        return jsonify({"error": "الرجاء تحديد سنة واحدة على الأقل."}), 400
        
    with sync_lock:
        if sync_active:
            return jsonify({"error": "المزامنة جارية بالفعل."}), 400
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
            "message": "بدأت المزامنة. يمكنك متابعة التقدم من خلال السجل."
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
            "years": sync_target_years,
            "error": globals().get('sync_error', False)
        })

stats_thread = None
stats_logs = []
stats_active = False
stats_lock = threading.Lock()
stats_result = None
stats_process = None

def run_stats_calculation(target_year, base_download_dir, start_date=None, end_date=None):
    global stats_active, stats_logs, stats_result, stats_process, stats_error
    with stats_lock:
        stats_logs.clear()
        stats_result = None
        stats_error = False
        
    def log_cb(msg):
        with stats_lock:
            stats_logs.append(msg)
        write_log(msg)
            
    write_log(f"[*] بدء حساب إحصائيات الفترة: {start_date} إلى {end_date}" if start_date and end_date else f"[*] بدء حساب إحصائيات السنة: {target_year}")
    try:
        max_retries = 3
        for attempt in range(1, max_retries + 1):
            with stats_lock:
                if not stats_active:
                    log_cb("[-] تم إيقاف حساب الإحصائيات من قبل المستخدم.")
                    return
                    
            if attempt > 1:
                log_cb(f"[*] إعادة المحاولة ({attempt}/{max_retries}) للسنة {target_year}...")
                import time
                time.sleep(3)
                
            try:
                import subprocess
                script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync_stats.py')
                
                env = os.environ.copy()
                env["PYTHONUNBUFFERED"] = "1"
                if start_date:
                    env["START_DATE"] = start_date
                if end_date:
                    env["END_DATE"] = end_date
                if "PLAYWRIGHT_BROWSERS_PATH" in env and not getattr(sys, 'frozen', False):
                    del env["PLAYWRIGHT_BROWSERS_PATH"]
                    
                for var in ['TCL_LIBRARY', 'TK_LIBRARY', 'PYI_CHILD_FILE', '_MEIPASS2']:
                    env.pop(var, None)
                    
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
                    raise Exception(f"خطأ في حساب الإحصائيات. الرمز: {return_code}")
                    
            except Exception as e:
                if attempt == max_retries:
                    raise e
                else:
                    log_cb(f"[-] محاولة {attempt} فشلت: {str(e)}. جاري المحاولة التالية...")
    except Exception as e:
        log_cb(f"[-] خطأ نهائي في حساب الإحصائيات: {str(e)}")
        with stats_lock:
            stats_error = True
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
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    if not year and end_date:
        try:
            year = int(end_date.split('-')[0])
        except Exception:
            pass
            
    if not year or not option:
        return jsonify({"error": "الرجاء تحديد السنة أو الفترة والخيار."}), 400
        
    with stats_lock:
        if stats_active:
            return jsonify({"error": "حساب الإحصائيات جارٍ بالفعل."}), 400
        stats_active = True
            
    try:
        directory = data.get('directory')
        if not directory or not directory.strip():
            directory = get_default_workspace()
        else:
            directory = os.path.abspath(os.path.expanduser(directory.strip()))
            
        base_download_dir = os.path.join(directory, 'stats_downloads')
        
        stats_thread = threading.Thread(
            target=run_stats_calculation, 
            args=(year, base_download_dir),
            kwargs={"start_date": start_date, "end_date": end_date}
        )
        stats_thread.daemon = True
        stats_thread.start()
        
        return jsonify({
            "success": True,
            "message": "بدأ حساب الإحصائيات."
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
            "result": stats_result,
            "error": globals().get('stats_error', False)
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
        write_log("[+] تم مسح السجل.")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/log-client-event', methods=['POST'])
def api_log_client_event():
    data = request.get_json() or {}
    message = data.get('message')
    if message:
        write_log(f"[Client Event] {message}")
        return jsonify({"success": True})
    return jsonify({"error": "No message provided"}), 400

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
            write_log("[-] تم إيقاف حساب الإحصائيات.")
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
            write_log("[-] تم إيقاف المزامنة.")
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
        write_log("[+] تم حفظ الإعدادات.")
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
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        selected_path = filedialog.askdirectory(
            initialdir=get_default_workspace(),
            title="اختر مجلد العمل"
        )
        
        root.destroy()
        
        if selected_path:
            return jsonify({"path": selected_path})
        else:
            return jsonify({"path": None})
    except Exception as e:
        return jsonify({"error": f"خطأ في فتح نافذة اختيار المجلد: {str(e)}"}), 500

@app.route('/api/toggle-complete', methods=['POST'])
def api_toggle_complete():
    data = request.get_json() or {}
    file_path = data.get('file_path')
    full_code = data.get('full_code')
    completed = data.get('completed', False)
    
    if not file_path or not full_code:
        return jsonify({"error": "مسار الملف والرمز مطلوبان."}), 400
        
    try:
        abs_path = os.path.abspath(file_path)
        success = engine.set_case_completed(abs_path, full_code, completed)
        if success:
            return jsonify({"success": True, "completed": completed})
        return jsonify({"error": "فشل تحديث حالة الملف."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/toggle-complete-bulk', methods=['POST'])
def api_toggle_complete_bulk():
    data = request.get_json() or {}
    items = data.get('items', [])
    completed = data.get('completed', False)
    
    if not items:
        return jsonify({"error": "الرجاء تحديد ملفات."}), 400
        
    try:
        success_count = 0
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


@app.route('/api/export-excel', methods=['POST'])
def api_export_excel():
    """Save Excel HTML content by showing a native file dialog to choose path/filename.
    This works perfectly in pywebview since the server opens the dialog locally.
    """
    try:
        data = request.get_json() or {}
        html_content = data.get('content', '')
        filename = data.get('filename', 'export.xls')
        if not html_content:
            return jsonify({'error': 'No content provided'}), 400

        # Open native Tkinter save file dialog
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        file_path = filedialog.asksaveasfilename(
            initialfile=filename,
            defaultextension=".xls",
            filetypes=[("Excel Files", "*.xls"), ("All files", "*.*")],
            title="تصدير إلى Excel"
        )
        root.destroy()
        
        if not file_path:
            return jsonify({'success': False, 'cancelled': True})

        # Save to the chosen path
        with open(file_path, 'w', encoding='utf-8-sig') as f:
            f.write(html_content)

        return jsonify({'success': True, 'path': file_path, 'cancelled': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/open-file', methods=['POST'])
def api_open_file():
    """Open a file using the OS default application."""
    try:
        data = request.get_json() or {}
        file_path = data.get('path', '')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'الملف غير موجود أو المسار فارغ'}), 400

        if os.name == 'nt':
            os.startfile(file_path)
        else:
            import subprocess
            if sys.platform == 'darwin':
                subprocess.call(('open', file_path))
            else:
                subprocess.call(('xdg-open', file_path))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
        write_log("[+] تم تشغيل الخادم بنجاح.")
    app.run(host='127.0.0.1', port=5000, debug=True)
