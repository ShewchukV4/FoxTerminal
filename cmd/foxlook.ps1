param(
    [Parameter(Position = 0)]
    [string]$Action,
    [Parameter(Position = 1)]
    [string]$Value,
    [Parameter(Position = 2)]
    [string]$Extra,
    [string]$Admin,
    [string]$Night = "#0B0F1A"
)

# Elevated helper: only the HKLM part. No foxauth, no login.
if ($Admin) {
    . (Join-Path $PSScriptRoot "foxos-lib.ps1")
    . (Join-Path $PSScriptRoot "foxlook-lib.ps1")
    $ok = $false
    try {
        if ($Admin -eq "apply") { $ok = Apply-FoxLookOemElevated $Night }
        elseif ($Admin -eq "restore") { $ok = Restore-FoxLookOemElevated }
    } catch { $ok = $false }
    exit $(if ($ok) { 0 } else { 1 })
}

# Rescue: no login. Ctrl+Alt+Del > Task Manager > File > Run restore-windows.cmd
if ($Action -eq "rescue") {
    . (Join-Path $PSScriptRoot "foxos-lib.ps1")
    . (Join-Path $PSScriptRoot "foxlook-lib.ps1")
    try { Restore-FoxLookShell } catch {}
    $s = Read-FoxLookState
    if ($s.parts.ContainsKey("shell")) { $s.parts["shell"] = $false }
    Write-FoxLookState $s
    if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
        try { Start-Process -FilePath "explorer.exe" } catch {}
    }
    exit 0
}

. (Join-Path $PSScriptRoot "foxauth.ps1")

function Show-FoxLookUsage {
    Write-Host "Usage: foxlook [on|off|status|<part> on|off|wall overlay|behind]"
    Write-Host "  no args / status  what FoxOS owns right now"
    Write-Host "  on                dark Windows, no desktop icons, taskbar hides, no system sounds,"
    Write-Host "                    inverted cursors, FoxOS lock screen, Win keys -> FoxOS, OEM = FoxOS (asks admin once)"
    Write-Host "  off               put every Windows value back from the snapshot"
    Write-Host "  <part> on|off     dark icons taskbar sounds cursors lockscreen winkeys oem winlock shell"
    Write-Host "  winlock on        Win+L locks FoxTerminal instead of Windows (Windows lock is disabled for this user)"
    Write-Host "  shell on          next sign-in: this user gets FoxOS instead of Explorer (other Windows user unchanged)"
    Write-Host "  shell off         Shell = Explorer again. Rescue: Ctrl+Alt+Del > Task Manager > File > Run"
    Write-Host "                    %LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd"
    Write-Host "  wall behind       rain lives behind the desktop icon layer (Win+D safe; desk prompt off)"
    Write-Host "  wall overlay      rain is a window on the desktop (default; desk prompt works)"
    Write-Host "  cursor <style> [1|2|3]   pixel | chunky | neon | fox (theme-coloured pixel art) | inverted; size x1..x3"
    Write-Host "  cursor preview    render every style in a few themes and open the picture"
    Write-Host "  dock style|place|size|hide|apps|tray|widgets|home <value>"
    Write-Host "                    style rail|pill|glass|slim   place top|bottom   size compact|normal|large"
    Write-Host "                    hide on|off   apps titles|dots|off   tray full|clock|off"
    Write-Host "                    widgets on|off   home on|off   (shell desktop widgets / home launcher)"
    Write-Host "  export [path]     save look + pins + theme to a profile json (Desktop by default)"
    Write-Host "  import <path>     restore a profile json"
}

