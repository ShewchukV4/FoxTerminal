# FOXSTYLE Apply - style.json to whole FoxOS stack
# theme.txt, wallpaper night, Windows DWM accent, live.json, dock, Ghostty
$ErrorActionPreference = 'Stop'
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

. (Join-Path $PSScriptRoot 'foxos-lib.ps1')
if (Test-Path (Join-Path $PSScriptRoot 'ghostty-lib.ps1')) { . (Join-Path $PSScriptRoot 'ghostty-lib.ps1') }
if (Test-Path (Join-Path $PSScriptRoot 'foxlook-lib.ps1')) { . (Join-Path $PSScriptRoot 'foxlook-lib.ps1') }
if (Test-Path (Join-Path $PSScriptRoot 'foxauth.ps1')) { . (Join-Path $PSScriptRoot 'foxauth.ps1') }
if (Test-Path (Join-Path $PSScriptRoot 'shader-lib.ps1')) { . (Join-Path $PSScriptRoot 'shader-lib.ps1') }

$stylePath = Join-Path (Get-FoxOsDir) 'style.json'
if (-not (Test-Path -LiteralPath $stylePath)) {
    Write-Host 'FOXSTYLE apply: no style.json'
    exit 1
}
$doc = Get-Content -LiteralPath $stylePath -Raw -Encoding UTF8 | ConvertFrom-Json

$preset = [string]$doc.preset
# Prefer the swatch the user picked (colors.sw); presets only fill the gap.
$sw = ''
if ($doc.colors -and $doc.colors.sw) { $sw = [string]$doc.colors.sw }
if ([string]::IsNullOrWhiteSpace($sw)) {
    $sw = switch ($preset) {
        'neon' { 'neon' }
        'foxpurple' { 'purple' }
        'light' { 'white' }
        'dark' { 'violet' }
        default {
            if ($doc.colors -and $doc.colors.theme) {
                switch ([string]$doc.colors.theme) {
                    'neon' { 'neon' }
                    'light' { 'white' }
                    default { 'violet' }
                }
            } else { 'violet' }
        }
    }
}
$sw = $sw.Trim().ToLowerInvariant()

# Always prefer style.json colors (what the user tuned in FOXSTYLE)
$accent  = if ($doc.colors.accent)  { [string]$doc.colors.accent }  else { '#7B5CFF' }
$accent2 = if ($doc.colors.accent2) { [string]$doc.colors.accent2 } else { $accent }
$night   = if ($doc.colors.bg)      { [string]$doc.colors.bg }      else { '#0B0A12' }
$ink     = if ($doc.colors.ink)     { [string]$doc.colors.ink }     else { '#E6E6E6' }
$dock = 'pill'
$wallKind = 'glass'
$wallRain = 30
$wallStrength = 60
$wallScale = 50
$wallWeight = 40
$wallVeil = 50
if ($doc.texture) {
    if ($doc.texture.dock) {
        $dock = [string]$doc.texture.dock
        # "bar" = full-width taskbar (rail), not the short "slim" island
        if ($dock -eq 'bar') { $dock = 'rail' }
        if ($dock -notin @('pill','rail','glass','slim')) { $dock = 'pill' }
    }
    if ($doc.texture.kind) { $wallKind = [string]$doc.texture.kind }
    if ($null -ne $doc.texture.rain) { $wallRain = [int]$doc.texture.rain }
    if ($null -ne $doc.texture.strength) { $wallStrength = [int]$doc.texture.strength }
    if ($null -ne $doc.texture.scale) { $wallScale = [int]$doc.texture.scale }
    if ($null -ne $doc.texture.weight) { $wallWeight = [int]$doc.texture.weight }
    if ($null -ne $doc.texture.veil) { $wallVeil = [int]$doc.texture.veil }
}
$wallStrength = [Math]::Max(0, [Math]::Min(100, $wallStrength))
$wallScale = [Math]::Max(0, [Math]::Min(100, $wallScale))
$wallWeight = [Math]::Max(0, [Math]::Min(100, $wallWeight))
$wallVeil = [Math]::Max(0, [Math]::Min(100, $wallVeil))
$foxGlow = [bool]($doc.labs -and $doc.labs.foxGlow)
$foxGlowStrength = 70
$foxGlowSpeed = 50
if ($doc.labs) {
    if ($null -ne $doc.labs.glowStrength) { $foxGlowStrength = [int]$doc.labs.glowStrength }
    if ($null -ne $doc.labs.glowSpeed) { $foxGlowSpeed = [int]$doc.labs.glowSpeed }
}
$foxGlowStrength = [Math]::Max(0, [Math]::Min(100, $foxGlowStrength))
$foxGlowSpeed = [Math]::Max(0, [Math]::Min(100, $foxGlowSpeed))
$dockPos = 'bottom'
try {
    if (Get-Command Read-FoxLookState -ErrorAction SilentlyContinue) {
        $cur = Read-FoxLookState
        if ($cur.dockPos) { $dockPos = [string]$cur.dockPos }
    }
} catch {}

