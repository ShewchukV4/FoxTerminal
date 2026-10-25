# FoxTerminal desktop skin (internal).
# When enabled, the active theme paints the Windows wallpaper and DWM accent.
# Previous wallpaper/accent are saved on first apply and restored by: foxos off

# Lightweight palette helpers when foxauth.ps1 is not loaded yet.
if (-not (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue)) {
    function Convert-HexToRgb([string]$hex) {
        $h = ($hex -replace '^#', '')
        if ($h.Length -ne 6) { return @{ r = 0; g = 0; b = 0 } }
        return @{
            r = [Convert]::ToInt32($h.Substring(0, 2), 16)
            g = [Convert]::ToInt32($h.Substring(2, 2), 16)
            b = [Convert]::ToInt32($h.Substring(4, 2), 16)
        }
    }
}
if (-not (Get-Command Adjust-Color -ErrorAction SilentlyContinue)) {
    function Adjust-Color([string]$hex, [double]$factor) {
        $rgb = Convert-HexToRgb $hex
        $r = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.r * $factor)))
        $g = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.g * $factor)))
        $b = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.b * $factor)))
        return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b)
    }
}
if (-not (Get-Command Mix-Hex -ErrorAction SilentlyContinue)) {
    function Mix-Hex([string]$a, [string]$b, [double]$t) {
        $ha = ($a -replace '^#', ''); $hb = ($b -replace '^#', '')
        if ($ha.Length -ne 6 -or $hb.Length -ne 6) { return $a }
        $ar = [Convert]::ToInt32($ha.Substring(0, 2), 16); $ag = [Convert]::ToInt32($ha.Substring(2, 2), 16); $ab = [Convert]::ToInt32($ha.Substring(4, 2), 16)
        $br = [Convert]::ToInt32($hb.Substring(0, 2), 16); $bg = [Convert]::ToInt32($hb.Substring(2, 2), 16); $bb = [Convert]::ToInt32($hb.Substring(4, 2), 16)
        $r = [int][Math]::Round($ar + ($br - $ar) * $t)
        $g = [int][Math]::Round($ag + ($bg - $ag) * $t)
        $bl = [int][Math]::Round($ab + ($bb - $ab) * $t)
        return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $bl)
    }
}

function Get-FoxOsStatePath {
    return (Join-Path $PSScriptRoot "foxos_state.txt")
}

function Test-FoxOsEnabled {
    if ($env:FOXTERM_FOXOS -eq "0") { return $false }
    $path = Get-FoxOsStatePath
    if (-not (Test-Path -LiteralPath $path)) { return $true }
    $raw = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $raw) { return $true }
    $name = $raw.Trim().ToLowerInvariant()
    return ($name -ne "off" -and $name -ne "0" -and $name -ne "false")
}

function Save-FoxOsState([bool]$enabled) {
    $value = if ($enabled) { "on" } else { "off" }
    $value | Set-Content -LiteralPath (Get-FoxOsStatePath) -Encoding UTF8
    if (Get-Command Save-FoxUserWorld -ErrorAction SilentlyContinue) {
        try { Save-FoxUserWorld } catch {}
    }
}

function Get-FoxOsDir {
    $root = $env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($root)) { $root = $env:TEMP }
    $dir = Join-Path $root "FoxTerminal\foxos"
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Get-FoxOsBackupPath {
    return (Join-Path (Get-FoxOsDir) "backup.json")
}

function Get-FoxOsLastPath {
    return (Join-Path (Get-FoxOsDir) "last.txt")
}

function Test-FoxOsWindows {
    if (Get-Command Test-FoxIsWindows -ErrorAction SilentlyContinue) {
        return (Test-FoxIsWindows)
    }
    return ($env:OS -eq "Windows_NT")
}

function Ensure-FoxOsNative {
    if ("FoxOsNative" -as [type]) { return $true }
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FoxOsNative {
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;
    public const int SPI_SETDESKWALLPAPER = 20;
    public const int SPIF_UPDATEINIFILE = 0x01;
    public const int SPIF_SENDWININICHANGE = 0x02;
    public const uint WM_SETTINGCHANGE = 0x001A;
    public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(
        IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
        uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
"@
        return $true
    } catch {
        return $false
    }
}

function Ensure-FoxOsUx {
    if ("FoxOsUx" -as [type]) { return $true }
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class FoxOsUx {
    [DllImport("uxtheme.dll", EntryPoint = "#104")]
    public static extern void RefreshImmersiveColorPolicyState();
}
"@
        return $true
    } catch {
        return $false
    }
}

