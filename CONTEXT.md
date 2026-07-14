# Mahkama Dossier Manager — Session Context & Fix Plan

**Last updated:** 2026-07-10  \
**Windows machine:** NGL\neger, Tailscale IP `100.90.226.13`  \
**SSH auth:** ed25519 key-based, passwordless  \
**Project path (Windows):** `D:\MYP\Mahkama-Dossier-Manager`  \
**Distributed exe path (current):** `C:\Users\neger\dist\Mahkama Dossier Manager.exe`  \
**Project repo:** `hsami7/Mahkama-Dossier-Manager` (GitHub)  \
**Current pushed `origin/main` head:** `13386b0` (stale — does not contain the most recent Windows launcher/logging fixes)  \
**Python on Windows:** `py -3` => `C:\Users\neger\AppData\Local\Programs\Python\Python313\python.exe`  \
**PyInstaller spec:** `D:\MYP\Mahkama-Dossier-Manager\mahkama.spec`

---

## 1. Architecture

```
D:\MYP\Mahkama-Dossier-Manager/
├── dist/
│   └── Mahkama Dossier Manager.exe    ← compiled PyWebView single exe
├── app.py                             ← Flask backend
├── engine.py                          ← business logic
├── launcher.py                        ← startup: port pick, Flask thread, PyWebView window
├── sync_dossiers.py                   ← CLI sync tool
├── sync_stats.py                      ← CLI stats tool
├── templates/
├── static/
├── mahkama.spec
└── setup.iss
```

**Backend:** Flask on `127.0.0.1:<random-port>`  \
**Frontend:** PyWebView loads `http://127.0.0.1:<port>/`

---

## 2. Windows-Launcher Contract

The launcher owns **all** single-instance and navigation behavior. The frontend/Flask side must not assume it can open new top-level windows.

Required launcher behavior:
- **No mutex dialogs.** We removed the single-instance mutex/Taskbar block entirely after multiple zombie/abandoned-mutex incidents.
- **No `webview.api` at import time.** `webview.api` is created lazily by pywebview after `create_window()`; referencing it at module scope raises `AttributeError`.
- **Feature clicks must navigate the existing window.** Replace any `create_window(route)` with `evaluate_js(...)` or `load_url(...)` on the existing single window.
- **New-window requests must be blocked.** `on_new_window` should return `None` if the backend needs it.
- **Flask must be ready before the window opens.** Poll `http://127.0.0.1:<port>/` before creating the webview to avoid blank UI.
- **GUI backend on Windows:** pass `gui="edge"` to `webview.start(...)`, not to `create_window()`.

---

## 3. What We Fixed (2026-07-10)

### 3.1 Launch crash: `AttributeError: module 'webview' has no attribute 'api'`
- **Root cause:** `launcher.py` line 153 had `api = webview.api` at module import time.
- **Fix:** Remove that reference. The working launcher pattern is `webview.create_window(...)` + `webview.start(...)`, without `webview.api`.
- **Status:** Verified fixed in rebuilt exe at `C:\Users\neger\dist\Mahkama Dossier Manager.exe`. User confirmed successful launch screenshots.

### 3.2 Blank/broken UI on launch
- **Root cause:** PyWebView window was created before Flask was bound to the chosen port.
- **Fix:** Launcher now picks a free port, starts the Flask thread, then polls `http://127.0.0.1:<port>/` before calling `webview.create_window(...)`.
- **Status:** Fix included in rebuilt exe.

