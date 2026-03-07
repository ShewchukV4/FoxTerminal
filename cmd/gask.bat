@echo off
setlocal
if "%~1"=="" (
  echo Usage: gask your question
  exit /b 1
)

set "QUERY=%*"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[uri]::EscapeDataString($env:QUERY)"`) do set "encoded=%%A"

set "url=https://chatgpt.com/?q=%encoded%"
if defined FIREFOX_PATH (
  start "" "%FIREFOX_PATH%" --new-tab "%url%"
) else (
  start "" "firefox" --new-tab "%url%"
)
endlocal