function Ensure-FoxOsWall {
    if ("FoxOsWall" -as [type]) { return $true }
    try {
        Add-Type -AssemblyName System.Drawing | Out-Null
        $asm = [System.Drawing.Bitmap].Assembly.Location
        Add-Type -ReferencedAssemblies $asm -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class FoxOsWall {
    static void Blend(byte[] px, int idx, int r, int g, int b, double a) {
        if (a <= 0.0) return;
        if (a > 1.0) a = 1.0;
        px[idx]     = (byte)(px[idx]     * (1.0 - a) + b * a);
        px[idx + 1] = (byte)(px[idx + 1] * (1.0 - a) + g * a);
        px[idx + 2] = (byte)(px[idx + 2] * (1.0 - a) + r * a);
    }

    static int Hash(int x, int y) {
        unchecked {
            int n = x * 374761393 + y * 668265263;
            n = (n ^ (n >> 13)) * 1274126177;
            return n ^ (n >> 16);
        }
    }

    static double U01(int h) {
        return (h & 0x7fffffff) / 2147483647.0;
    }

    public static void Paint(
        Bitmap bmp,
        int nr, int ng, int nb,
        int ar, int ag, int ab,
        int wr, int wg, int wb,
        int seed
    ) {
        int w = bmp.Width;
        int h = bmp.Height;
        var rect = new Rectangle(0, 0, w, h);
        var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
        int stride = data.Stride;
        byte[] px = new byte[stride * h];

        for (int y = 0; y < h; y++) {
            double t = (h <= 1) ? 0.0 : (double)y / (h - 1);
            double glow = t * t * 0.05;
            int cr = (int)(nr * (1.0 - glow) + ar * glow);
            int cg = (int)(ng * (1.0 - glow) + ag * glow);
            int cb = (int)(nb * (1.0 - glow) + ab * glow);
            for (int x = 0; x < w; x++) {
                double vx = Math.Min(x, w - 1 - x) / (w * 0.48);
                double vy = Math.Min(y, h - 1 - y) / (h * 0.48);
                double vig = Math.Min(1.0, Math.Min(vx, vy) * 2.0);
                double dark = 0.80 + 0.20 * vig;
                int idx = y * stride + x * 3;
                px[idx]     = (byte)(cb * dark);
                px[idx + 1] = (byte)(cg * dark);
                px[idx + 2] = (byte)(cr * dark);
            }
        }

        int rim = Math.Max(64, w / 42);
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                double dx = Math.Min(x, w - 1 - x) / (double)rim;
                double dy = Math.Min(y, h - 1 - y) / (double)rim;
                double e = Math.Min(dx, dy);
                if (e >= 1.0) continue;
                double a = (1.0 - e) * (1.0 - e) * 0.12;
                Blend(px, y * stride + x * 3, ar, ag, ab, a);
            }
        }

        double scale = Math.Max(1.0, w / 1920.0);
        for (int layer = 0; layer < 4; layer++) {
            int cols = (int)((120 + layer * 48) * scale);
            double baseA = 0.10 + layer * 0.055;
            int minLen = (int)(h * (0.10 + layer * 0.04));
            int maxLen = (int)(h * (0.22 + layer * 0.08));
            if (minLen < 28) minLen = 28;
            if (maxLen <= minLen) maxLen = minLen + 20;
            for (int c = 0; c < cols; c++) {
                int hs = Hash(c * 17 + seed, layer * 91 + seed);
                if (U01(hs) < 0.16) continue;
                int x0 = (int)((c + 0.2 + U01(Hash(c, seed + 3)) * 0.6) / cols * w);
                int y0 = (int)(U01(Hash(c, seed + 11 + layer)) * (h + maxLen)) - maxLen / 4;
                int len = minLen + (int)(U01(Hash(c, seed + 23)) * (maxLen - minLen));
                double dx = 0.06 + U01(Hash(c, seed + 41)) * 0.12;
                double aMul = baseA * (0.50 + U01(Hash(c, seed + 59)) * 0.70);
                for (int i = 0; i < len; i++) {
                    int x = x0 + (int)(i * dx);
                    int y = y0 + i;
                    if ((uint)x >= (uint)w || (uint)y >= (uint)h) continue;
                    double head = (double)i / len;
                    double fade = Math.Pow(head, 0.42);
                    fade *= (1.0 - 0.55 * (1.0 - head));
                    if (head > 0.88) fade *= (1.0 - (head - 0.88) / 0.12);
                    double a = aMul * (0.28 + 0.72 * fade);
                    int idx = y * stride + x * 3;
                    Blend(px, idx, wr, wg, wb, a);
                    if (x + 1 < w) Blend(px, idx + 3, wr, wg, wb, a * 0.70);
                    if (x + 2 < w) Blend(px, idx + 6, wr, wg, wb, a * 0.28);
                    if (head > 0.72 && x - 1 >= 0) Blend(px, idx - 3, wr, wg, wb, a * 0.22);
                }
            }
        }

        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
    }

    public static void StampMark(Bitmap dest, Bitmap src, int ar, int ag, int ab) {
        int sw = src.Width;
        int sh = src.Height;
        Bitmap tinted = new Bitmap(sw, sh, PixelFormat.Format32bppArgb);
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                Color c = src.GetPixel(x, y);
                if (c.A < 16 || (c.R < 22 && c.G < 22 && c.B < 22)) {
                    tinted.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    continue;
                }
                if (c.R > c.G + 12 && c.R > c.B + 12 && c.R > 60) {
                    double t = 0.62 + 0.38 * (c.R / 255.0);
                    int r = Math.Min(255, (int)(ar * t));
                    int g = Math.Min(255, (int)(ag * t));
                    int b = Math.Min(255, (int)(ab * t));
                    tinted.SetPixel(x, y, Color.FromArgb(c.A, r, g, b));
                } else {
                    tinted.SetPixel(x, y, c);
                }
            }
        }
        int mh = (int)(dest.Height * 0.38);
        int mw = (int)(sw * (mh / (double)sh));
        if (mw > dest.Width * 0.36) {
            mw = (int)(dest.Width * 0.36);
            mh = (int)(sh * (mw / (double)sw));
        }
        int dx = (dest.Width - mw) / 2;
        int dy = (dest.Height - mh) / 2;
        using (Graphics g = Graphics.FromImage(dest)) {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(tinted, dx, dy, mw, mh);
        }
        tinted.Dispose();
    }
}
'@
        return $true
    } catch {
        return $false
    }
}

function Get-FoxOsScreenSize {
    if (-not (Ensure-FoxOsNative)) {
        return @{ W = 1920; H = 1080 }
    }
    $w = [FoxOsNative]::GetSystemMetrics(0)
    $h = [FoxOsNative]::GetSystemMetrics(1)
    if ($w -lt 800) { $w = 1920 }
    if ($h -lt 600) { $h = 1080 }
    return @{ W = $w; H = $h }
}

function Convert-HexToAccentDword([string]$hex) {
    $rgb = Convert-HexToRgb $hex
    return [int]((0xFF -shl 24) -bor ($rgb.b -shl 16) -bor ($rgb.g -shl 8) -bor $rgb.r)
}

function Convert-HexToDrawingColor([string]$hex, [int]$alpha = 255) {
    $rgb = Convert-HexToRgb $hex
    return [System.Drawing.Color]::FromArgb($alpha, $rgb.r, $rgb.g, $rgb.b)
}

function Get-FoxOsThemeName {
    if (Get-Command Get-DiskThemeName -ErrorAction SilentlyContinue) {
        $n = Get-DiskThemeName
        if (-not [string]::IsNullOrWhiteSpace($n)) { return $n }
    }
    $path = Join-Path $PSScriptRoot "theme.txt"
    if (Test-Path -LiteralPath $path) {
        $n = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue).Trim()
        if (-not [string]::IsNullOrWhiteSpace($n)) { return $n }
    }
    return "orange"
}

