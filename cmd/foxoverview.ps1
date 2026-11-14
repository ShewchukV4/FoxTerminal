# FOX Overview panel mode — enable / disable without FOXSTYLE GUI.
# Usage:
#   foxoverview on|off|status
#   foxoverview -Off   (alias)

param(
    [Parameter(Position = 0)]
    [ValidateSet('on', 'off', 'status', '')]
    [string]$Mode = '',
    [switch]$Off,
    [switch]$On,
    [switch]$Status,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'foxos-lib.ps1')

if ($Help) {
    Write-Host 'foxoverview on|off|status'
    Write-Host '  on   — panelMode=overview (hide taskbar while foxos-live runs; Win opens Overview)'
    Write-Host '  off  — classic panel; restore Windows taskbar'
    Write-Host '  also: %LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd'
    return
}

$featPath = Join-Path (Get-FoxOsDir) 'features.json'
$modePath = Join-Path (Get-FoxOsDir) 'overview.mode'
$bakPath = Join-Path (Get-FoxOsDir) 'overview-taskbar.bak'
$alivePath = Join-Path (Get-FoxOsDir) 'overview.alive'
$suppress = Join-Path (Get-FoxOsDir) 'overview-suppress-dock.flag'

function Read-FeaturesObj {
    if (-not (Test-Path -LiteralPath $featPath)) {
        return [ordered]@{
            version = 1; revision = 1
            overview = [ordered]@{ enabled = $false; panelMode = 'classic'; openMs = 220; closeMs = 180; stageScalePct = 86 }
        }
    }
    try {
        return (Get-Content -LiteralPath $featPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    } catch {
        return [ordered]@{
            version = 1; revision = 1
            overview = [ordered]@{ enabled = $false; panelMode = 'classic' }
        }
    }
}

function Write-FeaturesOverview([bool]$enabled) {
    $obj = Read-FeaturesObj
    if (-not $obj.overview) {
        $obj | Add-Member -NotePropertyName overview -NotePropertyValue ([pscustomobject]@{}) -Force
    }
    $obj.overview.enabled = [bool]$enabled
    $obj.overview.panelMode = $(if ($enabled) { 'overview' } else { 'classic' })
    if (-not $obj.overview.openMs) { $obj.overview | Add-Member openMs 220 -Force }
    if (-not $obj.revision) { $obj | Add-Member revision 1 -Force }
    $obj.revision = [int]$obj.revision + 1
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
    $tmp = $featPath + '.tmp'
    [IO.File]::WriteAllText($tmp, $json, [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $featPath) {
        [IO.File]::Replace($tmp, $featPath, $null)
    } else {
        Move-Item -LiteralPath $tmp -Destination $featPath -Force
    }
    $(if ($enabled) { 'on' } else { 'off' }) | Set-Content -LiteralPath $modePath -Encoding ASCII
    $sig = Join-Path (Get-FoxOsDir) 'features.signal'
    "reload $($obj.revision)" | Set-Content -LiteralPath $sig -Encoding ASCII
}

function Restore-OverviewTaskbar {
    Remove-Item -LiteralPath $suppress -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $alivePath -Force -ErrorAction SilentlyContinue
    try {
        if (-not ('FoxLookNative' -as [type])) {
            if (Get-Command Ensure-FoxLookNative -ErrorAction SilentlyContinue) {
                Ensure-FoxLookNative | Out-Null
            }
        }
        if ('FoxLookNative' -as [type]) {
            $state = 0
            if (Test-Path -LiteralPath $bakPath) {
                $raw = (Get-Content -LiteralPath $bakPath -Raw).Trim()
                [void][int]::TryParse($raw, [ref]$state)
            }
            [FoxLookNative]::SetTaskbarState($state)
            [FoxLookNative]::ShowTaskbars()
        }
    } catch {}
}

if ($Off) { $Mode = 'off' }
if ($On) { $Mode = 'on' }
if ($Status) { $Mode = 'status' }
if ([string]::IsNullOrWhiteSpace($Mode)) { $Mode = 'status' }

if ($Mode -eq 'status') {
    $flag = if (Test-Path $modePath) { (Get-Content $modePath -Raw).Trim() } else { 'off' }
    Write-Host "FOX Overview"
    Write-Host ("  mode flag   " + $flag)
    Write-Host ("  features    " + $featPath)
    Write-Host ("  live        " + $(if (Test-FoxOsLiveRunning) { 'running' } else { 'stopped' }))
    return
}

if ($Mode -eq 'on') {
    Write-FeaturesOverview $true
    Write-Host 'Overview mode ON — restart/reload foxhotkeys; foxos-live will hide taskbar.'
    Write-Host 'Lone Win toggles Overview while live is running.'
    return
}

if ($Mode -eq 'off') {
    Write-FeaturesOverview $false
    Restore-OverviewTaskbar
    Write-Host 'Overview mode OFF — Windows taskbar restored.'
    return
}
