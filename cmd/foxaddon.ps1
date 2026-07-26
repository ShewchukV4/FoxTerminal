param(
    [switch]$Install,
    [switch]$OpenFolder,
    [switch]$Pack
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$addonRoot = Join-Path $repoRoot "FoxTerminal\firefox-addon"
$installScript = Join-Path $addonRoot "native-host\install-host.ps1"
$packScript = Join-Path $addonRoot "native-host\pack-xpi.ps1"
$manifestPath = Join-Path $addonRoot "manifest.json"

if ($OpenFolder) {
    if (Test-Path $addonRoot) {
        Start-Process -FilePath "explorer.exe" -ArgumentList $addonRoot | Out-Null
        Write-Host "Opened: $addonRoot"
    } else {
        Write-Host "Addon folder not found: $addonRoot" -ForegroundColor Red
        exit 1
    }
    exit 0
}

if ($Install) {
    if (-not (Test-Path $installScript)) {
        Write-Host "Install script not found: $installScript" -ForegroundColor Red
        exit 1
    }
    powershell -NoProfile -ExecutionPolicy Bypass -File $installScript
    exit $LASTEXITCODE
}

if ($Pack) {
    if (-not (Test-Path $packScript)) {
        Write-Host "Pack script not found: $packScript" -ForegroundColor Red
        exit 1
    }
    powershell -NoProfile -ExecutionPolicy Bypass -File $packScript
    exit $LASTEXITCODE
}

Write-Host "foxaddon usage:"
Write-Host "  foxaddon -Install      # register Native Messaging host (Firefox + Zen)"
Write-Host "  foxaddon -OpenFolder   # open addon folder"
Write-Host "  foxaddon -Pack         # build .xpi for permanent install"
Write-Host ""
Write-Host "Preferred browser: Zen (see foxzen status)"
Write-Host "Load add-on in Zen:"
Write-Host "  about:debugging#/runtime/this-firefox"
Write-Host "  Load Temporary Add-on -> $manifestPath"
Write-Host "Or install signed Unlisted .xpi via about:addons"
