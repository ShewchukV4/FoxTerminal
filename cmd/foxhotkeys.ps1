param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "hk_lib.ps1")

$AhkScript = Join-Path $PSScriptRoot "foxhotkeys.ahk"

function Get-HotkeyProcess {
    Get-CimInstance Win32_Process -Filter "Name LIKE 'AutoHotkey%'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*foxhotkeys.ahk*" }
}

function Start-FoxHotkeys {
    $p = Get-ThemePalette

    if (-not (Test-Path $AhkScript)) {
        Write-Host (Color-Text $p.dim "Script not found: $AhkScript")
        return
    }

    $running = Get-HotkeyProcess
    if ($running) {
        Write-Host (Color-Text $p.dim "FoxHotkeys already running (PID $($running[0].ProcessId)).")
        return
    }

    # Find AHK, auto-install if missing
    $ahk = Ensure-AHK
    if (-not $ahk) { return }

    Start-Process -FilePath $ahk -ArgumentList "`"$AhkScript`"" -WindowStyle Hidden
    Start-Sleep -Milliseconds 500
    $p2 = Get-HotkeyProcess
    if ($p2) {
        Write-Host (Color-Text $p.accent "FoxHotkeys started (PID $($p2[0].ProcessId)).")
    } else {
        Write-Host (Color-Text $p.accent "FoxHotkeys launched.")
    }
}

function Stop-FoxHotkeys {
    $p = Get-ThemePalette
    $procs = Get-HotkeyProcess
    if (-not $procs) {
        Write-Host (Color-Text $p.dim "FoxHotkeys is not running.")
        return
    }
    foreach ($proc in $procs) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Write-Host (Color-Text $p.accent "FoxHotkeys stopped.")
}

function Show-Status {
    $p = Get-ThemePalette
    $procs = Get-HotkeyProcess
    if ($procs) {
        Write-Host (Color-Text $p.accent "FoxHotkeys: RUNNING")
        foreach ($proc in $procs) {
            Write-Host (Color-Text $p.dim "  PID $($proc.ProcessId)")
        }
    } else {
        Write-Host (Color-Text $p.dim "FoxHotkeys: not running  (run: foxhotkeys)")
    }
    Write-Host ""
    $ahk = Find-AHK
    if ($ahk) {
        Write-Host (Color-Text $p.accent2 "AutoHotkey: $ahk")
    } else {
        Write-Host (Color-Text $p.dim "AutoHotkey: NOT FOUND  (run 'foxhotkeys' to auto-install)")
    }
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Built-in hotkeys:")
    Write-Host "  Shift+Alt+Y      -> YouTube"
    Write-Host "  Shift+Ctrl+Y     -> Close YouTube tab"
    Write-Host "  Shift+Alt+F      -> Firefox"
    Write-Host "  Shift+Alt+M      -> YouTube Music"
    Write-Host "  Shift+Alt+Space     -> Show FoxTerminal"
    Write-Host "  Shift+Ctrl+Space    -> Hide FoxTerminal"
    Write-Host "  Shift+Alt+T         -> Show FoxTerminal"
    Write-Host "  Shift+Ctrl+Alt+T    -> Close FoxTerminal"
    Write-Host "  Alt+Tab             -> FoxOS window switcher (while foxos-live runs)"
    Write-Host "  Alt+Shift+Tab       -> previous window"
    $winKeys = (Get-Command Test-FoxLookPart -ErrorAction SilentlyContinue) -and (Test-FoxLookPart "winkeys")
    Write-Host ""
    if ($winKeys) {
        Write-Host (Color-Text $p.accent2 "FoxOS Win keys (foxlook winkeys off):")
        Write-Host "  Win                 -> Show / hide FoxTerminal"
        Write-Host "  Win+R, Win+S        -> Desk prompt on the wallpaper"
        Write-Host "  Win+E               -> edit        Win+I -> settings"
        Write-Host "  Win+L               -> Fox lock (after foxlook winlock on)"
        Write-Host "  Win+Esc             -> Rescue: restore Windows shell"
    } else {
        Write-Host (Color-Text $p.dim "FoxOS Win keys: off  (foxlook winkeys on)")
    }
}

if ($Status)  { Show-Status;   exit }
if ($Stop)    { Stop-FoxHotkeys; exit }
if ($Restart) { Stop-FoxHotkeys; Start-Sleep -Milliseconds 300; Start-FoxHotkeys; exit }

# Default: start (with auto-install if AHK missing)
Start-FoxHotkeys
