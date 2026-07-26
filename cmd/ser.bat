@echo off
setlocal
if "%~1"=="" (
  echo Usage: ser your search terms
  exit /b 1
)

set "QUERY=%*"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[uri]::EscapeDataString($env:QUERY)"`) do set "encoded=%%A"
set "url=https://www.google.com/search?q=%encoded%"

for /f "usebackq delims=" %%B in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ". '%~dp0fox-browser.ps1'; Resolve-FoxBrowserPath"`) do set "BROWSER=%%B"

if defined BROWSER (
  start "" "%BROWSER%" --new-tab "%url%"
) else (
  start "" "zen" --new-tab "%url%"
)
endlocal