### 3.3 “New window / false already-open dialog”
- **Behavior:** Clicking a feature in the UI opened a second app instance, which then triggered the single-instance dialog.
- **Root cause:** The feature-click path called `webview.create_window(feature_route)` instead of navigating the existing webview instance.
- **Fix attempted in code:** Replaced `create_window(...)` on feature click with `window.evaluate_js(...)` navigation on the existing single window.
- **Deployment catch:** Earlier copied `launcher_fix.py` to Windows, but an SCP-style copy failed silently; the deployed file did not actually contain the fix. Only later did we confirm via SSH read-back that `create_window()` was still present and the mutex block was still present.
- **Mitigations in place now:**
  - Instrumented launcher logs every `NAVIGATE_*`, `SECOND_INSTANCE_*`, `NEW_WINDOW_*`, and process start event.
  - JS guard `static/js/single_window_guard.js` is prepended to the HTML to log client-side click / `window.open` / `location.href` changes.
  - `/api/log-client` endpoint accepts client events.
- **Current status:** Code-side launcher guard is fixed. Empirical test pending. We need the test log from `C:\Users\neger\.mahkama\launcher_full.log` to confirm whether the second instance is now prevented, or whether the page itself still has a `window.open(...)`/form-based new-window trigger that needs a frontend patch.

### 3.4 Full user-action logging (/queue request)
- **User request verbatim:** “/queue can force the logs to save everything so we gonna see what happen exactly so to write any small thing even my clicks”
- **Implemented:**
  - `/api/log-client` in `app.py` stores client events.
  - Frontend guard posts clicks / navigation attempts / `window.open` targets to `/api/log-client`.
  - Launcher writes startup, navigation, second-instance, and exit events to `~/.mahkama/launcher_full.log`.

---

## 4. Blocked / Unresolved As Of End Of 2026-07-10

1. **New-instance spawn still needs empirical proof.**
   - Do not blindly rebuild again — inspect `C:\Users\neger\.mahkama\launcher_full.log` after clicking a feature once.

2. **`proc_45b2a7f5d647` build failure.**
   - A prior `PyInstaller` run for `mahkama.spec` failed with `SyntaxError: no binding for nonlocal 'navigation_in_progress' found`.
   - The current deployed `launcher.py` `LINE153` is now safe and the next build should be clean. Recheck only if build output shows syntax errors.

3. **Statistics/v1.1.5 module.**
   - `app_v115.py` and descriptor strings are extracted locally. Integration into current `app.py` is *not* performed until the new-instance issue is confirmed closed, to avoid changing too many variables at once.

4. **Frontend template scan.**
   - `templates/index.html` and `static/js/main.js` have not shown `window.open` or `target="_blank"` in the sections inspected so far, but full scan is still pending.

5. **git push state.**
   - The current `origin/main` head `13386b0` is stale relative to the Windows-deployed source. No push has been done with the final instrumented launcher + JS guard.

---

## 5. Test Protocol

1. Close all running copies of the app.
2. Run `C:\Users\neger\dist\Mahkama Dossier Manager.exe` by double-click.
3. Click one feature once.
4. Close the app and paste:
   - `C:\Users\neger\.mahkama\launcher_full.log`
   - The first 20 interesting lines from the in-app operations/log view, if any.

That data is the next diagnostic input. Rebuilds without data are noise.

---

## 6. Key Local Files

| Path | Purpose |
|---|---|
| `/tmp/mahkama_push` | VPS clone of repo for inspect/search |
| `/tmp/launcher_instrumented_full.py` | Instrumented launcher source with logging + second-instance guard |
| `/tmp/js_guard.js` | Frontend click/window.open/location.href guard |
| `/tmp/launcher_new6.py` | Cleaner no-nonlocal launcher variant |
| `/tmp/mahkama_push/app.py` | Repo app.py with `/api/log-client` added |
| `/tmp/mahkama_push/templates/index.html` | Patched to load `single_window_guard.js` |

---

## 7. Stable Rules Going Forward

- Never reference `webview.api` at module scope in `launcher.py`.
- Never use `create_window(...)` from the feature-click handler.
- Always verify copy-to-Windows result with an SSH read-back before rebuilding.
- Launch the desktop window only from an interactive user session; SSH-launched Python is fine for testing API behavior, but not for validating window creation.
