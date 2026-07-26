param(
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

$addonRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $addonRoot "manifest.json"))) {
    $addonRoot = $PSScriptRoot
}

$manifestPath = Join-Path $addonRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Host "manifest.json not found near script." -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path $addonRoot "dist"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$version = if ($manifest.version) { $manifest.version } else { "0.0.0" }
$xpiPath = Join-Path $OutDir "foxterminal-companion-$version.xpi"

if (Test-Path $xpiPath) {
    Remove-Item -Force $xpiPath
}

$include = @(
    "manifest.json",
    "background.js",
    "themes.js",
    "popup.html",
    "popup.js",
    "styles.css",
    "sidebar.html",
    "sidebar.js",
    "sidebar.css",
    "translate-overlay.js"
)

$staging = Join-Path $env:TEMP ("foxterminal-addon-pack-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
    foreach ($name in $include) {
        $src = Join-Path $addonRoot $name
        if (-not (Test-Path $src)) {
            Write-Host "Missing file: $name" -ForegroundColor Yellow
            continue
        }
        Copy-Item -Path $src -Destination (Join-Path $staging $name) -Force
    }

    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath ($xpiPath + ".zip") -Force
    Move-Item -Force -Path ($xpiPath + ".zip") -Destination $xpiPath
}
finally {
    Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
}

Write-Host "Packed: $xpiPath"
Write-Host ""
Write-Host "NOTE: Temporary add-ons from about:debugging are removed on Firefox restart."
Write-Host "Permanent install options:"
Write-Host "  1) Firefox Developer Edition / Nightly:"
Write-Host "     about:config -> xpinstall.signatures.required = false"
Write-Host "     about:addons -> gear -> Install Add-on From File -> this .xpi"
Write-Host "  2) Regular Firefox: sign as Unlisted on https://addons.mozilla.org/developers/"
Write-Host "     then install the signed .xpi from file."