Write-Host ("FOXSTYLE apply: sw=$sw accent=$accent night=$night dock=$dock")

# --- system-wide window / taskbar shape (foxos-live applies it to every window) ---
$radius = 12
if ($doc.window -and $null -ne $doc.window.radius) { $radius = [int]$doc.window.radius }
$winCorner = if ($radius -le 2) { 'square' } elseif ($radius -le 9) { 'small' } else { 'round' }
$tbRadius = [Math]::Max(0, [Math]::Min(28, $radius))
$floating = [bool]($doc.chrome -and $doc.chrome.floating)
$tbInset = if ($floating) { 8 } else { 0 }
$lightMode = ($preset -eq 'light')
$motionOff = ($doc.motion -and [string]$doc.motion.scale -eq 'off')
$chromeOp = 72
$chromeH = 56
$chromeBlur = 0
if ($doc.chrome) {
    if ($null -ne $doc.chrome.opacity) { $chromeOp = [int]$doc.chrome.opacity }
    if ($null -ne $doc.chrome.height) { $chromeH = [int]$doc.chrome.height }
    if ($null -ne $doc.chrome.blur) { $chromeBlur = [int]$doc.chrome.blur }
}
$chromeH = [Math]::Max(36, [Math]::Min(80, $chromeH))
$chromeBlur = [Math]::Max(0, [Math]::Min(40, $chromeBlur))

# FoxOS dock = the taskbar when shell mode is on
$dockRadius = [Math]::Min(60, $radius * 2)
$dockPad = if ($floating) { 16 } else { 0 }
$dockAlpha = [Math]::Max(20, [Math]::Min(100, $chromeOp))
$dockBarH = $chromeH
$dockBlur = $chromeBlur

$appliedObj = [ordered]@{
    sw = $sw; accent = $accent; accent2 = $accent2; night = $night
    dockStyle = $dock; dockPos = $dockPos
    winCorner = $winCorner; winRadius = [string]$radius
    tbRadius = [string]$tbRadius; tbInset = [string]$tbInset
    dockRadius = [string]$dockRadius; dockPad = [string]$dockPad; dockAlpha = [string]$dockAlpha
    dockBarH = [string]$dockBarH; dockBlur = [string]$dockBlur
    wallKind = $wallKind; wallRain = [string]$wallRain
    wallStrength = [string]$wallStrength; wallScale = [string]$wallScale
    wallWeight = [string]$wallWeight; wallVeil = [string]$wallVeil
    foxGlow = $(if ($foxGlow) { 'on' } else { 'off' })
    foxGlowStrength = [string]$foxGlowStrength; foxGlowSpeed = [string]$foxGlowSpeed
    tbAccent = 'on'
}
[System.IO.File]::WriteAllText(
    (Join-Path (Get-FoxOsDir) 'style-applied.json'),
    ($appliedObj | ConvertTo-Json -Compress),
    (New-Object System.Text.UTF8Encoding $false))
Write-Host ("system look: winCorner=$winCorner taskbarRadius=$tbRadius inset=$tbInset light=$lightMode motionOff=$motionOff")

