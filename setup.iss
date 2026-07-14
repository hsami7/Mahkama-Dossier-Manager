#define AppName "Mahkama Dossier Manager"
#define AppVersion "1.2.1"
#define AppPublisher "Hatim Sami"
#define AppPublisherURL "https://hatimsami.engineer/"
#define AppExeName "Mahkama Dossier Manager.exe"

[Setup]
; Unique AppId to identify this program across updates
AppId={{9B78A52C-28D4-459D-B642-B3E34E28A466}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppPublisherURL}
DefaultDirName={localappdata}\Programs\{#AppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Mahkama_Dossier_Manager_Setup
SetupIconFile=app_icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
DisableDirPage=no
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "dist\Mahkama Dossier Manager\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "app_icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\إدارة ملفات المحاكم"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\إدارة ملفات المحاكم"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Parameters: "--install-browsers"; StatusMsg: "Installing Chromium browser required for dossier synchronization (please wait)..."; Flags: runhidden
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent
