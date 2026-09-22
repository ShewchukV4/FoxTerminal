# FoxTerminal system layer: per-user world, home, lock, toasts, first-boot, settings.
# Dot-sourced from foxauth.ps1. Wallpaper must never accept a password.

function Get-FoxSysDir {
    $root = $env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($root)) { $root = $env:TEMP }
    $dir = Join-Path $root "FoxTerminal"
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Get-FoxOsRuntimeDir {
    $dir = Join-Path (Get-FoxSysDir) "foxos"
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Get-FoxUserProfileDir([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { $name = $env:FOXTERM_USER }
    if ([string]::IsNullOrWhiteSpace($name)) { return $null }
    $safe = ($name.Trim() -replace '[^A-Za-z0-9._-]', '_')
    $dir = Join-Path (Get-FoxSysDir) ("profiles\" + $safe)
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Get-FoxUserProfilePath([string]$name) {
    $dir = Get-FoxUserProfileDir $name
    if (-not $dir) { return $null }
    return (Join-Path $dir "profile.json")
}

function Get-FoxDefaultUserWorld {
    return [ordered]@{
        theme       = "orange"
        foxos       = $true
        look        = $false
        shader      = $true
        lockMinutes = 10
        lastSite    = ""
        lastFriend  = ""
    }
}

function Read-FoxUserWorld([string]$name) {
    $world = Get-FoxDefaultUserWorld
    $path = Get-FoxUserProfilePath $name
    if (-not $path -or -not (Test-Path -LiteralPath $path)) { return $world }
    try {
        $obj = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($obj.theme) { $world.theme = [string]$obj.theme }
        if ($null -ne $obj.foxos) { $world.foxos = [bool]$obj.foxos }
        if ($null -ne $obj.look) { $world.look = [bool]$obj.look }
        if ($null -ne $obj.shader) { $world.shader = [bool]$obj.shader }
        if ($null -ne $obj.lockMinutes) { $world.lockMinutes = [int]$obj.lockMinutes }
        if ($obj.lastSite) { $world.lastSite = [string]$obj.lastSite }
        if ($obj.lastFriend) { $world.lastFriend = [string]$obj.lastFriend }
    } catch {}
    return $world
}

function Write-FoxUserWorld([hashtable]$world, [string]$name) {
    $path = Get-FoxUserProfilePath $name
    if (-not $path) { return $false }
    $world | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $path -Encoding UTF8
    return $true
}

function Save-FoxUserWorld {
    if ($global:FOXTERM_WORLD_APPLYING) { return }
    $name = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $world = Read-FoxUserWorld $name
    if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        $theme = Get-ActiveThemeName
        if (-not [string]::IsNullOrWhiteSpace($theme)) { $world.theme = $theme }
    }
    if (Get-Command Test-FoxOsEnabled -ErrorAction SilentlyContinue) {
        $world.foxos = [bool](Test-FoxOsEnabled)
    }
    if (Get-Command Test-FoxLookEnabled -ErrorAction SilentlyContinue) {
        $world.look = [bool](Test-FoxLookEnabled)
    }
    if (Get-Command Test-FoxShadersEnabled -ErrorAction SilentlyContinue) {
        $world.shader = [bool](Test-FoxShadersEnabled)
    }
    Write-FoxUserWorld $world $name | Out-Null
    Write-FoxIdleLockHint $world.lockMinutes $name
}

function Write-FoxIdleLockHint([int]$minutes, [string]$name) {
    $path = Join-Path (Get-FoxOsRuntimeDir) "idle-lock.txt"
    $user = if ($name) { $name } else { "" }
    @(
        ([Math]::Max(0, $minutes)).ToString(),
        $user
    ) | Set-Content -LiteralPath $path -Encoding ASCII
}

function Apply-FoxUserWorld {
    $name = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $global:FOXTERM_WORLD_APPLYING = $true
    try {
        $world = Read-FoxUserWorld $name
        if (Get-Command Save-ActiveTheme -ErrorAction SilentlyContinue) {
            Save-ActiveTheme $world.theme
        }
        if (Get-Command Save-FoxOsState -ErrorAction SilentlyContinue) {
            Save-FoxOsState ([bool]$world.foxos)
            if ($world.foxos -and (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue)) {
                try { Sync-FoxOsSkin | Out-Null } catch {}
            }
        }
        if (Get-Command Test-FoxLookEnabled -ErrorAction SilentlyContinue) {
            # Per-user: this user's look wins. On = re-assert (no UAC); off = give Windows back.
            try {
                if ($world.look) {
                    if (Test-FoxLookEnabled) { Sync-FoxLook | Out-Null } else { Enable-FoxLook -Quiet | Out-Null }
                } elseif (Test-FoxLookEnabled) {
                    Disable-FoxLook
                }
            } catch {}
        }
        if (Get-Command Save-FoxShaderState -ErrorAction SilentlyContinue) {
            Save-FoxShaderState ([bool]$world.shader)
            if (Get-Command Sync-FoxGhosttyShader -ErrorAction SilentlyContinue) {
                try { Sync-FoxGhosttyShader | Out-Null } catch {}
            }
        }
        Write-FoxIdleLockHint $world.lockMinutes $name
    } finally {
        $global:FOXTERM_WORLD_APPLYING = $false
    }
    return $true
}

function Set-FoxUserWorldValue {
    param(
        [string]$Key,
        $Value,
        [string]$Name
    )
    if ([string]::IsNullOrWhiteSpace($Name)) { $Name = $env:FOXTERM_USER }
    $world = Read-FoxUserWorld $Name
    switch ($Key) {
        "theme" { $world.theme = [string]$Value }
        "foxos" { $world.foxos = [bool]$Value }
        "look" { $world.look = [bool]$Value }
        "shader" { $world.shader = [bool]$Value }
        "lockMinutes" { $world.lockMinutes = [int]$Value }
        "lastSite" { $world.lastSite = [string]$Value }
        "lastFriend" { $world.lastFriend = [string]$Value }
        default { return $false }
    }
    Write-FoxUserWorld $world $Name | Out-Null
    if ($Key -eq "lockMinutes") { Write-FoxIdleLockHint $world.lockMinutes $Name }
    return $true
}

function Get-FoxLockPath {
    return (Join-Path (Get-FoxOsRuntimeDir) "lock.json")
}

function Test-FoxSessionLocked {
    $path = Get-FoxLockPath
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    try {
        $obj = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        return [bool]$obj.locked
    } catch {
        return $false
    }
}

function Get-FoxLockUser {
    $path = Get-FoxLockPath
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        $obj = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        $n = [string]$obj.user
        if ([string]::IsNullOrWhiteSpace($n)) { return $null }
        return $n
    } catch {
        return $null
    }
}

function Hide-FoxGhosttyWindows {
    if (-not ("FoxWinHide" -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FoxWinHide {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@
    }
    Get-Process -Name "winghostty","ghostty" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowHandle -ne [IntPtr]::Zero) {
            [FoxWinHide]::ShowWindow($_.MainWindowHandle, 0) | Out-Null
        }
    }
}

function Show-FoxGhosttyWindows {
    if (-not ("FoxWinHide" -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FoxWinHide {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
"@
    }
    Get-Process -Name "winghostty","ghostty" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowHandle -ne [IntPtr]::Zero) {
            [FoxWinHide]::ShowWindow($_.MainWindowHandle, 9) | Out-Null
        }
    }
}

function Lock-FoxSession {
    $name = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($name)) { $name = Get-FoxLockUser }
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    @{
        locked = $true
        user   = $name
        at     = (Get-Date).ToString("s")
    } | ConvertTo-Json | Set-Content -LiteralPath (Get-FoxLockPath) -Encoding UTF8
    Hide-FoxGhosttyWindows
    Write-FoxToast ("locked  " + $name)
    return $true
}

function Unlock-FoxSession {
    $name = Get-FoxLockUser
    $users = @{}
    if (Get-Command Load-Users -ErrorAction SilentlyContinue) { $users = Load-Users }
    if (-not $name -or -not $users.ContainsKey($name)) {
        Remove-Item -LiteralPath (Get-FoxLockPath) -Force -ErrorAction SilentlyContinue
        return $true
    }
    Set-Title "Locked"
    Show-FoxGhosttyWindows
    Write-Host ""
    Write-Host ("FoxTerminal is locked as " + $name)
    Write-Host "Windows stays signed in. Enter this Fox user password."
    $tries = 0
    while ($tries -lt 5) {
        $password = Read-PasswordPlain "Password"
        if (Verify-User $name $password) {
            Remove-Item -LiteralPath (Get-FoxLockPath) -Force -ErrorAction SilentlyContinue
            Set-CurrentUser $name
            Write-FoxToast ("welcome back  " + $name)
            return $true
        }
        $tries++
        Write-Host "Invalid password."
    }
    return $false
}

function Write-FoxToast([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $until = (Get-Date).ToUniversalTime().AddSeconds(8).ToString("o")
    $safe = ($text.Trim() -replace '[\r\n"]', ' ')
    if ($safe.Length -gt 80) { $safe = $safe.Substring(0, 80) }
    @{ text = $safe; until = $until } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Get-FoxOsRuntimeDir) "toast.json") -Encoding UTF8
}

