# FoxOS pixel cursors: every shape is an ASCII pixel map, tinted by the active theme and
# written as a .cur file. A 1px (or 2px) dark outline is grown around each shape automatically.
#   o  accent   +  highlight   -  shade   n  night (pupils, nose)   w  white   .  transparent
# Styles: neon (hollow, accent rim; default), pixel (classic thin arrow), chunky (2px outline, bold), fox (fox-head pointer).
# Loaded after foxos-lib.ps1 (needs Get-FoxOsPalette, Get-FoxOsNightHex, Get-FoxOsThemeName, Get-FoxOsDir).

$script:FoxCursorStyles = @("pixel", "chunky", "neon", "fox")

function Ensure-FoxCursorNative {
    if ("FoxCursor" -as [type]) { return $true }
    try {
        Add-Type -AssemblyName System.Drawing | Out-Null
        Add-Type -ReferencedAssemblies ([System.Drawing.Bitmap].Assembly.Location) -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class FoxCursor {
    public static string[] Pad(string[] map, int pad) {
        int w = 0;
        foreach (string r in map) if (r.Length > w) w = r.Length;
        var rows = new List<string>();
        string blank = new string('.', w + pad * 2);
        for (int i = 0; i < pad; i++) rows.Add(blank);
        foreach (string r in map) rows.Add(new string('.', pad) + r.PadRight(w, '.') + new string('.', pad));
        for (int i = 0; i < pad; i++) rows.Add(blank);
        return rows.ToArray();
    }

    static bool Filled(string[] g, int x, int y) {
        if (y < 0 || y >= g.Length || x < 0 || x >= g[y].Length) return false;
        return g[y][x] != '.';
    }

    // Grow a '#' outline around every filled cell (8-neighbour). Run twice for 2px.
    public static string[] Outline(string[] map, int thickness) {
        string[] g = Pad(map, thickness);
        for (int pass = 0; pass < thickness; pass++) {
            var next = new char[g.Length][];
            for (int y = 0; y < g.Length; y++) {
                next[y] = g[y].ToCharArray();
                for (int x = 0; x < g[y].Length; x++) {
                    if (g[y][x] != '.') continue;
                    bool near = false;
                    for (int dy = -1; dy <= 1 && !near; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                            if ((dx != 0 || dy != 0) && Filled(g, x + dx, y + dy)) { near = true; break; }
                    if (near) next[y][x] = '#';
                }
            }
            for (int y = 0; y < g.Length; y++) g[y] = new string(next[y]);
        }
        return g;
    }

    // Neon: keep a 1px accent rim, fill the inside with night. Thin strokes stay as they are.
    public static string[] Hollow(string[] map) {
        string[] g = Pad(map, 0);
        var out2 = new string[g.Length];
        for (int y = 0; y < g.Length; y++) {
            var row = g[y].ToCharArray();
            for (int x = 0; x < row.Length; x++) {
                char c = g[y][x];
                if (c == '.' || c == 'n' || c == 'w') continue;
                bool inner = true;
                for (int dy = -1; dy <= 1 && inner; dy++)
                    for (int dx = -1; dx <= 1; dx++)
                        if (!Filled(g, x + dx, y + dy)) { inner = false; break; }
                row[x] = inner ? 'n' : 'o';
            }
            out2[y] = new string(row);
        }
        return out2;
    }

    public static string[] Rotate90(string[] map) {
        int h = map.Length, w = 0;
        foreach (string r in map) if (r.Length > w) w = r.Length;
        var out2 = new string[w];
        for (int x = 0; x < w; x++) {
            var sb = new char[h];
            for (int y = 0; y < h; y++) {
                string r = map[h - 1 - y];
                sb[y] = x < r.Length ? r[x] : '.';
            }
            out2[x] = new string(sb);
        }
        return out2;
    }

    public static string[] MirrorH(string[] map) {
        int w = 0;
        foreach (string r in map) if (r.Length > w) w = r.Length;
        var out2 = new string[map.Length];
        for (int y = 0; y < map.Length; y++) {
            var a = map[y].PadRight(w, '.').ToCharArray();
            Array.Reverse(a);
            out2[y] = new string(a);
        }
        return out2;
    }

    public static string[] Compose(string[] a, string[] b, int dx, int dy) {
        int w = 0, h = a.Length;
        foreach (string r in a) if (r.Length > w) w = r.Length;
        int bw = 0;
        foreach (string r in b) if (r.Length > bw) bw = r.Length;
        w = Math.Max(w, dx + bw);
        h = Math.Max(h, dy + b.Length);
        var g = new char[h][];
        for (int y = 0; y < h; y++) {
            g[y] = (y < a.Length ? a[y] : "").PadRight(w, '.').ToCharArray();
        }
        for (int y = 0; y < b.Length; y++)
            for (int x = 0; x < b[y].Length; x++)
                if (b[y][x] != '.') g[y + dy][x + dx] = b[y][x];
        var out2 = new string[h];
        for (int y = 0; y < h; y++) out2[y] = new string(g[y]);
        return out2;
    }

    public static Bitmap Render(string[] grid, int scale, int canvas,
        Color accent, Color light, Color shade, Color night, Color white, Color edge) {
        var bmp = new Bitmap(canvas, canvas, PixelFormat.Format32bppArgb);
        for (int y = 0; y < grid.Length; y++) {
            for (int x = 0; x < grid[y].Length; x++) {
                char c = grid[y][x];
                if (c == '.') continue;
                Color col;
                switch (c) {
                    case '#': col = edge; break;
                    case '+': col = light; break;
                    case '-': col = shade; break;
                    case 'n': col = night; break;
                    case 'w': col = white; break;
                    default: col = accent; break;
                }
                for (int sy = 0; sy < scale; sy++)
                    for (int sx = 0; sx < scale; sx++) {
                        int px = x * scale + sx, py = y * scale + sy;
                        if (px < canvas && py < canvas) bmp.SetPixel(px, py, col);
                    }
            }
        }
        return bmp;
    }

    // .cur: ICONDIR + one ICONDIRENTRY + BITMAPINFOHEADER + 32bpp XOR (bottom-up) + 1bpp AND mask.
    public static void Save(Bitmap bmp, int hotX, int hotY, string path) {
        int w = bmp.Width, h = bmp.Height;
        int andStride = ((w + 31) / 32) * 4;
        int xorSize = w * h * 4;
        int andSize = andStride * h;
        using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
        using (var bw = new BinaryWriter(fs)) {
            bw.Write((ushort)0); bw.Write((ushort)2); bw.Write((ushort)1);
            bw.Write((byte)(w >= 256 ? 0 : w)); bw.Write((byte)(h >= 256 ? 0 : h));
            bw.Write((byte)0); bw.Write((byte)0);
            bw.Write((ushort)hotX); bw.Write((ushort)hotY);
            bw.Write((uint)(40 + xorSize + andSize)); bw.Write((uint)22);
            bw.Write((uint)40); bw.Write(w); bw.Write(h * 2); bw.Write((ushort)1); bw.Write((ushort)32);
            bw.Write((uint)0); bw.Write((uint)(xorSize + andSize)); bw.Write(0); bw.Write(0); bw.Write((uint)0); bw.Write((uint)0);
            for (int y = h - 1; y >= 0; y--)
                for (int x = 0; x < w; x++) {
                    Color c = bmp.GetPixel(x, y);
                    bw.Write(c.B); bw.Write(c.G); bw.Write(c.R); bw.Write(c.A);
                }
            var row = new byte[andStride];
            for (int y = h - 1; y >= 0; y--) {
                Array.Clear(row, 0, row.Length);
                for (int x = 0; x < w; x++)
                    if (bmp.GetPixel(x, y).A == 0) row[x / 8] |= (byte)(0x80 >> (x % 8));
                bw.Write(row);
            }
        }
    }
}
'@
        return $true
    } catch { return $false }
}

# ---- pixel maps (fill only; outline is generated) ---------------------------

function Get-FoxCursorArrow([string]$style) {
    if ($style -eq "fox") {
        return @(
            "o............",
            "oo...........",
            "o+o..........",
            "o+oo.........",
            "o+ooo......o.",
            "o+oooo....oo.",
            "o+ooooo..ooo.",
            "o+oooooooooo.",
            "o+ooooooooooo",
            "oooooooooooo.",
            "oonooooooonoo",
            "oooooooooooo.",
            ".ooowwwwwooo.",
            ".oowwwnwwwoo.",
            "..owwwwwwwo..",
            "...ooooooo...",
            ".....ooo....."
        )
    }
    return @(
        "o.........",
        "oo........",
        "o+o.......",
        "o+oo......",
        "o+ooo.....",
        "o+oooo....",
        "o+ooooo...",
        "o+oooooo..",
        "o+ooooooo.",
        "o+oooooooo",
        "o+ooo-----",
        "o+oo.oo...",
        "o+o..oo...",
        "oo...ooo..",
        "o.....oo..",
        "......ooo.",
        ".......oo."
    )
}

$script:FoxCursorHand = @(
    "....oo.......",
    "....o+o......",
    "....o+o......",
    "....o+o......",
    "....o+ooo....",
    "....o+oo+ooo.",
    "....o+oo+oo+o",
    "oo..o+oo+oo+o",
    "o+o.ooooooooo",
    ".o+oooooooooo",
    ".ooooooooooo.",
    "..oooooooooo.",
    "..oooooooooo.",
    "...oooooooo..",
    "...--------..",
    "...oooooooo.."
)

$script:FoxCursorIBeam = @(
    "ooooo",
    "..o..", "..o..", "..o..", "..o..", "..o..", "..o..", "..o..",
    "..o..", "..o..", "..o..", "..o..", "..o..", "..o..", "..o..",
    "ooooo"
)

$script:FoxCursorWait = @(
    "ooooooooooo",
    "o+++++++++o",
    ".o+++++++o.",
    "..o+++++o..",
    "...o+++o...",
    "....o+o....",
    "....o+o....",
    "...o.+.o...",
    "..o..+..o..",
    ".o..+++..o.",
    "o..+++++..o",
    "ooooooooooo"
)

$script:FoxCursorWaitMini = @(
    "ooooooo",
    ".o+++o.",
    "..o+o..",
    "..o+o..",
    ".o.+.o.",
    "o.+++.o",
    "ooooooo"
)

$script:FoxCursorCross = @(
    "......o......",
    "......o......",
    "......o......",
    "......o......",
    "......o......",
    ".............",
    "ooooo.+.ooooo",
    ".............",
    "......o......",
    "......o......",
    "......o......",
    "......o......",
    "......o......"
)

$script:FoxCursorNo = @(
    ".....ooooo.....",
    "...ooooooooo...",
    "..ooo.....ooo..",
    ".oooo.......oo.",
    ".oo.oo......oo.",
    "oo...oo......oo",
    "oo....oo.....oo",
    "oo.....oo....oo",
    "oo......oo...oo",
    "oo.......oo..oo",
    ".oo.......oooo.",
    ".oo........ooo.",
    "..ooo.....ooo..",
    "...ooooooooo...",
    ".....ooooo....."
)

$script:FoxCursorSizeNS = @(
    "....o....",
    "...ooo...",
    "..ooooo..",
    ".ooooooo.",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    ".ooooooo.",
    "..ooooo..",
    "...ooo...",
    "....o...."
)

$script:FoxCursorSizeNWSE = @(
    "oooooo.....",
    "o+ooo......",
    "o+oo.......",
    "o+ooo......",
    "oo.ooo.....",
    "o...ooo...o",
    ".....ooo.oo",
    "......ooooo",
    ".......oooo",
    "......ooooo",
    ".....oooooo"
)

$script:FoxCursorSizeAll = @(
    ".......o.......",
    "......ooo......",
    ".....ooooo.....",
    ".......o.......",
    ".......o.......",
    "..o....o....o..",
    ".oo....o....oo.",
    "ooooooooooooooo",
    ".oo....o....oo.",
    "..o....o....o..",
    ".......o.......",
    ".......o.......",
    ".....ooooo.....",
    "......ooo......",
    ".......o......."
)

$script:FoxCursorUp = @(
    "....o....",
    "...ooo...",
    "..ooooo..",
    ".ooooooo.",
    "ooooooooo",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...o+o...",
    "...ooo..."
)

$script:FoxCursorQuestion = @(
    ".ooo.",
    "o+.oo",
    "...oo",
    "..oo.",
    "..o..",
    ".....",
    "..o.."
)

$script:FoxCursorPen = @(
    ".........oo",
    "........o+o",
    ".......o+oo",
    "......o+oo.",
    ".....o+oo..",
    "....o+oo...",
    "...o+oo....",
    "..o+oo.....",
    ".o+oo......",
    "oooo.......",
    "-oo........",
    "no........."
)

# name -> @{ map; hot = @(x,y) in map coords; tip = $true when the hotspot is the outline pixel above-left }
function Get-FoxCursorShapes([string]$style) {
    $arrow = Get-FoxCursorArrow $style
    $we = [FoxCursor]::Rotate90($script:FoxCursorSizeNS)
    return [ordered]@{
        Arrow       = @{ map = $arrow; hot = @(0, 0); tip = $true }
        Help        = @{ map = [FoxCursor]::Compose($arrow, $script:FoxCursorQuestion, 11, 1); hot = @(0, 0); tip = $true }
        AppStarting = @{ map = [FoxCursor]::Compose($arrow, $script:FoxCursorWaitMini, 11, 9); hot = @(0, 0); tip = $true }
        Wait        = @{ map = $script:FoxCursorWait; hot = @(5, 6); tip = $false }
        Crosshair   = @{ map = $script:FoxCursorCross; hot = @(6, 6); tip = $false }
        IBeam       = @{ map = $script:FoxCursorIBeam; hot = @(2, 8); tip = $false }
        NWPen       = @{ map = $script:FoxCursorPen; hot = @(0, 11); tip = $false }
        No          = @{ map = $script:FoxCursorNo; hot = @(7, 7); tip = $false }
        SizeNS      = @{ map = $script:FoxCursorSizeNS; hot = @(4, 8); tip = $false }
        SizeWE      = @{ map = $we; hot = @(8, 4); tip = $false }
        SizeNWSE    = @{ map = $script:FoxCursorSizeNWSE; hot = @(5, 5); tip = $false }
        SizeNESW    = @{ map = [FoxCursor]::MirrorH($script:FoxCursorSizeNWSE); hot = @(5, 5); tip = $false }
        SizeAll     = @{ map = $script:FoxCursorSizeAll; hot = @(7, 7); tip = $false }
        UpArrow     = @{ map = $script:FoxCursorUp; hot = @(4, 0); tip = $true }
        Hand        = @{ map = $script:FoxCursorHand; hot = @(4, 0); tip = $true }
    }
}

# ---- colours ----------------------------------------------------------------

function ConvertFrom-FoxCursorHex([string]$hex) {
    $h = $hex.TrimStart("#")
    if ($h.Length -ne 6) { $h = "DC7A14" }
    return [System.Drawing.Color]::FromArgb(255,
        [Convert]::ToInt32($h.Substring(0, 2), 16),
        [Convert]::ToInt32($h.Substring(2, 2), 16),
        [Convert]::ToInt32($h.Substring(4, 2), 16))
}

function Get-FoxCursorInk([string]$theme) {
    $saved = $null
    if ($theme -and (Get-Command Get-FoxOsThemeName -ErrorAction SilentlyContinue)) {
        # Get-FoxOsPalette reads theme.txt; swap it in memory for the preview of other themes.
        $saved = Get-Item -Path Function:\Get-FoxOsThemeName
        $t = $theme
        Set-Item -Path Function:\Get-FoxOsThemeName -Value { return $t }.GetNewClosure()
    }
    try {
        $p = Get-FoxOsPalette
        $night = Get-FoxOsNightHex (Get-FoxOsThemeName)
    } finally {
        if ($saved) { Set-Item -Path Function:\Get-FoxOsThemeName -Value $saved.ScriptBlock }
    }
    $edgeHex = if (Get-Command Mix-Hex -ErrorAction SilentlyContinue) { Mix-Hex $night "#000000" 0.55 } else { "#050608" }
    return @{
        accent = ConvertFrom-FoxCursorHex $p.accent
        light  = ConvertFrom-FoxCursorHex $p.accent4
        shade  = ConvertFrom-FoxCursorHex $p.accent3
        night  = ConvertFrom-FoxCursorHex $night
        white  = [System.Drawing.Color]::FromArgb(255, 245, 245, 248)
        edge   = ConvertFrom-FoxCursorHex $edgeHex
    }
}

function Get-FoxCursorOutline([string]$style) { if ($style -eq "chunky") { return 2 } ; return 1 }

# ---- build ------------------------------------------------------------------

function New-FoxCursorBitmap {
    param($shape, [string]$style, [int]$scale, $ink)
    $outline = Get-FoxCursorOutline $style
    $map = $shape.map
    if ($style -eq "neon") { $map = [FoxCursor]::Hollow($map) }
    $grid = [FoxCursor]::Outline($map, $outline)
    $canvas = 32 * $scale
    $bmp = [FoxCursor]::Render($grid, $scale, $canvas, $ink.accent, $ink.light, $ink.shade, $ink.night, $ink.white, $ink.edge)
    if ($shape.tip) {
        # The outermost outline pixel sits exactly `outline` cells up-left of the fill tip,
        # which the padding moved `outline` cells down-right: tip lands on the map coordinate.
        $hx = [int]$shape.hot[0] * $scale
        $hy = [int]$shape.hot[1] * $scale
    } else {
        $hx = ([int]$shape.hot[0] + $outline) * $scale + [int]($scale / 2)
        $hy = ([int]$shape.hot[1] + $outline) * $scale + [int]($scale / 2)
    }
    return @{ Bitmap = $bmp; HotX = $hx; HotY = $hy; Grid = $grid }
}

# Writes the full set for one style + theme. Returns @{ name = path }.
function New-FoxCursorSet {
    param([string]$Style = "pixel", [int]$Scale = 2, [string]$Theme, [string]$OutDir)
    if (-not (Ensure-FoxCursorNative)) { return $null }
    if ($Style -notin $script:FoxCursorStyles) { $Style = "pixel" }
    if ($Scale -lt 1) { $Scale = 1 }
    if ($Scale -gt 3) { $Scale = 3 }
    if (-not $Theme) { $Theme = Get-FoxOsThemeName }
    if (-not $OutDir) { $OutDir = Join-Path (Get-FoxOsDir) ("cursors\" + $Style + "-" + $Theme + "-x" + $Scale) }
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $ink = Get-FoxCursorInk $Theme
    $files = [ordered]@{}
    foreach ($e in (Get-FoxCursorShapes $Style).GetEnumerator()) {
        $r = New-FoxCursorBitmap $e.Value $Style $Scale $ink
        $path = Join-Path $OutDir ($e.Key + ".cur")
        [FoxCursor]::Save($r.Bitmap, $r.HotX, $r.HotY, $path)
        $r.Bitmap.Dispose()
        $files[$e.Key] = $path
    }
    return $files
}

# Preview sheet: rows = styles, columns = themes; a handful of shapes each, on the theme's night colour.
function New-FoxCursorPreview {
    param([string[]]$Styles, [string[]]$Themes, [string]$OutPath, [int]$Scale = 3)
    if (-not (Ensure-FoxCursorNative)) { return $null }
    if (-not $Styles) { $Styles = $script:FoxCursorStyles }
    if (-not $Themes) { $Themes = @("orange", "slate", "noir", "ice") }
    $show = @("Arrow", "Hand", "IBeam", "Wait", "No", "SizeAll", "AppStarting")
    $cell = 34 * $Scale
    $labelH = 26
    $tileW = $show.Count * $cell + 16
    $tileH = $cell + 8
    $W = 90 + $Themes.Count * ($tileW + 12)
    $H = $labelH + $Styles.Count * ($tileH + 12) + 12
    $sheet = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 18, 18, 22))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $font = New-Object System.Drawing.Font "Consolas", 13, ([System.Drawing.FontStyle]::Bold)
    $small = New-Object System.Drawing.Font "Consolas", 11
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 220, 220, 226))
    for ($ti = 0; $ti -lt $Themes.Count; $ti++) {
        $x0 = 90 + $ti * ($tileW + 12)
        $g.DrawString($Themes[$ti], $font, $textBrush, $x0, 4)
    }
    for ($si = 0; $si -lt $Styles.Count; $si++) {
        $style = $Styles[$si]
        $y0 = $labelH + $si * ($tileH + 12)
        $g.DrawString($style, $font, $textBrush, 8, $y0 + ($tileH / 2) - 10)
        for ($ti = 0; $ti -lt $Themes.Count; $ti++) {
            $theme = $Themes[$ti]
            $ink = Get-FoxCursorInk $theme
            $x0 = 90 + $ti * ($tileW + 12)
            $bg = New-Object System.Drawing.SolidBrush $ink.night
            $g.FillRectangle($bg, $x0, $y0, $tileW, $tileH)
            $shapes = Get-FoxCursorShapes $style
            for ($k = 0; $k -lt $show.Count; $k++) {
                $r = New-FoxCursorBitmap $shapes[$show[$k]] $style $Scale $ink
                $g.DrawImageUnscaled($r.Bitmap, $x0 + 8 + $k * $cell, $y0 + 4)
                $r.Bitmap.Dispose()
            }
            $bg.Dispose()
        }
    }
    $g.DrawString(("scale x" + $Scale + "  (foxlook cursor <style> 1|2|3)"), $small, $textBrush, 8, $H - 20)
    $g.Dispose()
    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $sheet.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $sheet.Dispose()
    return $OutPath
}
