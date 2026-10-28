@echo off
rem Serve the model over http (ES modules cannot load from file://) and open the browser.
cd /d "%~dp0"
start "" http://127.0.0.1:8147/index.html
node serve.js