function Write-FoxLookStatus {
    $p = Get-ThemePalette
    $info = Get-FoxLookStatusInfo
    $state = if ($info.Enabled) { "ON" } else { "OFF" }
    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxOS look ===")
    Write-Host (Color-Text $p.dim "  look      ") -NoNewline
    Write-Host (Color-Text $(if ($info.Enabled) { $p.accent2 } else { $p.dim }) $state)
    Write-Host (Color-Text $p.dim "  wall      ") -NoNewline
    Write-Host (Color-Text $p.text $info.Wall)
    Write-Host (Color-Text $p.dim "  cursor    ") -NoNewline
    Write-Host (Color-Text $p.text ($info.Cursor + "  x" + $info.CursorScale))
    Write-Host (Color-Text $p.dim "  dock      ") -NoNewline
    Write-Host (Color-Text $p.text ($info.DockStyle + "  " + $info.DockPos + "  " + $info.DockSize + "  hide=" + $(if ($info.DockHide) { "on" } else { "off" }) + "  apps=" + $info.DockWins + "  tray=" + $info.DockTray))
    Write-Host ""
    $desc = [ordered]@{
        dark       = "Windows apps + shell dark"
        icons      = "desktop icons hidden"
        taskbar    = "taskbar auto-hide"
        sounds     = "system sounds off"
        cursors    = "pixel cursors in the theme colour (foxlook cursor <style>)"
        lockscreen = "lock screen = FoxOS picture, no Spotlight"
        winkeys    = "Win -> FoxTerminal, Win+R/S prompt, Win+E edit, Win+I settings"
        oem        = "Settings > About: FoxOS (admin)"
        winlock    = "Win+L -> Fox lock (Windows lock off)"
        shell      = "this user: Winlogon Shell = FoxOS (next login; other Windows user stays Explorer)"
    }
    foreach ($k in $desc.Keys) {
        $on = [bool]$info.Parts[$k]
        Write-Host (Color-Text $p.dim ("  " + $k.PadRight(11))) -NoNewline
        Write-Host (Color-Text $(if ($on) { $p.accent2 } else { $p.dim }) $(if ($on) { "on " } else { "off" })) -NoNewline
        Write-Host (Color-Text $p.text ("  " + $desc[$k]))
    }
    Write-Host ""
    Write-Host (Color-Text $p.dim ("  snapshot  " + $(if ($info.Backup) { "saved (foxlook off restores it)" } else { "none yet" })))
    Write-Host ""
}

$raw = if ($null -eq $Action) { "" } else { $Action.Trim() }
if ($raw -eq "-Status") { $raw = "status" }
$key = $raw.ToLowerInvariant()
$val = if ($null -eq $Value) { "" } else { $Value.Trim().ToLowerInvariant() }

if ($key -in @("-h", "--help", "help")) { Show-FoxLookUsage; return }

if (-not (Test-FoxOsWindows)) {
    Write-Host "FoxOS look changes Windows only."
    return
}

