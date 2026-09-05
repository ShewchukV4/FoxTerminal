param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SwArgs
)

# Ensure correct encoding so banner renders properly in all terminals
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$script:FoxAuthLoaded = $false
$script:SpiderMode = ($env:FOXTERM_SPIDER_PANEL -eq "1")
$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (Test-Path $foxauthPath) {
    try { . $foxauthPath; $script:FoxAuthLoaded = $true } catch {}
}

function Get-InstalledAppCount {
    $cachePath = Join-Path $env:TEMP "foxterm-appcount-cache.json"
    try {
        if (Test-Path $cachePath) {
            $cachedRaw = Get-Content -Path $cachePath -Raw -ErrorAction SilentlyContinue
            if (-not [string]::IsNullOrWhiteSpace($cachedRaw)) {
                $cached = $cachedRaw | ConvertFrom-Json
                $ts = [datetime]$cached.timestamp
                if (((Get-Date) - $ts).TotalMinutes -lt 30 -and $cached.count -ge 0) {
                    return [int]$cached.count
                }
            }
        }
    } catch {}

    $paths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $count = 0
    foreach ($p in $paths) {
        try {
            $count += (Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName }).Count
        } catch {}
    }
    try {
        @{ timestamp = (Get-Date).ToString("o"); count = $count } |
            ConvertTo-Json -Depth 3 |
            Set-Content -Path $cachePath -Encoding UTF8
    } catch {}
    return $count
}

function Format-Uptime([TimeSpan]$span) {
    $days = $span.Days
    $hours = $span.Hours
    $mins = $span.Minutes
    if ($days -gt 0) { return "$days d, $hours h, $mins m" }
    if ($hours -gt 0) { return "$hours h, $mins m" }
    return "$mins m"
}

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
$script:SwOs = Get-CimInstance Win32_OperatingSystem
$script:SwOsAt = Get-Date
$apps = Get-InstalledAppCount

$res = "N/A"
if ($gpu -and $gpu.CurrentHorizontalResolution -and $gpu.CurrentVerticalResolution) {
    $res = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)"
}

function Get-SwOsCached {
    if (-not $script:SwOs -or -not $script:SwOsAt -or ((Get-Date) - $script:SwOsAt).TotalSeconds -gt 15) {
        $script:SwOs = Get-CimInstance Win32_OperatingSystem
        $script:SwOsAt = Get-Date
    }
    return $script:SwOs
}

function Enable-VT {
    $sig = @"
using System;
using System.Runtime.InteropServices;
public static class VT {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out int lpMode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, int dwMode);
}
"@
    try { Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue | Out-Null } catch {}
    $STDOUT = -11
    $ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
    $h = [VT]::GetStdHandle($STDOUT)
    $mode = 0
    if ([VT]::GetConsoleMode($h, [ref]$mode)) {
        [VT]::SetConsoleMode($h, $mode -bor $ENABLE_VIRTUAL_TERMINAL_PROCESSING) | Out-Null
    }
}

function Get-AsciiArtData([string]$path, [int]$targetWidth, [char]$esc, [double]$charAspect, [switch]$HighDetail) {
    $cachePath = $null
    try {
        $info = Get-Item -LiteralPath $path -ErrorAction Stop
        $key = "$($info.FullName)|$($info.LastWriteTimeUtc.Ticks)|$targetWidth|$charAspect|$HighDetail"
        $sha = [System.Security.Cryptography.SHA1]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($key)
        $hash = -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") })
        $cachePath = Join-Path $env:TEMP ("foxterm-art-" + $hash + ".clixml")
        if (Test-Path $cachePath) {
            $cached = Import-Clixml -Path $cachePath -ErrorAction SilentlyContinue
            if ($cached -and $cached.Lines -and $cached.Colors) {
                return $cached
            }
        }
    } catch {}

    try {
        Add-Type -AssemblyName System.Drawing | Out-Null
    } catch {
        return @{ Lines = @("[image: System.Drawing not available]"); Colors = @(@()) }
    }

    if (-not (Test-Path $path)) {
        return @{ Lines = @("[image not found]"); Colors = @(@()) }
    }

    $img = [System.Drawing.Image]::FromFile($path)
    try {
        $aspect = $img.Height / [double]$img.Width
        $targetHeight = [int][Math]::Max(6, [Math]::Round($targetWidth * $aspect * $charAspect))
        $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
        $g.Dispose()

        $chars = if ($HighDetail) {
            ' .''`^'':,;iIl!|tTfFJ7XCvunmMkrRZU0OQK9$#%&@'
        } else {
            ' .,:;irsXA253hMHGS#9B&@'
        }
        $lines = New-Object System.Collections.Generic.List[string]
        $colors = New-Object System.Collections.Generic.List[object]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $lineColors = New-Object System.Collections.Generic.List[object]
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                $lum = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114)
                if ($HighDetail) {
                    if ($c.A -lt 20 -or $lum -lt 3) {
                        $line += " "
                        $lineColors.Add($null)
                        continue
                    }
                    $brightness = [Math]::Pow($lum / 255.0, 0.68)
                } else {
                    if ($c.A -lt 20 -or ($c.R -lt 10 -and $c.G -lt 10 -and $c.B -lt 10)) {
                        $line += " "
                        $lineColors.Add($null)
                        continue
                    }
                    $brightness = $lum / 255.0
                }
                $idx = [int]([Math]::Round($brightness * ($chars.Length - 1)))
                $ch = $chars[$idx]
                $line += $ch
                $lineColors.Add(@($c.R, $c.G, $c.B))
            }
            $lines.Add($line)
            $colors.Add($lineColors.ToArray())
        }
        $result = @{ Lines = $lines.ToArray(); Colors = $colors.ToArray() }
        if ($cachePath) {
            try { $result | Export-Clixml -Path $cachePath -Force } catch {}
        }
        return $result
    } finally {
        $img.Dispose()
    }
}

$foxRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
try { $script:SwWinW = $host.UI.RawUI.WindowSize.Width } catch { $script:SwWinW = 120 }
if ($script:SwWinW -le 0) { $script:SwWinW = 120 }
# Side-by-side art+info needs ~40 columns for the stats; below that, stack them.
$script:SwCompact = $script:SwWinW -lt 88
if ($script:SpiderMode) {
    $defaultImagePath = Join-Path $foxRoot "FoxTerminal\assets\spider-noir.png"
    $artTargetWidth = [Math]::Min(112, [Math]::Max(36, $script:SwWinW - 8))
} else {
    $bundledFox = Join-Path $foxRoot "FoxTerminal\assets\fox.png"
    $legacyFox = "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-09a73897-eaff-441b-94d6-e769a3f93cf5.png"
    if (Test-Path -LiteralPath $bundledFox) {
        $defaultImagePath = $bundledFox
    } else {
        $defaultImagePath = $legacyFox
    }
    if ($script:SwCompact) {
        $artTargetWidth = [Math]::Max(28, [Math]::Min(56, $script:SwWinW - 2))
    } else {
        $artTargetWidth = [Math]::Max(40, [Math]::Min(90, $script:SwWinW - 40))
    }
}
$imagePath = $defaultImagePath
foreach ($arg in $SwArgs) {
    if ([string]::IsNullOrWhiteSpace($arg)) { continue }
    if (Test-Path -LiteralPath $arg) { $imagePath = $arg; break }
}
$useColorArt = $false
if ($script:SpiderMode) { $useColorArt = $true }
if ($SwArgs -contains "color") { $useColorArt = $true }
# Ghostty is truecolor everywhere, so FOXTERM/GHOSTTY markers are enough.
if ($env:GHOSTTY_RESOURCES_DIR -or $env:FOXTERM -eq "1" -or ($env:TERM -like "*ghostty*") -or ($env:TERM_PROGRAM -like "*ghostty*")) { $useColorArt = $true }
if ($SwArgs -contains "mono") { $useColorArt = $false }
if (-not $useColorArt) {
    Enable-VT
    $useColorArt = $true
}
if ($useColorArt) { Enable-VT }
$esc = [char]27
function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

$charAspect = if ($script:SpiderMode) { 0.5 } else { 0.48 }
$artData = Get-AsciiArtData $imagePath $artTargetWidth $esc $charAspect -HighDetail:($script:SpiderMode)
$artRaw = $artData.Lines
$artColors = $artData.Colors

$useColorInfo = $useColorArt
function Get-ThemePath {
    return (Join-Path $PSScriptRoot "theme.txt")
}

function Save-Theme([string]$name) {
    if (Get-Command Save-ActiveTheme -ErrorAction SilentlyContinue) {
        Save-ActiveTheme $name
        return
    }
    $path = Get-ThemePath
    $name | Set-Content -Path $path -Encoding UTF8
    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) {
        Clear-FoxThemeCache
    }
}

function Load-Theme {
    if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        return (Get-ActiveThemeName)
    }
    $path = Get-ThemePath
    if (-not (Test-Path $path)) { return "orange" }
    $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim()
    if ([string]::IsNullOrWhiteSpace($name)) { return "orange" }
    return $name
}

function Get-ThemeLabel([string]$name) {
    if ($name -eq "orange") { return "Original" }
    if ($name -eq "noir") { return "Noir" }
    if ($name -eq "dnote") { return "Death Note" }
    if ($name -eq "pride") {
        if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) {
            return ("Pride | " + (Get-PrideStyleLabel (Load-PrideStyle)))
        }
        return "Pride"
    }
    return $name
}

function Test-NoirMode {
    return ($global:FOXTERM_THEME -eq "noir")
}

function To-NoirGray([int]$r, [int]$g, [int]$b) {
    $lum = [int]([Math]::Round($r * 0.299 + $g * 0.587 + $b * 0.114))
    if ($lum -lt 48)  { return 20 }
    if ($lum -lt 112) { return 85 }
    if ($lum -lt 176) { return 155 }
    return 225
}

function To-SpiderArtGray([int]$r, [int]$g, [int]$b) {
    $lum = ($r * 0.299 + $g * 0.587 + $b * 0.114) / 255.0
    $boosted = [Math]::Pow($lum, 0.72) * 255.0
    return [int][Math]::Min(245, [Math]::Max(50, [Math]::Round($boosted * 0.92 + 40)))
}

function Apply-NoirTerminalOsc {
    Write-Host -NoNewline "$esc]10;#D8D8D8$esc\"
    Write-Host -NoNewline "$esc]11;#0A0A0A$esc\"
    Write-Host -NoNewline "$esc]12;#909090$esc\"
}

function Noir-FgReset {
    return "$esc[39m"
}

function Sync-SwThemeFromDisk {
    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) {
        Clear-FoxThemeCache
    }
    $disk = Load-Theme
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
        $global:FOXTERM_THEME = "pride"
        if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) {
            $global:FOXTERM_PRIDE_STYLE = Load-PrideStyle
        }
        if (Get-Command Get-PrideArtBounds -ErrorAction SilentlyContinue) {
            $script:PrideArtBounds = Get-PrideArtBounds $artRaw
        }
        return
    }
    $script:PrideArtBounds = $null
    $global:FOXTERM_PRIDE_STYLE = $null
    if ($disk -eq "noir") {
        $global:FOXTERM_THEME = "noir"
        return
    }
    if ($cycleThemes -contains $disk) {
        $global:FOXTERM_THEME = $disk
    } else {
        $global:FOXTERM_THEME = "orange"
    }
}

function Invoke-SwThemeRefresh {
    Sync-SwThemeFromDisk
    if ($script:FoxAuthLoaded) {
        try { Sync-FoxTheme -ForcePrompt } catch {}
        try { Apply-TerminalOscColors } catch {}
    }
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
        Set-SwPSReadLineColors "pride"
    } else {
        Set-SwPSReadLineColors $global:FOXTERM_THEME
    }
}

function Get-SwThemeHex([string]$name) {
    switch ($name) {
        "blue"   { return "#5A8CFF" }
        "purple" { return "#A05AFF" }
        "cyan"   { return "#46DCC8" }
        "crimson" { return "#D14A5A" }
        "rose" { return "#E05A9A" }
        "magenta" { return "#D44BBD" }
        "violet" { return "#8356E6" }
        "indigo" { return "#4E75D8" }
        "sky" { return "#6FC4F0" }
        "teal" { return "#36B8B3" }
        "mint" { return "#6BD3B0" }
        "emerald" { return "#4CB874" }
        "lime" { return "#9BD94A" }
        "gold" { return "#E0B148" }
        "amber" { return "#E5943A" }
        "peach" { return "#E7A37C" }
        "coral" { return "#E07D69" }
        "ruby" { return "#C83B5C" }
        "slate" { return "#7D93B0" }
        "ice" { return "#7CC8E8" }
        "neon" { return "#7EF06B" }
        "forest" { return "#4E8C66" }
        "mocha" { return "#A17A5A" }
        "black" { return "#111111" }
        "white" { return "#F2F2F2" }
        "noir"  { return "#888888" }
        "dnote" { return "#B11212" }
        default  { return "#DC7A14" }
    }
}

