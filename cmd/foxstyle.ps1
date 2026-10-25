# FOXSTYLE - native FoxOS look studio (like foxlife).
# Usage:
#   foxstyle              compile (if needed) and open the window
#   foxstyle -Status      print style.json path
#   foxstyle -Rebuild     force csc rebuild
#   foxstyle -Preset neon write preset then open

param(
    [ValidateSet('dark','light','neon','foxpurple','custom')]
    [string]$Preset,
    [string]$Apply,
    [string]$Export,
    [switch]$Status,
    [switch]$Rebuild,
    [switch]$NodeEditor,
    [switch]$SelfTest,
    [switch]$Gui,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "foxos-lib.ps1")
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "foxauth.ps1")) {
    . (Join-Path $PSScriptRoot "foxauth.ps1")
}

function Get-FoxStyleSources {
    $list = @(Join-Path $PSScriptRoot "foxos-sdk.cs")
    $list += Join-Path $PSScriptRoot "fox-assistant.cs"
    $list += Join-Path $PSScriptRoot "fox-stt.cs"
    $list += Join-Path $PSScriptRoot "fox-understand.cs"
    $mod = Join-Path $PSScriptRoot "foxstyle"
    $list += @(Get-ChildItem -LiteralPath $mod -Filter "*.cs" | Sort-Object Name | ForEach-Object { $_.FullName })
    return $list
}

function Get-FoxStyleExe {
    return (Join-Path (Get-FoxOsDir) "foxstyle.exe")
}

function Get-FoxStyleJson {
    return (Join-Path (Get-FoxOsDir) "style.json")
}

function Test-FoxStyleStale {
    $exe = Get-FoxStyleExe
    if (-not (Test-Path -LiteralPath $exe)) { return $true }
    $exeTime = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
    foreach ($src in (Get-FoxStyleSources)) {
        if ((Get-Item -LiteralPath $src).LastWriteTimeUtc -gt $exeTime) { return $true }
    }
    return $false
}

function Ensure-FoxStyleBuilt {
    param([switch]$Force)
    $sources = @(Get-FoxStyleSources)
    $exe = Get-FoxStyleExe
    if (-not $Force -and -not (Test-FoxStyleStale)) { return $true }
    Get-Process -Name "foxstyle" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 200
    $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path -LiteralPath $csc)) {
        Write-Host "csc.exe missing - cannot build FOXSTYLE."
        return $false
    }
    $out = Join-Path (Get-FoxOsDir) "foxstyle.build.log"
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
    Write-Host "foxstyle build failed. See:"
    Write-Host ("  " + $out)
    Write-Host ("  " + $out + ".err")
    if (Test-Path -LiteralPath ($out + ".err")) { Get-Content ($out + ".err") -ErrorAction SilentlyContinue }
    if (Test-Path -LiteralPath $out) { Get-Content $out -ErrorAction SilentlyContinue | Select-Object -Last 40 }
    return $false
}

function Open-FoxStyle {
    if (-not (Ensure-FoxStyleBuilt -Force:$Rebuild)) { return $false }
    $exe = Get-FoxStyleExe
    $args = @(('"' + $PSScriptRoot + '"'))
    if ($NodeEditor) { $args += "-NodeEditor" }
    Start-Process -FilePath $exe -ArgumentList $args | Out-Null
    if (Get-Command Write-FoxToast -ErrorAction SilentlyContinue) {
        Write-FoxToast "FOXSTYLE"
    }
    return $true
}

if ($Help) {
    @"
FOXSTYLE - native look studio for FoxOS

  foxstyle                 open window
  foxstyle -Rebuild        force rebuild
  foxstyle -Status         style.json path
  foxstyle -NodeEditor     open visual Node Launcher editor
  foxstyle -SelfTest       editor model checks (no window)
  foxstyle -Preset neon    copy preset to style.json, then open
  foxstyle -Apply file.json
  foxstyle -Export [path]
"@ | Write-Host
    return
}

if ($Status) {
    Write-Host "FOXSTYLE"
    Write-Host ("  exe    " + (Get-FoxStyleExe))
    Write-Host ("  style  " + (Get-FoxStyleJson))
    Write-Host ("  built  " + (-not (Test-FoxStyleStale)))
    return
}

if ($Apply) {
    if (-not (Test-Path -LiteralPath $Apply)) { throw "File not found: $Apply" }
    New-Item -ItemType Directory -Force -Path (Get-FoxOsDir) | Out-Null
    Copy-Item -LiteralPath $Apply -Destination (Get-FoxStyleJson) -Force
    Write-Host ("applied -> " + (Get-FoxStyleJson))
    Open-FoxStyle | Out-Null
    return
}

if ($PSBoundParameters.ContainsKey('Export')) {
    $src = Get-FoxStyleJson
    if (-not (Test-Path -LiteralPath $src)) { throw "No style.json yet - open foxstyle and Apply first." }
    $out = if ([string]::IsNullOrWhiteSpace($Export)) {
        Join-Path ([Environment]::GetFolderPath('Desktop')) ("foxstyle-" + (Get-Date -Format 'yyyyMMdd-HHmm') + ".json")
    } else { $Export }
    Copy-Item -LiteralPath $src -Destination $out -Force
    Write-Host ("exported -> " + $out)
    return
}

if ($SelfTest) {
    if (-not (Ensure-FoxStyleBuilt -Force:$Rebuild)) { throw "FOXSTYLE build failed." }
    $log = Join-Path (Get-FoxOsDir) "foxstyle-selftest.log"
    Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
    $exe = Get-FoxStyleExe
    Start-Process -FilePath $exe -ArgumentList @('"' + $PSScriptRoot + '"', "-SelfTest") -Wait
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log }
    else { throw "FOXSTYLE self-test did not produce a result." }
    return
}

if ($Preset) {
    $presetFile = Join-Path (Split-Path $PSScriptRoot -Parent) "sites\foxstyle\presets\$Preset.json"
    if (-not (Test-Path -LiteralPath $presetFile)) {
        # fallback: let the app seed preset on open after writing minimal stub
        $stub = @{ version = "1"; name = $Preset; preset = $Preset } | ConvertTo-Json
        New-Item -ItemType Directory -Force -Path (Get-FoxOsDir) | Out-Null
        [System.IO.File]::WriteAllText((Get-FoxStyleJson), $stub, (New-Object System.Text.UTF8Encoding $false))
    } else {
        New-Item -ItemType Directory -Force -Path (Get-FoxOsDir) | Out-Null
        Copy-Item -LiteralPath $presetFile -Destination (Get-FoxStyleJson) -Force
    }
}

Open-FoxStyle | Out-Null