function Get-FoxOsPalette {
    $theme = Get-FoxOsThemeName
    if ($theme -eq "pride" -and (Get-Command Get-PridePalette -ErrorAction SilentlyContinue)) {
        $style = if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) { Load-PrideStyle } else { "gay" }
        return (Get-PridePalette $style)
    }
    if ($theme -eq "noir") {
        return @{
            accent  = "#888888"
            accent2 = "#A8A8A8"
            accent3 = "#686868"
            accent4 = "#C0C0C0"
            dim     = "#606060"
            base    = "#0A0A0A"
            text    = "#E0E0E0"
        }
    }
    if ($theme -eq "dnote") {
        return @{
            accent  = "#B11212"
            accent2 = "#D01616"
            accent3 = "#8F1010"
            accent4 = "#F2E9E9"
            dim     = "#8C7A7A"
            base    = "#050505"
            text    = "#F2E9E9"
        }
    }
    if ($theme -eq "notebook") {
        return @{
            accent  = "#9A4034"
            accent2 = "#C4A574"
            accent3 = "#6E4E3A"
            accent4 = "#E8D9C0"
            dim     = "#7A6B58"
            base    = "#1C1914"
            text    = "#EDE6D6"
        }
    }
    if ($theme -eq "arthas-light") {
        return @{
            accent  = "#E8C36A"
            accent2 = "#F3D992"
            accent3 = "#C49D43"
            accent4 = "#FFE7B8"
            dim     = "#A88746"
            base    = "#120F07"
            text    = "#FFF1D0"
        }
    }
    if ($theme -eq "arthas-dark" -or $theme -eq "arthas") {
        return @{
            accent  = "#58B8FF"
            accent2 = "#86CCFF"
            accent3 = "#2F86D8"
            accent4 = "#C1E8FF"
            dim     = "#3B6F96"
            base    = "#060A12"
            text    = "#D7F1FF"
        }
    }
    $hex = "#DC7A14"
    # Named sw colours — must work even when foxauth Get-ThemeHex is not loaded.
    switch ($theme) {
        "blue" { $hex = "#5A8CFF" }
        "purple" { $hex = "#A05AFF" }
        "cyan" { $hex = "#46DCC8" }
        "crimson" { $hex = "#D14A5A" }
        "rose" { $hex = "#E05A9A" }
        "magenta" { $hex = "#D44BBD" }
        "violet" { $hex = "#8356E6" }
        "indigo" { $hex = "#4E75D8" }
        "sky" { $hex = "#6FC4F0" }
        "teal" { $hex = "#36B8B3" }
        "mint" { $hex = "#6BD3B0" }
        "emerald" { $hex = "#4CB874" }
        "lime" { $hex = "#9BD94A" }
        "gold" { $hex = "#E0B148" }
        "amber" { $hex = "#E5943A" }
        "peach" { $hex = "#E7A37C" }
        "coral" { $hex = "#E07D69" }
        "ruby" { $hex = "#C83B5C" }
        "slate" { $hex = "#7D93B0" }
        "ice" { $hex = "#7CC8E8" }
        "neon" { $hex = "#7EF06B" }
        "forest" { $hex = "#4E8C66" }
        "mocha" { $hex = "#A17A5A" }
        "black" { $hex = "#111111" }
        "white" { $hex = "#F2F2F2" }
        "orange" { $hex = "#DC7A14" }
        default {
            if (Get-Command Get-ThemeHex -ErrorAction SilentlyContinue) {
                try {
                    $th = Get-ThemeHex $theme
                    if ($th) { $hex = $th }
                } catch {}
            }
        }
    }
    return @{
        accent  = $hex
        accent2 = (Adjust-Color $hex 1.15)
        accent3 = (Adjust-Color $hex 0.85)
        accent4 = (Adjust-Color $hex 1.3)
        dim     = (Adjust-Color $hex 0.65)
        base    = (Mix-Hex "#0B0F1A" $hex 0.12)
        text    = "#E6E6E6"
    }
}

function Get-FoxOsSkinKey {
    $theme = Get-FoxOsThemeName
    $extra = ""
    if ($theme -eq "pride" -and (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue)) {
        $extra = "-" + (Load-PrideStyle)
    }
    $sz = Get-FoxOsScreenSize
    return ($theme + $extra + "-" + $sz.W + "x" + $sz.H)
}

function Get-RegDword([string]$path, [string]$name) {
    try {
        $v = (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name
        if ($null -eq $v) { return $null }
        return [int]$v
    } catch {
        return $null
    }
}

function Save-FoxOsBackupIfNeeded {
    $path = Get-FoxOsBackupPath
    if (Test-Path -LiteralPath $path) { return }
    $wallpaper = $null
    try { $wallpaper = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name Wallpaper -ErrorAction SilentlyContinue).Wallpaper } catch {}
    $style = $null
    try { $style = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name WallpaperStyle -ErrorAction SilentlyContinue).WallpaperStyle } catch {}
    $tile = $null
    try { $tile = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name TileWallpaper -ErrorAction SilentlyContinue).TileWallpaper } catch {}
    $backup = [ordered]@{
        wallpaper           = $wallpaper
        wallpaperStyle      = $style
        tileWallpaper       = $tile
        accentColor         = Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "AccentColor"
        colorizationColor   = Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "ColorizationColor"
        colorPrevalence     = Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "ColorPrevalence"
        accentColorMenu     = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Accent" "AccentColorMenu"
        personalizePrev     = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "ColorPrevalence"
        enableTransparency  = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "EnableTransparency"
        accentColorInactive = Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "AccentColorInactive"
        enableWindowColorization = Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "EnableWindowColorization"
        searchboxTaskbarMode = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" "SearchboxTaskbarMode"
        taskbarDa = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarDa"
        taskbarWl = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarWl"
        showCopilotButton = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "ShowCopilotButton"
        taskbarCopilot = Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarCopilot"
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, ($backup | ConvertTo-Json), $utf8)
}