function Set-SwPSReadLineColors([string]$name) {
    try {
        if (Get-Module -ListAvailable -Name PSReadLine) {
            Import-Module PSReadLine -ErrorAction SilentlyContinue | Out-Null
            if ($name -eq "noir") {
                Set-PSReadLineOption -Colors @{
                    Command   = "#909090"
                    Parameter = "#A8A8A8"
                    Operator  = "#787878"
                    Type      = "#B0B0B0"
                    Number    = "#C0C0C0"
                    Variable  = "#707070"
                } | Out-Null
            } elseif ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
                if (Get-Command Set-PridePSReadLineColors -ErrorAction SilentlyContinue) {
                    Set-PridePSReadLineColors (Load-PrideStyle)
                }
            } else {
                $hex = Get-SwThemeHex $name
                Set-PSReadLineOption -Colors @{
                    Command   = $hex
                    Parameter = $hex
                    Operator  = $hex
                    Type      = $hex
                } | Out-Null
            }
        }
    } catch {
        # ignore if PSReadLine not available
    }
}
function Get-ThemeColors([string]$name) {
    switch ($name) {
        "blue" {
            return @{
                dark = @{ R = 40;  G = 80;  B = 200 }
                mid  = @{ R = 90;  G = 140; B = 255 }
                bright = @{ R = 170; G = 220; B = 255 }
            }
        }
        "purple" {
            return @{
                dark = @{ R = 90;  G = 40;  B = 180 }
                mid  = @{ R = 160; G = 90;  B = 255 }
                bright = @{ R = 230; G = 170; B = 255 }
            }
        }
        "cyan" {
            return @{
                dark = @{ R = 20;  G = 140; B = 140 }
                mid  = @{ R = 70;  G = 220; B = 200 }
                bright = @{ R = 160; G = 255; B = 240 }
            }
        }
        "crimson" {
            return @{
                dark = @{ R = 140; G = 20;  B = 30 }
                mid  = @{ R = 210; G = 60;  B = 70 }
                bright = @{ R = 255; G = 120; B = 140 }
            }
        }
        "rose" {
            return @{
                dark = @{ R = 150; G = 40;  B = 90 }
                mid  = @{ R = 220; G = 90;  B = 150 }
                bright = @{ R = 255; G = 160; B = 210 }
            }
        }
        "magenta" {
            return @{
                dark = @{ R = 140; G = 20;  B = 120 }
                mid  = @{ R = 210; G = 60;  B = 190 }
                bright = @{ R = 255; G = 140; B = 240 }
            }
        }
        "violet" {
            return @{
                dark = @{ R = 80;  G = 40;  B = 150 }
                mid  = @{ R = 130; G = 80;  B = 220 }
                bright = @{ R = 200; G = 150; B = 255 }
            }
        }
        "indigo" {
            return @{
                dark = @{ R = 30;  G = 50;  B = 120 }
                mid  = @{ R = 70;  G = 100; B = 200 }
                bright = @{ R = 140; G = 170; B = 255 }
            }
        }
        "sky" {
            return @{
                dark = @{ R = 30;  G = 120; B = 190 }
                mid  = @{ R = 90;  G = 180; B = 235 }
                bright = @{ R = 170; G = 230; B = 255 }
            }
        }
        "teal" {
            return @{
                dark = @{ R = 10;  G = 120; B = 120 }
                mid  = @{ R = 40;  G = 180; B = 170 }
                bright = @{ R = 120; G = 240; B = 220 }
            }
        }
        "mint" {
            return @{
                dark = @{ R = 20;  G = 150; B = 110 }
                mid  = @{ R = 80;  G = 210; B = 170 }
                bright = @{ R = 170; G = 255; B = 220 }
            }
        }
        "emerald" {
            return @{
                dark = @{ R = 10;  G = 120; B = 70 }
                mid  = @{ R = 50;  G = 180; B = 110 }
                bright = @{ R = 120; G = 240; B = 170 }
            }
        }
        "lime" {
            return @{
                dark = @{ R = 80;  G = 140; B = 10 }
                mid  = @{ R = 140; G = 200; B = 40 }
                bright = @{ R = 210; G = 255; B = 120 }
            }
        }
        "gold" {
            return @{
                dark = @{ R = 150; G = 90;  B = 10 }
                mid  = @{ R = 220; G = 150; B = 40 }
                bright = @{ R = 255; G = 210; B = 110 }
            }
        }
        "amber" {
            return @{
                dark = @{ R = 150; G = 70;  B = 0 }
                mid  = @{ R = 230; G = 120; B = 20 }
                bright = @{ R = 255; G = 180; B = 80 }
            }
        }
        "peach" {
            return @{
                dark = @{ R = 160; G = 80;  B = 60 }
                mid  = @{ R = 230; G = 140; B = 100 }
                bright = @{ R = 255; G = 200; B = 160 }
            }
        }
        "coral" {
            return @{
                dark = @{ R = 170; G = 60;  B = 50 }
                mid  = @{ R = 240; G = 120; B = 90 }
                bright = @{ R = 255; G = 190; B = 150 }
            }
        }
        "ruby" {
            return @{
                dark = @{ R = 120; G = 10;  B = 30 }
                mid  = @{ R = 190; G = 40;  B = 70 }
                bright = @{ R = 255; G = 110; B = 140 }
            }
        }
        "slate" {
            return @{
                dark = @{ R = 60;  G = 70;  B = 90 }
                mid  = @{ R = 110; G = 130; B = 160 }
                bright = @{ R = 180; G = 200; B = 230 }
            }
        }
        "ice" {
            return @{
                dark = @{ R = 40;  G = 110; B = 150 }
                mid  = @{ R = 80;  G = 170; B = 210 }
                bright = @{ R = 170; G = 230; B = 255 }
            }
        }
        "neon" {
            return @{
                dark = @{ R = 50;  G = 200; B = 60 }
                mid  = @{ R = 90;  G = 240; B = 100 }
                bright = @{ R = 180; G = 255; B = 150 }
            }
        }
        "forest" {
            return @{
                dark = @{ R = 20;  G = 80;  B = 30 }
                mid  = @{ R = 40;  G = 140; B = 60 }
                bright = @{ R = 120; G = 200; B = 140 }
            }
        }
        "mocha" {
            return @{
                dark = @{ R = 80;  G = 50;  B = 30 }
                mid  = @{ R = 130; G = 90;  B = 60 }
                bright = @{ R = 200; G = 160; B = 120 }
            }
        }
        "black" {
            return @{
                dark = @{ R = 18;  G = 18;  B = 18 }
                mid  = @{ R = 45;  G = 45;  B = 45 }
                bright = @{ R = 90; G = 90; B = 90 }
            }
        }
        "white" {
            return @{
                dark = @{ R = 160; G = 160; B = 160 }
                mid  = @{ R = 210; G = 210; B = 210 }
                bright = @{ R = 245; G = 245; B = 245 }
            }
        }
        "noir" {
            return @{
                dark   = @{ R = 18;  G = 18;  B = 18  }
                mid    = @{ R = 90;  G = 90;  B = 90  }
                bright = @{ R = 200; G = 200; B = 200 }
            }
        }
        "dnote" {
            return @{
                dark   = @{ R = 75;  G = 10;  B = 10  }
                mid    = @{ R = 145; G = 20;  B = 20  }
                bright = @{ R = 225; G = 95;  B = 95  }
            }
        }
        default {
            return @{
                dark = @{ R = 140; G = 60;  B = 0 }
                mid  = @{ R = 220; G = 120; B = 20 }
                bright = @{ R = 255; G = 190; B = 90 }
            }
        }
    }
}

