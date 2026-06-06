# ============================================================
#  build  <name>   --  Save a named config snapshot to builds\
#
#  Usage:
#    build mysetup          save current config as builds\mysetup\
#    build -list            list all saved builds
#    build -restore name    restore a saved build
#    build -delete  name    delete a saved build
# ============================================================

param(
    [Parameter(Position=0)]
    [string]$Action = '',

    [Parameter(Position=1)]
    [string]$NameArg = ''
)

$ErrorActionPreference = 'Stop'

# ── helpers ─────────────────────────────────────────────────
function fx([string]$t, [ConsoleColor]$c='White') { Write-Host $t -ForegroundColor $c }
function fxd { fx ('─'*55) 'DarkGray' }

# ── paths ────────────────────────────────────────────────────
$cmdDir    = $PSScriptRoot
$rootDir   = Split-Path $cmdDir -Parent
$buildsDir = Join-Path $rootDir 'builds'

# Ensure builds/ exists (it always should, but just in case)
if (-not (Test-Path $buildsDir)) {
    New-Item -ItemType Directory -Path $buildsDir -Force | Out-Null
}

# ── resolve Action / NameArg (handle "-build name" style input)
# If Action starts with a letter and NameArg is empty, it's the build name
$name = ''
$verb = ''

if ($Action -match '^-?(list|restore|delete|help)$') {
    $verb = $Matches[1].ToLower()
    $name = $NameArg
} elseif ($Action -match '^-(.+)$') {
    # "-build something" → name = "something" passed as Action
    $name = $Matches[1]
    $verb = 'save'
} elseif ($Action -ne '') {
    $name = $Action
    $verb = 'save'
} else {
    $verb = 'help'
}

# ── list ─────────────────────────────────────────────────────
if ($verb -eq 'list') {
    fx ''
    fx '  Saved builds:' 'Cyan'
    fxd
    $entries = Get-ChildItem $buildsDir -Directory -ErrorAction SilentlyContinue |
               Where-Object { $_.Name -ne '1firstbuild' }
    if (-not $entries) {
        fx '  (no saves yet -- use: build <name>)' 'DarkGray'
    } else {
        foreach ($e in $entries) {
            $meta = Join-Path $e.FullName 'meta.json'
            if (Test-Path $meta) {
                $m = Get-Content $meta -Raw | ConvertFrom-Json
                fx "  • $($e.Name)" 'Yellow'
                fx "      saved : $($m.saved_at)" 'DarkGray'
                if ($m.note) { fx "      note  : $($m.note)" 'DarkGray' }
            } else {
                fx "  • $($e.Name)" 'Gray'
            }
        }
    }
    fx ''
    return
}

# ── help ─────────────────────────────────────────────────────
if ($verb -eq 'help') {
    fx ''
    fx '  build <name>            save current config snapshot' 'White'
    fx '  build -list             list all saved builds' 'White'
    fx '  build -restore <name>   restore a build (overwrite current cfg)' 'White'
    fx '  build -delete  <name>   delete a saved build' 'White'
    fx ''
    fx '  Reserved name: 1firstbuild (factory defaults)' 'DarkGray'
    fx ''
    return
}

# ── validate name ─────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($name)) {
    fx ''
    fx '  [!] No build name specified.  Usage: build <name>' 'Red'
    fx '      Run  build -list  to see existing builds.' 'DarkGray'
    fx ''
    exit 1
}

# Sanitise: only letters, digits, hyphen, underscore, dot
$name = $name.Trim()
if ($name -notmatch '^[a-zA-Z0-9_\-\.]+$') {
    fx ''
    fx "  [!] Invalid name '$name'." 'Red'
    fx "      Use only letters, digits, - _ ." 'DarkGray'
    fx ''
    exit 1
}

if ($name -eq '1firstbuild') {
    fx ''
    fx "  [!] The name '1firstbuild' is reserved for the factory installer." 'Red'
    fx "      Please choose a different name." 'DarkGray'
    fx ''
    exit 1
}

$buildPath = Join-Path $buildsDir $name

# ── delete ───────────────────────────────────────────────────
if ($verb -eq 'delete') {
    if (-not (Test-Path $buildPath)) {
        fx ''
        fx "  [!] Build '$name' not found." 'Red'
        fx ''
        exit 1
    }
    Remove-Item $buildPath -Recurse -Force
    fx ''
    fx "  Deleted build: $name" 'Green'
    fx ''
    return
}