function Get-FoxFirstBootFlagPath {
    return (Join-Path (Get-FoxSysDir) "first-boot.done")
}

function Test-FoxFirstBootNeeded {
    if (Test-Path -LiteralPath (Get-FoxFirstBootFlagPath)) { return $false }
    $users = @{}
    if (Get-Command Load-Users -ErrorAction SilentlyContinue) { $users = Load-Users }
    return ($users.Count -eq 0)
}

function Set-FoxFirstBootDone {
    "done" | Set-Content -LiteralPath (Get-FoxFirstBootFlagPath) -Encoding ASCII
}

function Get-FoxHomeNotes([string]$name) {
    $rows = @()
    if ([string]::IsNullOrWhiteSpace($name)) { return $rows }
    $root = Join-Path $PSScriptRoot ("notes\" + $name + "\files")
    if (-not (Test-Path -LiteralPath $root)) { return $rows }
    Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 3 |
        ForEach-Object { $rows += $_.Name }
    return $rows
}

function Show-FoxHome {
    $name = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $world = Read-FoxUserWorld $name
    $p = Get-ThemePalette
    $notes = @(Get-FoxHomeNotes $name)
    $when = Get-Date -Format "HH:mm  ddd d MMM"
    Clear-FoxHost
    Write-Host (Color-Text $p.accent ("=== FoxTerminal  " + $name + " ==="))
    Write-Host ""
    Write-Host (Color-Text $p.dim "  time     ") -NoNewline
    Write-Host (Color-Text $p.text $when)
    Write-Host (Color-Text $p.dim "  theme    ") -NoNewline
    Write-Host (Color-Text $p.text $world.theme)
    Write-Host (Color-Text $p.dim "  foxos    ") -NoNewline
    Write-Host (Color-Text $(if ($world.foxos) { $p.accent2 } else { $p.dim }) $(if ($world.foxos) { "on" } else { "off" }))
    Write-Host (Color-Text $p.dim "  look     ") -NoNewline
    Write-Host (Color-Text $(if ($world.look) { $p.accent2 } else { $p.dim }) $(if ($world.look) { "on" } else { "off" }))
    if ($notes.Count -gt 0) {
        Write-Host (Color-Text $p.dim "  notes    ") -NoNewline
        Write-Host (Color-Text $p.text ($notes -join "  "))
    }
    if ($world.lastSite) {
        Write-Host (Color-Text $p.dim "  site     ") -NoNewline
        Write-Host (Color-Text $p.text $world.lastSite)
    }
    if ($world.lastFriend) {
        Write-Host (Color-Text $p.dim "  friend   ") -NoNewline
        Write-Host (Color-Text $p.text $world.lastFriend)
    }
    Write-Host ""
    $menu = @("Prompt", "FOXOS Life", "YouTube Music", "Sites", "Help", "Settings", "Lock")
    $idx = Select-Menu "home" $menu
    if ($idx -lt 0) { return }
    switch ($menu[$idx]) {
        "Prompt" { return }
        "FOXOS Life" { & (Join-Path $PSScriptRoot "foxlife.ps1") }
        "YouTube Music" { & (Join-Path $PSScriptRoot "ytm.ps1") }
        "Sites" { & (Join-Path $PSScriptRoot "sites.ps1") }
        "Help" { & (Join-Path $PSScriptRoot "foxhelp.ps1") }
        "Settings" { Show-FoxSettings }
        "Lock" { Lock-FoxSession | Out-Null }
    }
}

function Complete-FoxSession {
    param([switch]$Fresh)
    if ($Fresh -and $env:FOXTERM_USER) {
        try { Apply-FoxUserWorld | Out-Null } catch {}
    }
    if (Get-Command Apply-ThemeColors -ErrorAction SilentlyContinue) {
        Apply-ThemeColors
    }
    if (Get-Command Register-FoxConsoleFocusRepair -ErrorAction SilentlyContinue) {
        Register-FoxConsoleFocusRepair
    }
    if (Get-Command Invoke-FoxDeskPending -ErrorAction SilentlyContinue) {
        Invoke-FoxDeskPending
    }
    if ($Fresh -and $env:FOXTERM_HOME_SHOWN -ne "1") {
        $env:FOXTERM_HOME_SHOWN = "1"
        Show-FoxHome
    }
}

function Invoke-FoxFirstBoot {
    $p = Get-ThemePalette
    Clear-FoxHost
    Write-Host (Color-Text $p.accent "=== FoxTerminal first boot ===")
    Write-Host (Color-Text $p.dim "  New machine. Set up this system once, then just log in.")
    Write-Host ""

    $name = ""
    while ([string]::IsNullOrWhiteSpace($name)) {
        $name = (Read-Host "Fox user name").Trim()
    }
    $users = Load-Users
    if (-not $users.ContainsKey($name)) {
        $pw = Read-PasswordPlain "Password"
        $again = Read-PasswordPlain "Confirm password"
        if ($pw -ne $again) {
            Write-Host "Passwords do not match."
            return $false
        }
        New-User $name $pw
    }

    $themes = @("orange", "slate", "noir", "ice")
    $tIdx = Select-Menu "Theme" $themes
    $theme = if ($tIdx -ge 0) { $themes[$tIdx] } else { "orange" }

    $foxosIdx = Select-Menu "FoxOS rain wallpaper" @("On", "Off")
    $foxos = ($foxosIdx -ne 1)

    $lookIdx = Select-Menu "FoxOS look (dark Windows, no icons, taskbar hides, Win key = FoxTerminal)" @("On", "Off")
    $look = ($lookIdx -eq 0)

    $logonIdx = Select-Menu "Open Ghostty at Windows sign-in" @("On", "Off")
    $logon = ($logonIdx -ne 1)

    $hkIdx = Select-Menu "Start FoxHotkeys" @("On", "Off")
    $hotkeys = ($hkIdx -ne 1)

    $lockIdx = Select-Menu "Lock after idle" @("10 minutes", "Off")
    $lockMin = if ($lockIdx -eq 1) { 0 } else { 10 }

    Set-CurrentUser $name
    $world = Get-FoxDefaultUserWorld
    $world.theme = $theme
    $world.foxos = $foxos
    $world.look = $look
    $world.lockMinutes = $lockMin
    Write-FoxUserWorld $world $name | Out-Null
    Apply-FoxUserWorld | Out-Null
    if ($look -and (Get-Command Set-FoxLookPart -ErrorAction SilentlyContinue)) {
        # Apply-FoxUserWorld ran the look quietly; the admin part asks once here, where the user is watching.
        try { Set-FoxLookPart -Part "oem" -On $true | Out-Null } catch {}
    }

    if ($logon -and (Get-Command Get-GhosttyCommand -ErrorAction SilentlyContinue)) {
        $g = Get-GhosttyCommand
        if ($g -and (Get-Command Install-FoxGhosttyLogonStart -ErrorAction SilentlyContinue)) {
            try { Install-FoxGhosttyLogonStart -Ghostty $g -WorkingDirectory (Get-FoxRoot) | Out-Null } catch {}
        }
    }
    if (-not $logon -and (Get-Command Remove-FoxGhosttyLogonStart -ErrorAction SilentlyContinue)) {
        try { Remove-FoxGhosttyLogonStart | Out-Null } catch {}
    }
    if ($hotkeys) {
        try { & (Join-Path $PSScriptRoot "foxhotkeys.ps1") } catch {}
    }

    Set-FoxFirstBootDone
    Write-FoxToast ("first boot  " + $name)
    Write-Host ""
    Write-Host (Color-Text $p.accent2 ("  Ready. Logged in as " + $name))
    return $true
}

function Get-FoxSettingsUser {
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) { return $env:FOXTERM_USER }
    if (Get-Command Get-PersistedUserName -ErrorAction SilentlyContinue) {
        $n = Get-PersistedUserName
        if (-not [string]::IsNullOrWhiteSpace($n)) { return $n }
    }
    return $null
}

