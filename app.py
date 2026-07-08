import os
from flask import Flask, jsonify, request, render_template
import engine

app = Flask(__name__, template_folder='templates', static_folder='static')

def get_default_workspace():
    desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
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
@app.route('/api/sync', methods=['POST'])
def api_sync():
    data = request.get_json() or {}
    years = data.get('years', [])
    
    if not years:
        return jsonify({"error": "يرجى تحديد سنة واحدة على الأقل."}), 400
        
    try:
        import sync_dossiers
        base_download_dir = os.path.join(os.getcwd(), "data", "downloads")
        
        for year in years:
            try:
                yr_int = int(year)
                sync_dossiers.sync_dossiers(yr_int, output_dir=base_download_dir, debug=False)
            except ValueError:
                continue
                
        return jsonify({
            "success": True,
            "directory": base_download_dir,
            "years": years
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        import gi
        gi.require_version('Gtk', '3.0')
        from gi.repository import Gtk
        
        # Initialize GTK
        Gtk.init(None)
        
        dialog = Gtk.FileChooserDialog(
            title="اختر مجلد ملفات المحاكم",
            action=Gtk.FileChooserAction.SELECT_FOLDER
        )
        dialog.add_button("إلغاء", Gtk.ResponseType.CANCEL)
        dialog.add_button("اختيار المجلد", Gtk.ResponseType.OK)
        
        # Set default folder
        dialog.set_current_folder(get_default_workspace())
        dialog.set_keep_above(True)
        
        selected_path = None
        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            selected_path = dialog.get_filename()
            
        dialog.destroy()
        
        # Flush GTK main loop events
        while Gtk.events_pending():
            Gtk.main_iteration_do(False)
            
        return jsonify({"path": selected_path})
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
