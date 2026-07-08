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
    # Single instance check (Windows only)
    if os.name == 'nt':
        import ctypes
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
