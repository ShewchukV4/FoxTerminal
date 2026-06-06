param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

# Ensure correct encoding so banner renders properly in all terminals
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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
$apps = Get-InstalledAppCount

$res = "N/A"
if ($gpu -and $gpu.CurrentHorizontalResolution -and $gpu.CurrentVerticalResolution) {
    $res = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)"
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

function Get-AsciiArtData([string]$path, [int]$targetWidth, [char]$esc, [double]$charAspect) {
    $cachePath = $null
    try {
        $info = Get-Item -LiteralPath $path -ErrorAction Stop
        $key = "$($info.FullName)|$($info.LastWriteTimeUtc.Ticks)|$targetWidth|$charAspect"
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

        $chars = " .,:;irsXA253hMHGS#9B&@"
        $lines = New-Object System.Collections.Generic.List[string]
        $colors = New-Object System.Collections.Generic.List[object]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $lineColors = New-Object System.Collections.Generic.List[object]
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                if ($c.A -lt 20 -or ($c.R -lt 10 -and $c.G -lt 10 -and $c.B -lt 10)) {
                    $line += " "
                    $lineColors.Add($null)
                    continue
                }
                $brightness = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114) / 255
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

$defaultImagePath = "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-09a73897-eaff-441b-94d6-e769a3f93cf5.png"
$imagePath = $defaultImagePath
foreach ($arg in $Args) {
    if (Test-Path $arg) { $imagePath = $arg; break }
}
$useColorArt = $false
if ($Args -contains "color") { $useColorArt = $true }
if ($env:WT_SESSION -or $env:ANSICON -or $env:ConEmuANSI -eq "ON") { $useColorArt = $true }
if ($Args -contains "mono") { $useColorArt = $false }
if ($useColorArt) { Enable-VT }
$esc = [char]27
function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

$charAspect = 0.48
$artData = Get-AsciiArtData $imagePath 90 $esc $charAspect
$artRaw = $artData.Lines
$artColors = $artData.Colors

$useColorInfo = $useColorArt
function Get-ThemePath {
    return (Join-Path $PSScriptRoot "theme.txt")
}

function Load-Theme {
    $path = Get-ThemePath
    if (-not (Test-Path $path)) { return "orange" }
    $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim()
    if ([string]::IsNullOrWhiteSpace($name)) { return "orange" }
    return $name
}

function Get-ThemeLabel([string]$name) {
    if ($name -eq "orange") { return "Original" }
    return $name
}

function Save-Theme([string]$name) {
    $path = Get-ThemePath
    $name | Set-Content -Path $path -Encoding UTF8
}

function Get-ThemeHex([string]$name) {
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
        default  { return "#DC7A14" }
    }
}

function Apply-ThemeColors([string]$name) {
    try {
        $hex = Get-ThemeHex $name
        if (Get-Module -ListAvailable -Name PSReadLine) {
            Import-Module PSReadLine -ErrorAction SilentlyContinue | Out-Null
            Set-PSReadLineOption -Colors @{
                Command   = $hex
                Parameter = $hex
                Operator  = $hex
                Type      = $hex
            } | Out-Null
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
    $theme = Get-ThemeColors $global:FOXTERM_THEME
    $out = ""
    for ($i = 0; $i -lt $text.Length; $i++) {
        $t = [Math]::Pow($i / [double]$max, 0.7)
        $rgb = Mix-ThemeColor $theme $t
        $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])" + "m" + $text[$i] + "$esc[0m"
    }
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

function Colorize-ArtLine([string]$line, [object[]]$colors, [char]$esc) {
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
        if ($null -ne $rgb -and $global:FOXTERM_THEME -eq "orange") {
            $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])" + "m" + $ch + "$esc[0m"
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
    return $out
}

$labelWidth = 10
function Make-Label([string]$text) {
    $pad = " " * ([Math]::Max(0, $labelWidth - $text.Length))
    if ($useColorInfo) {
        return (Colorize-LabelGradient $text $esc) + $pad
    }
    return $text + $pad
}

function Colorize-GrayGradient([string]$text, [char]$esc) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    $max = [Math]::Max(1, $text.Length - 1)
    $start = @{ R = 190; G = 190; B = 190 }
    $end   = @{ R = 120; G = 120; B = 120 }
    $out = ""
    for ($i = 0; $i -lt $text.Length; $i++) {
        $t = [Math]::Pow($i / [double]$max, 0.6)
        $r = [int]([Math]::Round($start.R + ($end.R - $start.R) * $t))
        $g = [int]([Math]::Round($start.G + ($end.G - $start.G) * $t))
        $b = [int]([Math]::Round($start.B + ($end.B - $start.B) * $t))
        $out += "$esc[38;2;$r;$g;$b" + "m" + $text[$i] + "$esc[0m"
    }
    return $out
}

function Colorize-Value([string]$text, [bool]$useColor, [char]$esc) {
    if ($useColor) {
        return (Colorize-GrayGradient $text $esc)
    }
    return $text
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
$themes = @(
    "orange","blue","purple","cyan",
    "crimson","rose","magenta","violet","indigo",
    "sky","teal","mint","emerald","lime",
    "gold","amber","peach","coral","ruby",
    "slate","ice","neon","forest","mocha",
    "black","white"
)
$global:FOXTERM_THEME = Load-Theme
if (-not ($themes -contains $global:FOXTERM_THEME)) { $global:FOXTERM_THEME = "orange" }
Apply-ThemeColors $global:FOXTERM_THEME

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
    $lines = Build-FoxBannerLines
    try { $w = $host.UI.RawUI.WindowSize.Width } catch { $w = 80 }
    if ($w -le 0) { $w = 80 }
    $bannerW = ($lines | ForEach-Object { $_.Length } | Measure-Object -Maximum).Maximum
    foreach ($line in $lines) {
        $pad = [Math]::Max(0, [int](($w - $bannerW) / 2))
        $centered = (' ' * $pad) + $line
        if ($useColorInfo) {
            Write-Host (Colorize-LabelGradient $centered $esc)
        } else {
            Write-Host $centered
        }
    }
    Write-Host ''
}

function Render-Info {
    $os = Get-CimInstance Win32_OperatingSystem
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

    Clear-Host
    Write-FoxBanner
    $lines = [Math]::Max($artRaw.Count, $info.Count)
    $infoStart = [Math]::Max(0, [int][Math]::Floor(($artRaw.Count - $info.Count) / 2))
    $wifiLineY = $null
    $wifiLineX = $artWidth + 2
    for ($i = 0; $i -lt $lines; $i++) {
        $leftRaw = if ($i -lt $artRaw.Count) { $artRaw[$i] } else { "" }
        $leftColors = if ($i -lt $artColors.Count) { $artColors[$i] } else { @() }
        $left = if ($useColorArt) { Colorize-ArtLine $leftRaw $leftColors $esc } else { $leftRaw }
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

$pos = Render-Info
$wifiLineY = $pos.WiFiY
$wifiLineX = $pos.WiFiX

$enableLiveWifi = $Args -contains "live"
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
            $idx = [Array]::IndexOf($themes, $global:FOXTERM_THEME)
            if ($idx -lt 0) { $idx = 0 }
            if ($k.Key -eq "LeftArrow" -or $k.Key -eq "UpArrow") {
                $idx = ($idx - 1 + $themes.Count) % $themes.Count
            } else {
                $idx = ($idx + 1) % $themes.Count
            }
            $global:FOXTERM_THEME = $themes[$idx]
            Save-Theme $global:FOXTERM_THEME
            Apply-ThemeColors $global:FOXTERM_THEME
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
