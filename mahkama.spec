# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_all

pw_datas, pw_binaries, pw_hiddenimports = collect_all('playwright')

block_cipher = None

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[] + pw_binaries,
    datas=[
        ('app.py', '.'),
        ('engine.py', '.'),
        ('sync_dossiers.py', '.'),
        ('sync_stats.py', '.'),
        ('templates/*', 'templates/'),
        ('static/css/*', 'static/css/'),
        ('static/js/*', 'static/js/'),
        ('static/img/*', 'static/img/')
    ] + pw_datas,
    hiddenimports=['webview', 'flask', 'engine', 'sync_dossiers', 'sync_stats'] + pw_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Mahkama Dossier Manager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False, # Set to False so it doesn't open a cmd window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app_icon.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Mahkama Dossier Manager',
)