function Get-ThemeHue([string]$name) {
    switch ($name) {
        "blue" { return 210 }
        "purple" { return 280 }
        "cyan" { return 180 }
        "crimson" { return 350 }
        "rose" { return 330 }
        "magenta" { return 300 }
        "violet" { return 270 }
        "indigo" { return 230 }
        "sky" { return 200 }
        "teal" { return 170 }
        "mint" { return 155 }
        "emerald" { return 140 }
        "lime" { return 90 }
        "gold" { return 45 }
        "amber" { return 35 }
        "peach" { return 25 }
        "coral" { return 15 }
        "ruby" { return 355 }
        "slate" { return 215 }
        "ice" { return 195 }
        "neon" { return 110 }
        "forest" { return 125 }
        "mocha" { return 30 }
        "black" { return 0 }
        "white" { return 0 }
        "noir"  { return 0 }
        "dnote" { return 355 }
        default { return 30 }
    }
}

function Get-ArtHue([string]$name) {
    if ($name -eq "slate") {
        $t = Get-ThemeColors $name
        $hsv = Rgb-ToHsv $t.mid.R $t.mid.G $t.mid.B
        return $hsv[0]
    }
    return Get-ThemeHue $name
}

function Mix-ThemeColor([hashtable]$theme, [double]$t) {
    if ($t -le 0.5) {
        $local = $t / 0.5
        $a = $theme.dark
        $b = $theme.mid
    } else {
        $local = ($t - 0.5) / 0.5
        $a = $theme.mid
        $b = $theme.bright
    }
    $r = [int]([Math]::Round($a.R + ($b.R - $a.R) * $local))
    $g = [int]([Math]::Round($a.G + ($b.G - $a.G) * $local))
    $b2 = [int]([Math]::Round($a.B + ($b.B - $a.B) * $local))
    return @($r, $g, $b2)
}

function Colorize-LabelGradient([string]$text, [char]$esc) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    $max = [Math]::Max(1, $text.Length - 1)
    $out = ""
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive) -and -not (Test-NoirMode)) {
        $style = if ($global:FOXTERM_PRIDE_STYLE) { $global:FOXTERM_PRIDE_STYLE } else { Load-PrideStyle }
        return Colorize-PrideGradient $text $esc (Get-PrideFlagColors $style)
    }
    $theme = Get-ThemeColors $global:FOXTERM_THEME
    for ($i = 0; $i -lt $text.Length; $i++) {
        $t = [Math]::Pow($i / [double]$max, 0.7)
        $rgb = Mix-ThemeColor $theme $t
        if (Test-NoirMode) {
            $g = To-NoirGray $rgb[0] $rgb[1] $rgb[2]
            $out += "$esc[38;2;$g;$g;$g" + "m" + $text[$i]
        } else {
            $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])" + "m" + $text[$i] + "$esc[0m"
        }
    }
    if (Test-NoirMode) { $out += (Noir-FgReset) }
    return $out
}

function Rgb-ToHsv([int]$r, [int]$g, [int]$b) {
    $rf = $r / 255.0
    $gf = $g / 255.0
    $bf = $b / 255.0
    $max = [Math]::Max($rf, [Math]::Max($gf, $bf))
    $min = [Math]::Min($rf, [Math]::Min($gf, $bf))
    $delta = $max - $min

    $h = 0.0
    if ($delta -ne 0) {
        if ($max -eq $rf) { $h = 60 * ((($gf - $bf) / $delta) % 6) }
        elseif ($max -eq $gf) { $h = 60 * ((($bf - $rf) / $delta) + 2) }
        else { $h = 60 * ((($rf - $gf) / $delta) + 4) }
    }
    if ($h -lt 0) { $h += 360 }
    $s = if ($max -eq 0) { 0 } else { $delta / $max }
    $v = $max
    return @($h, $s, $v)
}

function Hsv-ToRgb([double]$h, [double]$s, [double]$v) {
    $c = $v * $s
    $x = $c * (1 - [Math]::Abs((($h / 60) % 2) - 1))
    $m = $v - $c
    $rf = 0.0; $gf = 0.0; $bf = 0.0
    if ($h -lt 60) { $rf = $c; $gf = $x; $bf = 0 }
    elseif ($h -lt 120) { $rf = $x; $gf = $c; $bf = 0 }
    elseif ($h -lt 180) { $rf = 0; $gf = $c; $bf = $x }
    elseif ($h -lt 240) { $rf = 0; $gf = $x; $bf = $c }
    elseif ($h -lt 300) { $rf = $x; $gf = 0; $bf = $c }
    else { $rf = $c; $gf = 0; $bf = $x }
    $r = [int]([Math]::Round(($rf + $m) * 255))
    $g = [int]([Math]::Round(($gf + $m) * 255))
    $b = [int]([Math]::Round(($bf + $m) * 255))
    return @($r, $g, $b)
}