function Get-FoxSettingsTheme {
    $disk = $null
    if (Get-Command Get-ThemePath -ErrorAction SilentlyContinue) {
        $path = Get-ThemePath
        if (Test-Path -LiteralPath $path) {
            $disk = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue).Trim()
        }
    }
    if (-not [string]::IsNullOrWhiteSpace($disk)) { return $disk }
    $world = Read-FoxUserWorld (Get-FoxSettingsUser)
    if ($world.theme) { return [string]$world.theme }
    return "orange"
}

function Get-FoxSettingsState {
    $name = Get-FoxSettingsUser
    $world = Read-FoxUserWorld $name
    $autostart = $false
    if (Get-Command Get-FoxLogonFlagPath -ErrorAction SilentlyContinue) {
        $autostart = Test-Path -LiteralPath (Get-FoxLogonFlagPath)
    }
    $hk = $false
    if ($global:FOXTERM_HK_CACHE -and ((Get-Date) - $global:FOXTERM_HK_CACHE_AT).TotalSeconds -lt 8) {
        $hk = [bool]$global:FOXTERM_HK_CACHE
    } else {
        try {
            $hk = [bool](Get-CimInstance Win32_Process -Filter "Name LIKE 'AutoHotkey%'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*foxhotkeys.ahk*" } | Select-Object -First 1)
        } catch {}
        $global:FOXTERM_HK_CACHE = $hk
        $global:FOXTERM_HK_CACHE_AT = Get-Date
    }
    $foxos = if (Get-Command Test-FoxOsEnabled -ErrorAction SilentlyContinue) { [bool](Test-FoxOsEnabled) } else { [bool]$world.foxos }
    $look = if (Get-Command Test-FoxLookEnabled -ErrorAction SilentlyContinue) { [bool](Test-FoxLookEnabled) } else { [bool]$world.look }
    $shader = if (Get-Command Test-FoxShadersEnabled -ErrorAction SilentlyContinue) { [bool](Test-FoxShadersEnabled) } else { [bool]$world.shader }
    $dockStyle = "pill"; $dockPos = "bottom"; $dockSize = "normal"
    $dockHide = $false; $dockWins = "titles"; $dockTray = "full"
    $cursor = "neon"; $shell = $false
    if (Get-Command Read-FoxLookState -ErrorAction SilentlyContinue) {
        $ls = Read-FoxLookState
        if ($ls.dockStyle) { $dockStyle = [string]$ls.dockStyle }
        if ($ls.dockPos) { $dockPos = [string]$ls.dockPos }
        if ($ls.dockSize) { $dockSize = [string]$ls.dockSize }
        $dockHide = [bool]$ls.dockHide
        if ($ls.dockWins) { $dockWins = [string]$ls.dockWins }
        if ($ls.dockTray) { $dockTray = [string]$ls.dockTray }
        if ($ls.cursor) { $cursor = [string]$ls.cursor }
        if ($ls.parts -and $ls.parts.ContainsKey("shell")) { $shell = [bool]$ls.parts["shell"] }
    }
    return [ordered]@{
        user        = $name
        theme       = (Get-FoxSettingsTheme)
        foxos       = $foxos
        look        = $look
        shader      = $shader
        lockMinutes = [int]$world.lockMinutes
        autostart   = $autostart
        hotkeys     = $hk
        locked      = (Test-FoxSessionLocked)
        dockStyle   = $dockStyle
        dockPos     = $dockPos
        dockSize    = $dockSize
        dockHide    = $dockHide
        dockWins    = $dockWins
        dockTray    = $dockTray
        cursor      = $cursor
        shell       = $shell
    }
}

