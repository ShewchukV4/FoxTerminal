# ============================================================
#  foxpack  –  Pack FoxTerminal into a single shareable zip.
#
#  foxpack               -- clean zip (default settings, no personal data)
#  foxpack -Full         -- includes YOUR current binds, notes, theme
#  foxpack -Open         -- opens Desktop folder after packing
#  foxpack -OutPath <p>  -- custom output path
# ============================================================

param(
    [string]$OutPath = '',    # custom output path (optional)
    [switch]$Open,            # open output folder after packing
    [switch]$Full             # include current personal settings
)

$ErrorActionPreference = 'Stop'

function fx([string]$t, [ConsoleColor]$c = 'White') { Write-Host $t -ForegroundColor $c }
function fxd { fx ('─' * 55) 'DarkGray' }

# ── paths ────────────────────────────────────────────────────
$root      = Split-Path $PSScriptRoot -Parent
$buildsSrc = Join-Path $root 'builds\1firstbuild'

# Default output: Desktop of the current user
$desktop  = [Environment]::GetFolderPath('Desktop')
$stamp    = Get-Date -Format 'yyyyMMdd_HHmm'
$zipName  = "FoxTerminal_$stamp.zip"

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $desktop $zipName
} else {
    if (Test-Path $OutPath -PathType Container) {
        $OutPath = Join-Path $OutPath $zipName
    }
}

# ── temp staging folder ──────────────────────────────────────
# Layout inside zip (flat, next to install.ps1):
#   install.ps1
#   HOW_TO_INSTALL.txt
#   cmd\
#   sites\
#   FoxTerminal\
$tmp = Join-Path $env:TEMP "foxpack_$stamp"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

$mode = if ($Full) { 'FULL (your settings)' } else { 'CLEAN (default settings)' }
fx ''
fx "  FoxPack -- $mode" 'Cyan'
fxd

# ── copy source files to staging ─────────────────────────────
$copyFolders = @('cmd', 'sites', 'FoxTerminal')
foreach ($f in $copyFolders) {
    $src = Join-Path $root $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $tmp $f) -Recurse -Force
        fx "  + $f\" 'DarkGray'
    }
}

# ── reset configs (clean) or keep personal (full) ────────────
$enc    = [System.Text.UTF8Encoding]::new($false)
$cmdPkg = Join-Path $tmp 'cmd'

if ($Full) {
    # Keep everything as-is (already copied from source)
    fx '  > personal settings kept (binds, notes, theme)' 'DarkGray'
    # Still clear users.json for security - receiver should register themselves
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'users.json'), '{}', $enc)
    fx '  > users.json cleared (security -- receiver registers fresh)' 'DarkGray'
} else {
    # Wipe all personal data -> clean defaults
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'bindings.json'), '{}', $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'users.json'),    '{}', $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'theme.txt'),     "orange`n", $enc)
    foreach ($f in @('sp_bindings.json', 'tg_bindings.json', 'ytm_bindings.json')) {
        $p = Join-Path $cmdPkg $f
        if (Test-Path $p) { [System.IO.File]::WriteAllText($p, '{}', $enc) }
    }
    $notesPkg = Join-Path $cmdPkg 'notes'
    if (Test-Path $notesPkg) { Get-ChildItem $notesPkg | Remove-Item -Recurse -Force }
    fx '  > configs reset to clean defaults' 'DarkGray'
}

# ── copy install.ps1 into the zip root (same level as cmd\) ──
$installSrc = Join-Path $buildsSrc 'install.ps1'
if (Test-Path $installSrc) {
    Copy-Item $installSrc (Join-Path $tmp 'install.ps1') -Force
}

# Remove builds\ from the copy if it was accidentally included
$buildsInPkg = Join-Path $tmp 'builds'
if (Test-Path $buildsInPkg) { Remove-Item $buildsInPkg -Recurse -Force }

# Also create a HOW_TO_LAUNCH.txt in the zip root
$howTo = @"
=== FoxTerminal – Quick Install ===

1. Extract this zip anywhere (e.g. C:\FoxTerminal or your Desktop).
2. Run install.ps1:
   Right-click install.ps1 -> "Run with PowerShell"
   OR open PowerShell and type:
     powershell -ExecutionPolicy Bypass -File ".\install.ps1"
3. When asked, enter the target folder (or press Enter to use current folder).
4. Done!  Follow the on-screen instructions to launch.

To share with another friend: run 'foxpack' in FoxTerminal again.
"@
[System.IO.File]::WriteAllText((Join-Path $tmp 'HOW_TO_INSTALL.txt'), $howTo, $enc)

# ── create zip ───────────────────────────────────────────────
if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $OutPath)
fx "  > zip created" 'DarkGray'

# ── cleanup staging ──────────────────────────────────────────
Remove-Item $tmp -Recurse -Force

# ── result ───────────────────────────────────────────────────
$size = (Get-Item $OutPath).Length
$sizeMB = [math]::Round($size / 1MB, 2)

fx ''
fxd
fx "  DONE!" 'Green'
fx "  File  : $OutPath" 'Cyan'
fx "  Size  : ${sizeMB} MB" 'Gray'
fxd
fx ''
fx '  Send this zip to your friend.' 'Yellow'
fx '  They unzip it and run install.ps1 -- done.' 'White'
fx ''
if ($Full) {
    fx '  Included: your binds, notes, theme.  Users cleared for security.' 'DarkGray'
} else {
    fx '  Clean build: default settings, no personal data.' 'DarkGray'
    fx '  To include your settings: foxpack -Full' 'DarkGray'
}
fx ''

if ($Open) {
    Start-Process explorer.exe -ArgumentList "/select,`"$OutPath`""
}