# Windows light/dark + transparency + animations
try {
    $pz = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
    if (-not (Test-Path $pz)) { New-Item -Path $pz -Force | Out-Null }
    $lv = if ($lightMode) { 1 } else { 0 }
    Set-ItemProperty -Path $pz -Name 'AppsUseLightTheme' -Value $lv -Type DWord
    Set-ItemProperty -Path $pz -Name 'SystemUsesLightTheme' -Value $lv -Type DWord
    Set-ItemProperty -Path $pz -Name 'EnableTransparency' -Value $(if ($chromeOp -lt 100) { 1 } else { 0 }) -Type DWord
    if (-not ('FoxStyleSpi' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FoxStyleSpi {
    [StructLayout(LayoutKind.Sequential)] public struct ANIMATIONINFO { public uint cbSize; public int iMinAnimate; }
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SystemParametersInfo(uint a, uint p, IntPtr v, uint f);
    [DllImport("user32.dll", SetLastError=true)] public static extern bool SystemParametersInfo(uint a, uint p, ref ANIMATIONINFO v, uint f);
    public static void Anim(bool on) {
        SystemParametersInfo(0x1043, 0, on ? new IntPtr(1) : IntPtr.Zero, 3);
        ANIMATIONINFO ai = new ANIMATIONINFO(); ai.cbSize = 8; ai.iMinAnimate = on ? 1 : 0;
        SystemParametersInfo(0x0049, 8, ref ai, 3);
    }
}
"@
    }
    [FoxStyleSpi]::Anim(-not $motionOff)
} catch {
    Write-Host ("personalize: " + $_.Exception.Message)
}

# --- 1) theme seed (theme.txt + every open Ghostty pane surface) ---
$themeFile = Join-Path $PSScriptRoot 'theme.txt'
$sw | Set-Content -LiteralPath $themeFile -Encoding ASCII
try {
    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) { Clear-FoxThemeCache }
    $global:FOXTERM_THEME = $sw
    $env:FOXTERM_THEME = $sw
    # Push sw into every live pane theme surface so prompt/OSC match Apply
    $surf = Get-ChildItem -LiteralPath ([System.IO.Path]::GetTempPath()) -Filter 'foxterm-theme-surface-*.txt' -ErrorAction SilentlyContinue
    foreach ($f in @($surf)) {
        try { $sw | Set-Content -LiteralPath $f.FullName -Encoding UTF8 } catch {}
    }
    Write-Host ("theme surfaces updated: " + @($surf).Count)
} catch {}

# --- 2) look.json dock ---
if (Get-Command Read-FoxLookState -ErrorAction SilentlyContinue) {
    try {
        $ls = Read-FoxLookState
        $ls.dockStyle = $dock
        if ($dockPos) { $ls.dockPos = $dockPos }
        Write-FoxLookState $ls
        Write-Host ("look.dockStyle -> " + $dock + " pos=" + $dockPos)
    } catch {}
}

# --- 3) Ensure FoxOS skin path is on (otherwise Sync no-ops) ---
$wasOff = -not (Test-FoxOsEnabled)
if ($wasOff) {
    Save-FoxOsState $true
    Write-Host 'FoxOS was off - enabled for Apply'
}

# --- 4) Wallpaper from style night + texture (glass/neon/metal/rain) ---
function New-FoxStyleWall([string]$HexNight, [string]$HexAccent, [string]$Kind, [int]$Rain, [string]$OutPath) {
    Add-Type -AssemblyName System.Drawing | Out-Null
    $sz = Get-FoxOsScreenSize
    $w = [int]$sz.W; $h = [int]$sz.H
    $c = Convert-HexToDrawingColor $HexNight
    $acc = Convert-HexToDrawingColor $HexAccent
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighSpeed
    $g.Clear($c)

    $k = ([string]$Kind).ToLowerInvariant()
    if ($k -eq 'glass') {
        # soft vertical gradient wash
        $top = [System.Drawing.Color]::FromArgb(255,
            [Math]::Min(255, $c.R + 18), [Math]::Min(255, $c.G + 14), [Math]::Min(255, $c.B + 28))
        $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            (New-Object System.Drawing.Rectangle 0,0,$w,[Math]::Max(1,$h)), $top, $c,
            [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
        $g.FillRectangle($br, 0, 0, $w, $h)
        $br.Dispose()
        $veil = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, $acc))
        $g.FillEllipse($veil, -($w/4), -($h/3), ($w*3/4), ($h*2/3))
        $veil.Dispose()
    } elseif ($k -eq 'neon') {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(55, $acc), 1.0)
        $step = 28
        for ($x = 0; $x -lt $w; $x += $step) { $g.DrawLine($pen, $x, 0, $x, $h) }
        for ($y = 0; $y -lt $h; $y += $step) { $g.DrawLine($pen, 0, $y, $w, $y) }
        $pen.Dispose()
        $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, $acc), 2.0)
        for ($x = 0; $x -lt $w; $x += ($step * 4)) { $g.DrawLine($glow, $x, 0, $x, $h) }
        $glow.Dispose()
    } elseif ($k -eq 'metal') {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 220, 220, 230), 1.0)
        for ($y = 0; $y -lt $h; $y += 3) { $g.DrawLine($pen, 0, $y, $w, $y) }
        $pen.Dispose()
        $sheen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, $acc))
        $g.FillRectangle($sheen, 0, 0, $w, [int]($h * 0.18))
        $sheen.Dispose()
    }
    # rain streaks (density 0..80) — visible even on "none" if rain > 0
    $rN = [Math]::Max(0, [Math]::Min(80, [int]$Rain))
    if ($rN -gt 0 -and $k -ne 'none') {
        $aRain = [Math]::Max(18, [Math]::Min(90, 14 + $rN))
        $rp = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($aRain, $acc), 1.2)
        $step = [Math]::Max(6, 48 - [int]($rN / 2))
        $rng = New-Object System.Random 7
        for ($x = 4; $x -lt $w; $x += $step) {
            $y0 = $rng.Next(0, 40)
            $len = 12 + [int]($rN / 3) + $rng.Next(0, 18)
            $g.DrawLine($rp, $x, $y0, $x, [Math]::Min($h - 1, $y0 + $len))
            # repeat columns down the screen
            for ($yy = $y0 + 80; $yy -lt $h; $yy += (70 + $rng.Next(0, 50))) {
                $g.DrawLine($rp, $x, $yy, $x, [Math]::Min($h - 1, $yy + $len))
            }
        }
        $rp.Dispose()
    }

    $g.Dispose()
    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    return $OutPath
}