function Merge-FoxOsBackupExtras {
    $path = Get-FoxOsBackupPath
    if (-not (Test-Path -LiteralPath $path)) { return }
    $raw = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($raw)) { return }
    $b = $raw | ConvertFrom-Json
    $changed = $false
    if ($null -eq $b.enableTransparency) {
        $b | Add-Member -NotePropertyName enableTransparency -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "EnableTransparency") -Force
        $changed = $true
    }
    if ($null -eq $b.accentColorInactive) {
        $b | Add-Member -NotePropertyName accentColorInactive -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "AccentColorInactive") -Force
        $changed = $true
    }
    if ($null -eq $b.enableWindowColorization) {
        $b | Add-Member -NotePropertyName enableWindowColorization -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\DWM" "EnableWindowColorization") -Force
        $changed = $true
    }
    if ($null -eq $b.searchboxTaskbarMode) {
        $b | Add-Member -NotePropertyName searchboxTaskbarMode -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" "SearchboxTaskbarMode") -Force
        $changed = $true
    }
    if ($null -eq $b.taskbarDa) {
        $b | Add-Member -NotePropertyName taskbarDa -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarDa") -Force
        $changed = $true
    }
    if ($null -eq $b.taskbarWl) {
        $b | Add-Member -NotePropertyName taskbarWl -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarWl") -Force
        $changed = $true
    }
    if ($null -eq $b.showCopilotButton) {
        $b | Add-Member -NotePropertyName showCopilotButton -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "ShowCopilotButton") -Force
        $changed = $true
    }
    if ($null -eq $b.taskbarCopilot) {
        $b | Add-Member -NotePropertyName taskbarCopilot -NotePropertyValue (Get-RegDword "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarCopilot") -Force
        $changed = $true
    }
    if ($changed) {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($path, ($b | ConvertTo-Json), $utf8)
    }
}

function Set-FoxOsRegDword([string]$path, [string]$name, $value) {
    if ($null -eq $value) { return }
    try {
        if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
        Set-ItemProperty -Path $path -Name $name -Value ([int]$value) -Type DWord -ErrorAction Stop
    } catch { }
}

function Apply-FoxOsTaskbar {
    Merge-FoxOsBackupExtras
    $adv = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
    $search = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search"
    Set-FoxOsRegDword $search "SearchboxTaskbarMode" 0
    Set-FoxOsRegDword $adv "TaskbarDa" 0
    Set-FoxOsRegDword $adv "TaskbarWl" 0
    Set-FoxOsRegDword $adv "ShowCopilotButton" 0
    Set-FoxOsRegDword $adv "TaskbarCopilot" 0
}

function Restore-FoxOsTaskbar($b) {
    if (-not $b) { return }
    $adv = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
    $search = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search"
    Set-FoxOsRegDword $search "SearchboxTaskbarMode" $b.searchboxTaskbarMode
    Set-FoxOsRegDword $adv "TaskbarDa" $b.taskbarDa
    Set-FoxOsRegDword $adv "TaskbarWl" $b.taskbarWl
    Set-FoxOsRegDword $adv "ShowCopilotButton" $b.showCopilotButton
    Set-FoxOsRegDword $adv "TaskbarCopilot" $b.taskbarCopilot
}

function Broadcast-FoxOsChange {
    if (Ensure-FoxOsUx) {
        try { [FoxOsUx]::RefreshImmersiveColorPolicyState() } catch {}
    }
    if (-not (Ensure-FoxOsNative)) { return }
    try {
        $ignored = [UIntPtr]::Zero
        foreach ($name in @("ImmersiveColorSet", "WindowsThemeElement")) {
            [void][FoxOsNative]::SendMessageTimeout(
                [FoxOsNative]::HWND_BROADCAST,
                [FoxOsNative]::WM_SETTINGCHANGE,
                [UIntPtr]::Zero,
                $name,
                2,
                200,
                [ref]$ignored
            )
        }
    } catch {}
}

function New-FoxOsAccentPalette([string]$hex) {
    $toward = @("#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000")
    $mix = @(0.08, 0.12, 0.18, 0.0, 0.10, 0.16, 0.22, 0.0)
    $bytes = New-Object byte[] 32
    for ($i = 0; $i -lt 8; $i++) {
        $c = Mix-Hex $hex $toward[$i] $mix[$i]
        $rgb = Convert-HexToRgb $c
        $o = $i * 4
        $bytes[$o]     = [byte]$rgb.r
        $bytes[$o + 1] = [byte]$rgb.g
        $bytes[$o + 2] = [byte]$rgb.b
        $bytes[$o + 3] = 255
    }
    return ,$bytes
}

function Set-FoxOsAccent([string]$hex) {
    Merge-FoxOsBackupExtras
    $dword = Convert-HexToAccentDword $hex
    $dwm = "HKCU:\Software\Microsoft\Windows\DWM"
    $accentKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Accent"
    $personalize = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
    $desktop = "HKCU:\Control Panel\Desktop"
    if (-not (Test-Path $dwm)) { New-Item -Path $dwm -Force | Out-Null }
    if (-not (Test-Path $accentKey)) { New-Item -Path $accentKey -Force | Out-Null }
    if (-not (Test-Path $personalize)) { New-Item -Path $personalize -Force | Out-Null }
    Set-ItemProperty -Path $dwm -Name "AccentColor" -Value $dword -Type DWord
    Set-ItemProperty -Path $dwm -Name "ColorizationColor" -Value $dword -Type DWord
    Set-ItemProperty -Path $dwm -Name "ColorizationAfterglow" -Value $dword -Type DWord
    Set-ItemProperty -Path $dwm -Name "ColorPrevalence" -Value 1 -Type DWord
    Set-ItemProperty -Path $dwm -Name "EnableWindowColorization" -Value 1 -Type DWord
    $theme = Get-FoxOsThemeName
    $inactiveHex = $hex
    if (Get-Command Mix-Hex -ErrorAction SilentlyContinue) {
        $inactiveHex = Mix-Hex $hex (Get-FoxOsNightHex $theme) 0.58
    }
    Set-ItemProperty -Path $dwm -Name "AccentColorInactive" -Value (Convert-HexToAccentDword $inactiveHex) -Type DWord
    Set-ItemProperty -Path $accentKey -Name "AccentColorMenu" -Value $dword -Type DWord
    Set-ItemProperty -Path $accentKey -Name "StartColorMenu" -Value $dword -Type DWord
    $pal = [byte[]](New-FoxOsAccentPalette $hex)
    try {
        $rk = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Software\Microsoft\Windows\CurrentVersion\Explorer\Accent", $true)
        if ($rk) {
            $rk.SetValue("AccentPalette", $pal, [Microsoft.Win32.RegistryValueKind]::Binary)
            $rk.Close()
        }
    } catch {
        Set-ItemProperty -Path $accentKey -Name "AccentPalette" -Value $pal
    }
    # FOXSTYLE can ask for accent-tinted taskbar/Start (ColorPrevalence=1)
    $tbTint = 0
    $appliedPath = Join-Path (Get-FoxOsDir) "style-applied.json"
    if (Test-Path -LiteralPath $appliedPath) {
        try {
            $ap = Get-Content -LiteralPath $appliedPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($ap.tbAccent -eq "on") { $tbTint = 1 }
        } catch {}
    }
    Set-ItemProperty -Path $personalize -Name "ColorPrevalence" -Value $tbTint -Type DWord
    Set-ItemProperty -Path $personalize -Name "EnableTransparency" -Value 1 -Type DWord
    Set-ItemProperty -Path $desktop -Name "AutoColorization" -Value 0 -Type DWord
}

