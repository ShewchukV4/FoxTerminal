# FoxOS session shell. Winlogon starts foxos-shell.cmd and keeps this process
# for the whole sign-in. Explorer is started immediately: Seelen, the taskbar,
# and Startup items do not exist until it does. Slow work (compile, UAC,
# wallpaper bake) must never run before that, or the session has nothing to launch.
$ErrorActionPreference = "Continue"
$cmdDir = $PSScriptRoot
. (Join-Path $cmdDir "foxos-lib.ps1")
. (Join-Path $cmdDir "foxlook-lib.ps1")

function Write-FoxLookShellAlive {
    $dir = Get-FoxOsDir
    $obj = [ordered]@{
        at   = [DateTime]::UtcNow.ToString("o")
        pid  = $PID
        live = [bool](Test-FoxOsLiveRunning)
    }
    Write-FoxLookJson (Join-Path $dir "shell-alive.json") $obj
}

function Start-FoxOsExplorer {
    if (Get-Process -Name explorer -ErrorAction SilentlyContinue) { return }
    try { Start-Process -FilePath "explorer.exe" } catch {}
}

Write-FoxLookShellAlive
# Desktop before any FoxOS work. This process may be the Winlogon shell.
Start-FoxOsExplorer
# look.json shell off + a leftover Winlogon Shell value is how the next
# sign-in comes up with no taskbar. Drop that override now.
try {
    if (-not (Test-FoxLookPart "shell")) {
        $key = Get-FoxLookWinlogonKey
        $cur = ""
        try { $cur = [string](Get-ItemProperty -Path $key -Name Shell -ErrorAction Stop).Shell } catch {}
        if ($cur -and ($cur -like "*foxos-shell*")) {
            Remove-ItemProperty -Path $key -Name Shell -ErrorAction SilentlyContinue
        }
    }
} catch {}
try { Disable-WindowsWidgetBoard | Out-Null } catch {}
try { Disable-SeelenWallpaperOverlay | Out-Null } catch {}

function Start-ShewchukBackgroundApp([string]$name, [string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    if (Get-Process -Name $name -ErrorAction SilentlyContinue) { return }
    try { Start-Process -FilePath $path -WorkingDirectory (Split-Path -Parent $path) } catch {}
}

# Island and Seelen come up with the session. No extra windows are activated.
Start-ShewchukBackgroundApp "nusa" (Join-Path $env:LOCALAPPDATA "Programs\Nusa\nusa.exe")
if (-not (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'seelen' })) {
    try {
        $pkg = Get-AppxPackage -Name "Seelen.SeelenUI" -ErrorAction SilentlyContinue
        if ($pkg) {
            $man = Get-AppxPackageManifest -Package $pkg.PackageFullName
            $appId = "App"
            try {
                $ui = @($man.Package.Applications.Application) | Where-Object { $_.Executable -eq "seelen-ui.exe" } | Select-Object -First 1
                if ($ui -and $ui.Id) { $appId = [string]$ui.Id }
            } catch {}
            $aumid = $pkg.PackageFamilyName + "!" + $appId
            Start-Process -FilePath "explorer.exe" -ArgumentList @("shell:AppsFolder\$aumid") | Out-Null
        }
    } catch {}
}
# -Logon starts the existing exe only. No csc, no UAC, no kill-and-rebuild.
try { Start-FoxOsLive -Logon | Out-Null } catch {}
# Shell and the macOS cursor are pinned. Shaders stay off unless turned on.
try { Ensure-FoxPinnedChrome } catch {}
# Never leave a stale MediaStrip / DeskWidgets from a previous live build.
Get-Process -Name "WidgetBoard","Widgets" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

$hk = Join-Path $cmdDir "foxhotkeys.ps1"
if (Test-Path -LiteralPath $hk) {
    try {
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $hk
        ) -WindowStyle Hidden | Out-Null
    } catch {}
}

# Win+W carousel must not depend only on Explorer Startup (Shell is FoxOS).
$winw = Join-Path $env:USERPROFILE "Shewchuk\wallpapers\picker\WinW-Wallpaper.ahk"
$ahk = Join-Path $env:LOCALAPPDATA "Programs\AutoHotkey\v2\AutoHotkey64.exe"
if (-not (Test-Path -LiteralPath $ahk)) { $ahk = "C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe" }
$ahkStarted = $false
if ((Test-Path -LiteralPath $winw) -and (Test-Path -LiteralPath $ahk)) {
    $already = Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and ($_.CommandLine -like '*WinW-Wallpaper.ahk*') }
    if (-not $already) {
        try {
            Start-Process -FilePath $ahk -ArgumentList "`"$winw`"" -WorkingDirectory (Split-Path $winw) -WindowStyle Hidden | Out-Null
            $ahkStarted = $true
        } catch {}
    } else {
        $ahkStarted = $true
    }
}
# One wallpaper restore, off this thread. A second PowerShell on the shell
# thread was baking the default fox wall and blocking sign-in.
if (-not $ahkStarted) {
    try {
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
            "-Command", ". '$cmdDir\foxos-lib.ps1'; . '$cmdDir\foxlook-lib.ps1'; Apply-ShewchukRememberedWallpaper | Out-Null"
        ) -WindowStyle Hidden | Out-Null
    } catch {}
}

# Terminal logon is the scheduled task only. Starting it here as well
# opened a second noctty next to that task.

$crashes = 0
$window = Get-Date
while ($true) {
    Write-FoxLookShellAlive
    if (-not (Test-FoxOsLiveRunning)) {
        if (((Get-Date) - $window).TotalSeconds -gt 60) {
            $crashes = 0
            $window = Get-Date
        }
        $crashes++
        if ($crashes -ge 3) {
            # Stay alive: exiting the Winlogon shell ends the session.
            try { Restore-FoxLookShell } catch {}
            Start-FoxOsExplorer
            $crashes = 0
            $window = Get-Date
            Start-Sleep -Seconds 30
            continue
        }
        try { Start-FoxOsLive -Logon | Out-Null } catch {}
    }
    Start-Sleep -Seconds 4
}
