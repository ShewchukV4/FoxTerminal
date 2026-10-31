# foxdoctor - diagnostyka Systemy Foks na tsomu PK (paths, deps, configs, processes).
# Does not erase personal data. -Fix only safely restores overlay / duplicate processes.
# Ukrainian messages below are ASCII-safe where needed for Windows PowerShell 5.1.

param(
    [switch]$Fix,
    [switch]$Quiet,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

. (Join-Path $PSScriptRoot 'foxsys-lib.ps1')
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'foxos-lib.ps1')) {
    . (Join-Path $PSScriptRoot 'foxos-lib.ps1')
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'ghostty-lib.ps1')) {
    . (Join-Path $PSScriptRoot 'ghostty-lib.ps1')
}

$script:issues = New-Object System.Collections.Generic.List[object]

function Add-Issue([string]$Id, [string]$Level, [string]$Message, [string]$Action) {
    $script:issues.Add([pscustomobject]@{
        id = $Id; level = $Level; message = $Message; action = $Action
    }) | Out-Null
}

function Write-Line([string]$t, [ConsoleColor]$c = 'Gray') {
    if (-not $Quiet -and -not $Json) { Write-Host $t -ForegroundColor $c }
}

$root = $null
try {
    if (Get-Command Get-FoxRoot -ErrorAction SilentlyContinue) {
        $root = Get-FoxRoot
    } else {
        $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    }
} catch {
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

Write-Line ''
Write-Line '  Sistema Foks / Fox System - foxdoctor' 'Cyan'
Write-Line ('  root: ' + $root) 'DarkGray'
Write-Line ('-' * 56) 'DarkGray'

# 1) Repo root
if (-not (Test-Path -LiteralPath (Join-Path $root 'cmd'))) {
    Add-Issue 'root' 'error' 'Repo root has no cmd\' 'Unpack/clone FoxTerminal and run install.ps1 again.'
} else {
    Write-Line '  [ok] repo root' 'Green'
}

# 2) Runtime dirs + write
$runtime = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos'
$sys = Join-Path $env:LOCALAPPDATA 'FoxTerminal'
foreach ($d in @($sys, $runtime)) {
    try {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
        $probe = Join-Path $d ('.foxwrite-' + [guid]::NewGuid().ToString('N'))
        'ok' | Set-Content -LiteralPath $probe -Encoding ASCII
        Remove-Item -LiteralPath $probe -Force
        Write-Line ('  [ok] write ' + $d) 'Green'
    } catch {
        Add-Issue 'runtime-write' 'error' ("Cannot write to $d") 'Check permissions on %LOCALAPPDATA%\FoxTerminal.'
    }
}

# 3-4) Overlay + Ghostty
$overlay = Join-Path $env:LOCALAPPDATA 'winghostty\config\foxterminal-local.ghostty'
if (-not (Test-Path -LiteralPath $overlay)) {
    $overlay = Join-Path $env:LOCALAPPDATA 'winghostty\foxterminal-local.ghostty'
}
$ghostty = $null
if (Get-Command Get-GhosttyCommand -ErrorAction SilentlyContinue) {
    try {
        $g = Get-GhosttyCommand
        if ($g -is [string]) { $ghostty = $g }
        elseif ($g -and $g.Path) { $ghostty = [string]$g.Path }
        elseif ($g -and $g.Exe) { $ghostty = [string]$g.Exe }
        elseif ($g -and $g.Source) { $ghostty = [string]$g.Source }
    } catch {}
}
if (-not $ghostty -or -not (Test-Path -LiteralPath $ghostty)) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\winghostty\winghostty.exe'),
        (Join-Path $env:LOCALAPPDATA 'winghostty\bin\winghostty.exe'),
        (Join-Path $env:ProgramFiles 'winghostty\winghostty.exe'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\winghostty.exe')
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { $ghostty = $c; break }
    }
}
if ($ghostty -and (Test-Path -LiteralPath $ghostty)) {
    Write-Line ('  [ok] Ghostty: ' + $ghostty) 'Green'
} elseif (Test-Path -LiteralPath $overlay) {
    Write-Line '  [ok] Ghostty overlay present (exe path unresolved in PATH)' 'Green'
} else {
    Add-Issue 'ghostty' 'error' 'Ghostty/winghostty not found' 'winget install AmanThanvi.winghostty then FoxTerminal\install.ps1'
}

if (Test-Path -LiteralPath $overlay) {
    $ov = Get-Content -LiteralPath $overlay -Raw -ErrorAction SilentlyContinue
    if ($ov -and $root -and ($ov -notlike ("*" + $root + "*")) -and $ov -match '[A-Za-z]:\\') {
        Add-Issue 'overlay-path' 'warn' 'Ghostty overlay points to another repo path' 'Re-run install.ps1 from current root (rewrites local overlay).'
        if ($Fix -and (Test-Path -LiteralPath (Join-Path $root 'FoxTerminal\install.ps1'))) {
            Write-Line '  -> Fix: install.ps1 -Force -NoShortcut -NoLogonStart' 'Yellow'
            try {
                & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'FoxTerminal\install.ps1') -Force -NoShortcut -NoLogonStart | Out-Null
            } catch {}
        }
    } else {
        Write-Line '  [ok] Ghostty overlay' 'Green'
    }
} else {
    Add-Issue 'overlay-missing' 'warn' 'Missing foxterminal-local.ghostty' 'Run FoxTerminal\install.ps1'
}

