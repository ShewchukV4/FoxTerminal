# FoxTerminal <-> Ghostty helper library (internal).
#
# Ghostty is the only terminal FoxTerminal supports. Upstream Ghostty ships for
# Linux and macOS; on Windows the same terminal core is available through the
# winghostty fork, which reads the identical config format. Every function here
# treats those two as one host and reports which flavor was found.

function Test-FoxIsWindows {
    if (Get-Variable -Name IsWindows -Scope Global -ErrorAction SilentlyContinue) { return [bool]$IsWindows }
    return ($env:OS -eq "Windows_NT")
}

function Test-FoxIsMacOS {
    if (Get-Variable -Name IsMacOS -Scope Global -ErrorAction SilentlyContinue) { return [bool]$IsMacOS }
    return $false
}

# winghostty ships two binaries next to each other:
#   .exe  Win32 GUI. Opens a window. CLI actions like +show-config fail with
#         "WriteFailed" because there is no stdout to write to.
#   .com  Console host. Prints to the terminal. Use this for +show-config,
#         +edit-config, +perform-action, and any other +action.
# Path is always the GUI binary (shortcuts, Start-Process). CliPath is the one
# that can talk to a console. On Linux/macOS they are the same file.
function Resolve-GhosttyPair([string]$foundPath, [string]$flavor, [string]$name) {
    $gui = $foundPath
    $cli = $foundPath
    $dir = Split-Path -Parent $foundPath
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($foundPath)
    if (-not [string]::IsNullOrWhiteSpace($dir) -and -not [string]::IsNullOrWhiteSpace($stem)) {
        $exe = Join-Path $dir ($stem + ".exe")
        $com = Join-Path $dir ($stem + ".com")
        if (Test-Path $exe) { $gui = $exe }
        if (Test-Path $com) { $cli = $com }
    }
    return @{ Name = $name; Path = $gui; CliPath = $cli; Flavor = $flavor }
}

function Get-GhosttyCliPath($ghostty) {
    if (-not $ghostty) { return $null }
    if ($ghostty.CliPath) { return $ghostty.CliPath }
    return $ghostty.Path
}

# Returns $null, or a hashtable: Name, Path (GUI), CliPath (console), Flavor.
function Get-GhosttyCommand {
    $names = @("ghostty", "winghostty")

    foreach ($name in $names) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) {
            return (Resolve-GhosttyPair $cmd.Source $name $name)
        }
    }

    if (-not (Test-FoxIsWindows)) {
        $unixCandidates = @(
            "/usr/bin/ghostty",
            "/usr/local/bin/ghostty",
            "/opt/homebrew/bin/ghostty",
            "/Applications/Ghostty.app/Contents/MacOS/ghostty"
        )
        foreach ($p in $unixCandidates) {
            if (Test-Path $p) {
                return (Resolve-GhosttyPair $p "ghostty" "ghostty")
            }
        }
        return $null
    }

    $winCandidates = @(
        "$env:LOCALAPPDATA\Programs\winghostty\winghostty.exe",
        "$env:LOCALAPPDATA\winghostty\bin\winghostty.exe",
        "$env:ProgramFiles\winghostty\winghostty.exe",
        "${env:ProgramFiles(x86)}\winghostty\winghostty.exe",
        "$env:USERPROFILE\scoop\apps\winghostty\current\winghostty.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links\winghostty.exe"
    )
    foreach ($p in $winCandidates) {
        if ([string]::IsNullOrWhiteSpace($p)) { continue }
        if (Test-Path $p) {
            return (Resolve-GhosttyPair $p "winghostty" "winghostty")
        }
    }

    return $null
}

