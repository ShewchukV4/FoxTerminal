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
