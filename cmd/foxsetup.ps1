# foxsetup - Fox System setup wizard on this PC.
# Base system works without AI/STT. Models are never auto-downloaded here.
param(
    [switch]$Doctor,
    [switch]$SkipFirstBoot,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'foxauth.ps1')
. (Join-Path $PSScriptRoot 'ghostty-lib.ps1')
. (Join-Path $PSScriptRoot 'foxsys-lib.ps1')

if ($Help) {
    Write-Host 'foxsetup - Fox System wizard'
    Write-Host '  foxsetup              full wizard'
    Write-Host '  foxsetup -Doctor      foxdoctor only'
    Write-Host '  foxsetup -SkipFirstBoot'
    exit 0
}

if ($Doctor) {
    & (Join-Path $PSScriptRoot 'foxdoctor.ps1')
    exit $LASTEXITCODE
}

function fx([string]$t, [ConsoleColor]$c = 'White') { Write-Host $t -ForegroundColor $c }
function fxd { fx ('-' * 56) 'DarkGray' }

$root = Get-FoxRoot
$runtime = Get-FoxOsRuntimeDir

Clear-FoxHost
fx ''
fx '  Fox System - setup wizard' 'Cyan'
fx '  FoxTerminal = terminal | FoxOS = desktop | FOXSTYLE = studio' 'DarkGray'
fxd

fx '  [1/8] Environment' 'Yellow'
fx ("  root: $root") 'DarkGray'
fx ("  runtime: $runtime") 'DarkGray'
& (Join-Path $PSScriptRoot 'foxdoctor.ps1') -Quiet
if ($LASTEXITCODE -ne 0) {
    fx '  Issues found - details: foxdoctor' 'Yellow'
} else {
    fx '  Diagnostics: OK' 'Green'
}
fxd

fx '  [2/8] Components' 'Yellow'
$idx = Select-Menu 'Desktop FoxOS + foxlook' @('Yes', 'No')
$wantDesktop = ($idx -ne 1)
$idx = Select-Menu 'Node Launcher (foxnodes)' @('Yes', 'No')
$wantNodes = ($idx -ne 1)
$idx = Select-Menu 'AI (Ollama) - optional' @('No', 'Yes')
$wantAi = ($idx -eq 1)
$idx = Select-Menu 'Ukrainian STT (whisper) - large, optional' @('No', 'Yes')
$wantStt = ($idx -eq 1)
fxd

fx '  [3/8] Dependencies' 'Yellow'
$idx = Select-Menu 'Install deps now (foxdeps -Install)?' @('Yes', 'Later')
if ($idx -ne 1) {
    try { & (Join-Path $PSScriptRoot 'foxdeps.ps1') -Install } catch { fx $_.Exception.Message 'Yellow' }
} else {
    fx '  Skipped. Later: foxdeps -Install' 'DarkGray'
}
if ($wantStt) { fx '  STT: after login run foxstt -Install (not in this wizard).' 'DarkGray' }
if ($wantAi) { fx '  AI: install Ollama separately; qwen3-vl optional.' 'DarkGray' }
fxd

fx '  [4/8] Profile' 'Yellow'
$idx = Select-Menu 'Profile' @('New (first boot)', 'Import foxpack profile', 'Skip')
if ($idx -eq 0 -and -not $SkipFirstBoot) {
    if (Invoke-FoxFirstBoot) { Complete-FoxSession -Fresh }
} elseif ($idx -eq 1) {
    $path = Read-Host 'Path to .foxprofile.zip'
    if (-not [string]::IsNullOrWhiteSpace($path)) {
        & (Join-Path $PSScriptRoot 'foxpack.ps1') -ImportProfile $path
    }
} else {
    fx '  Profile skipped.' 'DarkGray'
}
fxd

fx '  [5/8] Apps and binds' 'Yellow'
$bindPath = Join-Path $PSScriptRoot 'bindings.json'
if (Test-Path -LiteralPath $bindPath) {
    try {
        $binds = Get-Content -LiteralPath $bindPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $bad = @()
        if ($binds) {
            foreach ($p in $binds.PSObject.Properties) {
                $val = [string]$p.Value
                if ($val -match '^[A-Za-z]:\\' -and -not (Test-Path -LiteralPath $val)) { $bad += $p.Name }
            }
        }
        if ($bad.Count -gt 0) {
            fx ('  Missing paths: ' + ($bad -join ', ')) 'Yellow'
            fx '  Fix via bbind or FOXSTYLE Node Launcher.' 'DarkGray'
        } else {
            fx '  Binding paths look valid.' 'Green'
        }
    } catch { fx '  bindings.json unreadable.' 'Yellow' }
} else {
    fx '  No bindings.json - OK for clean start.' 'DarkGray'
}
fxd