# Candidate config paths, most specific first. Ghostty reads both the extension-less
# "config" and the newer "config.ghostty" name.
function Get-GhosttyConfigCandidates {
    $candidates = New-Object System.Collections.Generic.List[string]

    $xdg = $env:XDG_CONFIG_HOME
    if (-not [string]::IsNullOrWhiteSpace($xdg)) {
        $candidates.Add((Join-Path $xdg "ghostty\config.ghostty"))
        $candidates.Add((Join-Path $xdg "ghostty\config"))
    }

    if (Test-FoxIsWindows) {
        if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
            # Documented winghostty default; written on first launch.
            $candidates.Add((Join-Path $env:LOCALAPPDATA "winghostty\config.ghostty"))
            $candidates.Add((Join-Path $env:LOCALAPPDATA "winghostty\config"))
        }
        if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
            $candidates.Add((Join-Path $env:APPDATA "ghostty\config.ghostty"))
            $candidates.Add((Join-Path $env:APPDATA "ghostty\config"))
        }
    } else {
        $home = $HOME
        if ([string]::IsNullOrWhiteSpace($home)) { $home = $env:HOME }
        if (Test-FoxIsMacOS) {
            $candidates.Add((Join-Path $home "Library/Application Support/com.mitchellh.ghostty/config"))
        }
        $candidates.Add((Join-Path $home ".config/ghostty/config.ghostty"))
        $candidates.Add((Join-Path $home ".config/ghostty/config"))
    }

    return $candidates.ToArray()
}

# The path FoxTerminal will write to: an existing config if there is one,
# otherwise the platform default.
function Get-GhosttyConfigPath {
    $candidates = Get-GhosttyConfigCandidates
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    if ($candidates.Count -gt 0) { return $candidates[0] }
    return $null
}

function Get-GhosttyConfigDir {
    $path = Get-GhosttyConfigPath
    if ([string]::IsNullOrWhiteSpace($path)) { return $null }
    return (Split-Path -Parent $path)
}

function Get-FoxRepoRoot {
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_ROOT) -and (Test-Path $env:FOXTERM_ROOT)) {
        return (Resolve-Path $env:FOXTERM_ROOT).Path
    }
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-FoxGhosttySourceDir {
    return (Join-Path (Get-FoxRepoRoot) "FoxTerminal\ghostty")
}

# True when the current session is running inside Ghostty / winghostty.
function Test-InGhostty {
    if ($env:GHOSTTY_RESOURCES_DIR) { return $true }
    if ($env:GHOSTTY_BIN_DIR) { return $true }
    if ($env:TERM_PROGRAM -and $env:TERM_PROGRAM.ToLowerInvariant().Contains("ghostty")) { return $true }
    if ($env:TERM -and $env:TERM.ToLowerInvariant().Contains("ghostty")) { return $true }
    return $false
}

function Test-FoxGhosttyRunning {
    return [bool](Get-Process -Name "winghostty","ghostty" -ErrorAction SilentlyContinue)
}

# Open a real FoxTerminal Ghostty window.
# Never pass +new-window or -e to the GUI .exe — that skips login or opens a dead window.
# If Ghostty is already running, reuse it. A new process always hits Ensure-Login.
function Start-FoxGhosttyWindow {
    param([string]$Command)

    $ghostty = Get-GhosttyCommand
    if (-not $ghostty) { return $false }

    $root = Get-FoxRepoRoot
    if ([string]::IsNullOrWhiteSpace($root) -or -not (Test-Path -LiteralPath $root)) {
        $root = (Get-Location).Path
    }

    $cmd = ""
    if (-not [string]::IsNullOrWhiteSpace($Command)) {
        $raw = $Command.Trim()
        if ($raw -match '^[A-Za-z][A-Za-z0-9._-]*(\s+[A-Za-z0-9._-]+)*$') {
            $cmd = $raw
        }
    }

    if (Test-FoxGhosttyRunning) {
        return $true
    }

    Start-Process -FilePath $ghostty.Path -WorkingDirectory $root | Out-Null
    return $true
}

# Visible Ghostty at Windows logon. Explorer's Startup folder waits until the
# machine is idle (often ~1 min). A logon scheduled task does not. The launcher
# starts Ghostty with no args so the GUI boot hits Ensure-Login.
# Do not pass +new-window or -e.

function Get-FoxLogonTaskName { return "FoxTerminal" }

function Get-FoxLogonDir {
    return (Join-Path $env:LOCALAPPDATA "FoxTerminal")
}

function Get-FoxLogonCmdPath {
    return (Join-Path (Get-FoxLogonDir) "fox-logon.cmd")
}

function Get-FoxLogonFlagPath {
    return (Join-Path (Get-FoxLogonDir) "logon-autostart")
}

