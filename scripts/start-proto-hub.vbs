' ============================================================
' Autostart entry for Hatch (local prototype workbench).
' Runs the start script fully hidden after a short delay so the
' system is ready. Copy/keep this file in the Startup folder:
'   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
' ============================================================
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
WScript.Sleep 10000
sh.Run """d:\newproject\scripts\start-proto-hub.bat""", 0, False