fx '  [6/8] Screens and performance' 'Yellow'
try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $screens = [System.Windows.Forms.Screen]::AllScreens
    fx ("  monitors: $($screens.Count)") 'DarkGray'
    $i = 0
    foreach ($s in $screens) {
        $b = $s.Bounds
        fx ("  [$i] $($b.Width)x$($b.Height) @($($b.X),$($b.Y)) primary=$($s.Primary)") 'DarkGray'
        $i++
    }
} catch { fx '  Could not query screens.' 'DarkGray' }

$perf = Select-Menu 'Animation preset (FOXSTYLE motion)' @('balanced', 'economy', 'smooth', 'off', 'Later in FOXSTYLE')
if ($perf -ge 0 -and $perf -le 3) {
    $names = @('balanced', 'economy', 'smooth', 'off')
    $preset = $names[$perf]
    $stylePath = Join-Path $runtime 'style.json'
    try {
        $doc = $null
        if (Test-Path -LiteralPath $stylePath) {
            $doc = Get-Content -LiteralPath $stylePath -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        if (-not $doc) {
            $doc = [pscustomobject]@{ version = '1'; name = 'FoxOS Dark'; preset = 'dark'; motion = [pscustomobject]@{} }
        }
        if (-not $doc.motion) {
            $doc | Add-Member -NotePropertyName motion -NotePropertyValue ([pscustomobject]@{}) -Force
        }
        $doc.motion | Add-Member -NotePropertyName preset -NotePropertyValue $preset -Force
        $doc.motion | Add-Member -NotePropertyName enabled -NotePropertyValue ($preset -ne 'off') -Force
        $scale = 'full'
        if ($preset -eq 'off') { $scale = 'off' }
        elseif ($preset -eq 'economy') { $scale = 'reduced' }
        $doc.motion | Add-Member -NotePropertyName scale -NotePropertyValue $scale -Force
        $utf8 = New-Object System.Text.UTF8Encoding $false
        $tmp = $stylePath + '.tmp'
        if (Test-Path -LiteralPath $stylePath) {
            Copy-Item -LiteralPath $stylePath -Destination ($stylePath + '.bak-setup') -Force
        }
        [System.IO.File]::WriteAllText($tmp, ($doc | ConvertTo-Json -Depth 12), $utf8)
        Move-Item -LiteralPath $tmp -Destination $stylePath -Force
        fx ("  motion.preset = $preset") 'Green'
    } catch {
        fx ('  style.json write failed: ' + $_.Exception.Message) 'Yellow'
        fx '  Open FOXSTYLE -> Animations.' 'DarkGray'
    }
}
fxd

fx '  [7/8] Start layers' 'Yellow'
if ($wantDesktop) {
    $idx = Select-Menu 'Enable FoxOS now (foxos on)?' @('Yes', 'Later')
    if ($idx -ne 1) {
        try { & (Join-Path $PSScriptRoot 'foxos.ps1') on } catch { fx $_.Exception.Message 'Yellow' }
    }
    fx '  NOTE: foxlook shell on is NOT enabled by this wizard.' 'DarkGray'
}
if ($wantNodes) {
    $idx = Select-Menu 'Start Node Launcher (foxnodes)?' @('Yes', 'Later')
    if ($idx -ne 1) {
        try { & (Join-Path $PSScriptRoot 'foxnodes.ps1') } catch { fx $_.Exception.Message 'Yellow' }
    }
}
fxd

fx '  [8/8] Summary - next steps' 'Cyan'
fx '  1. In Ghostty: l user pass  ->  home' 'White'
fx '  2. Look: foxstyle  -> Animations' 'White'
fx '  3. Menu: foxnodes (Ctrl+Alt+Space)' 'White'
fx '  4. Check: foxdoctor  |  FoxTerminal/windows/VERIFY_ALL.md' 'White'
fx '  5. Transfer: foxpack -Profile export / -ImportProfile' 'White'
fx '  6. AI/STT only if needed: ollama / foxstt -Install' 'White'
fxd
fx '  Done.' 'Green'
fx ''
