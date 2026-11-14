# Logic checks for Fox features config / headphone state rules (no Bluetooth required).
param()
$ErrorActionPreference = 'Stop'
$failed = 0
function Assert([bool]$cond, [string]$msg) {
    if ($cond) { Write-Host ("  OK  " + $msg) -ForegroundColor Green }
    else { Write-Host ("  FAIL " + $msg) -ForegroundColor Red; $script:failed++ }
}

Write-Host 'Fox features logic checks'

# Normalize defaults
Add-Type -Path (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\System.Web.Extensions.dll') -ErrorAction SilentlyContinue
# Lightweight JSON checks via PowerShell objects mirroring FoxFeaturesDoc
$doc = @{
    version = 1
    revision = 1
    mixer = @{ enabled = $true }
    actionWheel = @{
        enabled = $false
        ctrl = $true; alt = $true; shift = $false; win = $false
        key = 'W'; sizeDip = 168; deadZoneDip = 28
        sectors = @(
            @{ id='mixer'; kind='internal'; command='vol'; order=0 }
            @{ id='playpause'; kind='media'; command='playpause'; order=1 }
            @{ id='next'; kind='media'; command='next'; order=2 }
            @{ id='shot'; kind='internal'; command='screenshot'; order=3 }
        )
    }
    headphones = @{
        enabled = $false
        deviceId = ''
        autoResume = $false
        debounceMs = 700
        resumeStabilizeMs = 1200
        resumeOfferSec = 45
    }
}

Assert ($doc.actionWheel.sectors.Count -eq 4) 'default wheel has 4 sectors'
Assert ($doc.headphones.autoResume -eq $false) 'autoResume defaults off'
Assert ($doc.mixer.enabled -eq $true) 'mixer defaults on'
Assert ($doc.actionWheel.enabled -eq $false) 'wheel defaults off (no surprise hotkey)'

# Pause selection rule: only Playing + Pause (never PlayPause)
function Should-Pause([string]$status, [bool]$active) {
    return $active -and ($status -eq 'Playing')
}
Assert (Should-Pause 'Playing' $true) 'playing session → pause candidate'
Assert (-not (Should-Pause 'Paused' $true)) 'already paused → no pause'
Assert (-not (Should-Pause 'Playing' $false)) 'inactive → no pause'

# Device match rule
function Device-Match([string]$watched, [string]$eventId) {
    if ([string]::IsNullOrWhiteSpace($watched)) { return $false }
    return $watched.Equals($eventId, [StringComparison]::OrdinalIgnoreCase)
}
Assert (Device-Match 'dev-A' 'dev-A') 'same device matches'
Assert (-not (Device-Match 'dev-A' 'dev-B')) 'other device ignored'
Assert (-not (Device-Match '' 'dev-A')) 'empty watch ignores all'

# Resume offer window
function Offer-Valid([datetime]$pausedAt, [int]$sec) {
    return (([datetime]::UtcNow) - $pausedAt).TotalSeconds -le $sec
}
Assert (Offer-Valid ([datetime]::UtcNow.AddSeconds(-10)) 45) 'offer inside window'
Assert (-not (Offer-Valid ([datetime]::UtcNow.AddSeconds(-90)) 45)) 'offer expired'

# Atomic features path
$feat = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos\features.json'
$dir = Split-Path $feat
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$tmp = $feat + '.logic-test.tmp'
'{ "version":1,"revision":1 }' | Set-Content -LiteralPath $tmp -Encoding UTF8
Assert (Test-Path -LiteralPath $tmp) 'can write features tmp'
Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue

if ($failed -gt 0) {
    Write-Host ("FAILED: $failed") -ForegroundColor Red
    exit 1
}
Write-Host 'All logic checks passed.' -ForegroundColor Green
exit 0