function Convert-FoxBool($Value) {
    if ($Value -is [bool]) { return $Value }
    $s = ("$Value").Trim().ToLowerInvariant()
    return ($s -eq "true" -or $s -eq "1" -or $s -eq "on")
}

function Get-FoxControlThemePath {
    return (Join-Path (Get-FoxOsRuntimeDir) "control-theme.txt")
}

function Import-FoxControlTheme {
    $path = Get-FoxControlThemePath
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $stamp = (Get-Item -LiteralPath $path).LastWriteTimeUtc
    if ($global:FOXTERM_CONTROL_THEME_AT -and $global:FOXTERM_CONTROL_THEME_AT -ge $stamp) { return $false }
    $name = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
    $global:FOXTERM_CONTROL_THEME_AT = $stamp
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $name = $name.Trim().ToLowerInvariant()
    $current = if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) { Get-ActiveThemeName } else { "" }
    if ($name -eq $current) { return $false }
    if (Get-Command Save-ActiveTheme -ErrorAction SilentlyContinue) {
        Save-ActiveTheme $name
    }
    $global:FOXTERM_OSC_APPLIED = $null
    if (Get-Command Apply-ThemeColors -ErrorAction SilentlyContinue) {
        try { Apply-ThemeColors } catch {}
    }
    if (Get-Command Ensure-OhMyPoshConfig -ErrorAction SilentlyContinue) {
        try { Ensure-OhMyPoshConfig | Out-Null } catch {}
    }
    return $true
}

function Set-FoxControlTheme([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $name = $name.Trim().ToLowerInvariant()
    $user = Get-FoxSettingsUser
    if (Get-Command Get-ThemePath -ErrorAction SilentlyContinue) {
        $name | Set-Content -LiteralPath (Get-ThemePath) -Encoding UTF8
    }
    if (Get-Command Get-ThemeSurfacePath -ErrorAction SilentlyContinue) {
        $surface = Get-ThemeSurfacePath
        if ($surface) { $name | Set-Content -LiteralPath $surface -Encoding UTF8 }
    }
    $name | Set-Content -LiteralPath (Get-FoxControlThemePath) -Encoding UTF8
    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) { Clear-FoxThemeCache }
    Set-FoxUserWorldValue -Key "theme" -Value $name -Name $user | Out-Null
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
        try { Write-FoxOsLiveState | Out-Null } catch {}
    }
    return $true
}