function Colorize-ArtLine([string]$line, [object[]]$colors, [char]$esc, [int]$lineIndex = 0, [int]$lineCount = 1) {
    if ([string]::IsNullOrEmpty($line)) { return $line }
    $theme = Get-ThemeColors $global:FOXTERM_THEME
    $len = $line.Length
    if ($len -le 1) { return $line }

    $out = ""
    for ($i = 0; $i -lt $len; $i++) {
        $ch = $line[$i]
        $rgb = if ($i -lt $colors.Length) { $colors[$i] } else { $null }
        if ($ch -eq " ") {
            $out += " "
            continue
        }
        if (Test-NoirMode) {
            if ($null -ne $rgb) {
                $gray = if ($script:SpiderMode) {
                    To-SpiderArtGray $rgb[0] $rgb[1] $rgb[2]
                } else {
                    To-NoirGray $rgb[0] $rgb[1] $rgb[2]
                }
                $out += "$esc[38;2;$gray;$gray;$gray" + "m" + $ch
            } else {
                $out += $ch
            }
            continue
        }
        if ($null -ne $rgb -and $global:FOXTERM_THEME -eq "orange") {
            $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])" + "m" + $ch + "$esc[0m"
        } elseif ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
            $style = if ($global:FOXTERM_PRIDE_STYLE) { $global:FOXTERM_PRIDE_STYLE } else { Load-PrideStyle }
            $bounds = if ($script:PrideArtBounds) { $script:PrideArtBounds } else { $null }
            $rgbNew = Get-PrideArtRgb $lineIndex $i $bounds $style
            $out += "$esc[38;2;$($rgbNew[0]);$($rgbNew[1]);$($rgbNew[2])" + "m" + $ch + "$esc[0m"
        } elseif ($null -ne $rgb) {
            $hsv = Rgb-ToHsv $rgb[0] $rgb[1] $rgb[2]
            $h = $hsv[0]; $s = $hsv[1]; $v = $hsv[2]
            if ($s -lt 0.12) {
                $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])" + "m" + $ch + "$esc[0m"
            } else {
                if ($global:FOXTERM_THEME -eq "slate" -or $global:FOXTERM_THEME -eq "black" -or $global:FOXTERM_THEME -eq "white") {
                    $t = [Math]::Min(1.0, [Math]::Max(0.0, $v * 0.5))
                    $rgbNew = Mix-ThemeColor $theme $t
                } else {
                    $h2 = Get-ArtHue $global:FOXTERM_THEME
                    $rgbNew = Hsv-ToRgb $h2 $s $v
                }
                $out += "$esc[38;2;$($rgbNew[0]);$($rgbNew[1]);$($rgbNew[2])" + "m" + $ch + "$esc[0m"
            }
        } else {
            $out += $ch
        }
    }
    if (Test-NoirMode) { $out += (Noir-FgReset) }
    return $out
}

$labelWidth = 10
function Get-SwLabelIcon([string]$text) {
    $key = $text.Trim().TrimEnd(":")
    $code = switch ($key) {
        "User"       { 0xF007 }
        "Style"      { 0xF1FC }
        "OS"         { 0xF17A }
        "Kernel"     { 0xF013 }
        "Uptime"     { 0xF017 }
        "Packages"   { 0xF187 }
        "Shell"      { 0xF120 }
        "Resolution" { 0xF0B2 }
        "Terminal"   { 0xF2D0 }
        "CPU"        { 0xF2DB }
        "GPU"        { 0xF26C }
        "Memory"     { 0xF1C0 }
        "WiFi"       { 0xF1EB }
        default      { 0 }
    }
    if ($code -eq 0) { return "" }
    if (Get-Command Get-FoxIcon -ErrorAction SilentlyContinue) {
        return (Get-FoxIcon $code)
    }
    return [string][char]$code
}

function Make-Label([string]$text) {
    $glyph = Get-SwLabelIcon $text
    $prefix = if ($glyph) {
        if ($useColorInfo) { (Colorize-LabelGradient $glyph $esc) + "  " } else { $glyph + "  " }
    } else { "" }
    $pad = " " * ([Math]::Max(0, $labelWidth - $text.Length))
    if ($useColorInfo) {
        return $prefix + (Colorize-LabelGradient $text $esc) + $pad
    }
    return $prefix + $text + $pad
}

function Colorize-GrayGradient([string]$text, [char]$esc) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    $max = [Math]::Max(1, $text.Length - 1)
    if (Test-NoirMode) {
        $start = @{ R = 220; G = 220; B = 220 }
        $end   = @{ R = 90;  G = 90;  B = 90 }
    } else {
        $start = @{ R = 190; G = 190; B = 190 }
        $end   = @{ R = 120; G = 120; B = 120 }
    }
    $out = ""
    for ($i = 0; $i -lt $text.Length; $i++) {
        $t = [Math]::Pow($i / [double]$max, 0.6)
        $r = [int]([Math]::Round($start.R + ($end.R - $start.R) * $t))
        $g = [int]([Math]::Round($start.G + ($end.G - $start.G) * $t))
        $b = [int]([Math]::Round($start.B + ($end.B - $start.B) * $t))
        if (Test-NoirMode) {
            $gray = To-NoirGray $r $g $b
            $out += "$esc[38;2;$gray;$gray;$gray" + "m" + $text[$i]
        } else {
            $out += "$esc[38;2;$r;$g;$b" + "m" + $text[$i] + "$esc[0m"
        }
    }
    if (Test-NoirMode) { $out += (Noir-FgReset) }
    return $out
}

function Colorize-Value([string]$text, [bool]$useColor, [char]$esc) {
    if (-not $useColor) { return $text }
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive) -and -not (Test-NoirMode)) {
        $style = if ($global:FOXTERM_PRIDE_STYLE) { $global:FOXTERM_PRIDE_STYLE } else { Load-PrideStyle }
        return Colorize-PrideGradient $text $esc (Get-PrideFlagColors $style)
    }
    return (Colorize-GrayGradient $text $esc)
}

function Get-WifiStatus {
    $raw = netsh wlan show interfaces 2>$null
    if (-not $raw) { return @{ Text = "off"; Signal = $null } }

    $state = $null
    $signal = $null
    $channel = $null
    foreach ($line in $raw) {
        if ($line -match '^\s*State\s*:\s*(.+)$') { $state = $Matches[1].Trim(); continue }
        if ($line -match '^\s*Signal\s*:\s*(\d+)%') { $signal = [int]$Matches[1]; continue }
        if ($line -match '^\s*Channel\s*:\s*(\d+)$') { $channel = [int]$Matches[1]; continue }
    }

    if ($state -and $state -notmatch 'connected') {
        return @{ Text = "disconnected"; Signal = $null }
    }

    if ($null -eq $signal) {
        return @{ Text = "unknown"; Signal = $null }
    }

    $band = if ($channel -le 14) { "2.4G" } else { "5G" }
    return @{ Text = ("{0}% {1}" -f $signal, $band); Signal = $signal }
}

function Colorize-Wifi([string]$text, [int]$signal, [bool]$useColor, [char]$esc) {
    if (-not $useColor) { return $text }
    if (Test-NoirMode) {
        $gray = if ($null -eq $signal) { 100 } elseif ($signal -le 40) { 70 } elseif ($signal -le 70) { 140 } else { 210 }
        return "$esc[38;2;$gray;$gray;$gray" + "m" + $text + (Noir-FgReset)
    }
    if ($null -eq $signal) { return $text }
    if ($signal -le 40) { $r = 255; $g = 90;  $b = 90 }
    elseif ($signal -le 70) { $r = 255; $g = 200; $b = 80 }
    else { $r = 120; $g = 255; $b = 140 }
    return "$esc[38;2;$r;$g;$b" + "m" + $text + "$esc[0m"
}