function Clear-FoxOsWallpaperCache {
    $dir = Join-Path $env:APPDATA "Microsoft\Windows\Themes"
    Remove-Item -LiteralPath (Join-Path $dir "TranscodedWallpaper") -Force -ErrorAction SilentlyContinue
    $cached = Join-Path $dir "CachedFiles"
    if (Test-Path -LiteralPath $cached) {
        Get-ChildItem -LiteralPath $cached -Force -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

function Set-FoxOsWallpaper([string]$file) {
    if (-not (Ensure-FoxOsNative)) { return $false }
    if (-not (Test-Path -LiteralPath $file)) { return $false }
    Clear-FoxOsWallpaperCache
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name WallpaperStyle -Value "10"
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name TileWallpaper -Value "0"
    $flags = [FoxOsNative]::SPIF_UPDATEINIFILE -bor [FoxOsNative]::SPIF_SENDWININICHANGE
    [void][FoxOsNative]::SystemParametersInfo([FoxOsNative]::SPI_SETDESKWALLPAPER, 0, "", $flags)
    [void][FoxOsNative]::SystemParametersInfo([FoxOsNative]::SPI_SETDESKWALLPAPER, 0, $file, $flags)
    return $true
}

function Hide-FoxOsShellWallpaper {
    if (-not (Ensure-FoxOsNative)) { return }
    Clear-FoxOsWallpaperCache
    $flags = [FoxOsNative]::SPIF_UPDATEINIFILE -bor [FoxOsNative]::SPIF_SENDWININICHANGE
    [void][FoxOsNative]::SystemParametersInfo([FoxOsNative]::SPI_SETDESKWALLPAPER, 0, "", $flags)
}

function Restore-FoxOsDesktop {
    $path = Get-FoxOsBackupPath
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $raw = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
    $b = $raw | ConvertFrom-Json
    if ($b.wallpaper -and (Test-Path -LiteralPath ([string]$b.wallpaper))) {
        Set-FoxOsWallpaper ([string]$b.wallpaper) | Out-Null
        if ($b.wallpaperStyle) {
            Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name WallpaperStyle -Value ([string]$b.wallpaperStyle)
        }
        if ($null -ne $b.tileWallpaper) {
            Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name TileWallpaper -Value ([string]$b.tileWallpaper)
        }
    }
    $dwm = "HKCU:\Software\Microsoft\Windows\DWM"
    $accentKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Accent"
    $personalize = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
    if ($null -ne $b.accentColor) { Set-ItemProperty -Path $dwm -Name "AccentColor" -Value ([int]$b.accentColor) -Type DWord }
    if ($null -ne $b.colorizationColor) { Set-ItemProperty -Path $dwm -Name "ColorizationColor" -Value ([int]$b.colorizationColor) -Type DWord }
    if ($null -ne $b.colorPrevalence) { Set-ItemProperty -Path $dwm -Name "ColorPrevalence" -Value ([int]$b.colorPrevalence) -Type DWord }
    if ($null -ne $b.accentColorInactive) { Set-ItemProperty -Path $dwm -Name "AccentColorInactive" -Value ([int]$b.accentColorInactive) -Type DWord }
    if ($null -ne $b.enableWindowColorization) { Set-ItemProperty -Path $dwm -Name "EnableWindowColorization" -Value ([int]$b.enableWindowColorization) -Type DWord }
    if ($null -ne $b.accentColorMenu -and (Test-Path $accentKey)) {
        Set-ItemProperty -Path $accentKey -Name "AccentColorMenu" -Value ([int]$b.accentColorMenu) -Type DWord
    }
    if ($null -ne $b.personalizePrev -and (Test-Path $personalize)) {
        Set-ItemProperty -Path $personalize -Name "ColorPrevalence" -Value ([int]$b.personalizePrev) -Type DWord
    }
    if ($null -ne $b.enableTransparency -and (Test-Path $personalize)) {
        Set-ItemProperty -Path $personalize -Name "EnableTransparency" -Value ([int]$b.enableTransparency) -Type DWord
    }
    if ($null -ne $b.autoColorization) {
        Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "AutoColorization" -Value ([int]$b.autoColorization) -Type DWord
    }
    Restore-FoxOsTaskbar $b
    Broadcast-FoxOsChange
    Stop-FoxOsLive
    $last = Get-FoxOsLastPath
    if (Test-Path -LiteralPath $last) { Remove-Item -LiteralPath $last -Force -ErrorAction SilentlyContinue }
    return $true
}

function Get-FoxOsNightHex([string]$theme) {
    switch ($theme) {
        "noir" { return "#0A0A0A" }
        "dnote" { return "#050505" }
        "notebook" { return "#1C1914" }
        "pride" { return "#160814" }
        "arthas-dark" { return "#060A12" }
        "arthas-light" { return "#120F07" }
        default { return "#0B0F1A" }
    }
}

function Get-FoxOsSeed([string]$s) {
    $h = 0
    foreach ($ch in $s.ToCharArray()) {
        $h = ((($h -shl 5) - $h) + [int][char]$ch) -band 0x7FFFFFFF
    }
    if ($h -eq 0) { $h = 1 }
    return [int]$h
}

function New-FoxOsWallpaper {
    param(
        [string]$Theme,
        [string]$OutPath
    )

    Add-Type -AssemblyName System.Drawing | Out-Null
    $sz = Get-FoxOsScreenSize
    $w = [int]$sz.W
    $h = [int]$sz.H
    $night = Convert-HexToDrawingColor (Get-FoxOsNightHex $Theme)
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($night)
    $g.Dispose()

    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    return $OutPath
}

function Resolve-FoxDockPin([string]$id) {
    $local = [Environment]::GetFolderPath("LocalApplicationData")
    $pf = $env:ProgramFiles
    $paths = @()
    if ($id -eq "cursor") {
        $paths = @(
            (Join-Path $local "Programs\cursor\Cursor.exe"),
            (Join-Path $local "Programs\Cursor\Cursor.exe"),
            (Join-Path $pf "Cursor\Cursor.exe")
        )
    } elseif ($id -eq "zen") {
        $paths = @(
            (Join-Path $pf "Zen Browser\zen.exe"),
            (Join-Path $local "Zen Browser\zen.exe"),
            (Join-Path $pf "Zen\zen.exe")
        )
    } elseif ($id -eq "term") {
        $gh = Join-Path $PSScriptRoot "ghostty-lib.ps1"
        if ((Test-Path -LiteralPath $gh) -and -not (Get-Command Get-GhosttyCommand -ErrorAction SilentlyContinue)) {
            try { . $gh } catch {}
        }
        if (Get-Command Get-GhosttyCommand -ErrorAction SilentlyContinue) {
            try {
                $g = Get-GhosttyCommand
                if ($g -and $g.Path) { return [string]$g.Path }
            } catch {}
        }
        $paths = @(
            (Join-Path $local "Programs\winghostty\winghostty.exe"),
            (Join-Path $local "winghostty\bin\winghostty.exe"),
            (Join-Path $pf "winghostty\winghostty.exe")
        )
    }
    foreach ($p in $paths) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return ""
}

function Get-FoxOsLiveSource {
    return (Join-Path $PSScriptRoot "foxos-live.cs")
}

function Get-FoxOsLiveSources {
    $list = @(Get-FoxOsLiveSource)
    $help = Join-Path $PSScriptRoot "foxos-help.cs"
    if (Test-Path -LiteralPath $help) { $list += $help }
    $dock = Join-Path $PSScriptRoot "foxos-dock.cs"
    if (Test-Path -LiteralPath $dock) { $list += $dock }
    $chrome = Join-Path $PSScriptRoot "foxos-chrome.cs"
    if (Test-Path -LiteralPath $chrome) { $list += $chrome }
    $quick = Join-Path $PSScriptRoot "foxos-quick.cs"
    if (Test-Path -LiteralPath $quick) { $list += $quick }
    $media = Join-Path $PSScriptRoot "foxos-media.cs"
    if (Test-Path -LiteralPath $media) { $list += $media }
    return $list
}

function Get-FoxOsLiveExe {
    return (Join-Path (Get-FoxOsDir) "foxos-live.exe")
}

function Get-FoxOsLiveStatePath {
    return (Join-Path (Get-FoxOsDir) "live.json")
}

function Get-FoxOsDeskPath {
    return (Join-Path (Get-FoxOsDir) "desk.txt")
}

function Get-FoxOsLivePidPath {
    return (Join-Path (Get-FoxOsDir) "live.pid")
}

function Write-FoxOsLiveState {
    $theme = Get-FoxOsThemeName
    $p = Get-FoxOsPalette
    $flag = ""
    if ($theme -eq "pride" -and (Get-Command Get-PrideFoxFlagColors -ErrorAction SilentlyContinue)) {
        $style = if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) { Load-PrideStyle } else { "gay" }
        $flag = (@(Get-PrideFoxFlagColors $style) -join ",")
    }
    $fox = Join-Path (Split-Path $PSScriptRoot -Parent) "FoxTerminal\assets\fox.png"
    $foxUser = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($foxUser)) {
        $cup = Join-Path $PSScriptRoot "current_user.txt"
        if (Test-Path -LiteralPath $cup) {
            $foxUser = (Get-Content -LiteralPath $cup -Raw -ErrorAction SilentlyContinue).Trim()
        }
    }
    if ([string]::IsNullOrWhiteSpace($foxUser)) { $foxUser = $env:USERNAME }
    $obj = @{
        night   = (Get-FoxOsNightHex $theme)
        accent  = $p.accent
        accent2 = $p.accent2
        theme   = $theme
        user    = $foxUser
        flag    = $flag
        fox     = $fox
        cmd     = $PSScriptRoot
        rig     = $(if ($script:FoxOsRigOverride) { $script:FoxOsRigOverride } else { Get-FoxOsRigStyle })
        wall    = $(if (Get-Command Get-FoxLookWall -ErrorAction SilentlyContinue) { Get-FoxLookWall } else { "overlay" })
        shell   = "off"
        dockStyle = "pill"
        dockPos   = "bottom"
        dockSize  = "normal"
        dockHide  = "off"
        dockWins  = "titles"
        dockTray  = "full"
        dockWidgets = "on"
        dockHome = "on"
        pinCursor = (Resolve-FoxDockPin "cursor")
        pinZen    = (Resolve-FoxDockPin "zen")
        pinTerm   = (Resolve-FoxDockPin "term")
    }
    if (Get-Command Read-FoxLookState -ErrorAction SilentlyContinue) {
        $ls = Read-FoxLookState
        if ($ls.parts.ContainsKey("shell") -and $ls.parts["shell"]) { $obj.shell = "on" }
        if ($ls.dockStyle) { $obj.dockStyle = [string]$ls.dockStyle }
        if ($ls.dockPos) { $obj.dockPos = [string]$ls.dockPos }
        if ($ls.dockSize) { $obj.dockSize = [string]$ls.dockSize }
        # dockHide/widgets/home may be bool or "on"/"off" — never cast strings with [bool]
        $hideOn = if ($ls.dockHide -is [bool]) { [bool]$ls.dockHide } else { ("$($ls.dockHide)".ToLowerInvariant() -in @("on","1","true")) }
        $obj.dockHide = $(if ($hideOn) { "on" } else { "off" })
        if ($ls.dockWins) { $obj.dockWins = [string]$ls.dockWins }
        if ($ls.dockTray) { $obj.dockTray = [string]$ls.dockTray }
        $widOn = if ($null -eq $ls.dockWidgets) { $true } elseif ($ls.dockWidgets -is [bool]) { [bool]$ls.dockWidgets } else { ("$($ls.dockWidgets)".ToLowerInvariant() -in @("on","1","true")) }
        $obj.dockWidgets = $(if ($widOn) { "on" } else { "off" })
        $homeOn = if ($null -eq $ls.dockHome) { $true } elseif ($ls.dockHome -is [bool]) { [bool]$ls.dockHome } else { ("$($ls.dockHome)".ToLowerInvariant() -in @("on","1","true")) }
        $obj.dockHome = $(if ($homeOn) { "on" } else { "off" })
    } else {
        # foxlook-lib not loaded — still honor look.json shell/dock flags
        $lookPath = Join-Path (Get-FoxOsDir) "look.json"
        if (Test-Path -LiteralPath $lookPath) {
            try {
                $lj = Get-Content -LiteralPath $lookPath -Raw -ErrorAction Stop | ConvertFrom-Json
                if ($lj.parts -and $lj.parts.shell) { $obj.shell = "on" }
                if ($null -ne $lj.dockHide) {
                    $hideOn = if ($lj.dockHide -is [bool]) { [bool]$lj.dockHide } else { ("$($lj.dockHide)".ToLowerInvariant() -in @("on","1","true")) }
                    $obj.dockHide = $(if ($hideOn) { "on" } else { "off" })
                }
            } catch {}
        }
    }
    if (Get-Command Ensure-FoxDockPins -ErrorAction SilentlyContinue) {
        try { Ensure-FoxDockPins | Out-Null } catch {}
    }
    # feed desktop widgets
    try {
        $desk = Get-FoxOsDeskPath
        $noteOut = Join-Path (Get-FoxOsDir) "widget-note.txt"
        if (Test-Path -LiteralPath $desk) {
            $last = Get-Content -LiteralPath $desk -Tail 1 -ErrorAction SilentlyContinue
            if ($last) { [System.IO.File]::WriteAllText($noteOut, ("$last".Trim()), (New-Object System.Text.UTF8Encoding $false)) }
        }
    } catch {}
    # FOXSTYLE overlay: window corners / taskbar shape always; colors only while theme matches.
    $obj.winCorner = "default"
    $obj.winRadius = "-1"
    $obj.tbRadius = "-1"
    $obj.tbInset = "0"
    $obj.dockRadius = "-1"
    $obj.dockPad = "-1"
    $obj.dockAlpha = "-1"
    $applied = Join-Path (Get-FoxOsDir) "style-applied.json"
    if (Test-Path -LiteralPath $applied) {
        try {
            $a = Get-Content -LiteralPath $applied -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($null -ne $a.dockRadius) { $obj.dockRadius = [string]$a.dockRadius }
            if ($null -ne $a.dockPad) { $obj.dockPad = [string]$a.dockPad }
            if ($null -ne $a.dockAlpha) { $obj.dockAlpha = [string]$a.dockAlpha }
            if ($null -ne $a.dockBarH) { $obj.dockBarH = [string]$a.dockBarH }
            if ($null -ne $a.dockBlur) { $obj.dockBlur = [string]$a.dockBlur }
            if ($a.winCorner) { $obj.winCorner = [string]$a.winCorner }
            if ($null -ne $a.winRadius) { $obj.winRadius = [string]$a.winRadius }
            if ($null -ne $a.tbRadius) { $obj.tbRadius = [string]$a.tbRadius }
            if ($null -ne $a.tbInset) { $obj.tbInset = [string]$a.tbInset }
            if ($a.wallKind) { $obj.wallKind = [string]$a.wallKind }
            if ($null -ne $a.wallRain) { $obj.wallRain = [string]$a.wallRain }
            if ($null -ne $a.wallStrength) { $obj.wallStrength = [string]$a.wallStrength }
            if ($null -ne $a.wallScale) { $obj.wallScale = [string]$a.wallScale }
            if ($null -ne $a.wallWeight) { $obj.wallWeight = [string]$a.wallWeight }
            if ($null -ne $a.wallVeil) { $obj.wallVeil = [string]$a.wallVeil }
            if ($a.foxGlow) { $obj.foxGlow = [string]$a.foxGlow }
            if ($null -ne $a.foxGlowStrength) { $obj.foxGlowStrength = [string]$a.foxGlowStrength }
            if ($null -ne $a.foxGlowSpeed) { $obj.foxGlowSpeed = [string]$a.foxGlowSpeed }
            if ($a.sw -and ([string]$a.sw -eq [string]$theme)) {
                if ($a.accent) { $obj.accent = [string]$a.accent }
                if ($a.accent2) { $obj.accent2 = [string]$a.accent2 }
                if ($a.night) { $obj.night = [string]$a.night }
                if ($a.dockStyle) { $obj.dockStyle = [string]$a.dockStyle }
                if ($a.dockPos) { $obj.dockPos = [string]$a.dockPos }
            }
        } catch {}
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Get-FoxOsLiveStatePath), ($obj | ConvertTo-Json -Compress), $utf8)
}