$wallDir = Join-Path (Get-FoxOsDir) 'walls'
$wall = Join-Path $wallDir ('foxstyle-' + $sw + '-' + $wallKind + '-r' + $wallRain + '.bmp')
try {
    New-FoxStyleWall $night $accent $wallKind $wallRain $wall | Out-Null
    Set-FoxOsWallpaper $wall | Out-Null
    Write-Host ("wallpaper -> night=$night kind=$wallKind rain=$wallRain")
} catch {
    Write-Host ("wallpaper: " + $_.Exception.Message)
}

# Sync for live process / taskbar / skin bookkeeping (Force)
try {
    if (Test-FoxOsEnabled) {
        Sync-FoxOsSkin -Force | Out-Null
        # Sync may overwrite wall with palette night - re-apply style night + accent
        if (Test-Path -LiteralPath $wall) { Set-FoxOsWallpaper $wall | Out-Null }
    }
} catch {
    Write-Host ("Sync-FoxOsSkin: " + $_.Exception.Message)
}

# --- 5) Windows accent (DWM) always from style ---
try {
    Set-FoxOsAccent $accent
    $dwm = 'HKCU:\Software\Microsoft\Windows\DWM'
    Set-ItemProperty -Path $dwm -Name 'ColorPrevalence' -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $dwm -Name 'EnableWindowColorization' -Value 1 -Type DWord -ErrorAction SilentlyContinue
    Broadcast-FoxOsChange
    Write-Host ("DWM accent -> " + $accent)
} catch {
    Write-Host ("accent: " + $_.Exception.Message)
}

# --- 6) ensure live + media watch are up ---
try { Start-FoxOsLive | Out-Null } catch {}
try { Start-FoxOsMediaWatch | Out-Null; Write-Host 'media watch ok' } catch {
    Write-Host ("media watch: " + $_.Exception.Message)
}