function Invoke-FoxSettingsEffects {
    param(
        [hashtable]$Patch,
        [switch]$FastTheme
    )
    if (-not $Patch) { return }
    if ($Patch.ContainsKey("theme") -and $Patch.theme) {
        if (-not $FastTheme) {
            if ((Get-Command Test-FoxOsEnabled -ErrorAction SilentlyContinue) -and (Test-FoxOsEnabled)) {
                if (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue) {
                    try { Sync-FoxOsSkin | Out-Null } catch {}
                }
            }
            if (Get-Command Sync-FoxGhosttyShader -ErrorAction SilentlyContinue) {
                try { Sync-FoxGhosttyShader | Out-Null } catch {}
            }
        } elseif (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
            try { Write-FoxOsLiveState | Out-Null } catch {}
        }
    }
    if ($Patch.ContainsKey("foxos")) {
        $foxosOn = Convert-FoxBool $Patch.foxos
        if ($foxosOn) {
            if (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue) {
                try { Sync-FoxOsSkin | Out-Null } catch {}
            }
            if (Get-Command Start-FoxOsLive -ErrorAction SilentlyContinue) {
                try { Start-FoxOsLive | Out-Null } catch {}
            }
        } else {
            if (Get-Command Stop-FoxOsLive -ErrorAction SilentlyContinue) {
                try { Stop-FoxOsLive } catch {}
            }
            if (Get-Command Restore-FoxOsDesktop -ErrorAction SilentlyContinue) {
                try { Restore-FoxOsDesktop | Out-Null } catch {}
            }
        }
    }
    if ($Patch.ContainsKey("look") -and (Get-Command Enable-FoxLook -ErrorAction SilentlyContinue)) {
        # -Quiet: no UAC from a background worker. `foxlook oem on` in the terminal does the admin part.
        if (Convert-FoxBool $Patch.look) {
            try { Enable-FoxLook -Quiet | Out-Null } catch {}
        } else {
            try { Disable-FoxLook } catch {}
        }
    }
    if ($Patch.ContainsKey("shader")) {
        if (Get-Command Sync-FoxGhosttyShader -ErrorAction SilentlyContinue) {
            try { Sync-FoxGhosttyShader | Out-Null } catch {}
        }
    }
}

function Apply-FoxSettingsPatch {
    param([hashtable]$Patch)
    if (-not $Patch) { return Get-FoxSettingsState }
    $user = Get-FoxSettingsUser
    if ($Patch.ContainsKey("theme") -and $Patch.theme) {
        Set-FoxControlTheme ([string]$Patch.theme) | Out-Null
    }
    if ($Patch.ContainsKey("foxos")) {
        $foxosOn = Convert-FoxBool $Patch.foxos
        Set-FoxUserWorldValue -Key "foxos" -Value $foxosOn -Name $user | Out-Null
        if (Get-Command Save-FoxOsState -ErrorAction SilentlyContinue) {
            Save-FoxOsState $foxosOn
        }
        if (-not $foxosOn -and (Get-Command Stop-FoxOsLive -ErrorAction SilentlyContinue)) {
            try { Stop-FoxOsLive } catch {}
        }
    }
    if ($Patch.ContainsKey("look")) {
        $lookOn = Convert-FoxBool $Patch.look
        Set-FoxUserWorldValue -Key "look" -Value $lookOn -Name $user | Out-Null
        if (Get-Command Read-FoxLookState -ErrorAction SilentlyContinue) {
            # Flag now so the reply shows the new state; the parts land in the effect worker.
            $ls = Read-FoxLookState
            $ls.on = $lookOn
            Write-FoxLookState $ls
        }
    }
    if ($Patch.ContainsKey("shader")) {
        $shaderOn = Convert-FoxBool $Patch.shader
        Set-FoxUserWorldValue -Key "shader" -Value $shaderOn -Name $user | Out-Null
        if (Get-Command Save-FoxShaderState -ErrorAction SilentlyContinue) {
            Save-FoxShaderState $shaderOn
        }
    }
    if ($Patch.ContainsKey("lockMinutes")) {
        Set-FoxUserWorldValue -Key "lockMinutes" -Value ([int]$Patch.lockMinutes) -Name $user | Out-Null
    }
    if ($Patch.ContainsKey("autostart")) {
        . (Join-Path $PSScriptRoot "ghostty-lib.ps1")
        if (Convert-FoxBool $Patch.autostart) {
            $g = Get-GhosttyCommand
            if ($g) { Install-FoxGhosttyLogonStart -Ghostty $g -WorkingDirectory (Get-FoxRoot) | Out-Null }
        } else {
            Remove-FoxGhosttyLogonStart | Out-Null
        }
    }
    if ($Patch.ContainsKey("hotkeys")) {
        $global:FOXTERM_HK_CACHE = $null
        if (Convert-FoxBool $Patch.hotkeys) { & (Join-Path $PSScriptRoot "foxhotkeys.ps1") }
        else { & (Join-Path $PSScriptRoot "foxhotkeys.ps1") -Stop }
    }
    if (Get-Command Set-FoxLookDock -ErrorAction SilentlyContinue) {
        foreach ($k in @("dockStyle", "dockPos", "dockSize", "dockHide", "dockWins", "dockTray")) {
            if ($Patch.ContainsKey($k)) {
                $v = $Patch[$k]
                if ($k -eq "dockHide") { $v = Convert-FoxBool $v }
                try { Set-FoxLookDock -Key $k -Value $v | Out-Null } catch {}
            }
        }
    }
    if ($Patch.ContainsKey("cursor") -and (Get-Command Set-FoxLookCursorStyle -ErrorAction SilentlyContinue)) {
        try { Set-FoxLookCursorStyle ([string]$Patch.cursor) 0 | Out-Null } catch {}
    }
    if ($Patch.ContainsKey("shell") -and (Get-Command Set-FoxLookPart -ErrorAction SilentlyContinue)) {
        try { Set-FoxLookPart -Part "shell" -On (Convert-FoxBool $Patch.shell) | Out-Null } catch {}
    }
    Write-FoxToast "settings saved"
    return Get-FoxSettingsState
}

function Format-FoxSettingsSpin([string]$value) {
    $left = [string][char]0x25C0
    $right = [string][char]0x25B6
    return ($left + "  " + $value + "  " + $right)
}