function Get-FoxOsRigStyle {
    $path = Get-FoxOsLiveStatePath
        if (-not (Test-Path -LiteralPath $path)) { return "4" }
        try {
            $j = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
            $v = [string]$j.rig
            if ($v -match '^[1-5]$') { return $v }
        } catch { }
        return "4"
}

function Save-FoxOsRigStyle([string]$style) {
    if ($style -match '^[1-5]$') { $script:FoxOsRigOverride = $style } else { $script:FoxOsRigOverride = "4" }
    $path = Get-FoxOsLiveStatePath
    if (Test-Path -LiteralPath $path) {
        try {
            $j = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
            $ht = @{}
            $j.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
            $ht["rig"] = $script:FoxOsRigOverride
            $utf8 = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($path, ($ht | ConvertTo-Json -Compress), $utf8)
            return
        } catch { }
    }
    Write-FoxOsLiveState
}

function Test-FoxOsLiveRunning {
    $path = Get-FoxOsLivePidPath
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $raw = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
    $id = 0
    if (-not [int]::TryParse("$raw".Trim(), [ref]$id)) { return $false }
    try {
        $proc = Get-Process -Id $id -ErrorAction Stop
        return ($proc.ProcessName -like "foxos-live*")
    } catch {
        return $false
    }
}