function Get-FoxStartupLogonLinkPath {
    $startup = [Environment]::GetFolderPath("Startup")
    if ([string]::IsNullOrWhiteSpace($startup)) {
        $startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    }
    return (Join-Path $startup "FoxTerminal.lnk")
}

function Write-FoxLogonLauncher {
    param(
        [string]$GhosttyPath,
        [string]$WorkingDirectory
    )

    $dir = Get-FoxLogonDir
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $exe = $GhosttyPath.TrimEnd('\')
    $work = $WorkingDirectory.TrimEnd('\')
    $cmdPath = Get-FoxLogonCmdPath
    $lines = @(
        "@echo off",
        "rem Generated by FoxTerminal. Opens Ghostty at Windows sign-in.",
        "tasklist /FI `"IMAGENAME eq winghostty.exe`" | find /I `"winghostty.exe`" >nul 2>nul",
        "if not errorlevel 1 exit /b 0",
        "tasklist /FI `"IMAGENAME eq ghostty.exe`" | find /I `"ghostty.exe`" >nul 2>nul",
        "if not errorlevel 1 exit /b 0",
        "start `"`" /D `"$work`" `"$exe`""
    )
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($cmdPath, (($lines -join "`r`n") + "`r`n"), $utf8)
    [System.IO.File]::WriteAllText((Get-FoxLogonFlagPath), $exe, $utf8)
    return $cmdPath
}

function Register-FoxLogonTask {
    param([string]$CmdPath)

    $who = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute $CmdPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $who
    try { $trigger.Delay = "PT0S" } catch {}
    $principal = New-ScheduledTaskPrincipal -UserId $who -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -DontStopOnIdleEnd `
        -StartWhenAvailable `
        -MultipleInstances IgnoreNew
    $settings.DisallowStartIfOnBatteries = $false
    $settings.StopIfGoingOnBatteries = $false
    $settings.AllowDemandStart = $true
    $settings.ExecutionTimeLimit = "PT0S"
    $settings.Priority = 4
    $settings.Hidden = $false
    $name = Get-FoxLogonTaskName
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Open Ghostty at Windows sign-in (Test / Login / Register)" -Force | Out-Null
    return $true
}

function Install-FoxGhosttyLogonStart {
    param(
        [hashtable]$Ghostty,
        [string]$WorkingDirectory
    )

    if (-not (Test-FoxIsWindows)) { return $false }
    if (-not $Ghostty -or [string]::IsNullOrWhiteSpace($Ghostty.Path)) { return $false }
    if (-not (Test-Path -LiteralPath $Ghostty.Path)) { return $false }

    $work = $WorkingDirectory
    if ([string]::IsNullOrWhiteSpace($work) -or -not (Test-Path -LiteralPath $work)) {
        $work = Get-FoxRepoRoot
    }

    $cmdPath = Write-FoxLogonLauncher -GhosttyPath $Ghostty.Path -WorkingDirectory $work

    # Startup-folder shortcuts wait for Explorer idle. Drop ours so logon is not gated on that.
    $oldLnk = Get-FoxStartupLogonLinkPath
    if (Test-Path -LiteralPath $oldLnk) {
        Remove-Item -LiteralPath $oldLnk -Force -ErrorAction SilentlyContinue
    }

    $taskOk = $false
    try {
        $taskOk = [bool](Register-FoxLogonTask -CmdPath $cmdPath)
    } catch {
        $taskOk = $false
    }

    try {
        $run = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
        if (-not (Test-Path -LiteralPath $run)) {
            New-Item -Path $run -Force | Out-Null
        }
        New-ItemProperty -Path $run -Name "FoxTerminal" -Value ("`"" + $cmdPath + "`"") -PropertyType String -Force | Out-Null
    } catch {}

    try {
        $serialize = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize"
        if (-not (Test-Path -LiteralPath $serialize)) {
            New-Item -Path $serialize -Force | Out-Null
        }
        New-ItemProperty -Path $serialize -Name "StartupDelayInMSec" -Value 0 -PropertyType DWord -Force | Out-Null
        New-ItemProperty -Path $serialize -Name "WaitForIdleState" -Value 0 -PropertyType DWord -Force | Out-Null
    } catch {}

    if ($taskOk) { return ("task:" + (Get-FoxLogonTaskName)) }
    return $cmdPath
}

function Remove-FoxGhosttyLogonStart {
    if (-not (Test-FoxIsWindows)) { return $false }
    $removed = $false

    $lnk = Get-FoxStartupLogonLinkPath
    if (Test-Path -LiteralPath $lnk) {
        Remove-Item -LiteralPath $lnk -Force -ErrorAction SilentlyContinue
        $removed = $true
    }

    try {
        Unregister-ScheduledTask -TaskName (Get-FoxLogonTaskName) -Confirm:$false -ErrorAction Stop
        $removed = $true
    } catch {}

    try {
        Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "FoxTerminal" -ErrorAction Stop
        $removed = $true
    } catch {}

    foreach ($p in @((Get-FoxLogonCmdPath), (Get-FoxLogonFlagPath))) {
        if (Test-Path -LiteralPath $p) {
            Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue
            $removed = $true
        }
    }
    return $removed
}

function Ensure-FoxGhosttyWinApi {
    if ("FoxGhosttyWin" -as [type]) { return $true }
    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FoxGhosttyWin {
    public const int SW_MAXIMIZE = 3;
    public const uint SWP_SHOWWINDOW = 0x0040;
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
        return $true
    } catch {
        return $false
    }
}

function Get-FoxGhosttyWindowHandle {
    foreach ($name in @("winghostty", "ghostty")) {
        $proc = Get-Process -Name $name -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
            Select-Object -First 1
        if ($proc) { return $proc.MainWindowHandle }
    }
    return [IntPtr]::Zero
}

function Save-FoxGhosttyWindowPlace {
    if (-not (Ensure-FoxGhosttyWinApi)) { return $null }
    $h = Get-FoxGhosttyWindowHandle
    if ($h -eq [IntPtr]::Zero) { return $null }
    $rect = New-Object FoxGhosttyWin+RECT
    if (-not [FoxGhosttyWin]::GetWindowRect($h, [ref]$rect)) { return $null }
    return @{
        Handle    = $h
        Maximized = [FoxGhosttyWin]::IsZoomed($h)
        Left      = $rect.Left
        Top       = $rect.Top
        Width     = ($rect.Right - $rect.Left)
        Height    = ($rect.Bottom - $rect.Top)
    }
}

function Restore-FoxGhosttyWindowPlace($place) {
    if (-not $place) { return }
    if (-not (Ensure-FoxGhosttyWinApi)) { return }
    $h = $place.Handle
    if ($h -eq [IntPtr]::Zero) { $h = Get-FoxGhosttyWindowHandle }
    if ($h -eq [IntPtr]::Zero) { return }
    Start-Sleep -Milliseconds 120
    $w = [int]$place.Width
    $ht = [int]$place.Height
    if ($w -ge 200 -and $ht -ge 100) {
        [void][FoxGhosttyWin]::SetWindowPos(
            $h, [IntPtr]::Zero,
            [int]$place.Left, [int]$place.Top, $w, $ht,
            [FoxGhosttyWin]::SWP_SHOWWINDOW
        )
    }
    if ($place.Maximized) {
        [void][FoxGhosttyWin]::ShowWindow($h, [FoxGhosttyWin]::SW_MAXIMIZE)
    }
}

function Get-GhosttyInstallHint {
    if (Test-FoxIsWindows) {
        return @(
            "Ghostty upstream does not ship a Windows app yet.",
            "On Windows FoxTerminal uses winghostty - the Ghostty terminal core with a native Win32 runtime.",
            "  winget install AmanThanvi.winghostty",
            "  or: scoop bucket add winghostty https://github.com/amanthanvi/scoop-winghostty; scoop install winghostty",
            "  or download from https://github.com/amanthanvi/winghostty/releases"
        )
    }
    if (Test-FoxIsMacOS) {
        return @(
            "Install Ghostty:",
            "  brew install --cask ghostty",
            "  or download from https://ghostty.org/download"
        )
    }
    return @(
        "Install Ghostty with your package manager, or see https://ghostty.org/download",
        "  Arch:   pacman -S ghostty",
        "  Fedora: dnf install ghostty",
        "  Debian/Ubuntu: see https://ghostty.org/docs/install/binary"
    )
}
