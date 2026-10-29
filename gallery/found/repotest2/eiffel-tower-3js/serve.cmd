@echo off
REM Serve this folder over HTTP so the page can be opened at http://localhost:8080/
REM Useful if your browser refuses to load local scripts from a file:// URL.
setlocal
cd /d "%~dp0"

where py >nul 2>nul && (
  echo Serving %CD% on http://localhost:8080/
  py -m http.server 8080
  goto :eof
)

where python >nul 2>nul && (
  echo Serving %CD% on http://localhost:8080/
  python -m http.server 8080
  goto :eof
)

where npx >nul 2>nul && (
  echo Serving %CD% on http://localhost:8080/
  npx --yes http-server -p 8080 -c-1
  goto :eof
)

echo No Python or npx found. Install Python, or just double-click index.html.
pause