$p = Get-ThemePalette
switch ($key) {
    { $_ -in @("", "status") } { Write-FoxLookStatus; return }
    { $_ -in @("on", "1", "true", "enable") } {
        Write-Host (Color-Text $p.dim "  applying FoxOS look...")
        $r = Enable-FoxLook
        Set-FoxUserWorldValue -Key "look" -Value $true -Name (Get-FoxSettingsUser) | Out-Null
        Write-FoxLookStatus
        $failed = @($r.Keys | Where-Object { -not $r[$_] })
        if ($failed.Count -gt 0) {
            Write-Host (Color-Text $p.dim ("  skipped: " + ($failed -join ", ") + "  (oem = UAC declined; cursors/lockscreen = scheme or WinRT missing)"))
        }
        Write-Host (Color-Text $p.accent2 "  Windows now wears FoxOS. foxlook off puts it back.")
        Write-Host ""
        return
    }
    { $_ -in @("off", "0", "false", "disable") } {
        Disable-FoxLook
        Set-FoxUserWorldValue -Key "look" -Value $false -Name (Get-FoxSettingsUser) | Out-Null
        Write-FoxLookStatus
        Write-Host (Color-Text $p.accent2 "  Windows restored.")
        Write-Host ""
        return
    }
    "wall" {
        if ($val -notin @("overlay", "behind")) { Show-FoxLookUsage; exit 1 }
        Set-FoxLookWall $val | Out-Null
        Write-Host (Color-Text $p.accent2 ("  wall " + $val))
        return
    }
    "cursor" {
        if ($val -eq "preview") {
            $png = Join-Path (Get-FoxLookDir) "cursors\preview.png"
            New-FoxCursorPreview -OutPath $png -Scale 5 | Out-Null
            Start-Process $png | Out-Null
            Write-Host (Color-Text $p.dim ("  " + $png))
            return
        }
        $scaleArg = 0
        if ($Extra) { [int]::TryParse($Extra.Trim(), [ref]$scaleArg) | Out-Null }
        if (-not (Set-FoxLookCursorStyle $val $scaleArg)) {
            Write-Host "foxlook cursor pixel|chunky|neon|fox|inverted [1|2|3]   or   foxlook cursor preview"
            exit 1
        }
        $st = Read-FoxLookState
        Write-Host (Color-Text $p.accent2 ("  cursor " + $st.cursor + "  x" + $st.cursorScale + $(if (Test-FoxLookPart "cursors") { "  (applied)" } else { "  (foxlook cursors on to apply)" })))
        return
    }
    "dock" {
        if ($val -eq "" -or $val -eq "status") { Write-FoxLookStatus; return }
        $map = @{
            style = "dockStyle"; place = "dockPos"; pos = "dockPos"; size = "dockSize"
            hide = "dockHide"; apps = "dockWins"; windows = "dockWins"; tray = "dockTray"
            widgets = "dockWidgets"; home = "dockHome"
        }
        $field = $map[$val]
        if (-not $field) {
            Write-Host "foxlook dock style|place|size|hide|apps|tray|widgets|home <value>"
            exit 1
        }
        $raw = if ($Extra) { $Extra.Trim().ToLowerInvariant() } else { "" }
        $v = $raw
        if ($field -in @("dockHide", "dockWidgets", "dockHome")) { $v = ($raw -in @("on", "1", "true")) }
        if (-not (Set-FoxLookDock -Key $field -Value $v)) {
            Write-Host "foxlook dock style rail|pill|glass|slim   place top|bottom   size compact|normal|large"
            Write-Host "             hide on|off   apps titles|dots|off   tray full|clock|off"
            Write-Host "             widgets on|off   home on|off"
            exit 1
        }
        $st = Read-FoxLookState
        Write-Host (Color-Text $p.accent2 ("  dock " + $st.dockStyle + "  " + $st.dockPos + "  " + $st.dockSize + "  hide=" + $(if ($st.dockHide) { "on" } else { "off" }) + "  apps=" + $st.dockWins + "  tray=" + $st.dockTray + "  widgets=" + $(if ($st.dockWidgets) { "on" } else { "off" }) + "  home=" + $(if ($st.dockHome) { "on" } else { "off" })))
        return
    }
    "export" {
        $path = Export-FoxLookProfile $val
        Write-Host (Color-Text $p.accent2 ("  exported  " + $path))
        return
    }
    "import" {
        if (-not $val) { Write-Host "foxlook import <path>"; exit 1 }
        if (-not (Import-FoxLookProfile $val)) { Write-Host "import failed"; exit 1 }
        Write-Host (Color-Text $p.accent2 ("  imported  " + $val))
        return
    }
    { $_ -in @("dark", "icons", "taskbar", "sounds", "cursors", "lockscreen", "winkeys", "oem", "winlock", "shell") } {
        if ($val -notin @("on", "off")) { Show-FoxLookUsage; exit 1 }
        $ok = Set-FoxLookPart -Part $key -On ($val -eq "on")
        Set-FoxUserWorldValue -Key "look" -Value (Test-FoxLookEnabled) -Name (Get-FoxSettingsUser) | Out-Null
        if ($val -eq "on" -and -not $ok) {
            Write-Host (Color-Text $p.dim ("  " + $key + " did not apply."))
        } else {
            Write-Host (Color-Text $p.accent2 ("  " + $key + " " + $val))
        }
        if ($key -eq "winlock" -and $val -eq "on") {
            Write-Host (Color-Text $p.dim "  Windows lock (Win+L, Ctrl+Alt+Del > Lock) is off for this user. foxlook winlock off returns it.")
        }
        if ($key -eq "shell" -and $val -eq "on") {
            Write-Host (Color-Text $p.dim "  Next sign-in of THIS user starts FoxOS, not Explorer. The other Windows user is unchanged.")
            Write-Host (Color-Text $p.dim "  Rescue: switch user, or Ctrl+Alt+Del > Task Manager > File > Run")
            Write-Host (Color-Text $p.dim ("  " + (Get-FoxLookRestoreCmdPath)))
            Write-Host (Color-Text $p.dim "  If the dock is silent for 30s after login, Explorer comes back by itself.")
        }
        return
    }
    default {
        Write-Host ("Unknown action: " + $Action)
        Show-FoxLookUsage
        exit 1
    }
}
