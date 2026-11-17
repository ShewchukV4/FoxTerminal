param([ValidateSet('install','load','status')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Seelen UI requires Windows.' }
$theme = Join-Path (Split-Path $PSScriptRoot -Parent) 'integrations\seelen\fox-glass'
if ($Action -eq 'install') {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Install Windows App Installer (winget) first.' }
    & winget install --id Seelen.SeelenUI --exact
    if ($LASTEXITCODE -ne 0) { throw "Seelen installer exited with $LASTEXITCODE. FOX settings were not changed." }
    Write-Host 'Open Seelen UI, then run foxseelen load in a new terminal.'
    return
}
$slu = Get-Command slu -ErrorAction SilentlyContinue
if ($Action -eq 'status') {
    Write-Host ('Seelen CLI available: ' + [bool]$slu)
    Write-Host ('FOX theme: ' + $theme)
    Write-Host 'foxseelen install | foxseelen load'
    return
}
if (-not $slu) { throw 'Start Seelen UI and open a new terminal so slu is on PATH.' }
& $slu.Source resource load theme $theme
if ($LASTEXITCODE -ne 0) { throw 'Theme registration failed. FOX settings were not changed.' }
Write-Host 'FOX Glass is registered for this Seelen session. Select it in Seelen settings; install it there for persistence.'
Write-Host 'Desktop handover is not automatic yet. Do not enable overlapping FOX and Seelen dock/window managers together.'
