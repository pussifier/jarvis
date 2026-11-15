Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
Name "JARVIS"
OutFile "release/JARVIS-1.0.0-Windows-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\JARVIS"
RequestExecutionLevel user
SetCompressor /SOLID zlib
BrandingText "JARVIS Desktop"
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "JARVIS"
VIAddVersionKey "FileDescription" "JARVIS Desktop Setup"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "JARVIS Desktop contributors"
!define MUI_ICON "build/icon.ico"
!define MUI_UNICON "build/icon.ico"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\JARVIS.exe"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "JARVIS requires 64-bit Windows 10 or Windows 11."
    Abort
  ${EndIf}
  SetShellVarContext current
  ; Keep installation in a fixed per-user application directory, never a vault or project folder.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\JARVIS"
FunctionEnd

Section "JARVIS desktop application (required)" AppSection
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "release/win-unpacked/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\JARVIS"
  CreateShortcut "$SMPROGRAMS\JARVIS\JARVIS.lnk" "$INSTDIR\JARVIS.exe"
  CreateShortcut "$SMPROGRAMS\JARVIS\Uninstall JARVIS.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "DisplayName" "JARVIS Desktop"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "DisplayIcon" "$INSTDIR\JARVIS.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop" "NoRepair" 1
SectionEnd

Section "Desktop shortcut" DesktopSection
  CreateShortcut "$DESKTOP\JARVIS.lnk" "$INSTDIR\JARVIS.exe"
SectionEnd

Function un.onInit
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\JARVIS"
FunctionEnd
Section "Uninstall"
  Delete "$DESKTOP\JARVIS.lnk"
  Delete "$SMPROGRAMS\JARVIS\JARVIS.lnk"
  Delete "$SMPROGRAMS\JARVIS\Uninstall JARVIS.lnk"
  RMDir "$SMPROGRAMS\JARVIS"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JARVISDesktop"
  RMDir /r "$INSTDIR"
  ; %APPDATA%\JARVIS and the user's Documents workspace are intentionally preserved.
SectionEnd
