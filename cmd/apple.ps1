param(
    [string]$ImagePath
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

function Get-CenteredLine([string]$text, [int]$width) {
    $plain = Strip-Ansi $text
    $pad = [Math]::Max(0, [int](($width - $plain.Length) / 2))
    return ((" " * $pad) + $text)
}

function Resolve-AppleImagePath([string]$requested) {
    if (-not [string]::IsNullOrWhiteSpace($requested) -and (Test-Path -LiteralPath $requested)) { return $requested }

    $envPath = $env:FOXTERM_APPLE_IMAGE
    if ([string]::IsNullOrWhiteSpace($envPath)) { $envPath = $env:FOXTERM_DNOTE_IMAGE }
    if (-not [string]::IsNullOrWhiteSpace($envPath) -and (Test-Path -LiteralPath $envPath)) { return $envPath }

    $root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $candidates = @(
        (Join-Path $root "FoxTerminal\assets\dnote-scene.png"),
        (Join-Path $root "FoxTerminal\assets\dnote-scene.jpg"),
        "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-0a774970-2d0d-41bf-bdb0-49030642ae8a.png",
        "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-a37bda16-320e-4a60-9338-a725feb8f448.png"
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Get-AppleAsciiArtData([string]$path, [int]$targetWidth, [double]$charAspect) {
    try { Add-Type -AssemblyName System.Drawing | Out-Null } catch { return $null }
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $img = [System.Drawing.Image]::FromFile($path)
    try {
        $aspect = $img.Height / [double]$img.Width
        $targetHeight = [int][Math]::Max(20, [Math]::Round($targetWidth * $aspect * $charAspect))
        $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
        $g.Dispose()

        $chars = ' .''`^",:;Il!i~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
        $lines = New-Object System.Collections.Generic.List[string]
        $colors = New-Object System.Collections.Generic.List[object]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $lineColors = New-Object System.Collections.Generic.List[object]
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                $lum = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114)
                if ($c.A -lt 16) {
                    $line += " "
                    $lineColors.Add($null)
                    continue
                }
                $brightness = [Math]::Pow($lum / 255.0, 0.72)
                $idx = [int]([Math]::Round($brightness * ($chars.Length - 1)))
                $line += $chars[$idx]
                $lineColors.Add(@($c.R, $c.G, $c.B))
            }
            $lines.Add($line)
            $colors.Add($lineColors.ToArray())
        }
        return @{ Lines = $lines.ToArray(); Colors = $colors.ToArray() }
    } finally {
        $img.Dispose()
    }
}

function Colorize-AppleAsciiLine([string]$line, [object[]]$colors) {
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

$path = Resolve-AppleImagePath $ImagePath
if (-not $path) {
    Write-Host "apple image not found."
    Write-Host "Set FOXTERM_APPLE_IMAGE or place dnote-scene.png in FoxTerminal/assets."
    exit 1
}

$w = 100
$h = 30
try {
    $w = [Math]::Max(60, $host.UI.RawUI.WindowSize.Width)
    $h = [Math]::Max(16, $host.UI.RawUI.WindowSize.Height)
} catch {}

# Use almost full terminal width for maximum detail.
$targetWidth = [Math]::Min(220, [Math]::Max(96, $w - 2))
$data = Get-AppleAsciiArtData $path $targetWidth 0.5
if ($null -eq $data) {
    Write-Host "Failed to render image."
    exit 1
}

Clear-Host
$artLines = $data.Lines
$artColors = $data.Colors
$topPad = [Math]::Max(0, [int](($h - $artLines.Count) / 2))
for ($pad = 0; $pad -lt $topPad; $pad++) { Write-Host "" }
for ($i = 0; $i -lt $artLines.Count; $i++) {
    $line = Colorize-AppleAsciiLine $artLines[$i] $artColors[$i]
    Write-Host (Get-CenteredLine $line $w)
}

# Keep viewer open (no prompt line) until Escape.
try { [Console]::CursorVisible = $false } catch {}
try {
    while ($true) {
        $k = [Console]::ReadKey($true)
        if ($k.Key -eq 'Escape') { break }
    }
} finally {
    try { [Console]::CursorVisible = $true } catch {}
}
Clear-Host