function Stop-FoxOsMediaWatch {
    $ps1 = Join-Path $PSScriptRoot "foxos-media.ps1"
    if (Test-Path -LiteralPath $ps1) {
        try {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ps1 -Mode stop | Out-Null
        } catch {}
    }
    $pidFile = Join-Path (Get-FoxOsDir) "media.pid"
    if (Test-Path -LiteralPath $pidFile) {
        $old = 0
        try { $old = [int]((Get-Content -LiteralPath $pidFile -Raw).Trim()) } catch {}
        if ($old -gt 0) { Stop-Process -Id $old -Force -ErrorAction SilentlyContinue }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function Start-FoxOsMediaWatch {
    if (-not (Test-FoxOsWindows)) { return $false }
    $ps1 = Join-Path $PSScriptRoot "foxos-media.ps1"
    if (-not (Test-Path -LiteralPath $ps1)) { return $false }
    $pidFile = Join-Path (Get-FoxOsDir) "media.pid"
    if (Test-Path -LiteralPath $pidFile) {
        $old = 0
        try { $old = [int]((Get-Content -LiteralPath $pidFile -Raw).Trim()) } catch {}
        if ($old -gt 0) {
            $alive = Get-Process -Id $old -ErrorAction SilentlyContinue
            if ($alive) { return $true }
        }
    }
    # Avoid duplicate watchers fighting over media.pid / media.json
    try {
        $dup = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like '*foxos-media.ps1*' -and $_.CommandLine -like '*watch*' } |
            Select-Object -First 1
        if ($dup) {
            try { [string]$dup.ProcessId | Set-Content -LiteralPath $pidFile -Encoding ASCII } catch {}
            return $true
        }
    } catch {}
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
        "-File", $ps1, "-Mode", "watch"
    ) -WindowStyle Hidden | Out-Null
    return $true
}

