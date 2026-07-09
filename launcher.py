import os
import sys
import threading
import socket
import webview
from app import app

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def start_server(port):
    # Disable werkzeug logging
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    # Handle self-updater replace-and-start command
    if len(sys.argv) >= 4 and sys.argv[1] == '--replace-and-start':
        target_path = sys.argv[2]
        old_pid = int(sys.argv[3])
        
        # Wait for the old process to exit
        import time
        for _ in range(100): # Wait up to 10 seconds
            try:
                os.kill(old_pid, 0)
                time.sleep(0.1)
            except OSError:
                break
                
        # Copy this running executable to overwrite the old one
        import shutil
        this_exe = sys.executable
        copied = False
        for _ in range(20): # Try up to 10 seconds in case of file locks
            try:
                shutil.copy2(this_exe, target_path)
                copied = True
                break
            except Exception:
                time.sleep(0.5)
                
        # Launch the updated executable
        if copied:
            import subprocess
            try:
                subprocess.Popen([target_path])
            except Exception:
                pass
        sys.exit(0)

    # Single instance check and Taskbar grouping (Windows only)
    if os.name == 'nt':
        import ctypes
        from ctypes import wintypes
        
        # Set explicit AppUserModelID to group taskbar icons and shortcuts correctly
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("HatimSami.MahkamaDossierManager")
        except Exception:
            pass

        # Try to find the existing window of an old instance and close it
        window_title = "مدير ملفات المحاكم (Mahkama Dossier Manager)"
        hwnd = ctypes.windll.user32.FindWindowW(None, window_title)
        if hwnd:
            # Ask user before closing the running instance
            ret = ctypes.windll.user32.MessageBoxW(
                None, 
                "هناك نسخة مفتوحة بالفعل من التطبيق. هل ترغب في إغلاقها تلقائياً للمتابعة؟", 
                "تنبيه - مدير ملفات المحاكم", 
                0x24 # MB_YESNO | MB_ICONQUESTION (0x04 | 0x20)
            )
            if ret == 6: # IDYES
                # Get the process ID of the window
                pid = wintypes.DWORD()
                ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                
                # Send WM_CLOSE (0x0010) gracefully
                ctypes.windll.user32.PostMessageW(hwnd, 0x0010, 0, 0)
                
                # Wait up to 2 seconds for it to exit
                import time
                for _ in range(20):
                    if not ctypes.windll.user32.IsWindow(hwnd):
                        break
                    time.sleep(0.1)
                
                # If still alive, terminate the process
                if ctypes.windll.user32.IsWindow(hwnd) and pid.value > 0:
                    PROCESS_TERMINATE = 0x0001
                    h_process = ctypes.windll.kernel32.OpenProcess(PROCESS_TERMINATE, False, pid.value)
                    if h_process:
                        ctypes.windll.kernel32.TerminateProcess(h_process, 0)
                        ctypes.windll.kernel32.CloseHandle(h_process)
                        time.sleep(0.5) # Wait for OS to clean up mutex
            else:
                sys.exit(0)

        mutex_name = "Global\\MahkamaDossierManager_SingleInstance_Mutex"
        global _single_instance_mutex
        _single_instance_mutex = ctypes.windll.kernel32.CreateMutexW(None, True, mutex_name)
        if ctypes.windll.kernel32.GetLastError() == 183: # ERROR_ALREADY_EXISTS
            ctypes.windll.user32.MessageBoxW(
                None, 
                "التطبيق قيد التشغيل بالفعل. يرجى إغلاق النسخة المفتوحة أولاً.", 
                "تنبيه - مدير ملفات المحاكم", 
                0x30 # MB_ICONWARNING
            )
            sys.exit(0)

    # When running as compiled executable, set working dir properly
    if getattr(sys, 'frozen', False):
        os.chdir(sys._MEIPASS)
        
    port = get_free_port()
    
    # Start the Flask app in a background thread
    t = threading.Thread(target=start_server, args=(port,))
    t.daemon = True
    t.start()
    
    # Create and start the PyWebView window
    url = f"http://127.0.0.1:{port}/"
    webview.create_window(
        title="مدير ملفات المحاكم (Mahkama Dossier Manager)", 
        url=url, 
        width=1200, 
        height=800,
        text_select=True
    )
    
    webview.start()
