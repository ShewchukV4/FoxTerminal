param(
    [switch]$Check,
    [switch]$Install
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "hk_lib.ps1")

$RootDir = Split-Path $PSScriptRoot -Parent

# ============================================================
# Detection helpers
# ============================================================

function Find-InRegistry {
    param([string[]]$Keys, [string[]]$ValueNames)
    foreach ($key in $Keys) {
        try {
            $item = Get-ItemProperty $key -ErrorAction SilentlyContinue
            foreach ($vn in $ValueNames) {
                $val = $item.$vn
                if ($val -and (Test-Path $val)) { return $val }
            }
        } catch {}
    }
    return $null
}

function Find-FireFox {
    . (Join-Path $PSScriptRoot "fox-browser.ps1")
    try {
        $info = Get-FoxBrowserInfo
        if ($info -and $info.Path -and (Test-Path $info.Path)) {
            return $info.Path
        }
    } catch {}

    $knownPaths = @(
        "$env:ProgramFiles\Zen Browser\zen.exe",
        "$env:LOCALAPPDATA\Zen Browser\zen.exe",
        "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
        "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe",
        "$env:LOCALAPPDATA\Mozilla Firefox\firefox.exe"
    )
    foreach ($p in $knownPaths) { if (Test-Path $p) { return $p } }

    foreach ($name in @("zen", "firefox")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    }

    return $null
}

