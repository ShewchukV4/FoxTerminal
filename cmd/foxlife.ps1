# FOXOS Life - native notes / finance / tables app.
# Usage:
#   foxlife              compile (if needed) and open the window
#   foxlife -Status      print store path + counts, no GUI
#   foxlife -Rebuild     force csc rebuild

param(
    [switch]$Status,
    [switch]$Rebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "foxos-lib.ps1")
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "foxauth.ps1")) {
    . (Join-Path $PSScriptRoot "foxauth.ps1")
}

# Same resolution as FoxPaths.CurrentUser() in the SDK: session env, persisted user, "local".
function Get-FoxLifeUser {
    $user = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($user)) {
        $state = Join-Path $PSScriptRoot "current_user.txt"
        if (Test-Path -LiteralPath $state) {
            $user = ([System.IO.File]::ReadAllText($state)).Trim()
        }
    }
    if ([string]::IsNullOrWhiteSpace($user)) { $user = "local" }
    return $user
}

function Get-FoxLifeDir {
    $user = Get-FoxLifeUser
    $dir = Join-Path (Get-FoxOsDir) ("apps\foxlife\" + $user)
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Get-FoxLifeSources {
    $list = @(Join-Path $PSScriptRoot "foxos-sdk.cs")
    $mod = Join-Path $PSScriptRoot "foxlife"
    $list += @(Get-ChildItem -LiteralPath $mod -Filter "*.cs" | Sort-Object Name | ForEach-Object { $_.FullName })
    return $list
}

function Get-FoxLifeExe {
    return (Join-Path (Get-FoxOsDir) "foxlife.exe")
}

function Test-FoxLifeStale {
    $exe = Get-FoxLifeExe
    if (-not (Test-Path -LiteralPath $exe)) { return $true }
    $exeTime = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
    foreach ($src in (Get-FoxLifeSources)) {
        if ((Get-Item -LiteralPath $src).LastWriteTimeUtc -gt $exeTime) { return $true }
    }
    return $false
}

function Ensure-FoxLifeBuilt {
    param([switch]$Force)
    $sources = @(Get-FoxLifeSources)
    $exe = Get-FoxLifeExe
    if (-not $Force -and -not (Test-FoxLifeStale)) { return $true }
    Get-Process -Name "foxlife" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 200
    $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path -LiteralPath $csc)) {
        Write-Host "csc.exe missing - cannot build FOXOS Life."
        return $false
    }
    $out = Join-Path (Get-FoxOsDir) "foxlife.build.log"
    $args = @(
        "/nologo",
        "/target:winexe",
        "/optimize+",
        "/codepage:65001",
        ("/out:" + $exe),
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Web.Extensions.dll",
        "/r:System.Web.dll"
    ) + $sources
    $p = Start-Process -FilePath $csc -ArgumentList $args -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $out -RedirectStandardError ($out + ".err")
    if ((Test-Path -LiteralPath $exe) -and $p.ExitCode -eq 0) { return $true }
    Write-Host "foxlife build failed. See:"
    Write-Host ("  " + $out)
    Write-Host ("  " + $out + ".err")
    return $false
}

if ($Status) {
    $dir = Get-FoxLifeDir
    $metaPath = Join-Path $dir "meta.json"
    Write-Host "FOXOS Life"
    Write-Host ("  store   " + $dir)
    Write-Host ("  exe     " + (Get-FoxLifeExe))
    if (Test-Path -LiteralPath $metaPath) {
        Write-Host ("  meta    " + ((Get-Content -LiteralPath $metaPath -Raw).Trim()))
    } else {
        Write-Host "  meta    (first run will seed demo data)"
    }
    foreach ($name in @("notes", "txs", "tables", "reminders")) {
        $p = Join-Path $dir ($name + ".json")
        if (Test-Path -LiteralPath $p) {
            $n = ([regex]::Matches((Get-Content -LiteralPath $p -Raw), '"id"')).Count
            Write-Host ("  {0,-10} {1}" -f $name, $n)
        } else {
            Write-Host ("  {0,-10} -" -f $name)
        }
    }
    return
}

if (-not (Ensure-FoxLifeBuilt -Force:$Rebuild)) { return }
$exe = Get-FoxLifeExe
# Hand the resolved user to the app so it opens the same store the terminal shows.
if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) {
    $resolved = Get-FoxLifeUser
    if ($resolved -ne "local") { $env:FOXTERM_USER = $resolved }
}
Start-Process -FilePath $exe -ArgumentList @(('"' + $PSScriptRoot + '"')) | Out-Null
if (Get-Command Write-FoxToast -ErrorAction SilentlyContinue) {
    Write-FoxToast "FOXOS Life"
}