$artWidth = ($artRaw | ForEach-Object { (Strip-Ansi $_).Length } | Measure-Object -Maximum).Maximum

$lastWifiRender = Get-Date
$lastWifiText = $null
$wifiRefreshMs = 500
$cycleThemes = @(
    "orange","blue","purple","cyan",
    "crimson","rose","magenta","violet","indigo",
    "sky","teal","mint","emerald","lime",
    "gold","amber","peach","coral","ruby",
    "slate","ice","neon","forest","mocha","dnote",
    "black","white"
)
$themeArgAliases = @{
    "default" = "orange"
    "orig" = "orange"
    "original" = "orange"
}
$requestedTheme = $null
foreach ($arg in $SwArgs) {
    if ([string]::IsNullOrWhiteSpace($arg)) { continue }
    $argRaw = $arg.Trim()
    if (Test-Path -LiteralPath $argRaw) { continue }
    $argNorm = $argRaw.ToLowerInvariant()
    if ($argNorm -eq "live" -or $argNorm -eq "color" -or $argNorm -eq "mono") { continue }
    if ($themeArgAliases.ContainsKey($argNorm)) {
        $requestedTheme = $themeArgAliases[$argNorm]
        break
    }
    if ($cycleThemes -contains $argNorm -or $argNorm -eq "pride" -or $argNorm -eq "noir" -or $argNorm -eq "dnote") {
        $requestedTheme = $argNorm
        break
    }
}
if (-not [string]::IsNullOrWhiteSpace($requestedTheme)) {
    Save-Theme $requestedTheme
    if ($requestedTheme -eq "pride" -and (Get-Command Save-PrideStyle -ErrorAction SilentlyContinue)) {
        $stylePath = Get-PrideStylePath
        if (-not (Test-Path $stylePath)) { Save-PrideStyle "gay" }
    }
}
$global:FOXTERM_THEME = Load-Theme
$global:FOXTERM_PRIDE_STYLE = $null
if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
    $global:FOXTERM_THEME = "pride"
    $global:FOXTERM_PRIDE_STYLE = Load-PrideStyle
    if (Get-Command Get-PrideArtBounds -ErrorAction SilentlyContinue) {
        $script:PrideArtBounds = Get-PrideArtBounds $artRaw
    }
} else {
    $script:PrideArtBounds = $null
}
if ($script:SpiderMode -and $global:FOXTERM_THEME -ne "noir") {
    Write-Host ""
    Write-Host "  The shadows are quiet. Enable noir first."
    Write-Host "  Run: noir"
    Write-Host ""
    exit 0
}
if ($global:FOXTERM_THEME -ne "noir" -and $global:FOXTERM_THEME -ne "pride" -and -not ($cycleThemes -contains $global:FOXTERM_THEME)) {
    $global:FOXTERM_THEME = "orange"
}
if (Test-NoirMode) {
    $useColorArt = $true
    $useColorInfo = $true
    Enable-VT
    Apply-NoirTerminalOsc
}
if ($script:FoxAuthLoaded) {
    try { Invoke-SwThemeRefresh } catch { Set-SwPSReadLineColors $global:FOXTERM_THEME }
} else {
    Set-SwPSReadLineColors $global:FOXTERM_THEME
}

# ── FOX TERM pixel banner (7-wide glyphs, codepoint-safe) ────
function Build-FoxBannerLines {
    $B = [string][char]0x2588   # █  full block
    $D = [string][char]0x2500   # ─  thin horizontal

    # Each glyph: exactly 7 chars wide, 5 rows tall
    $g = @{
        'F' = @("${B}${B}${B}${B}${B}${B}${B}",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}  ",
                "${B}${B}     ",
                "${B}${B}     ")
        'O' = @(" ${B}${B}${B}${B}${B} ",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}",
                " ${B}${B}${B}${B}${B} ")
        'X' = @("${B}${B}   ${B}${B}",
                " ${B}${B} ${B}${B} ",
                "  ${B}${B}${B}  ",
                " ${B}${B} ${B}${B} ",
                "${B}${B}   ${B}${B}")
        'T' = @("${B}${B}${B}${B}${B}${B}${B}",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ")
        'E' = @("${B}${B}${B}${B}${B}${B}${B}",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}  ",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}${B}${B}")
        'R' = @("${B}${B}${B}${B}${B}${B} ",
                "${B}${B}   ${B}${B}",
                "${B}${B}${B}${B}${B}${B} ",
                "${B}${B}${B}${B} ${B} ",
                "${B}${B}   ${B}${B}")
        'M' = @("${B}${B}   ${B}${B}",
                "${B}${B}${B} ${B}${B}${B}",
                "${B}${B} ${B} ${B}${B}",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}")
    }

    $w1 = @('F','O','X')
    $w2 = @('T','E','R','M')
    # banner width: 3*(7+1) + 2 + 4*(7+1) - 1  = 24+2+31 = 57
    $bannerW = 57
    $result  = @()

    for ($row = 0; $row -lt 5; $row++) {
        $line = ''
        foreach ($ch in $w1) { $line += $g[$ch][$row] + ' ' }
        $line += ' '   # extra gap between FOX and TERM
        foreach ($ch in $w2) { $line += $g[$ch][$row] + ' ' }
        $result += $line.TrimEnd()
    }

    # thin decorative line + label
    $result += ($D * $bannerW)
    $tag = '  [ FoxTerminal ]  '
    $tagPad = [Math]::Max(0, [int](($bannerW - $tag.Length) / 2))
    $result += (' ' * $tagPad) + $tag

    return $result
}

