$script:FoxPrideStyles = @("gay", "bi", "lesbian", "trans", "femboy")

function Get-PrideStylePath {
    return (Join-Path $PSScriptRoot "pride_style.txt")
}

function Get-PrideStatePath {
    return (Join-Path $PSScriptRoot "pride_state.txt")
}

function Test-PrideActive {
    try {
        if (Get-Command Load-ThemeName -ErrorAction SilentlyContinue) {
            return ((Load-ThemeName) -eq "pride")
        }
    } catch {}
    $path = Join-Path $PSScriptRoot "theme.txt"
    if (-not (Test-Path $path)) { return $false }
    $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim().ToLower()
    return ($name -eq "pride")
}

function Load-PrideStyle {
    $path = Get-PrideStylePath
    if (Test-Path $path) {
        $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim().ToLower()
        if ($script:FoxPrideStyles -contains $name) { return $name }
    }
    return "gay"
}

function Save-PrideStyle([string]$style) {
    if ($script:FoxPrideStyles -notcontains $style) { return }
    $style | Set-Content -Path (Get-PrideStylePath) -Encoding UTF8
}

function Get-PrideStyleLabel([string]$style) {
    switch ($style) {
        "gay"     { return "Gay" }
        "bi"      { return "Bi" }
        "lesbian" { return "Lesbian" }
        "trans"   { return "Trans" }
        "femboy"  { return "Femboy" }
        default   { return $style }
    }
}

function Get-PrideFlagColors([string]$style) {
    switch ($style) {
        "gay" {
            # MLM / gay men pride flag (7 stripes)
            return @("#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78")
        }
        "bi" {
            return @("#D60270", "#9B4F96", "#0038A8")
        }
        "lesbian" {
            return @("#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4")
        }
        "trans" {
            return @("#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA")
        }
        "femboy" {
            return @("#FF97BD", "#FFADD6", "#FFD6E8", "#FFFFFF", "#C9E4FF", "#9EC6FF", "#7BA7E1")
        }
        default {
            return @("#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78")
        }
    }
}

function Get-PrideFoxFlagColors([string]$style) {
    if ($style -eq "femboy") {
        return @("#FF3D8A", "#FF6BAD", "#FF9FCC", "#FFFFFF", "#6AABFF", "#2E6FD4", "#1247A8")
    }
    return Get-PrideFlagColors $style
}

function Get-PridePalette([string]$style) {
    $c = Get-PrideFlagColors $style
    $pick = {
        param([int]$i)
        if ($i -lt $c.Count) { return $c[$i] }
        return $c[$c.Count - 1]
    }
    return @{
        accent  = & $pick 0
        accent2 = & $pick 1
        accent3 = & $pick ([Math]::Min(2, $c.Count - 1))
        accent4 = & $pick ([Math]::Min($c.Count - 1, 3))
        dim     = if ($c.Count -gt 2) { $c[[Math]::Min(2, $c.Count - 1)] } else { $c[0] }
        base    = "#0B0F1A"
        text    = "#F2F4FC"
    }
}

function Get-PrideHexFromFlag([string]$style) {
    $c = Get-PrideFlagColors $style
    return $c[[Math]::Min(1, $c.Count - 1)]
}

function Get-PrideStripeIndex([int]$position, [int]$count, [int]$stripeCount) {
    if ($count -le 1 -or $stripeCount -le 1) { return 0 }
    $t = $position / [double]($count - 1)
    $idx = [int][Math]::Floor($t * ($stripeCount - 1) + 0.001)
    if ($idx -ge $stripeCount) { return $stripeCount - 1 }
    return $idx
}

function Get-PrideRgbFromHex([string]$hex) {
    $rgb = Convert-HexToRgb $hex
    return @($rgb.r, $rgb.g, $rgb.b)
}

function Colorize-PrideGradient([string]$text, [char]$esc, [string[]]$colors) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    if ($null -eq $colors -or $colors.Count -eq 0) { return $text }

    $visible = @()
    for ($i = 0; $i -lt $text.Length; $i++) {
        if ($text[$i] -ne ' ') { $visible += $i }
    }
    if ($visible.Count -eq 0) { return $text }

    $out = ""
    for ($i = 0; $i -lt $text.Length; $i++) {
        $ch = $text[$i]
        if ($ch -eq ' ') {
            $out += ' '
            continue
        }
        $visPos = [Array]::IndexOf($visible, $i)
        $idx = Get-PrideStripeIndex $visPos $visible.Count $colors.Count
        $rgb = Convert-HexToRgb $colors[$idx]
        $out += "${esc}[38;2;$($rgb.r);$($rgb.g);$($rgb.b)m" + $ch + "${esc}[0m"
    }
    return $out
}