# --- 7) Ghostty colors + reload (full theme: bg/fg/cursor + ANSI from palette) ---
try {
    if (Get-Command Get-GhosttyConfigDir -ErrorAction SilentlyContinue) {
        $cfgDir = Get-GhosttyConfigDir
        if ($cfgDir) {
            New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
            $overlay = Join-Path $cfgDir 'foxterminal-foxstyle.ghostty'
            $pAcc = $accent; $pAcc2 = $accent2; $pBase = $night; $pText = $ink; $pDim = '#888888'
            try {
                if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) {
                    $global:FOXTERM_THEME = $sw
                    $env:FOXTERM_THEME = $sw
                    if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) { Clear-FoxThemeCache }
                    # temporary surface so Get-ActiveThemeName == $sw
                    if (Get-Command Get-ThemeSurfacePath -ErrorAction SilentlyContinue) {
                        $sp = Get-ThemeSurfacePath
                        if ($sp) { $sw | Set-Content -LiteralPath $sp -Encoding UTF8 }
                    }
                    $gp = Get-ThemePalette
                    if ($gp.accent) { $pAcc = [string]$gp.accent }
                    if ($gp.accent2) { $pAcc2 = [string]$gp.accent2 }
                    if ($gp.base) { $pBase = [string]$gp.base }
                    if ($gp.text) { $pText = [string]$gp.text }
                    if ($gp.dim) { $pDim = [string]$gp.dim }
                }
            } catch {}
            # Prefer FOXSTYLE night/ink/accent when user tuned them
            if ($night) { $pBase = $night }
            if ($ink) { $pText = $ink }
            if ($accent) { $pAcc = $accent }
            if ($accent2) { $pAcc2 = $accent2 }
            $lines = @(
                '# Generated by FOXSTYLE Apply'
                ("background = " + $pBase)
                ("foreground = " + $pText)
                ("cursor-color = " + $pAcc)
                ("selection-background = " + $pAcc)
                ("selection-foreground = " + $pBase)
                ("window-titlebar-background = " + $pBase)
                ("palette = 0=" + $pBase)
                ("palette = 1=" + $pAcc)
                ("palette = 2=" + $pAcc2)
                ("palette = 3=" + $pAcc2)
                ("palette = 4=" + $pAcc)
                ("palette = 5=" + $pAcc)
                ("palette = 6=" + $pAcc2)
                ("palette = 7=" + $pText)
                ("palette = 8=" + $pDim)
                ("palette = 9=" + $pAcc)
                ("palette = 10=" + $pAcc2)
                ("palette = 11=" + $pAcc2)
                ("palette = 12=" + $pAcc)
                ("palette = 13=" + $pAcc)
                ("palette = 14=" + $pAcc2)
                ("palette = 15=" + $pText)
            )
            [System.IO.File]::WriteAllLines($overlay, $lines, (New-Object System.Text.UTF8Encoding $false))
            Write-Host ("ghostty overlay bg=" + $pBase + " fg=" + $pText + " cursor=" + $pAcc)

            $main = Get-GhosttyConfigPath
            if ($main -and (Test-Path -LiteralPath $main)) {
                $raw = Get-Content -LiteralPath $main -Raw -ErrorAction SilentlyContinue
                if ($raw -notmatch 'foxterminal-foxstyle\.ghostty') {
                    Add-Content -LiteralPath $main -Value "`r`n# FOXSTYLE live theme`r`nconfig-file = foxterminal-foxstyle.ghostty`r`n" -Encoding UTF8
                }
            }
            if (Get-Command Invoke-GhosttyReloadConfig -ErrorAction SilentlyContinue) {
                $ok = Invoke-GhosttyReloadConfig
                Write-Host ("ghostty reload=" + $ok)
            }
        }
    }
} catch {
    Write-Host ("ghostty: " + $_.Exception.Message)
}

# --- 8) live.json LAST - Start-FoxOsLive / Sync overwrite with palette, so patch after ---
function Write-FoxStyleLivePatch {
    $livePath = Get-FoxOsLiveStatePath
    if (-not (Test-Path -LiteralPath $livePath)) {
        try { Write-FoxOsLiveState } catch {}
    }
    if (-not (Test-Path -LiteralPath $livePath)) { return }
    $j = Get-Content -LiteralPath $livePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $j.theme = $sw
    $j.accent = $accent
    $j.accent2 = $accent2
    $j.night = $night
    $j.dockStyle = $dock
    $j.dockPos = $dockPos
    $j.winCorner = $winCorner
    $j.winRadius = [string]$radius
    $j.tbRadius = [string]$tbRadius
    $j.tbInset = [string]$tbInset
    $j.dockRadius = [string]$dockRadius
    $j.dockPad = [string]$dockPad
    $j.dockAlpha = [string]$dockAlpha
    $j.dockBarH = [string]$dockBarH
    $j.dockBlur = [string]$dockBlur
    $j.wallKind = $wallKind
    $j.wallRain = [string]$wallRain
    $j.wallStrength = [string]$wallStrength
    $j.wallScale = [string]$wallScale
    $j.wallWeight = [string]$wallWeight
    $j.wallVeil = [string]$wallVeil
    $j.foxGlow = $(if ($foxGlow) { 'on' } else { 'off' })
    $j.foxGlowStrength = [string]$foxGlowStrength
    $j.foxGlowSpeed = [string]$foxGlowSpeed
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($livePath, ($j | ConvertTo-Json -Compress), $utf8)
    Write-Host ("live.json final dock=$dock alpha=$dockAlpha wall=$wallKind str=$wallStrength wt=$wallWeight glow=$foxGlow/$foxGlowStrength")
}
Write-FoxStyleLivePatch
Start-Sleep -Milliseconds 350
Write-FoxStyleLivePatch

if (Get-Command Write-FoxToast -ErrorAction SilentlyContinue) {
    Write-FoxToast ("FOXSTYLE system: " + $sw)
}

Write-Host 'FOXSTYLE apply done.'
exit 0