function Write-FoxBanner {
    try { $w = $host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    if ($w -le 0) { $w = 80 }
    if ($script:SwCompact -or $w -lt 64) {
        $tag = "[ FoxTerminal ]"
        $pad = [Math]::Max(0, [int](($w - $tag.Length) / 2))
        $line = (' ' * $pad) + $tag
        if ($useColorInfo) { Write-Host (Colorize-LabelGradient $line $esc) } else { Write-Host $line }
        Write-Host ''
        return
    }
    $lines = Build-FoxBannerLines
    try { $w = $host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    if ($w -le 0) { $w = 80 }
    $bannerW = ($lines | ForEach-Object { $_.Length } | Measure-Object -Maximum).Maximum
    $prideActive = (Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive) -and -not (Test-NoirMode)
    $prideColors = $null
    if ($prideActive) {
        $style = if ($global:FOXTERM_PRIDE_STYLE) { $global:FOXTERM_PRIDE_STYLE } else { Load-PrideStyle }
        $prideColors = Get-PrideFlagColors $style
    }
    for ($lineIdx = 0; $lineIdx -lt $lines.Count; $lineIdx++) {
        $line = $lines[$lineIdx]
        $pad = [Math]::Max(0, [int](($w - $bannerW) / 2))
        if ($useColorInfo -and $prideActive) {
            $colored = Colorize-PrideRow $line $esc $prideColors $lineIdx $lines.Count
            Write-Host ((' ' * $pad) + $colored)
        } elseif ($useColorInfo) {
            Write-Host ((' ' * $pad) + (Colorize-LabelGradient $line $esc))
        } else {
            Write-Host ((' ' * $pad) + $line)
        }
    }
    Write-Host ''
}

function Write-SpiderBanner {
    try { $w = $host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    if ($w -le 0) { $w = 80 }
    $lineW = [Math]::Min(56, [Math]::Max(36, $w - 8))
    $tags = @(
        "[ SPIDER - NOIR ]",
        "The city never sleeps. Neither do I.",
        ("-" * $lineW)
    )
    foreach ($tag in $tags) {
        $pad = [Math]::Max(0, [int](($w - $tag.Length) / 2))
        $centered = (' ' * $pad) + $tag
        if ($useColorInfo) {
            Write-Host (Colorize-LabelGradient $centered $esc)
        } else {
            Write-Host $centered
        }
    }
    Write-Host ''
}

function Write-CenteredLine([string]$text) {
    try { $w = $host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    if ($w -le 0) { $w = 80 }
    $plainLen = (Strip-Ansi $text).Length
    $pad = [Math]::Max(0, [int](($w - $plainLen) / 2))
    Write-Host ((' ' * $pad) + $text)
}

function Get-SwSystemInfo {
    $os = Get-SwOsCached
    $memTotal = [Math]::Round($os.TotalVisibleMemorySize / 1024)
    $memFree = [Math]::Round($os.FreePhysicalMemory / 1024)
    $memUsed = [Math]::Max(0, $memTotal - $memFree)
    $uptime = (Get-Date) - $os.LastBootUpTime
    $userName = if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { $env:USERNAME }
    $wifi = Get-WifiStatus
    $wifiText = (Colorize-Wifi $wifi.Text $wifi.Signal $useColorInfo $esc)
    $cpuName = ($cpu.Name -replace "\s+", " ").Trim()
    $gpuName = ($gpu.Name -replace "\s+", " ").Trim()
    $cpuName = ($cpuName -replace "(?i)\s*(with|w/)\s+Radeon\s+Graphics", "").Trim()

    $rows = @()
    $rows += (Make-Label "User:")       + " " + (Colorize-Value $userName $useColorInfo $esc)
    $rows += (Make-Label "Style:")      + " " + (Colorize-Value "Noir" $useColorInfo $esc)
    $rows += (Make-Label "OS:")         + " " + (Colorize-Value "$($os.Caption) $($os.OSArchitecture)" $useColorInfo $esc)
    $rows += (Make-Label "Uptime:")     + " " + (Colorize-Value (Format-Uptime $uptime) $useColorInfo $esc)
    $rows += (Make-Label "CPU:")        + " " + (Colorize-Value $cpuName $useColorInfo $esc)
    $rows += (Make-Label "GPU:")        + " " + (Colorize-Value $gpuName $useColorInfo $esc)
    $rows += (Make-Label "Memory:")     + " " + (Colorize-Value "${memUsed}MiB / ${memTotal}MiB" $useColorInfo $esc)
    $rows += (Make-Label "WiFi:")       + " " + $wifiText
    return $rows
}

function Render-SpiderPanel {
    Clear-Host
    Apply-NoirTerminalOsc
    Write-SpiderBanner

    for ($i = 0; $i -lt $artRaw.Count; $i++) {
        $leftRaw = $artRaw[$i]
        $leftColors = if ($i -lt $artColors.Count) { $artColors[$i] } else { @() }
        $left = if ($useColorArt) { Colorize-ArtLine $leftRaw $leftColors $esc $i $artRaw.Count } else { $leftRaw }
        Write-CenteredLine $left
    }

    Write-Host ''
    foreach ($row in (Get-SwSystemInfo)) {
        Write-CenteredLine $row
    }
    Write-Host ''
    $hint = if ($useColorInfo) { (Colorize-GrayGradient "Ctrl+E to exit" $esc) } else { "Ctrl+E to exit" }
    Write-CenteredLine $hint
    return @{ WiFiY = -1; WiFiX = 0 }
}

function Render-Info {
    Sync-SwThemeFromDisk
    $os = Get-SwOsCached
    $memTotal = [Math]::Round($os.TotalVisibleMemorySize / 1024)
    $memFree = [Math]::Round($os.FreePhysicalMemory / 1024)
    $memUsed = [Math]::Max(0, $memTotal - $memFree)
    $uptime = (Get-Date) - $os.LastBootUpTime

    $userName = if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { $env:USERNAME }
    $wifi = Get-WifiStatus
    $wifiText = (Colorize-Wifi $wifi.Text $wifi.Signal $useColorInfo $esc)

    $info = @()
    $info += (Make-Label "User:")       + " " + (Colorize-Value $userName $useColorInfo $esc)
    $info += (Make-Label "Style:")      + " " + (Colorize-Value (Get-ThemeLabel $global:FOXTERM_THEME) $useColorInfo $esc)
    $info += (Make-Label "OS:")         + " " + (Colorize-Value "$($os.Caption) $($os.OSArchitecture)" $useColorInfo $esc)
    $info += (Make-Label "Kernel:")     + " " + (Colorize-Value $os.Version $useColorInfo $esc)
    $info += (Make-Label "Uptime:")     + " " + (Colorize-Value (Format-Uptime $uptime) $useColorInfo $esc)
    $info += (Make-Label "Packages:")   + " " + (Colorize-Value "$apps (apps)" $useColorInfo $esc)
    $info += (Make-Label "Shell:")      + " " + (Colorize-Value $env:ComSpec $useColorInfo $esc)
    $info += (Make-Label "Resolution:") + " " + (Colorize-Value $res $useColorInfo $esc)
    $info += (Make-Label "Terminal:")   + " " + (Colorize-Value "FoxTerminal" $useColorInfo $esc)
    $cpuName = ($cpu.Name -replace "\s+", " ").Trim()
    $gpuName = ($gpu.Name -replace "\s+", " ").Trim()
    $cpuName = ($cpuName -replace "(?i)\s*(with|w/)\s+Radeon\s+Graphics", "").Trim()
    $info += (Make-Label "CPU:")        + " " + (Colorize-Value $cpuName $useColorInfo $esc)
    $info += (Make-Label "GPU:")        + " " + (Colorize-Value $gpuName $useColorInfo $esc)
    $info += (Make-Label "Memory:")     + " " + (Colorize-Value "${memUsed}MiB / ${memTotal}MiB" $useColorInfo $esc)
    $info += (Make-Label "WiFi:")       + " " + $wifiText

    if (Test-NoirMode) {
        Clear-Host
        Apply-NoirTerminalOsc
    } else {
        Clear-Host
    }
    Write-FoxBanner

    try { $winW = $host.UI.RawUI.WindowSize.Width } catch { $winW = $script:SwWinW }
    if ($winW -le 0) { $winW = $script:SwWinW }
    $stack = $script:SwCompact -or $winW -lt ($artWidth + 36)

    if ($stack) {
        for ($i = 0; $i -lt $artRaw.Count; $i++) {
            $leftRaw = $artRaw[$i]
            $leftColors = if ($i -lt $artColors.Count) { $artColors[$i] } else { @() }
            $left = if ($useColorArt) { Colorize-ArtLine $leftRaw $leftColors $esc $i $artRaw.Count } else { $leftRaw }
            Write-CenteredLine $left
        }
        Write-Host ''
        $compactInfo = $info | Where-Object { $_ -match 'User:|Style:|OS:|Uptime:|CPU:|GPU:|Memory:|WiFi:' }
        foreach ($row in $compactInfo) { Write-CenteredLine $row }
        Write-Host ''
        return @{ WiFiY = -1; WiFiX = 0 }
    }

    $lines = [Math]::Max($artRaw.Count, $info.Count)
    $infoStart = [Math]::Max(0, [int][Math]::Floor(($artRaw.Count - $info.Count) / 2))
    $wifiLineY = $null
    $wifiLineX = $artWidth + 2
    for ($i = 0; $i -lt $lines; $i++) {
        $leftRaw = if ($i -lt $artRaw.Count) { $artRaw[$i] } else { "" }
        $leftColors = if ($i -lt $artColors.Count) { $artColors[$i] } else { @() }
        $left = if ($useColorArt) { Colorize-ArtLine $leftRaw $leftColors $esc $i $artRaw.Count } else { $leftRaw }
        $infoIndex = $i - $infoStart
        $right = if ($infoIndex -ge 0 -and $infoIndex -lt $info.Count) { $info[$infoIndex] } else { "" }
        $leftLen = (Strip-Ansi $leftRaw).Length
        $pad = " " * ([Math]::Max(0, $artWidth - $leftLen + 2))
        if ($infoIndex -eq ($info.Count - 1)) {
            $wifiLineY = $host.UI.RawUI.CursorPosition.Y
        }
        Write-Host ($left + $pad + $right)
    }
    if ($null -eq $wifiLineY) { $wifiLineY = $infoStart + ($info.Count - 1) }
    return @{ WiFiY = $wifiLineY; WiFiX = $wifiLineX }
}

if ($script:SpiderMode) {
    $pos = Render-SpiderPanel
} else {
    $pos = Render-Info
}
$wifiLineY = $pos.WiFiY
$wifiLineX = $pos.WiFiX

$enableLiveWifi = (-not $script:SpiderMode) -and ($SwArgs -contains "live")
$canInlineUpdate = $enableLiveWifi
if ($canInlineUpdate) {
    try {
        $cur = $host.UI.RawUI.CursorPosition
        [Console]::SetCursorPosition($cur.X, $cur.Y)
    } catch {
        $canInlineUpdate = $false
    }
}

while ($true) {
    if ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true)
        if (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E") {
            break
        }
        if ($k.Key -eq "LeftArrow" -or $k.Key -eq "RightArrow" -or $k.Key -eq "UpArrow" -or $k.Key -eq "DownArrow") {
            if ($script:SpiderMode -or (Test-NoirMode)) { continue }
            if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
                $styles = $script:FoxPrideStyles
                if (-not $styles) { $styles = @("gay", "bi", "lesbian", "trans", "femboy") }
                $idx = [Array]::IndexOf($styles, $global:FOXTERM_PRIDE_STYLE)
                if ($idx -lt 0) { $idx = 0 }
                if ($k.Key -eq "LeftArrow" -or $k.Key -eq "UpArrow") {
                    $idx = ($idx - 1 + $styles.Count) % $styles.Count
                } else {
                    $idx = ($idx + 1) % $styles.Count
                }
                $global:FOXTERM_PRIDE_STYLE = $styles[$idx]
                Save-PrideStyle $global:FOXTERM_PRIDE_STYLE
                Invoke-SwThemeRefresh
                $pos = Render-Info
                $wifiLineY = $pos.WiFiY
                $wifiLineX = $pos.WiFiX
                continue
            }
            $idx = [Array]::IndexOf($cycleThemes, $global:FOXTERM_THEME)
            if ($idx -lt 0) { $idx = 0 }
            if ($k.Key -eq "LeftArrow" -or $k.Key -eq "UpArrow") {
                $idx = ($idx - 1 + $cycleThemes.Count) % $cycleThemes.Count
            } else {
                $idx = ($idx + 1) % $cycleThemes.Count
            }
            $global:FOXTERM_THEME = $cycleThemes[$idx]
            Save-Theme $global:FOXTERM_THEME
            Invoke-SwThemeRefresh
            $pos = Render-Info
            $wifiLineY = $pos.WiFiY
            $wifiLineX = $pos.WiFiX
            continue
        }
    }

    if ($canInlineUpdate) {
        $now = Get-Date
        if ((($now - $lastWifiRender).TotalMilliseconds -ge $wifiRefreshMs)) {
            $wifi = Get-WifiStatus
            $wifiText = (Colorize-Wifi $wifi.Text $wifi.Signal $useColorInfo $esc)
            $wifiLine = (Make-Label "WiFi:") + " " + $wifiText

        $windowWidth = $host.UI.RawUI.WindowSize.Width
        $maxRight = [Math]::Max(0, $windowWidth - $wifiLineX - 1)
        $plainLen = (Strip-Ansi $wifiLine).Length
        $padRight = " " * ([Math]::Max(0, $maxRight - $plainLen))

            if ($wifiLine -ne $lastWifiText) {
                try {
                    [Console]::SetCursorPosition($wifiLineX, $wifiLineY)
                    Write-Host -NoNewline ($wifiLine + $padRight)
                    $lastWifiText = $wifiLine
                } catch {
                    $canInlineUpdate = $false
                }
            }
            $lastWifiRender = $now
        }
    }

    Start-Sleep -Milliseconds 150
}

if ($script:FoxAuthLoaded) {
    try { Sync-FoxTheme -ForcePrompt -RedrawPrompt } catch {}
}
