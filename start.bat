@echo off
cd /d "%~dp0"
start "" /b cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8080/"
python -m http.server 8080
