@chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0friend.ps1" %*
