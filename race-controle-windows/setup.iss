#define MyAppName "RACE CONTROLE VCE"
#define MyAppVersion "2.0.0"
#define MyAppExeName "Race-Controle-VCE.exe"

[Setup]
AppId={{5D07D135-EB8C-4EE3-B299-330986A6D695}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=VCE ESPORT
DefaultDirName={localappdata}\Programs\Race Controle VCE
DefaultGroupName=RACE CONTROLE VCE
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\release
OutputBaseFilename=Race-Controle-VCE-Setup
SetupIconFile=..\agent\vce.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
ChangesAssociations=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"

[Files]
Source: "..\agent\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\RACE CONTROLE VCE"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\RACE CONTROLE VCE"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Lancer RACE CONTROLE VCE"; Flags: nowait postinstall skipifsilent
