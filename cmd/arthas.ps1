param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (-not (Test-Path $foxauthPath)) {
    Write-Host "foxauth.ps1 not found."
    exit 1
}

. $foxauthPath

$themePath = Get-ThemePath
$arthasStatePath = Join-Path $PSScriptRoot "arthas_state.txt"
$arthasThemes = @("arthas-dark", "arthas-light")

function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

function Get-CenteredLine([string]$text, [int]$width) {
    $plain = Strip-Ansi $text
    $pad = [Math]::Max(0, [int](($width - $plain.Length) / 2))
    return ((" " * $pad) + $text)
}

function Resolve-ArthasImagePath([string]$variant) {
    $foxRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    if ($variant -eq "light") {
        $candidates = @(
            $env:FOXTERM_ARTHAS_LIGHT_IMAGE,
            (Join-Path $foxRoot "FoxTerminal\assets\arthas-light.png"),
            "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-2c33b40a-2d6a-4966-9857-e2b773206daa.png"
        )
    } else {
        $candidates = @(
            $env:FOXTERM_ARTHAS_DARK_IMAGE,
            (Join-Path $foxRoot "FoxTerminal\assets\arthas-dark.png"),
            "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-206ef388-bbab-4df9-b7f6-99f1076baa75.png"
        )
    }

    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Soften-ArthasHighlight([int]$r, [int]$g, [int]$b) {
    # Only crush near-white speculars. Midtones stay as in the photo.
    $max = [Math]::Max($r, [Math]::Max($g, $b))
    if ($max -le 210) { return @($r, $g, $b) }
    $t = ($max - 210) / 45.0
    $cap = 198.0
    $scale = (($max * (1.0 - $t)) + ($cap * $t)) / $max
    return @(
        [Math]::Min(205, [int]($r * $scale)),
        [Math]::Min(205, [int]($g * $scale)),
        [Math]::Min(205, [int]($b * $scale))
    )
}

function Get-ArthasAsciiArtData([string]$path, [int]$targetWidth, [double]$charAspect) {
    try { Add-Type -AssemblyName System.Drawing | Out-Null } catch { return $null }
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $img = [System.Drawing.Image]::FromFile($path)
    $bmp = $null
    try {
        $aspect = $img.Height / [double]$img.Width
        $targetHeight = [int][Math]::Max(18, [Math]::Round($targetWidth * $aspect * $charAspect))
        $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
        $g.Dispose()

        # Classic ASCII ramp (same as before). Density carries the face.
        $chars = ' .''`^",:;Il!i~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
        $lums = New-Object System.Collections.Generic.List[double]
        $pix = New-Object System.Collections.Generic.List[object]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                $lum = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114)
                if ($c.A -lt 16) {
                    $pix.Add($null)
                    $lums.Add(-1)
                    continue
                }
                $pix.Add(@($c.R, $c.G, $c.B, $lum))
                $lums.Add($lum)
            }
        }

        # Stretch contrast so eyes / hair / armor separate from midtones.
        $valid = @($lums | Where-Object { $_ -ge 0 })
        $lo = 20.0
        $hi = 235.0
        if ($valid.Count -gt 20) {
            $sorted = $valid | Sort-Object
            $lo = $sorted[[Math]::Max(0, [int]($sorted.Count * 0.05))]
            $hi = $sorted[[Math]::Min($sorted.Count - 1, [int]($sorted.Count * 0.97))]
            if (($hi - $lo) -lt 40) { $lo = 20.0; $hi = 235.0 }
        }

        $lines = New-Object System.Collections.Generic.List[string]
        $colors = New-Object System.Collections.Generic.List[object]
        $i = 0
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $lineColors = New-Object System.Collections.Generic.List[object]
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $p = $pix[$i]
                $i++
                if ($null -eq $p) {
                    $line += " "
                    $lineColors.Add($null)
                    continue
                }
                $norm = ($p[3] - $lo) / ($hi - $lo)
                if ($norm -lt 0) { $norm = 0 }
                if ($norm -gt 1) { $norm = 1 }
                $brightness = [Math]::Pow($norm, 0.72)
                # Soft ceiling so speculars stay dense but not pure-white blobs.
                if ($brightness -gt 0.92) {
                    $brightness = 0.92 + (($brightness - 0.92) * 0.35)
                }
                $idx = [int]([Math]::Round($brightness * ($chars.Length - 1)))
                $line += $chars[$idx]
                $lineColors.Add((Soften-ArthasHighlight $p[0] $p[1] $p[2]))
            }
            $lines.Add($line)
            $colors.Add($lineColors.ToArray())
        }
        return @{ Lines = $lines.ToArray(); Colors = $colors.ToArray() }
    } finally {
        if ($null -ne $bmp) { $bmp.Dispose() }
        $img.Dispose()
    }
}

function Colorize-ArthasAsciiLine([string]$line, [object[]]$colors) {
    if ([string]::IsNullOrEmpty($line)) { return $line }
    $esc = [char]27
    $out = ""
    for ($i = 0; $i -lt $line.Length; $i++) {
        $ch = $line[$i]
        if ($ch -eq " ") { $out += " "; continue }
        $rgb = if ($i -lt $colors.Length) { $colors[$i] } else { $null }
        if ($null -eq $rgb) {
            $out += $ch
        } else {
            $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])m$ch"
        }
    }
    return ($out + "$esc[0m")
}

