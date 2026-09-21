@echo off
rem ============================================================
rem Hatch - local prototype workbench (Vite dev server) autostart
rem Idempotent: skips start if port 5173 is already listening.
rem Logs: d:\newproject\dev_stdout.log / dev_stderr.log
rem Stop:  taskkill /F /IM node.exe   (or close PID shown by netstat)
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) { Start-Process -WindowStyle Hidden -FilePath 'cmd' -ArgumentList '/c','npm run dev -- --port 5173 --strictPort > dev_stdout.log 2> dev_stderr.log' -WorkingDirectory 'd:\newproject' }"