function Colorize-PrideRow([string]$text, [char]$esc, [string[]]$colors, [int]$rowIndex, [int]$rowCount) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    if ($null -eq $colors -or $colors.Count -eq 0) { return $text }

    $stripeIdx = Get-PrideStripeIndex $rowIndex ([Math]::Max(1, $rowCount)) $colors.Count
    $rgb = Convert-HexToRgb $colors[$stripeIdx]
    $out = ""
    for ($i = 0; $i -lt $text.Length; $i++) {
        $ch = $text[$i]
        if ($ch -eq ' ') {
            $out += ' '
            continue
        }
        $out += "${esc}[38;2;$($rgb.r);$($rgb.g);$($rgb.b)m" + $ch + "${esc}[0m"
    }
    return $out
}

function Get-PrideArtBounds([string[]]$lines) {
    $minRow = -1
    $maxRow = -1
    $minCol = [int]::MaxValue
    $maxCol = -1
    $contentRows = New-Object System.Collections.Generic.List[int]
    for ($r = 0; $r -lt $lines.Count; $r++) {
        $line = $lines[$r]
        $rowHasPixel = $false
        for ($c = 0; $c -lt $line.Length; $c++) {
            if ($line[$c] -eq ' ') { continue }
            $rowHasPixel = $true
            if ($minRow -lt 0) { $minRow = $r }
            $maxRow = $r
            if ($c -lt $minCol) { $minCol = $c }
            if ($c -gt $maxCol) { $maxCol = $c }
        }
        if ($rowHasPixel) { [void]$contentRows.Add($r) }
    }
    if ($minRow -lt 0) {
        return @{
            MinRow = 0
            MaxRow = [Math]::Max(0, $lines.Count - 1)
            MinCol = 0
            MaxCol = 0
            RowCount = 1
            ColCount = 1
            ContentRows = @(0)
        }
    }
    return @{
        MinRow = $minRow
        MaxRow = $maxRow
        MinCol = $minCol
        MaxCol = $maxCol
        RowCount = $contentRows.Count
        ColCount = ($maxCol - $minCol + 1)
        ContentRows = $contentRows.ToArray()
    }
}

function Get-PrideArtRgb([int]$lineIndex, [int]$colIndex, [hashtable]$bounds, [string]$style) {
    $colors = Get-PrideFoxFlagColors $style
    if ($null -eq $bounds) {
        $idx = Get-PrideStripeIndex $lineIndex ([Math]::Max(1, $colors.Count)) $colors.Count
        return Get-PrideRgbFromHex $colors[$idx]
    }

    if ($lineIndex -lt $bounds.MinRow -or $lineIndex -gt $bounds.MaxRow) {
        return Get-PrideRgbFromHex $colors[0]
    }
    if ($colIndex -lt $bounds.MinCol -or $colIndex -gt $bounds.MaxCol) {
        return Get-PrideRgbFromHex $colors[0]
    }

    $visRow = [Array]::IndexOf($bounds.ContentRows, $lineIndex)
    if ($visRow -lt 0) {
        return Get-PrideRgbFromHex $colors[0]
    }
    $idx = Get-PrideStripeIndex $visRow $bounds.RowCount $colors.Count

    return Get-PrideRgbFromHex $colors[$idx]
}

function Set-PridePSReadLineColors([string]$style) {
    try {
        if (-not (Get-Module -ListAvailable -Name PSReadLine)) { return }
        Import-Module PSReadLine -ErrorAction SilentlyContinue | Out-Null
        $c = Get-PrideFlagColors $style
        $at = { param([int]$i) if ($i -lt $c.Count) { $c[$i] } else { $c[$c.Count - 1] } }
        Set-PSReadLineOption -Colors @{
            Command   = (& $at 0)
            Parameter = (& $at 1)
            Operator  = (& $at ([Math]::Min(2, $c.Count - 1)))
            Type      = (& $at ([Math]::Min(3, $c.Count - 1)))
            Number    = (& $at ([Math]::Min(4, $c.Count - 1)))
            Variable  = (& $at ([Math]::Min(1, $c.Count - 1)))
        } | Out-Null
    } catch {}
}
