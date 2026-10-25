# FoxNodes - radial node launcher overlay (global hotkey daemon).
# Usage:
#   foxnodes              start daemon (or toggle if already running)
#   foxnodes -Status      paths + hotkey
#   foxnodes -Settings    config editor (standalone)
#   foxnodes -Show         show/activate persistent desktop graph
#   foxnodes -Hide         hide graph (daemon stays alive)
#   foxnodes -Stop         quit daemon
#   foxnodes -Rebuild     force csc rebuild

param(
    [switch]$Status,
    [switch]$Settings,
    [switch]$Show,
    [switch]$Hide,
    [switch]$Stop,
    [switch]$SelfTest,
    [switch]$Rebuild,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "foxos-lib.ps1")

function Get-FoxNodesSources {
    $list = @(Join-Path $PSScriptRoot "foxos-sdk.cs")
    $list += Join-Path $PSScriptRoot "fox-assistant.cs"
    $list += Join-Path $PSScriptRoot "fox-stt.cs"
    $list += Join-Path $PSScriptRoot "fox-understand.cs"
    $mod = Join-Path $PSScriptRoot "foxnodes"
    $list += @(Get-ChildItem -LiteralPath $mod -Filter "*.cs" | Sort-Object Name | ForEach-Object { $_.FullName })
    return $list
}

function Get-FoxNodesExe {
    return (Join-Path (Get-FoxOsDir) "foxnodes.exe")
}

function Test-FoxNodesStale {
    $exe = Get-FoxNodesExe
    if (-not (Test-Path -LiteralPath $exe)) { return $true }
    $exeTime = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
    foreach ($src in (Get-FoxNodesSources)) {
        if ((Get-Item -LiteralPath $src).LastWriteTimeUtc -gt $exeTime) { return $true }
    }
    return $false
}

function Ensure-FoxNodesBuilt {
    param([switch]$Force)
    $sources = @(Get-FoxNodesSources)
    $exe = Get-FoxNodesExe
    if (-not $Force -and -not (Test-FoxNodesStale)) { return $true }
    Get-Process -Name "foxnodes" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 200
    $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path -LiteralPath $csc)) {
        Write-Host "csc.exe missing - cannot build foxnodes."
        return $false
    }
    $out = Join-Path (Get-FoxOsDir) "foxnodes.build.log"
    $args = @(
        "/nologo",
        "/target:winexe",
        "/optimize+",
        "/codepage:65001",
        ("/out:" + $exe),
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Web.Extensions.dll",
        "/r:System.Web.dll",
        '/r:"C:\Program Files (x86)\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8\System.Speech.dll"'
    ) + $sources
    $p = Start-Process -FilePath $csc -ArgumentList $args -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $out -RedirectStandardError ($out + ".err")
    if ((Test-Path -LiteralPath $exe) -and $p.ExitCode -eq 0) { return $true }
    Write-Host "foxnodes build failed. See:"
    Write-Host ("  " + $out)
    Write-Host ("  " + $out + ".err")
    return $false
}

if ($Help) {
    Write-Host "foxnodes - Node Launcher (Ctrl+Alt+Space)"
    Write-Host "  foxnodes           start / activate on desktop"
    Write-Host "  foxnodes -Settings editor"
    Write-Host "  foxnodes -Show     show persistent desktop graph"
    Write-Host "  foxnodes -Hide     explicit hide (the graph otherwise persists)"
    Write-Host "  foxnodes -Stop"
    return
}

if ($Status) {
    $foxUser = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($foxUser)) {
        $userFile = Join-Path $PSScriptRoot "current_user.txt"
        if (Test-Path -LiteralPath $userFile) { $foxUser = ([IO.File]::ReadAllText($userFile)).Trim() }
    }
    if ([string]::IsNullOrWhiteSpace($foxUser)) { $foxUser = "local" }
    $cfg = Join-Path $env:LOCALAPPDATA ("FoxTerminal\foxos\apps\foxnodes\" + $foxUser + "\launcher.json")
    Write-Host "FoxNodes"
    Write-Host ("  exe     " + (Get-FoxNodesExe))
    Write-Host ("  config  " + $cfg)
    $run = Get-Process -Name "foxnodes" -ErrorAction SilentlyContinue
    if ($run) { Write-Host ("  daemon  running (pid " + $run.Id + ")") }
    else { Write-Host "  daemon  (not running)" }
    return
}

if (-not (Ensure-FoxNodesBuilt -Force:$Rebuild)) { return }
$exe = Get-FoxNodesExe

if ($SelfTest) {
    $log = Join-Path (Get-FoxOsDir) "foxnodes-selftest.log"
    Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $exe -ArgumentList @('"' + $PSScriptRoot + '"', "-SelfTest") -Wait
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log }
    else { throw "FoxNodes self-test did not produce a result." }
    return
}

$argList = @('"' + $PSScriptRoot + '"')
if ($Settings) { $argList += "-Settings" }
$daemonRunning = [bool](Get-Process -Name "foxnodes" -ErrorAction SilentlyContinue)
if ($Show -and $daemonRunning) { $argList += "-Show" }
if ($Hide) { $argList += "-Hide" }

if ($Stop) {
    & $exe @("-Stop")
    return
}

Start-Process -FilePath $exe -ArgumentList $argList | Out-Null
if (Get-Command Write-FoxToast -ErrorAction SilentlyContinue) {
    Write-FoxToast "FoxNodes - Ctrl+Alt+Space"
}