# ── restore ──────────────────────────────────────────────────
if ($verb -eq 'restore') {
    if (-not (Test-Path $buildPath)) {
        fx ''
        fx "  [!] Build '$name' not found.  Run  build -list  to see saves." 'Red'
        fx ''
        exit 1
    }

    fx ''
    fx "  Restoring build '$name'..." 'Cyan'

    $enc = [System.Text.UTF8Encoding]::new($false)

    # bindings
    $bSrc = Join-Path $buildPath 'bindings.json'
    if (Test-Path $bSrc) {
        Copy-Item $bSrc (Join-Path $cmdDir 'bindings.json') -Force
        fx '    > bindings.json restored' 'DarkGray'
    }

    # extra bindings
    foreach ($f in @('sp_bindings.json','tg_bindings.json','ytm_bindings.json')) {
        $p = Join-Path $buildPath $f
        if (Test-Path $p) {
            Copy-Item $p (Join-Path $cmdDir $f) -Force
            fx "    > $f restored" 'DarkGray'
        }
    }

    # theme
    $tSrc = Join-Path $buildPath 'theme.txt'
    if (Test-Path $tSrc) {
        Copy-Item $tSrc (Join-Path $cmdDir 'theme.txt') -Force
        fx '    > theme.txt restored' 'DarkGray'
    }

    # notes
    $nSrc = Join-Path $buildPath 'notes'
    if (Test-Path $nSrc) {
        $nDst = Join-Path $cmdDir 'notes'
        if (-not (Test-Path $nDst)) { New-Item -ItemType Directory -Path $nDst -Force | Out-Null }
        Copy-Item (Join-Path $nSrc '*') $nDst -Recurse -Force
        fx '    > notes/ restored' 'DarkGray'
    }

    fx ''
    fx "  Build '$name' restored successfully." 'Green'
    fx '  (Restart FoxTerminal for all changes to take effect)' 'DarkGray'
    fx ''
    return
}

# ── SAVE ─────────────────────────────────────────────────────
if (Test-Path $buildPath) {
    fx ''
    fx "  Build '$name' already exists." 'Yellow'
    Write-Host '  Overwrite? (y/N) > ' -ForegroundColor Cyan -NoNewline
    $confirm = Read-Host
    if ($confirm -notmatch '^[yY]') {
        fx '  Cancelled.' 'DarkGray'
        fx ''
        return
    }
    Remove-Item $buildPath -Recurse -Force
}

New-Item -ItemType Directory -Path $buildPath -Force | Out-Null

$enc = [System.Text.UTF8Encoding]::new($false)

# bindings.json
$bSrc = Join-Path $cmdDir 'bindings.json'
if (Test-Path $bSrc) {
    Copy-Item $bSrc $buildPath -Force
    fx "  + bindings.json" 'DarkGray'
}

# extra bindings
foreach ($f in @('sp_bindings.json','tg_bindings.json','ytm_bindings.json')) {
    $p = Join-Path $cmdDir $f
    if (Test-Path $p) {
        Copy-Item $p $buildPath -Force
        fx "  + $f" 'DarkGray'
    }
}

# theme
$tSrc = Join-Path $cmdDir 'theme.txt'
if (Test-Path $tSrc) {
    Copy-Item $tSrc $buildPath -Force
    fx "  + theme.txt  ($(Get-Content $tSrc -Raw | ForEach-Object { $_.Trim() }))" 'DarkGray'
}

# notes
$nSrc = Join-Path $cmdDir 'notes'
if (Test-Path $nSrc) {
    Copy-Item $nSrc (Join-Path $buildPath 'notes') -Recurse -Force
    fx "  + notes/" 'DarkGray'
}

# meta.json
$meta = [ordered]@{
    name     = $name
    saved_at = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    note     = ''
    fox_ver  = '1.0'
}
$meta | ConvertTo-Json -Depth 3 | ForEach-Object {
    [System.IO.File]::WriteAllText((Join-Path $buildPath 'meta.json'), $_, $enc)
}

fx ''
fxd
fx "  Build '$name' saved to:" 'Green'
fx "    $buildPath" 'Cyan'
fxd
fx ''
fx "  Commands:" 'Yellow'
fx "    build -list              -- see all builds" 'White'
fx "    build -restore $name     -- restore this build" 'White'
fx "    build -delete  $name     -- delete this build" 'White'
fx ''