function Find-OhMyPosh {
    $cmd = Get-Command "oh-my-posh" -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }

    $knownPaths = @(
        "$env:LOCALAPPDATA\Programs\oh-my-posh\bin\oh-my-posh.exe",
        "$env:ProgramFiles\oh-my-posh\bin\oh-my-posh.exe",
        "$env:LOCALAPPDATA\oh-my-posh\oh-my-posh.exe",
        "$env:USERPROFILE\AppData\Local\Programs\oh-my-posh\bin\oh-my-posh.exe"
    )
    foreach ($p in $knownPaths) { if (Test-Path $p) { return $p } }

    # scoop
    foreach ($scoop in @("$env:USERPROFILE\scoop","$env:LOCALAPPDATA\scoop")) {
        $p = "$scoop\apps\oh-my-posh\current\bin\oh-my-posh.exe"
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Find-Dotnet9 {
    $cmd = Get-Command "dotnet" -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    try {
        $runtimes = & dotnet --list-runtimes 2>$null
        $has9 = $runtimes | Where-Object { $_ -match "Microsoft\.NETCore\.App 9\." }
        if ($has9) { return $cmd.Source }
    } catch {}
    # Check if dotnet exists but runtime 9 missing
    return $null
}

function Find-DotnetSdk9 {
    $cmd = Get-Command "dotnet" -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    try {
        $sdks = & dotnet --list-sdks 2>$null
        $has9 = $sdks | Where-Object { $_ -match "^9\." }
        if ($has9) { return $cmd.Source }
    } catch {}
    return $null
}

function Find-FoxTermApp {
    $candidates = @(
        (Join-Path $RootDir "FoxTerminalApp\FoxTerminal.UI\bin\Release\net9.0\FoxTerminal.UI.exe"),
        (Join-Path $RootDir "FoxTerminalApp\FoxTerminal.UI\bin\Debug\net9.0\FoxTerminal.UI.exe")
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    return $null
}

function Find-Git {
    $cmd = Get-Command "git" -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    $p = "$env:ProgramFiles\Git\bin\git.exe"
    if (Test-Path $p) { return $p }
    return $null
}

function Find-WindowsTerminal {
    $wt = Get-Command "wt" -ErrorAction SilentlyContinue
    if ($wt) { return $wt.Source }
    # Check store package
    try {
        $pkg = Get-AppxPackage -Name "Microsoft.WindowsTerminal" -ErrorAction SilentlyContinue
        if ($pkg) { return "WindowsTerminal (Store)" }
    } catch {}
    return $null
}

function Find-Ollama {
    $cmd = Get-Command "ollama" -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    $p = "$env:ProgramFiles\Ollama\ollama.exe"
    if (Test-Path $p) { return $p }
    return $null
}

function Find-WinGet {
    $cmd = Get-Command "winget" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# ============================================================
# Install via winget
# ============================================================

function Install-Via-WinGet {
    param([string]$Id, [string]$DisplayName)
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent2 "  Installing $DisplayName via winget...")
    try {
        $proc = Start-Process "winget" `
            -ArgumentList "install --id $Id --silent --accept-package-agreements --accept-source-agreements" `
            -PassThru -Wait -WindowStyle Hidden
        if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq -1978335189) {
            Write-Host (Color-Text $p.accent "  $DisplayName installed OK.")
            return $true
        }
        Write-Host (Color-Text $p.dim "  winget exit code: $($proc.ExitCode)")
        return $false
    } catch {
        Write-Host (Color-Text $p.dim "  winget failed: $_")
        return $false
    }
}

function Build-FoxTermApp {
    $p       = Get-ThemePalette
    $projDir = Join-Path $RootDir "FoxTerminalApp\FoxTerminal.UI"
    $dotnet  = Get-Command "dotnet" -ErrorAction SilentlyContinue
    if (-not $dotnet) {
        Write-Host (Color-Text $p.dim "  dotnet not found - cannot build FoxTerminalApp.")
        return $false
    }
    Write-Host (Color-Text $p.accent2 "  Building FoxTerminalApp (dotnet build)...")
    try {
        $proc = Start-Process "dotnet" -ArgumentList "build `"$projDir`" -c Release --nologo -v q" `
            -PassThru -Wait -NoNewWindow
        if ($proc.ExitCode -eq 0) {
            Write-Host (Color-Text $p.accent "  FoxTerminalApp built OK.")
            return $true
        }
        Write-Host (Color-Text $p.dim "  Build failed (exit code $($proc.ExitCode)). Try: dotnet build FoxTerminalApp\FoxTerminal.UI")
        return $false
    } catch {
        Write-Host (Color-Text $p.dim "  Build error: $_")
        return $false
    }
}

# ============================================================
# Status table
# ============================================================

function Write-DepRow {
    param([string]$Label, [string]$Path, [bool]$Required, [string]$Extra = "")
    $p = Get-ThemePalette
    $ok = -not [string]::IsNullOrWhiteSpace($Path)
    $tag = if ($ok) { "[OK]    " } elseif ($Required) { "[MISS]  " } else { "[--]    " }
    $color = if ($ok) { $p.accent } elseif ($Required) { $p.accent2 } else { $p.dim }
    $short = if ($ok) { $Path } else { if ($Required) { "NOT FOUND" } else { "not installed (optional)" } }
    if ($short.Length -gt 60) { $short = "..." + $short.Substring($short.Length - 57) }
    if ($Extra) { $short += "  ($Extra)" }
    Write-Host (Color-Text $color ("  " + $tag + ("{0,-22}" -f $Label) + " " + $short))
}

# ============================================================
# Main
# ============================================================

$p = Get-ThemePalette
Clear-FoxHost
Write-Host (Color-Text $p.accent "=== FoxTerminal dependency check ===")
Write-Host ""
Write-Host (Color-Text $p.dim "  Scanning... (this may take a few seconds)")
Write-Host ""

# Gather
$ffPath   = Find-FireFox
$ompPath  = Find-OhMyPosh
$ahkPath  = Find-AHK
$dn9Path  = Find-Dotnet9
$sdk9Path = Find-DotnetSdk9
$ftPath   = Find-FoxTermApp
$gitPath  = Find-Git
$wtPath   = Find-WindowsTerminal
$olPath   = Find-Ollama
$wgPath   = Find-WinGet

$canWinGet = -not [string]::IsNullOrWhiteSpace($wgPath)

# Display
Write-Host (Color-Text $p.accent2 "  Required:")
Write-DepRow "Browser (Zen)"    $ffPath   $true  "Zen preferred, Firefox fallback"
Write-DepRow "Oh My Posh"      $ompPath  $true
Write-DepRow "AutoHotkey v2"   $ahkPath  $true  "for foxhotkeys"
Write-DepRow ".NET 9 Runtime"  $dn9Path  $true  "for FoxTerminalApp"
Write-DepRow ".NET 9 SDK"      $sdk9Path $true  "to build FoxTerminalApp"
Write-DepRow "FoxTerminalApp"  $ftPath   $true  "built exe"
Write-Host ""
Write-Host (Color-Text $p.accent2 "  Optional:")
Write-DepRow "Git"               $gitPath $false "for prompt git info"
Write-DepRow "Windows Terminal"  $wtPath  $false "better terminal host"
Write-DepRow "Ollama"            $olPath  $false "for ask/friend AI"
Write-Host ""

if ($canWinGet) {
    Write-Host (Color-Text $p.dim "  winget: available ($wgPath)")
} else {
    Write-Host (Color-Text $p.dim "  winget: NOT FOUND - some auto-installs unavailable")
}
Write-Host ""

# Build missing list
$missing = [System.Collections.Generic.List[object]]::new()

if (-not $ffPath)  { $missing.Add([pscustomobject]@{ name="Zen Browser";     id="";                                 action="manual"; required=$true }) }
if (-not $ompPath) { $missing.Add([pscustomobject]@{ name="Oh My Posh";      id="JanDeDobbeleer.OhMyPosh";          action="winget"; required=$true }) }
if (-not $ahkPath) { $missing.Add([pscustomobject]@{ name="AutoHotkey v2";   id="AutoHotkey.AutoHotkey";             action="winget"; required=$true }) }
if (-not $dn9Path -or -not $sdk9Path) {
    $missing.Add([pscustomobject]@{ name=".NET 9 SDK"; id="Microsoft.DotNet.SDK.9";    action="winget"; required=$true })
}
if (-not $ftPath -and ($sdk9Path -or $dn9Path)) {
    $missing.Add([pscustomobject]@{ name="FoxTerminalApp (build)"; id=""; action="build"; required=$true })
}

if ($missing.Count -eq 0) {
    Write-Host (Color-Text $p.accent "  All required dependencies are installed!")
    Write-Host ""
    if (-not $Install) { exit 0 }
}

# If -Check only: just report
if ($Check -and -not $Install) {
    if ($missing.Count -gt 0) {
        Write-Host (Color-Text $p.accent2 "  Missing required:")
        foreach ($m in $missing) { Write-Host "    - $($m.name)" }
        Write-Host ""
        Write-Host (Color-Text $p.dim "  Run:  foxdeps -Install  to fix automatically")
    }
    exit 0
}

# Ask or auto-install
if ($missing.Count -gt 0) {
    $missingNames = ($missing | ForEach-Object { $_.name }) -join ", "
    Write-Host (Color-Text $p.accent2 "  Missing: $missingNames")
    Write-Host ""

    if (-not $Install) {
        $ans = Read-Host "  Install missing now? (y/n)"
        $ansLow = $ans.Trim().ToLower()
        if ($ansLow -ne "y" -and $ansLow -ne "yes") {
            Write-Host (Color-Text $p.dim "  Skipped. Run: foxdeps -Install")
            exit 0
        }
    }

    if (-not $canWinGet) {
        Write-Host (Color-Text $p.accent2 "  winget not available. Manual install links:")
        Write-Host "    Zen Browser:   https://zen-browser.app/download/"
        Write-Host "    Firefox:       https://www.mozilla.org/firefox/"
        Write-Host "    Oh My Posh:    https://ohmyposh.dev/docs/installation/windows"
        Write-Host "    AutoHotkey v2: https://www.autohotkey.com"
        Write-Host "    .NET 9 SDK:    https://dotnet.microsoft.com/download/dotnet/9.0"
        exit 1
    }

    Write-Host ""
    foreach ($m in $missing) {
        if ($m.action -eq "winget") {
            Install-Via-WinGet -Id $m.id -DisplayName $m.name
        } elseif ($m.action -eq "build") {
            Build-FoxTermApp
        }
        Start-Sleep -Milliseconds 300
    }

    # Re-check after install
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "  Re-checking...")
    Write-Host ""
    $ffPath2   = Find-FireFox
    $ompPath2  = Find-OhMyPosh
    $ahkPath2  = Find-AHK
    $dn9Path2  = Find-Dotnet9
    $sdk9Path2 = Find-DotnetSdk9
    $ftPath2   = Find-FoxTermApp

    Write-DepRow "Browser (Zen)"    $ffPath2   $true  "Zen preferred, Firefox fallback"
    Write-DepRow "Oh My Posh"      $ompPath2  $true
    Write-DepRow "AutoHotkey v2"   $ahkPath2  $true
    Write-DepRow ".NET 9 Runtime"  $dn9Path2  $true
    Write-DepRow ".NET 9 SDK"      $sdk9Path2 $true
    Write-DepRow "FoxTerminalApp"  $ftPath2   $true
    Write-Host ""

    $stillMissing = @($ffPath2, $ompPath2, $ahkPath2, $dn9Path2, $sdk9Path2, $ftPath2) |
        Where-Object { [string]::IsNullOrWhiteSpace($_) }
    if ($stillMissing.Count -eq 0) {
        Write-Host (Color-Text $p.accent "  All dependencies installed!")
        Write-Host (Color-Text $p.dim    "  Restart your terminal for PATH changes to apply.")
    } else {
        Write-Host (Color-Text $p.accent2 "  Some items still missing. You may need to restart the terminal and re-run foxdeps.")
    }
}
