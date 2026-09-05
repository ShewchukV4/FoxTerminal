# FoxTerminal desktop skin (internal).
# When enabled, the active theme paints the Windows wallpaper and DWM accent.
# Previous wallpaper/accent are saved on first apply and restored by: foxos off

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

function Get-FoxOsSkinKey {
    $theme = "orange"
    if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        $theme = Get-ActiveThemeName
    }
    $extra = ""
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
        if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) {
            $extra = "-" + (Load-PrideStyle)
        }
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
    $theme = "orange"
    if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        $theme = Get-ActiveThemeName
    }
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
    Set-ItemProperty -Path $personalize -Name "ColorPrevalence" -Value 0 -Type DWord
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

function Get-FoxOsLiveSource {
    return (Join-Path $PSScriptRoot "foxos-live.cs")
}

function Get-FoxOsLiveSources {
    $list = @(Get-FoxOsLiveSource)
    $help = Join-Path $PSScriptRoot "foxos-help.cs"
    if (Test-Path -LiteralPath $help) { $list += $help }
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
    $theme = if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        Get-ActiveThemeName
    } else {
        "orange"
    }
    $p = Get-ThemePalette
    $fox = Join-Path (Split-Path $PSScriptRoot -Parent) "FoxTerminal\assets\fox.png"
    $obj = @{
        night   = (Get-FoxOsNightHex $theme)
        accent  = $p.accent
        accent2 = $p.accent2
        theme   = $theme
        fox     = $fox
        cmd     = $PSScriptRoot
        rig     = $(if ($script:FoxOsRigOverride) { $script:FoxOsRigOverride } else { Get-FoxOsRigStyle })
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

function Stop-FoxOsLive {
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
    return (Test-FoxOsLiveRunning)
}

function Sync-FoxOsSkin {
    param([switch]$Force)

    if (-not (Test-FoxOsWindows)) { return $false }
    if (-not (Test-FoxOsEnabled)) { return $false }

    $theme = if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        Get-ActiveThemeName
    } else {
        "orange"
    }
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
        $p = Get-ThemePalette
        Set-FoxOsWallpaper $wall | Out-Null
        Set-FoxOsAccent $p.accent
        Broadcast-FoxOsChange
        $key | Set-Content -LiteralPath $lastPath -Encoding UTF8
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
    $theme = if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        Get-ActiveThemeName
    } else {
        "orange"
    }
    $p = Get-ThemePalette
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