function Stop-FoxOsLive {
    Stop-FoxOsMediaWatch
    Get-Process -Name "foxos-live" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    $pidPath = Get-FoxOsLivePidPath
    if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    }
}

function Test-FoxOsLiveStale {
    $exe = Get-FoxOsLiveExe
    if (-not (Test-Path -LiteralPath $exe)) { return $true }
    $exeTime = (Get-Item -LiteralPath $exe).LastWriteTimeUtc
    foreach ($src in (Get-FoxOsLiveSources)) {
        if ((Get-Item -LiteralPath $src).LastWriteTimeUtc -gt $exeTime) { return $true }
    }
    return $false
}

function Ensure-FoxOsLiveBuilt {
    $sources = @(Get-FoxOsLiveSources)
    if ($sources.Count -eq 0) { return $false }
    $exe = Get-FoxOsLiveExe
    if (-not (Test-FoxOsLiveStale)) { return $true }
    $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    if (-not (Test-Path -LiteralPath $csc)) { return $false }
    $out = Join-Path (Get-FoxOsDir) "foxos-live.build.log"
    $args = @(
        "/nologo",
        "/target:winexe",
        "/optimize+",
        ("/out:" + $exe),
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Management.dll"
    ) + $sources
    $p = Start-Process -FilePath $csc -ArgumentList $args -Wait -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError ($out + ".err")
    return ((Test-Path -LiteralPath $exe) -and $p.ExitCode -eq 0)
}

function Start-FoxOsLive {
    Write-FoxOsLiveState
    $exe = Get-FoxOsLiveExe
    if ((Test-Path -LiteralPath $exe) -and (Test-FoxOsLiveStale)) {
        Stop-FoxOsLive
    }
    if (-not (Ensure-FoxOsLiveBuilt)) { return $false }
    if (Test-FoxOsLiveRunning) { return $true }
    Start-Process -FilePath $exe -ArgumentList @((Get-FoxOsLiveStatePath)) -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 400
    try { Start-FoxOsMediaWatch | Out-Null } catch {}
    # Alt+Tab remap is in foxhotkeys.ahk (#HotIf foxos-live) — without the
    # daemon, Windows Alt+Tab stays and the Fox slide never appears.
    try {
        $hk = Join-Path $PSScriptRoot "foxhotkeys.ps1"
        if (Test-Path -LiteralPath $hk) {
            $alive = $false
            try {
                $alive = [bool](Get-CimInstance Win32_Process -Filter "Name LIKE 'AutoHotkey%'" -ErrorAction SilentlyContinue |
                    Where-Object { $_.CommandLine -like "*foxhotkeys.ahk*" } | Select-Object -First 1)
            } catch {}
            if (-not $alive) { & $hk | Out-Null }
        }
    } catch {}
    return (Test-FoxOsLiveRunning)
}

function Sync-FoxOsSkin {
    param([switch]$Force)

    if (-not (Test-FoxOsWindows)) { return $false }
    if (-not (Test-FoxOsEnabled)) { return $false }

    $theme = Get-FoxOsThemeName
    $key = Get-FoxOsSkinKey
    $lastPath = Get-FoxOsLastPath
    $themeChanged = $true
    if (-not $Force -and (Test-Path -LiteralPath $lastPath)) {
        $prev = (Get-Content -LiteralPath $lastPath -Raw -ErrorAction SilentlyContinue)
        if ($prev -and $prev.Trim() -eq $key) { $themeChanged = $false }
    }

    Save-FoxOsBackupIfNeeded
    Merge-FoxOsBackupExtras
    Apply-FoxOsTaskbar
    Write-FoxOsLiveState

    if ($themeChanged -or $Force) {
        $wallDir = Join-Path (Get-FoxOsDir) "walls"
        $wall = Join-Path $wallDir ($key + ".bmp")
        if ($Force -or -not (Test-Path -LiteralPath $wall)) {
            New-FoxOsWallpaper -Theme $theme -OutPath $wall | Out-Null
        }
        $p = Get-FoxOsPalette
        Set-FoxOsWallpaper $wall | Out-Null
        Set-FoxOsAccent $p.accent
        Broadcast-FoxOsChange
        $key | Set-Content -LiteralPath $lastPath -Encoding UTF8
        # Lock screen picture follows the theme while the FoxOS look owns it.
        if ((Get-Command Test-FoxLookPart -ErrorAction SilentlyContinue) -and (Test-FoxLookEnabled)) {
            if (Test-FoxLookPart "lockscreen") { try { Apply-FoxLookLockScreen | Out-Null } catch {} }
            if (Test-FoxLookPart "cursors") { try { Apply-FoxLookCursors | Out-Null } catch {} }
        }
    }

    Start-FoxOsLive | Out-Null
    return $true
}

function Restart-FoxOsShell {
    try {
        Stop-Process -Name explorer -Force -ErrorAction Stop
    } catch {
        return
    }
    Start-Sleep -Milliseconds 500
    if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
        Start-Process explorer.exe
    }
}

function Get-FoxOsStatusInfo {
    $theme = Get-FoxOsThemeName
    $p = Get-FoxOsPalette
    return @{
        Enabled  = (Test-FoxOsEnabled)
        Windows  = (Test-FoxOsWindows)
        Theme    = $theme
        Accent   = $p.accent
        Backup   = (Test-Path -LiteralPath (Get-FoxOsBackupPath))
        Last     = if (Test-Path -LiteralPath (Get-FoxOsLastPath)) {
            (Get-Content -LiteralPath (Get-FoxOsLastPath) -Raw).Trim()
        } else { $null }
        Live     = (Test-FoxOsLiveRunning)
    }
}
