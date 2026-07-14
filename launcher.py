import os, sys, time, logging, tempfile, ctypes, shutil, subprocess

if getattr(sys, 'frozen', False):
    meipass = getattr(sys, '_MEIPASS', '')
    if meipass:
        if os.path.exists(os.path.join(meipass, 'tcl_data')):
            os.environ['TCL_LIBRARY'] = os.path.join(meipass, 'tcl_data')
        if os.path.exists(os.path.join(meipass, 'tk_data')):
            os.environ['TK_LIBRARY'] = os.path.join(meipass, 'tk_data')

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import threading, socket, urllib.request, webview
from app import app

LOG_PATH = os.path.join(os.path.expanduser('~'), '.mahkama', 'launcher_full.log')
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
logging.basicConfig(
    filename=LOG_PATH, level=logging.DEBUG,
    format='%(asctime)s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S', encoding='utf-8'
)
log = logging.getLogger('mahkama')
log.debug('LOGGER_INITIALIZED')

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def wait_for_flask(port, timeout=15):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            r = urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5)
            if r.status < 500:
                return True
        except Exception as e:
            last = e
        time.sleep(0.2)
    raise RuntimeError(f'Flask not ready in {timeout}s: {last}')

def start_server(port):
    flask_log = logging.getLogger('werkzeug')
    try:
        flask_log.setLevel(logging.ERROR)
    except Exception:
        pass
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--install-browsers':
        print("Installing Playwright Chromium browser... please wait.")
        try:
            import playwright.__main__
            sys.argv = ["playwright", "install", "chromium"]
            playwright.__main__.main()
            print("Successfully installed Playwright Chromium browser!")
            sys.exit(0)
        except Exception as e:
            print(f"Error installing browsers: {e}")
            sys.exit(1)

    if len(sys.argv) > 1 and any(s in sys.argv[1] for s in ('sync_dossiers.py', 'sync_stats.py')):
        script = sys.argv[1]
        log.debug(f'SUBPROCESS_RUN_SCRIPT: {script}')
        sys.argv = sys.argv[1:]
        try:
            with open(script, 'r', encoding='utf-8') as f:
                code = f.read()
            globs = {
                '__name__': '__main__',
                '__file__': script,
                '__package__': None,
                '__doc__': None,
            }
            exec(compile(code, script, 'exec'), globs)
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            log.error(f'SUBPROCESS_RUN_SCRIPT_ERROR: {e}\n{tb}')
            print(f"Error running script {script}: {e}\n{tb}", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)

    if len(sys.argv) >= 4 and sys.argv[1] == '--replace-and-start':
        target_path = sys.argv[2]
        old_pid = int(sys.argv[3])
        log.debug(f'SELF_UPDATE_START old_pid={old_pid} target={target_path}')
        if os.name == 'nt':
            SYNCHRONIZE = 0x00100000
            h = None
            try:
                h = ctypes.windll.kernel32.OpenProcess(SYNCHRONIZE, False, old_pid)
                if h:
                    ctypes.windll.kernel32.WaitForSingleObject(h, 15000)
            except Exception as e:
                log.debug(f'SELF_UPDATE_WAIT_FAILED: {e}')
            finally:
                if h:
                    try:
                        ctypes.windll.kernel32.CloseHandle(h)
                    except Exception:
                        pass
        else:
            for _ in range(100):
                try:
                    os.kill(old_pid, 0)
                    time.sleep(0.1)
                except OSError:
                    break
        for _ in range(30):
            try:
                shutil.copy2(sys.executable, target_path)
                break
            except Exception:
                time.sleep(0.5)
        try:
            p = os.path.join(os.path.dirname(sys.executable), 'mdm_next.exe')
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass
        try:
            log.debug(f'SELF_UPDATE_LAUNCH target={target_path}')
            subprocess.Popen([target_path])
        except Exception as e:
            log.debug(f'SELF_UPDATE_LAUNCH_FAILED: {e}')
        sys.exit(0)

    if os.name == 'nt':
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('HatimSami.MahkamaDossierManager')
        except Exception:
            pass

    log.debug(f'PROCESS_START pid={os.getpid()} ppid={os.getppid()} frozen={getattr(sys, "frozen", False)} exe={sys.executable}')
    log.debug(f'ARGS={sys.argv}')

    if getattr(sys, 'frozen', False):
        try:
            update_helper = os.path.join(os.path.dirname(sys.executable), 'mdm_next.exe')
            if os.path.exists(update_helper):
                os.remove(update_helper)
        except Exception:
            pass
        os.chdir(sys._MEIPASS)
        log.debug(f'CHDIR_MEIPASS={sys._MEIPASS}')

    port = get_free_port()
    log.debug(f'FLASK_PORT={port}')
    t = threading.Thread(target=start_server, args=(port,), daemon=True)
    t.start()

    try:
        wait_for_flask(port, timeout=15)
    except Exception as e:
        log.debug(f'FLASK_START_FAILED: {e}')
        print(f'ERROR: Flask did not start: {e}')
        sys.exit(1)

    url = f'http://127.0.0.1:{port}/'
    start_kwargs = dict(title='مدير ملفات المحاكم', url=url, width=1200, height=800, text_select=True, maximized=True)
    log.debug(f'WEBVIEW_KWARGS={start_kwargs}')

    window = None

    def navigate_to(route):
        if not window:
            log.debug('NAVIGATE_SKIP no_window')
            return
        try:
            if route and (route.startswith('http://') or route.startswith('/') or route.startswith('https://')):
                log.debug(f'NAVIGATE load_url route={route}')
                window.load_url(route)
            elif route:
                js = ("(()=>{let tries=0;while(tries<20&&!(window.location&&window.location.href)){tries++;new Promise(r=>setTimeout(r,50)).then(()=>{});}window.location.href='" + route.replace("'", "\\'") + "';})()")
                log.debug(f'NAVIGATE evaluate_js route={route}')
                window.evaluate_js(js)
        except Exception as e:
            log.debug(f'NAVIGATE_ERROR route={route} err={e}')
            print(f'navigation error: {e}')

    def on_second_instance(args):
        log.debug(f'SECOND_INSTANCE_BLOCKED args={args}')
        try:
            if window:
                window.show()
                window.restore()
        except Exception:
            pass
        return []

    def on_new_window(window_id, url):
        log.debug(f'NEW_WINDOW_BLOCKED window_id={window_id} url={url}')
        return None

    try:
        window = webview.create_window(**start_kwargs)
        log.debug('WEBVIEW_CREATED')
        webview.start(
            debug=False,
            gui='edge' if os.name == 'nt' else None,
            http_server=False,
            second_instance=on_second_instance,
            on_new_window=on_new_window,
            user_agent='MahkamaDossierManager/1.0'
        )
        log.debug('WEBVIEW_START_RETURNED')
    except TypeError as te:
        if 'unexpected keyword argument' in str(te):
            log.debug('WEBVIEW_START_FALLBACK_UNSUPPORTED_KWARG')
            try:
                webview.start(
                    lambda *a, **kw: log.debug(f'FALLBACK_START_CB args={a} kwargs={kw}') or [],
                    debug=False, gui='edge' if os.name == 'nt' else None
                )
                log.debug('WEBVIEW_START_RETURNED_FALLBACK')
            except Exception as e2:
                log.debug(f'WEBVIEW_START_FAILED_FALLBACK: {e2}')
                print(f'ERROR: webview fallback failed: {e2}')
                sys.exit(1)
        else:
            raise
    except Exception as e:
        log.debug(f'WEBVIEW_START_FAILED: {e}')
        print(f'ERROR: failed to start webview: {e}')
        try:
            log.debug('WEBVIEW_FALLBACK_START')
            window = webview.create_window(**start_kwargs)
            webview.start(debug=False)
            log.debug('WEBVIEW_FALLBACK_RETURNED')
        except Exception as e2:
            log.debug(f'WEBVIEW_FALLBACK_FAILED: {e2}')
            print(f'ERROR: webview fallback also failed: {e2}')
            sys.exit(1)