# 5) csc
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (Test-Path -LiteralPath $csc) {
    Write-Line '  [ok] csc.exe (.NET Framework 4.x)' 'Green'
} else {
    Add-Issue 'csc' 'warn' 'csc.exe missing - native windows will not build' 'Enable .NET Framework 4.8 Developer Pack / Features.'
}

# 6) Fonts
$fontHit = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts') -Filter '*Caskaydia*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $fontHit) {
    $fontHit = Get-ChildItem -Path (Join-Path $env:WINDIR 'Fonts') -Filter '*Caskaydia*' -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($fontHit) { Write-Line '  [ok] CaskaydiaCove font' 'Green' }
else { Add-Issue 'font' 'warn' 'CaskaydiaCove Nerd Font not found' 'foxdeps -Install or install the font manually' }

# 7) style.json validity
$stylePath = Join-Path $runtime 'style.json'
if (Test-Path -LiteralPath $stylePath) {
    try {
        $null = Get-Content -LiteralPath $stylePath -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-Line '  [ok] style.json valid' 'Green'
    } catch {
        Add-Issue 'style-json' 'error' 'style.json damaged' 'Backup file, then open foxstyle (defaults) or restore a slot.'
        if ($Fix) {
            $bak = $stylePath + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss')
            Copy-Item -LiteralPath $stylePath -Destination $bak -Force
            Write-Line ('  -> Fix: backup ' + $bak) 'Yellow'
        }
    }
} else {
    Write-Line '  [..] style.json not yet (created by FOXSTYLE)' 'DarkGray'
}

# 8) Duplicate background processes
foreach ($name in @('foxos-live', 'foxnodes', 'foxstyle')) {
    $procs = @(Get-Process -Name $name -ErrorAction SilentlyContinue)
    if ($procs.Count -gt 1) {
        Add-Issue ("dup-$name") 'warn' ("Multiple ${name} processes: $($procs.Count)") 'Close extras or: foxdoctor -Fix'
        if ($Fix) {
            $procs | Sort-Object StartTime -Descending | Select-Object -Skip 1 | ForEach-Object {
                try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
            }
            Write-Line ("  -> Fix: extra $name stopped") 'Yellow'
        }
    } elseif ($procs.Count -eq 1) {
        Write-Line ("  [ok] $name x1") 'Green'
    }
}

# 9) Bindings path check
$bindPath = Join-Path $PSScriptRoot 'bindings.json'
if (Test-Path -LiteralPath $bindPath) {
    try {
        $binds = Get-Content -LiteralPath $bindPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $missing = 0
        if ($binds) {
            foreach ($p in $binds.PSObject.Properties) {
                $val = [string]$p.Value
                if ($val -match '^[A-Za-z]:\\' -and -not (Test-Path -LiteralPath $val)) { $missing++ }
            }
        }
        if ($missing -gt 0) {
            Add-Issue 'bindings' 'warn' ("bindings.json has $missing missing path(s)") 'bbind / foxsetup / Node Launcher path picker.'
        } else {
            Write-Line '  [ok] bindings paths' 'Green'
        }
    } catch {
        Add-Issue 'bindings-json' 'warn' 'bindings.json unreadable' 'Fix JSON or reset via foxpack clean.'
    }
}

# 10) Autostart duplicates
try {
    $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match 'FoxTerminal|Ghostty|FoxOS' })
    if ($tasks.Count -gt 2) {
        Add-Issue 'autostart' 'warn' ("Many Fox scheduled tasks: $($tasks.Count)") 'Keep one logon task; remove extras in Task Scheduler.'
    }
} catch {}

Write-Line ('-' * 56) 'DarkGray'
$errN = @($script:issues | Where-Object { $_.level -eq 'error' }).Count
$warnN = @($script:issues | Where-Object { $_.level -eq 'warn' }).Count
if ($errN -eq 0 -and $warnN -eq 0) {
    Write-Line '  OK - no critical issues.' 'Green'
} else {
    Write-Line ("  Found: $errN error, $warnN warn") 'Yellow'
    foreach ($i in $script:issues) {
        $col = 'Yellow'
        if ($i.level -eq 'error') { $col = 'Red' }
        Write-Line ("  [$($i.level)] $($i.id): $($i.message)") $col
        Write-Line ("           -> $($i.action)") 'DarkGray'
    }
}
Write-Line ''
Write-Line '  Next: foxsetup  |  foxdeps -Install  |  foxpack -Profile export' 'DarkGray'
Write-Line ''

if ($Json) {
    [pscustomobject]@{
        root = $root
        runtime = $runtime
        ghostty = $ghostty
        issues = @($script:issues)
        errors = $errN
        warns = $warnN
    } | ConvertTo-Json -Depth 6
}

exit $(if ($errN -gt 0) { 1 } else { 0 })