function Copy-FoxSettingsDraft($s) {
    return [ordered]@{
        theme       = [string]$s.theme
        foxos       = [bool]$s.foxos
        look        = [bool]$s.look
        dockStyle   = [string]$s.dockStyle
        dockPos     = [string]$s.dockPos
        dockSize    = [string]$s.dockSize
        dockHide    = [bool]$s.dockHide
        dockWins    = [string]$s.dockWins
        dockTray    = [string]$s.dockTray
        cursor      = [string]$s.cursor
        shell       = [bool]$s.shell
        shader      = [bool]$s.shader
        autostart   = [bool]$s.autostart
        hotkeys     = [bool]$s.hotkeys
        lockMinutes = [int]$s.lockMinutes
    }
}

function Test-FoxSettingsDirty($draft, $applied) {
    if (-not $draft -or -not $applied) { return $false }
    return (
        [string]$draft.theme -ne [string]$applied.theme -or
        [bool]$draft.foxos -ne [bool]$applied.foxos -or
        [bool]$draft.look -ne [bool]$applied.look -or
        [string]$draft.dockStyle -ne [string]$applied.dockStyle -or
        [string]$draft.dockPos -ne [string]$applied.dockPos -or
        [string]$draft.dockSize -ne [string]$applied.dockSize -or
        [bool]$draft.dockHide -ne [bool]$applied.dockHide -or
        [string]$draft.dockWins -ne [string]$applied.dockWins -or
        [string]$draft.dockTray -ne [string]$applied.dockTray -or
        [string]$draft.cursor -ne [string]$applied.cursor -or
        [bool]$draft.shell -ne [bool]$applied.shell -or
        [bool]$draft.shader -ne [bool]$applied.shader -or
        [bool]$draft.autostart -ne [bool]$applied.autostart -or
        [bool]$draft.hotkeys -ne [bool]$applied.hotkeys -or
        [int]$draft.lockMinutes -ne [int]$applied.lockMinutes
    )
}

function Get-FoxSettingsMenuLines($draft, $applied) {
    $mark = {
        param($value, $dirty)
        if ($dirty) { return ((Format-FoxSettingsSpin $value) + " *") }
        return (Format-FoxSettingsSpin $value)
    }
    $foxos = if ($draft.foxos) { "on" } else { "off" }
    $look = if ($draft.look) { "on" } else { "off" }
    $hide = if ($draft.dockHide) { "on" } else { "off" }
    $shell = if ($draft.shell) { "on" } else { "off" }
    $shader = if ($draft.shader) { "on" } else { "off" }
    $auto = if ($draft.autostart) { "on" } else { "off" }
    $hk = if ($draft.hotkeys) { "on" } else { "off" }
    $lock = if ($draft.lockMinutes -gt 0) { "$($draft.lockMinutes) min" } else { "off" }
    $dirty = Test-FoxSettingsDirty $draft $applied
    $apply = if ($dirty) { "Apply changes  *" } else { "Apply changes" }
    return @(
        ("Theme          " + (& $mark $draft.theme ([string]$draft.theme -ne [string]$applied.theme))),
        ("FoxOS          " + (& $mark $foxos ([bool]$draft.foxos -ne [bool]$applied.foxos))),
        ("FoxOS look     " + (& $mark $look ([bool]$draft.look -ne [bool]$applied.look))),
        ("Taskbar        " + (& $mark $draft.dockStyle ([string]$draft.dockStyle -ne [string]$applied.dockStyle))),
        ("Bar place      " + (& $mark $draft.dockPos ([string]$draft.dockPos -ne [string]$applied.dockPos))),
        ("Bar size       " + (& $mark $draft.dockSize ([string]$draft.dockSize -ne [string]$applied.dockSize))),
        ("Bar hide       " + (& $mark $hide ([bool]$draft.dockHide -ne [bool]$applied.dockHide))),
        ("Bar apps       " + (& $mark $draft.dockWins ([string]$draft.dockWins -ne [string]$applied.dockWins))),
        ("Bar tray       " + (& $mark $draft.dockTray ([string]$draft.dockTray -ne [string]$applied.dockTray))),
        ("Cursor         " + (& $mark $draft.cursor ([string]$draft.cursor -ne [string]$applied.cursor))),
        ("FoxOS shell    " + (& $mark $shell ([bool]$draft.shell -ne [bool]$applied.shell))),
        ("Shader         " + (& $mark $shader ([bool]$draft.shader -ne [bool]$applied.shader))),
        ("Windows logon  " + (& $mark $auto ([bool]$draft.autostart -ne [bool]$applied.autostart))),
        ("Hotkeys        " + (& $mark $hk ([bool]$draft.hotkeys -ne [bool]$applied.hotkeys))),
        ("Idle lock      " + (& $mark $lock ([int]$draft.lockMinutes -ne [int]$applied.lockMinutes))),
        $apply,
        "Open Control UI",
        "Back"
    )
}

function Preview-FoxSettingsTheme([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    $name = $name.Trim().ToLowerInvariant()
    if (Get-Command Get-ThemeSurfacePath -ErrorAction SilentlyContinue) {
        $surface = Get-ThemeSurfacePath
        if ($surface) { $name | Set-Content -LiteralPath $surface -Encoding UTF8 }
    }
    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) { Clear-FoxThemeCache }
    if (Get-Command Apply-TerminalOscColors -ErrorAction SilentlyContinue) {
        try { Apply-TerminalOscColors } catch {}
    }
}

function Step-FoxPick([string]$cur, [string[]]$opts, [int]$dir) {
    $i = [Array]::IndexOf($opts, $cur)
    if ($i -lt 0) { $i = 0 }
    return $opts[(($i + $dir + $opts.Count) % $opts.Count)]
}

