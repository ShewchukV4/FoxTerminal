@echo off
setlocal
if "%~1"=="" (
  echo Usage: ser your search terms
  exit /b 1
)

set "QUERY=%*"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[uri]::EscapeDataString($env:QUERY)"`) do set "encoded=%%A"

set "url=https://www.google.com/search?q=%encoded%"
if defined FIREFOX_PATH (
  start "" "%FIREFOX_PATH%" --new-tab "%url%"
) else (
  start "" "firefox" --new-tab "%url%"
)
endlocal