function Get-ArthasCaption([string]$themeName) {
    function New-Text([int[]]$codes) {
        return (-join ($codes | ForEach-Object { [char]$_ }))
    }
    if ($themeName -eq "arthas-light") {
        return (New-Text @(0x042F,0x0020,0x0441,0x043B,0x0443,0x0436,0x0443,0x0020,0x0421,0x0432,0x0435,0x0442,0x0443))
    }
    return (New-Text @(0x041A,0x0430,0x043A,0x0020,0x0433,0x043B,0x0443,0x043F,0x043E,0x0020,0x0431,0x044B,0x043B,0x043E,0x0020,0x0432,0x0435,0x0440,0x0438,0x0442,0x044C,0x0020,0x0432,0x0020,0x0441,0x0432,0x0435,0x0442))
}

function Get-ArthasTitle([string]$themeName) {
    if ($themeName -eq "arthas-light") { return "[ ARTHAS - LIGHT ]" }
    return "[ ARTHAS - FROST ]"
}

function Get-ArthasHint([string]$themeName) {
    if ($themeName -eq "arthas-light") {
        return "Left/Right or A/D - swap Arthas | Ctrl+E - close"
    }
    return "Left/Right or A/D - swap Arthas | Ctrl+E - close"
}

function Render-ArthasPanel([string]$themeName, [hashtable]$artData) {
    Clear-FoxHost
    $w = 100
    try { $w = [Math]::Max(60, $host.UI.RawUI.WindowSize.Width) } catch {}

    Write-Host ""
    $palette = Get-ThemePalette
    Write-Host (Get-CenteredLine (Color-Text $palette.accent (Get-ArthasTitle $themeName)) $w)
    Write-Host ""

    if ($null -eq $artData) {
        $missing = Color-Text $palette.accent2 "[arthas image not found]"
        Write-Host (Get-CenteredLine $missing $w)
    } else {
        $artW = $artData.Lines[0].Length
        $pad = [Math]::Max(0, [int](($w - $artW) / 2))
        $padStr = " " * $pad
        for ($i = 0; $i -lt $artData.Lines.Count; $i++) {
            $line = Colorize-ArthasAsciiLine $artData.Lines[$i] $artData.Colors[$i]
            Write-Host ($padStr + $line)
        }
    }

    Write-Host ""
    Write-Host (Get-CenteredLine (Color-Text $palette.accent2 (Get-ArthasCaption $themeName)) $w)
    Write-Host ""
    Write-Host (Get-CenteredLine (Color-Text $palette.dim (Get-ArthasHint $themeName)) $w)
}

function Save-ThemeName([string]$themeName) {
    if (Get-Command Save-ActiveTheme -ErrorAction SilentlyContinue) {
        Save-ActiveTheme $themeName
    } else {
        $themeName | Set-Content -Path $themePath -Encoding UTF8
    }
}

function Apply-ArthasTheme([string]$themeName, [switch]$RedrawPrompt) {
    Save-ThemeName $themeName
    if ($RedrawPrompt) {
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
    } else {
        Clear-FoxThemeCache
        Apply-ThemeColors
    }
}

$currentTheme = Get-ActiveThemeName
if ($arthasThemes -contains $currentTheme) {
    $restoreTo = "orange"
    if (Test-Path $arthasStatePath) {
        $saved = (Get-Content -Path $arthasStatePath -Raw -ErrorAction SilentlyContinue).Trim()
        if (-not [string]::IsNullOrWhiteSpace($saved) -and ($arthasThemes -notcontains $saved)) {
            $restoreTo = $saved
        }
    }

    Save-ThemeName $restoreTo
    if (Test-Path $arthasStatePath) { Remove-Item $arthasStatePath -Force }
    Sync-FoxTheme -ForcePrompt -RedrawPrompt
    Register-FoxConsoleFocusRepair
    Write-Host ""
    Write-Host "  Arthas theme OFF. Theme restored: $restoreTo"
    Write-Host ""
    exit 0
}

$currentTheme | Set-Content -Path $arthasStatePath -Encoding UTF8
$activeTheme = "arthas-dark"
Apply-ArthasTheme $activeTheme -RedrawPrompt
Register-FoxConsoleFocusRepair

$darkPath = Resolve-ArthasImagePath "dark"
$lightPath = Resolve-ArthasImagePath "light"

$windowWidth = 100
try { $windowWidth = [Math]::Max(60, $host.UI.RawUI.WindowSize.Width) } catch {}
$targetWidth = [Math]::Min(120, [Math]::Max(64, $windowWidth - 16))
$darkArt = if ($darkPath) { Get-ArthasAsciiArtData $darkPath $targetWidth 0.5 } else { $null }
$lightArt = if ($lightPath) { Get-ArthasAsciiArtData $lightPath $targetWidth 0.5 } else { $null }

try { [Console]::CursorVisible = $false } catch {}
try {
    while ($true) {
        $art = if ($activeTheme -eq "arthas-light") { $lightArt } else { $darkArt }
        Render-ArthasPanel $activeTheme $art

        $k = [Console]::ReadKey($true)
        if (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E") {
            break
        }

        $switchTheme = $null
        if ($k.Key -eq "LeftArrow" -or $k.Key -eq "A") {
            $switchTheme = if ($activeTheme -eq "arthas-light") { "arthas-dark" } else { "arthas-light" }
        } elseif ($k.Key -eq "RightArrow" -or $k.Key -eq "D") {
            $switchTheme = if ($activeTheme -eq "arthas-dark") { "arthas-light" } else { "arthas-dark" }
        }

        if ($switchTheme -and $switchTheme -ne $activeTheme) {
            $activeTheme = $switchTheme
            Apply-ArthasTheme $activeTheme
        }
    }
} finally {
    try { [Console]::CursorVisible = $true } catch {}
}

Sync-FoxTheme -ForcePrompt -RedrawPrompt
Register-FoxConsoleFocusRepair
