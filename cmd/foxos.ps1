param(
    [Parameter(Position = 0)]
    [string]$Action
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "foxos-lib.ps1")

function Show-FoxOsUsage {
    Write-Host "Usage: foxos [on|off|status|toggle|apply]"
    Write-Host "  no args / status  show whether the desktop skin is on"
    Write-Host "  on                ASCII rain wallpaper + Windows accent from the theme"
    Write-Host "  off               restore the wallpaper and accent from before FoxOS"
    Write-Host "  apply             repaint now (theme already on)"
    Write-Host "  toggle            flip"
    Write-Host "Env: FOXTERM_FOXOS=0 skips the desktop skin for this session."
}

function Write-FoxOsStatus {
    $p = Get-ThemePalette
    $info = Get-FoxOsStatusInfo
    $state = if ($info.Enabled) { "ON" } else { "OFF" }
    $stateColor = if ($info.Enabled) { $p.accent2 } else { $p.dim }

    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxOS desktop skin ===")
    Write-Host (Color-Text $p.dim "  skin    ") -NoNewline
    Write-Host (Color-Text $stateColor $state)
    Write-Host (Color-Text $p.dim "  theme   ") -NoNewline
    Write-Host (Color-Text $p.text $info.Theme)
    Write-Host (Color-Text $p.dim "  accent  ") -NoNewline
    Write-Host (Color-Text $p.accent $info.Accent)
    if ($info.Last) {
        Write-Host (Color-Text $p.dim "  last    ") -NoNewline
        Write-Host (Color-Text $p.text $info.Last)
    }
    Write-Host (Color-Text $p.dim "  backup  ") -NoNewline
    Write-Host (Color-Text $p.text $(if ($info.Backup) { "saved (foxos off restores it)" } else { "none yet" }))
    Write-Host ""
    Write-Host (Color-Text $p.dim "  live    ") -NoNewline
    Write-Host (Color-Text $(if ($info.Live) { $p.accent2 } else { $p.dim }) $(if ($info.Live) { "ASCII rain" } else { "off" }))
    Write-Host ""
    Write-Host (Color-Text $p.dim "  foxos on / off    enable or restore Windows")
    Write-Host (Color-Text $p.dim "  sw arrows         recolor rain, fox, title bars, borders")
    Write-Host (Color-Text $p.dim "  taskbar           search / copilot / weather hidden while FoxOS is on")
    Write-Host (Color-Text $p.dim "  desktop prompt    click under the fox: sw slate, ytm, help")
    Write-Host ""
}

$raw = if ($null -eq $Action) { "" } else { $Action.Trim() }
if ($raw -eq "-Status") { $raw = "status" }
$key = $raw.ToLowerInvariant()

if ($key -in @("-h", "--help", "help")) {
    Show-FoxOsUsage
    return
}

if (-not (Test-FoxOsWindows)) {
    Write-Host "FoxOS paints wallpaper and accent on Windows only."
    return
}

$target = $null
$forceApply = $false
switch ($key) {
    { $_ -in @("", "status") } { }
    "toggle" { $target = -not (Test-FoxOsEnabled) }
    { $_ -in @("on", "1", "true", "enable") } { $target = $true }
    { $_ -in @("off", "0", "false", "disable") } { $target = $false }
    "apply" { $forceApply = $true }
    default {
        Write-Host ("Unknown action: " + $Action)
        Show-FoxOsUsage
        exit 1
    }
}

if ($null -ne $target) {
    Save-FoxOsState $target
    if (-not $target) {
        $ok = Restore-FoxOsDesktop
        Restart-FoxOsShell
        Write-FoxOsStatus
        $p = Get-ThemePalette
        if ($ok) {
            Write-Host (Color-Text $p.accent2 "  Desktop restored.")
        } else {
            Write-Host (Color-Text $p.dim "  No backup to restore. Set a wallpaper in Windows Settings if you want.")
        }
        Write-Host ""
        return
    }
    Sync-FoxOsSkin -Force | Out-Null
    Restart-FoxOsShell
    Start-Sleep -Milliseconds 1200
    Start-FoxOsLive | Out-Null
} elseif ($forceApply) {
    Save-FoxOsState $true
    Sync-FoxOsSkin -Force | Out-Null
    Restart-FoxOsShell
    Start-Sleep -Milliseconds 1200
    Start-FoxOsLive | Out-Null
}

Write-FoxOsStatus
$p = Get-ThemePalette
if (Test-FoxOsEnabled) {
    Write-Host (Color-Text $p.accent2 "  ASCII rain is running. sw arrows recolor it.")
} else {
    Write-Host (Color-Text $p.text "  FoxOS is off.")
}
Write-Host ""