function Step-FoxSettingsDraft {
    param($Draft, [int]$Row, [int]$Dir)
    if ($Dir -eq 0) { $Dir = 1 }
    $themes = @("orange", "slate", "noir", "ice", "blue")
    $locks = @(0, 5, 10, 30)
    switch ($Row) {
        0 {
            $Draft.theme = Step-FoxPick ([string]$Draft.theme) $themes $Dir
            Preview-FoxSettingsTheme $Draft.theme
        }
        1 { $Draft.foxos = (-not $Draft.foxos) }
        2 { $Draft.look = (-not $Draft.look) }
        3 { $Draft.dockStyle = Step-FoxPick ([string]$Draft.dockStyle) @("pill", "rail", "glass", "slim") $Dir }
        4 { $Draft.dockPos = Step-FoxPick ([string]$Draft.dockPos) @("bottom", "top") $Dir }
        5 { $Draft.dockSize = Step-FoxPick ([string]$Draft.dockSize) @("compact", "normal", "large") $Dir }
        6 { $Draft.dockHide = (-not $Draft.dockHide) }
        7 { $Draft.dockWins = Step-FoxPick ([string]$Draft.dockWins) @("titles", "dots", "off") $Dir }
        8 { $Draft.dockTray = Step-FoxPick ([string]$Draft.dockTray) @("full", "clock", "off") $Dir }
        9 { $Draft.cursor = Step-FoxPick ([string]$Draft.cursor) @("neon", "pixel", "chunky", "fox") $Dir }
        10 { $Draft.shell = (-not $Draft.shell) }
        11 { $Draft.shader = (-not $Draft.shader) }
        12 { $Draft.autostart = (-not $Draft.autostart) }
        13 { $Draft.hotkeys = (-not $Draft.hotkeys) }
        14 {
            $cur = [int]$Draft.lockMinutes
            $i = 0
            for ($n = 0; $n -lt $locks.Count; $n++) {
                if ($locks[$n] -eq $cur) { $i = $n; break }
                if ($locks[$n] -lt $cur) { $i = $n }
            }
            $Draft.lockMinutes = $locks[(($i + $Dir + $locks.Count) % $locks.Count)]
        }
    }
    return $Draft
}

function Confirm-FoxSettingsDraft($draft, $applied) {
    if (-not (Test-FoxSettingsDirty $draft $applied)) { return $applied }
    $patch = @{}
    if ([string]$draft.theme -ne [string]$applied.theme) { $patch.theme = [string]$draft.theme }
    if ([bool]$draft.foxos -ne [bool]$applied.foxos) { $patch.foxos = [bool]$draft.foxos }
    if ([bool]$draft.look -ne [bool]$applied.look) { $patch.look = [bool]$draft.look }
    if ([string]$draft.dockStyle -ne [string]$applied.dockStyle) { $patch.dockStyle = [string]$draft.dockStyle }
    if ([string]$draft.dockPos -ne [string]$applied.dockPos) { $patch.dockPos = [string]$draft.dockPos }
    if ([string]$draft.dockSize -ne [string]$applied.dockSize) { $patch.dockSize = [string]$draft.dockSize }
    if ([bool]$draft.dockHide -ne [bool]$applied.dockHide) { $patch.dockHide = [bool]$draft.dockHide }
    if ([string]$draft.dockWins -ne [string]$applied.dockWins) { $patch.dockWins = [string]$draft.dockWins }
    if ([string]$draft.dockTray -ne [string]$applied.dockTray) { $patch.dockTray = [string]$draft.dockTray }
    if ([string]$draft.cursor -ne [string]$applied.cursor) { $patch.cursor = [string]$draft.cursor }
    if ([bool]$draft.shell -ne [bool]$applied.shell) { $patch.shell = [bool]$draft.shell }
    if ([bool]$draft.shader -ne [bool]$applied.shader) { $patch.shader = [bool]$draft.shader }
    if ([bool]$draft.autostart -ne [bool]$applied.autostart) { $patch.autostart = [bool]$draft.autostart }
    if ([bool]$draft.hotkeys -ne [bool]$applied.hotkeys) { $patch.hotkeys = [bool]$draft.hotkeys }
    if ([int]$draft.lockMinutes -ne [int]$applied.lockMinutes) { $patch.lockMinutes = [int]$draft.lockMinutes }
    $next = Apply-FoxSettingsPatch $patch
    Invoke-FoxSettingsEffects $patch -FastTheme
    if ($patch.ContainsKey("theme")) {
        if (Get-Command Apply-ThemeColors -ErrorAction SilentlyContinue) {
            try { Apply-ThemeColors } catch {}
        }
        if (Get-Command Ensure-OhMyPoshConfig -ErrorAction SilentlyContinue) {
            try { Ensure-OhMyPoshConfig | Out-Null } catch {}
        }
    }
    if ($next) { return (Copy-FoxSettingsDraft $next) }
    return (Copy-FoxSettingsDraft (Get-FoxSettingsState))
}

function Show-FoxSettings {
    $applied = Copy-FoxSettingsDraft (Get-FoxSettingsState)
    $draft = Copy-FoxSettingsDraft $applied
    $index = 0
    try { [Console]::CursorVisible = $false } catch {}
    try {
        while ($true) {
            $p = Get-ThemePalette
            $fgSelected = Get-ContrastText $p.accent2
            $lines = Get-FoxSettingsMenuLines $draft $applied
            $dirty = Test-FoxSettingsDirty $draft $applied
            Clear-FoxHost
            Write-Host (Color-Text $p.accent "=== settings ===")
            Write-Host ""
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($i -eq $index) {
                    Write-Host (Color-TextBg $fgSelected $p.accent2 ("  " + $lines[$i] + "  "))
                } else {
                    Write-Host (Color-Text $p.text ("  " + $lines[$i]))
                }
            }
            Write-Host ""
            $hint = ("  " + [char]0x2191 + [char]0x2193 + " move   " + [char]0x2190 + [char]0x2192 + " pick   enter apply   esc back")
            Write-Host (Color-Text $p.dim $hint)
            if ($dirty) {
                Write-Host (Color-Text $p.accent2 "  not saved yet")
            }

            $key = [Console]::ReadKey($true)
            switch ($key.Key) {
                'UpArrow' { if ($index -gt 0) { $index-- } }
                'DownArrow' { if ($index -lt ($lines.Count - 1)) { $index++ } }
                'LeftArrow' {
                    if ($index -le 14) { $draft = Step-FoxSettingsDraft $draft $index (-1) }
                }
                'RightArrow' {
                    if ($index -le 14) { $draft = Step-FoxSettingsDraft $draft $index 1 }
                }
                'Enter' {
                    if ($index -eq 15) {
                        $applied = Confirm-FoxSettingsDraft $draft $applied
                        $draft = Copy-FoxSettingsDraft $applied
                    } elseif ($index -eq 16) {
                        Start-FoxSettingsGui
                    } elseif ($index -eq 17) {
                        if ($dirty) { Preview-FoxSettingsTheme $applied.theme }
                        Clear-FoxHost
                        return
                    } elseif ($dirty) {
                        $applied = Confirm-FoxSettingsDraft $draft $applied
                        $draft = Copy-FoxSettingsDraft $applied
                    }
                }
                'Escape' {
                    if ($dirty) { Preview-FoxSettingsTheme $applied.theme }
                    Clear-FoxHost
                    return
                }
            }
        }
    } finally {
        try { [Console]::CursorVisible = $true } catch {}
    }
}

