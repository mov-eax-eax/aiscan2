@echo off
setlocal
cd /d "%~dp0"
echo Starting the DualSense study...
start "DualSense server" /min cmd /c "node serve.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8153/"
endlocal