function Get-FoxSettingsGuiDir {
    $root = Get-FoxRoot
    $site = Join-Path $root "sites\fox-terminal"
    if (Test-Path -LiteralPath $site) { return $site }
    return (Join-Path $root "FoxTerminal\control")
}

function Start-FoxSettingsGui {
    $page = Join-Path (Get-FoxSettingsGuiDir) "settings.html"
    if (-not (Test-Path -LiteralPath $page)) {
        Write-Host "settings.html missing."
        return
    }
    $ps1 = Join-Path $PSScriptRoot "settings.ps1"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ps1, "-Gui"
    ) -WindowStyle Hidden | Out-Null
    Write-Host "Control UI: http://127.0.0.1:17321/settings.html"
}

function Start-FoxSettingsEffectWorker {
    $queue = New-Object 'System.Collections.Concurrent.ConcurrentQueue[hashtable]'
    $rs = [runspacefactory]::CreateRunspace()
    $rs.Open()
    $ps = [PowerShell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript({
        param($CmdDir, $Queue)
        Set-Location -LiteralPath $CmdDir
        . (Join-Path $CmdDir "foxauth.ps1")
        . (Join-Path $CmdDir "ghostty-lib.ps1")
        while ($true) {
            $patch = $null
            if ($Queue.TryDequeue([ref]$patch)) {
                try { Invoke-FoxSettingsEffects $patch } catch {}
            } else {
                Start-Sleep -Milliseconds 40
            }
        }
    }).AddArgument($PSScriptRoot).AddArgument($queue)
    [void]$ps.BeginInvoke()
    return @{ Queue = $queue; Runspace = $rs; Shell = $ps }
}

function Start-FoxSettingsHost {
    param([string]$WebRoot, [int]$Port = 17321)
    $fx = Start-FoxSettingsEffectWorker
    $listener = New-Object System.Net.HttpListener
    $prefix = "http://127.0.0.1:$Port/"
    $listener.Prefixes.Add($prefix)
    try {
        $listener.Start()
    } catch {
        Write-Host "Control UI port $Port is busy. In Ghostty press Ctrl+C, then run settings -StopGui and settings -Gui."
        try { $fx.Shell.Stop() } catch {}
        try { $fx.Runspace.Dispose() } catch {}
        return
    }
    try {
        while ($listener.IsListening) {
            $ctx = $listener.GetContext()
            $req = $ctx.Request
            $res = $ctx.Response
            $res.Headers.Add("Access-Control-Allow-Origin", "*")
            $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            if ($req.HttpMethod -eq "OPTIONS") { $res.StatusCode = 204; $res.Close(); continue }
            $path = $req.Url.AbsolutePath
            if ($path -eq "/api/state" -and $req.HttpMethod -eq "GET") {
                $json = (Get-FoxSettingsState | ConvertTo-Json -Compress)
                $bytes = [Text.Encoding]::UTF8.GetBytes($json)
                $res.ContentType = "application/json; charset=utf-8"
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.Close()
                continue
            }
            if ($path -eq "/api/stop" -and $req.HttpMethod -eq "POST") {
                $res.StatusCode = 204
                $res.Close()
                $listener.Stop()
                break
            }
            if ($path -eq "/api/apply" -and $req.HttpMethod -eq "POST") {
                $patch = $null
                try {
                    $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
                    $body = $reader.ReadToEnd()
                    $obj = $body | ConvertFrom-Json
                    $patch = @{}
                    $obj.PSObject.Properties | ForEach-Object { $patch[$_.Name] = $_.Value }
                    $json = (Apply-FoxSettingsPatch $patch | ConvertTo-Json -Compress)
                    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
                    $res.ContentType = "application/json; charset=utf-8"
                    $res.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $res.StatusCode = 500
                    $err = [Text.Encoding]::UTF8.GetBytes((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress))
                    $res.ContentType = "application/json; charset=utf-8"
                    $res.OutputStream.Write($err, 0, $err.Length)
                    $patch = $null
                }
                $res.Close()
                if ($patch) { [void]$fx.Queue.Enqueue($patch) }
                continue
            }
            $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
            if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "settings.html" }
            $file = [IO.Path]::GetFullPath((Join-Path $WebRoot $rel))
            $rootFull = [IO.Path]::GetFullPath($WebRoot)
            if (-not $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
                $res.StatusCode = 404
                $res.Close()
                continue
            }
            if (-not (Test-Path -LiteralPath $file)) {
                $res.StatusCode = 404
                $res.Close()
                continue
            }
            $bytes = [IO.File]::ReadAllBytes($file)
            $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
            $res.ContentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css" { "text/css; charset=utf-8" }
                ".js" { "application/javascript; charset=utf-8" }
                ".png" { "image/png" }
                ".svg" { "image/svg+xml" }
                default { "application/octet-stream" }
            }
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
        }
    } finally {
        try { $listener.Stop() } catch {}
        try { $fx.Shell.Stop() } catch {}
        try { $fx.Runspace.Dispose() } catch {}
    }
}
