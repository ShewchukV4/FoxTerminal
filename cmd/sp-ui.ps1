param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args = @()
)

Set-StrictMode -Version Latest

$script:__spui_lastNowRefreshUtc = $null
$script:__spui_cachedNow = $null
$script:__spui_buttonsSig = $null
$script:__spui_lastNowLinePlain = ""

$script:LogPath = Join-Path $env:TEMP "sp-ui.log"
function Write-Log([string]$message) {
    try {
        $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
        Add-Content -Path $script:LogPath -Value ("[$ts] " + $message) -Encoding UTF8
    } catch { }
}

# Theme helpers (FoxTerminal)
try {
    . (Join-Path $PSScriptRoot "foxauth.ps1")
} catch { }

function Ensure-Utf8Console {
    try {
        $chcp = Get-Command chcp -ErrorAction SilentlyContinue
        if ($chcp) { $null = & chcp 65001 2>$null }
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $global:OutputEncoding = $utf8
    } catch { }
}

function Resolve-SpotifyAppPath {
    # Typical Spotify Desktop install locations (classic installer)
    $candidates = @(
        (Join-Path $env:APPDATA "Spotify\Spotify.exe"),
        (Join-Path $env:LOCALAPPDATA "Spotify\Spotify.exe")
    )
    foreach ($p in $candidates) {
        try { if ($p -and (Test-Path $p)) { return $p } } catch { }
    }
    return $null
}

function Ensure-AudioMeterType {
    if ("FoxTerm.AudioMeter" -as [type]) { return }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace FoxTerm {
  public sealed class AudioMeter : IDisposable {
    private IMMDeviceEnumerator _enumerator;
    private IMMDevice _device;
    private IAudioMeterInformation _meter;
    private AudioMeter() { }
    public static AudioMeter Create() { var a = new AudioMeter(); a.Init(); return a; }
    private void Init() {
      var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
      var type = Type.GetTypeFromCLSID(clsid, true);
      _enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(type);
      _enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out _device);
      var iid = typeof(IAudioMeterInformation).GUID;
      object o;
      _device.Activate(ref iid, (int)CLSCTX.CLSCTX_ALL, IntPtr.Zero, out o);
      _meter = (IAudioMeterInformation)o;
    }
    public float GetPeak() {
      float v; _meter.GetPeakValue(out v);
      if (v < 0) return 0.0f; if (v > 1) return 1.0f;
      return v;
    }
    public void Dispose() {
      try { if (_meter != null) Marshal.FinalReleaseComObject(_meter); } catch { }
      try { if (_device != null) Marshal.FinalReleaseComObject(_device); } catch { }
      try { if (_enumerator != null) Marshal.FinalReleaseComObject(_enumerator); } catch { }
      _meter = null; _device = null; _enumerator = null;
    }
    private enum EDataFlow { eRender = 0, eCapture = 1, eAll = 2 }
    private enum ERole { eConsole = 0, eMultimedia = 1, eCommunications = 2 }
    [Flags] private enum CLSCTX {
      CLSCTX_INPROC_SERVER = 0x1, CLSCTX_INPROC_HANDLER = 0x2, CLSCTX_LOCAL_SERVER = 0x4, CLSCTX_REMOTE_SERVER = 0x10,
      CLSCTX_ALL = CLSCTX_INPROC_SERVER | CLSCTX_INPROC_HANDLER | CLSCTX_LOCAL_SERVER | CLSCTX_REMOTE_SERVER
    }
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator {
      int NotImpl1();
      [PreserveSig] int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
    }
    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice {
      [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }
    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioMeterInformation {
      [PreserveSig] int GetPeakValue(out float pfPeak);
    }
  }
}
"@ -ErrorAction Stop | Out-Null
}

function Enable-VT {
    # Ensure ANSI colors work even in older consoles
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
    try { Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue | Out-Null } catch { }
    $STDOUT = -11
    $ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
    try {
        $h = [VT]::GetStdHandle($STDOUT)
        $mode = 0
        if ([VT]::GetConsoleMode($h, [ref]$mode)) {
            [VT]::SetConsoleMode($h, $mode -bor $ENABLE_VIRTUAL_TERMINAL_PROCESSING) | Out-Null
        }
    } catch { }
}

function Get-SpotifyIconPath {
    # Allow overriding with env var (absolute path to .png)
    if ($env:FOXTERM_SPOTIFY_ICON -and (Test-Path $env:FOXTERM_SPOTIFY_ICON)) {
        return $env:FOXTERM_SPOTIFY_ICON
    }
    # Default: the image you provided most recently in this workspace
    return "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-19c5a3a4-5832-445f-8045-1e871423f62f.png"
}

function Get-AsciiArtData([string]$path, [int]$targetWidth, [double]$charAspect) {
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
        $targetHeight = [int][Math]::Max(12, [Math]::Round($targetWidth * $aspect * $charAspect))
        $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
        $g.Dispose()

        # Denser ramp => better detail when scaled up
        $chars = @'
 .'`^",:;Il!i><~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$
'@
        $lines = New-Object System.Collections.Generic.List[string]
        $colors = New-Object System.Collections.Generic.List[object]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $lineColors = New-Object System.Collections.Generic.List[object]
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                if ($c.A -lt 10) {
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
        return @{ Lines = $lines.ToArray(); Colors = $colors.ToArray() }
    } finally {
        $img.Dispose()
    }
}

function Colorize-ArtLine([string]$line, [object[]]$colors) {
    $esc = [char]27
    $out = ""
    for ($i = 0; $i -lt $line.Length; $i++) {
        $ch = $line[$i]
        $rgb = if ($i -lt $colors.Length) { $colors[$i] } else { $null }
        if ($ch -eq " " -or $null -eq $rgb) {
            $out += " "
        } else {
            $out += ("{0}[38;2;{1};{2};{3}m{4}{0}[0m" -f $esc, $rgb[0], $rgb[1], $rgb[2], $ch)
        }
    }
    return $out
}

function Load-SpotifyBindings {
    $path = Join-Path $PSScriptRoot "sp_bindings.json"
    if (-not (Test-Path $path)) { return @{} }
    try {
        $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

function Resolve-SpotifyUrl([string]$input) {
    if ($null -eq $input) { $input = "" }
    $input = $input.Trim()
    if ([string]::IsNullOrWhiteSpace($input)) { return "https://open.spotify.com/" }

    $bindings = Load-SpotifyBindings
    if ($bindings.ContainsKey($input)) {
        $bound = [string]$bindings[$input]
        if ($bound -notmatch '^https?://') { return "https://$bound" }
        return $bound
    }

    if ($input -match '^https?://') { return $input }

    $encoded = [uri]::EscapeDataString($input)
    return "https://open.spotify.com/search/$encoded"
}

function Start-SpotifyApp([string]$queryOrAlias) {
    # Opens Spotify Desktop app. If query/alias is provided, opens Spotify search inside the app.
    $q = if ($null -eq $queryOrAlias) { "" } else { [string]$queryOrAlias }
    $q = $q.Trim()
    try {
        if (-not [string]::IsNullOrWhiteSpace($q)) {
            # If user passed a URL, open it via Spotify app anyway (it will route via handler)
            if ($q -match '^https?://') {
                Start-Process $q | Out-Null
                return $true
            }
            $encoded = [uri]::EscapeDataString($q)
            Start-Process ("spotify:search:" + $encoded) | Out-Null
            return $true
        }

        $exe = Resolve-SpotifyAppPath
        if ($exe) {
            Start-Process -FilePath $exe | Out-Null
            return $true
        }

        # URI fallback (works for Store app / handler)
        Start-Process "spotify:" | Out-Null
        return $true
    } catch {
        Write-Log ("Start-SpotifyApp failed: " + $_.Exception.Message)
        return $false
    }
}

function Ensure-WinApiTypes {
    # WinApi type can be "stuck" in the current session (Add-Type can't redefine it).
    # So we compile a V2 type if WinApi is missing required members.
    $t = ("FoxTerm.WinApi" -as [type])
    $ok = $false
    if ($t) {
        try {
            $ok = ($null -ne $t.GetMethod("KeyDown")) -and
                  ($null -ne $t.GetMethod("KeyUp")) -and
                  ($null -ne $t.GetMethod("Press")) -and
                  ($null -ne $t.GetMethod("ShowWindow")) -and
                  ($null -ne $t.GetMethod("SetForegroundWindow")) -and
                  ($null -ne $t.GetMethod("GetForegroundWindow"))
        } catch { $ok = $false }
    }
    if ($ok) { return }
    if ("FoxTerm.WinApiV2" -as [type]) { return }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace FoxTerm {
  public static class WinApiV2 {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const int SW_RESTORE = 9;
    public const int SW_MINIMIZE = 6;
    public static void KeyDown(byte vk) {
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
    }
    public static void KeyUp(byte vk) {
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }
    public static void Press(byte vk) {
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }
  }
}
"@
}

function Get-WinApiType {
    Ensure-WinApiTypes
    $t2 = ("FoxTerm.WinApiV2" -as [type])
    if ($t2) { return $t2 }
    return ("FoxTerm.WinApi" -as [type])
}

function Media-PlayPause { $t = Get-WinApiType; $t::Press(0xB3) }
function Media-Next      { $t = Get-WinApiType; $t::Press(0xB0) }
function Media-Prev      { $t = Get-WinApiType; $t::Press(0xB1) }
function Media-Mute      { $t = Get-WinApiType; $t::Press(0xAD) }
function Media-VolUp     { $t = Get-WinApiType; $t::Press(0xAF) }
function Media-VolDown   { $t = Get-WinApiType; $t::Press(0xAE) }

function Send-CtrlCombo([byte]$vk) {
    $t = Get-WinApiType
    # Ctrl down
    $t::KeyDown(0x11)
    Start-Sleep -Milliseconds 20
    $t::Press($vk)
    Start-Sleep -Milliseconds 20
    $t::KeyUp(0x11)
}

function Read-KeyBlocking {
    # Prefer Console.ReadKey, fallback to RawUI.ReadKey (works in some hosts where Console doesn't).
    try { return [Console]::ReadKey($true) } catch { }
    try {
        if ($host -and $host.UI -and $host.UI.RawUI) {
            return $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } catch { }
    throw "No key input available"
}

function Read-KeyOptional {
    try {
        if ([Console]::KeyAvailable) { return [Console]::ReadKey($true) }
    } catch { }
    try {
        if ($host -and $host.UI -and $host.UI.RawUI -and $host.UI.RawUI.KeyAvailable) {
            return $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } catch { }
    return $null
}

function Get-KeyName($k) {
    if ($null -eq $k) { return "" }
    try {
        if ($k -is [ConsoleKeyInfo]) { return $k.Key.ToString() }
    } catch { }
    try {
        if ($k.PSObject -and ($k.PSObject.Properties.Name -contains "VirtualKeyCode")) {
            return ([System.ConsoleKey]([int]$k.VirtualKeyCode)).ToString()
        }
    } catch { }
    return ""
}

function Clamp01([double]$v) {
    if ($v -lt 0) { return 0.0 }
    if ($v -gt 1) { return 1.0 }
    return $v
}

function Strip-AnsiLocal([string]$s) {
    if ($null -eq $s) { return "" }
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

function Pad-ToWidth([string]$line, [int]$width) {
    $plain = Strip-AnsiLocal $line
    if ($plain.Length -ge $width) { return $line }
    return $line + (" " * ($width - $plain.Length))
}

function Ansi-Home {
    $esc = [char]27
    return "$esc[H"
}

function Ansi-ClearScreen {
    $esc = [char]27
    return "$esc[2J$esc[H"
}

function Write-Console([string]$s) {
    try { [Console]::Write($s) } catch { Write-Host -NoNewline $s }
}

function Truncate-PlainToWidth([string]$s, [int]$width) {
    if ($null -eq $s) { return "" }
    if ($width -le 0) { return "" }
    if ($s.Length -le $width) { return $s }
    if ($width -le 3) { return $s.Substring(0, $width) }
    return ($s.Substring(0, $width - 3) + "...")
}

function Center-InWidth([string]$line, [int]$width) {
    $plain = Strip-AnsiLocal $line
    if ($plain.Length -ge $width) { return $line }
    $padLeft = [int][Math]::Floor(($width - $plain.Length) / 2)
    return (" " * $padLeft) + $line
}

function Get-SpotifyFirefoxWindowTitle {
    # Best-effort: reads Firefox main window title when Spotify tab is active in that window.
    try {
        $bestTitle = ""
        $procs = Get-Process -Name firefox -ErrorAction SilentlyContinue
        foreach ($p in $procs) {
            try {
                $t = [string]$p.MainWindowTitle
                if ([string]::IsNullOrWhiteSpace($t)) { continue }
                if ($t -notmatch '(?i)\bspotify\b') { continue }
                # Prefer longer titles (more likely to include track/artist)
                if ($t.Length -gt $bestTitle.Length) { $bestTitle = $t }
            } catch { }
        }
        return $bestTitle
    } catch {
        return ""
    }
}

function Parse-SpotifyTitleToNowPlaying([string]$title) {
    $t = if ($null -eq $title) { "" } else { $title.Trim() }
    if ([string]::IsNullOrWhiteSpace($t)) { return @{ Track = ""; Artist = ""; Raw = "" } }

    # Ignore generic titles if possible
    if ($t -match '(?i)spotify\s*[–—-]\s*web player') {
        return @{ Track = ""; Artist = ""; Raw = $t }
    }

    # Strip trailing "Spotify"
    $t = ($t -replace '\s*[\|\-–—•]\s*Spotify\s*$', '').Trim()
    # Strip leading "Spotify -/–/—"
    $t = ($t -replace '^(?i)\s*Spotify\s*[\|\-–—•]\s*', '').Trim()

    $track = ""
    $artist = ""

    # Common patterns in Spotify tab titles:
    # "Track • Artist", "Track - Artist", "Track – Artist"
    $parts = @()
    if ($t -like '* • *') {
        $parts = $t -split '\s+•\s+', 3
    } elseif ($t -like '* - *') {
        $parts = $t -split '\s+-\s+', 3
    } elseif ($t -like '* – *') {
        $parts = $t -split '\s+–\s+', 3
    } elseif ($t -like '* — *') {
        $parts = $t -split '\s+—\s+', 3
    } elseif ($t -like '* | *') {
        $parts = $t -split '\s+\|\s+', 3
    } else {
        $parts = @($t)
    }

    if ($parts.Count -ge 2) {
        $track = ($parts[0]).Trim()
        $artist = ($parts[1]).Trim()
    } else {
        $track = $t
        $artist = ""
    }

    return @{ Track = $track; Artist = $artist; Raw = $title }
}

function Await-WinRt([object]$op) {
    if ($null -eq $op) { return $null }
    # PowerShell 7+ sometimes supports GetAwaiter on WinRT projections,
    # but Windows PowerShell 5.1 typically needs AsTask().
    try {
        return $op.GetAwaiter().GetResult()
    } catch { }
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue | Out-Null
        return ([System.WindowsRuntimeSystemExtensions]::AsTask($op)).Result
    } catch { }
    return $null
}

function Try-Get-NowPlayingFromGsmTc {
    # Windows 10/11 global media session (more reliable than window title).
    # Returns: @{ Track; Artist; Status; Id; Raw }
    try {
        $pick = Get-SpotifyGsmTcSession
        if ($null -eq $pick -or $null -eq $pick.Session) { return $null }

        $props = Await-WinRt ($pick.Session.TryGetMediaPropertiesAsync())
        $track = ""
        $artist = ""
        $subtitle = ""
        $albumTitle = ""
        $albumArtist = ""
        if ($null -ne $props) {
            try { $track = ([string]$props.Title).Trim() } catch { $track = "" }
            try { $artist = ([string]$props.Artist).Trim() } catch { $artist = "" }
            try { $subtitle = ([string]$props.Subtitle).Trim() } catch { $subtitle = "" }
            try { $albumTitle = ([string]$props.AlbumTitle).Trim() } catch { $albumTitle = "" }
            try { $albumArtist = ([string]$props.AlbumArtist).Trim() } catch { $albumArtist = "" }
        }

        # Some sources (browser tabs) may omit Artist but provide Subtitle.
        if ([string]::IsNullOrWhiteSpace($artist) -and -not [string]::IsNullOrWhiteSpace($subtitle)) {
            $artist = $subtitle
        }
        # Some sources provide album info but not artist.
        if ([string]::IsNullOrWhiteSpace($artist) -and -not [string]::IsNullOrWhiteSpace($albumArtist)) {
            $artist = $albumArtist
        }
        if ([string]::IsNullOrWhiteSpace($track) -and -not [string]::IsNullOrWhiteSpace($albumTitle)) {
            $track = $albumTitle
        }

        return @{
            Track  = $track
            Artist = $artist
            Status = [string]$pick.Status
            Id     = [string]$pick.Id
            Raw    = ""
        }
    } catch {
        try {
            if ($env:FOXTERM_SP_UI_DEBUG -and $env:FOXTERM_SP_UI_DEBUG -match '^(?i)(1|true|yes|on)$') {
                Write-Log ("Try-Get-NowPlayingFromGsmTc failed: " + $_.Exception.Message)
            }
        } catch { }
        return $null
    }
}

function Render-Buttons([hashtable]$p, [string[]]$buttons, [int]$selectedIndex) {
    # Requires foxauth palette helpers; fallback if not loaded.
    $out = ""
    for ($i = 0; $i -lt $buttons.Count; $i++) {
        $label = " " + $buttons[$i] + " "
        if ($i -eq $selectedIndex) {
            if (Get-Command Color-TextBg -ErrorAction SilentlyContinue) {
                $out += (Color-TextBg (Get-ContrastText $p.accent2) $p.accent2 $label) + " "
            } else {
                $out += ("[" + $buttons[$i] + "] ")
            }
        } else {
            if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
                $out += (Color-Text $p.dim $label) + " "
            } else {
                $out += ($label + " ")
            }
        }
    }
    return $out.TrimEnd()
}

function Render-Visualizer([hashtable]$p, [double[]]$levels, [int[]]$columns, [int]$height) {
    $esc = [char]27
    $reset = "$esc[0m"
    $block = [char]0x2588
    $space = " "

    # Use FoxTerminal theme colors (system style)
    $rgbLow  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent3 } else { @{ r = 90;  g = 180; b = 255 } }
    $rgbMid  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent2 } else { @{ r = 120; g = 220; b = 255 } }
    $rgbHigh = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent4 } else { @{ r = 255; g = 190; b = 90 } }
    $rgbOff  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.dim } else { @{ r = 60; g = 60; b = 60 } }

    $w = $columns.Count
    $lines = New-Object System.Collections.Generic.List[string]
    for ($y = $height; $y -ge 1; $y--) {
        $line = ""
        for ($x = 0; $x -lt $w; $x++) {
            $barIdx = $columns[$x]
            if ($barIdx -lt 0) {
                $line += " "
                continue
            }
            $h = [int][Math]::Round((Clamp01 $levels[$barIdx]) * $height)
            if ($h -ge $y) {
                # Gradient by vertical position
                $t = $y / [double]$height
                $rgb = if ($t -lt 0.34) { $rgbLow } elseif ($t -lt 0.67) { $rgbMid } else { $rgbHigh }
                $line += ("$esc[38;2;{0};{1};{2}m{3}{4}" -f $rgb.r, $rgb.g, $rgb.b, $block, $reset)
            } else {
                $line += ("$esc[38;2;{0};{1};{2}m{3}{4}" -f $rgbOff.r, $rgbOff.g, $rgbOff.b, $space, $reset)
            }
        }
        $lines.Add($line)
    }
    return $lines.ToArray()
}

function Render-SpotifyIcon([int]$targetWidth) {
    Enable-VT
    $path = Get-SpotifyIconPath
    $data = Get-AsciiArtData $path $targetWidth 0.48
    $lines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $data.Lines.Count; $i++) {
        $lines.Add((Colorize-ArtLine $data.Lines[$i] $data.Colors[$i]))
    }
    return $lines.ToArray()
}

function Ensure-GsmTcTypes {
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue | Out-Null
        $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
        return $true
    } catch {
        try {
            if ($env:FOXTERM_SP_UI_DEBUG -and $env:FOXTERM_SP_UI_DEBUG -match '^(?i)(1|true|yes|on)$') {
                Write-Log ("Ensure-GsmTcTypes failed: " + $_.Exception.Message)
            }
        } catch { }
        return $false
    }
}

function Pick-SpotifyCandidate($candidates) {
    if ($null -eq $candidates -or $candidates.Count -eq 0) { return $null }
    # Prefer Spotify Desktop / Store app sessions first.
    $spotify = @($candidates | Where-Object { $_.Id -match '(?i)\bspotify\b' })
    if ($spotify.Count -gt 0) { return $spotify }
    return $candidates
}

function Get-SpotifyGsmTcSession {
    if (-not (Ensure-GsmTcTypes)) { return $null }
    try {
        $mgr = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
        if ($null -eq $mgr) { return $null }
        $sessions = $mgr.GetSessions()
        $candidates = @()
        if ($sessions -and $sessions.Count -gt 0) {
            foreach ($s in $sessions) {
                $id = ""
                $status = ""
                try { $id = [string]$s.SourceAppUserModelId } catch { $id = "" }
                try { $status = $s.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
                $candidates += [pscustomobject]@{ Session = $s; Id = $id; Status = $status }
            }
        }
        if ($candidates.Count -eq 0) {
            $current = $mgr.GetCurrentSession()
            if ($null -eq $current) { return $null }
            $id = ""
            $status = ""
            try { $id = [string]$current.SourceAppUserModelId } catch { $id = "" }
            try { $status = $current.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
            $candidates = @([pscustomobject]@{ Session = $current; Id = $id; Status = $status })
        }

        $preferred = Pick-SpotifyCandidate $candidates
        if ($preferred.Count -eq 0) { return $null }

        # Prefer playing, then paused, then anything.
        $pick = $null
        $playing = @($preferred | Where-Object { $_.Status -eq "Playing" })
        if ($playing.Count -gt 0) { $pick = $playing[0] }
        if ($null -eq $pick) {
            $paused = @($preferred | Where-Object { $_.Status -eq "Paused" })
            if ($paused.Count -gt 0) { $pick = $paused[0] }
        }
        if ($null -eq $pick) { $pick = $preferred[0] }
        return $pick
    } catch {
        try {
            if ($env:FOXTERM_SP_UI_DEBUG -and $env:FOXTERM_SP_UI_DEBUG -match '^(?i)(1|true|yes|on)$') {
                Write-Log ("Get-SpotifyGsmTcSession failed: " + $_.Exception.Message)
            }
        } catch { }
        return $null
    }
}

function Spotify-Play {
    $pick = Get-SpotifyGsmTcSession
    if ($null -eq $pick -or $null -eq $pick.Session) { Media-PlayPause; return }
    try { $null = Await-WinRt ($pick.Session.TryPlayAsync()) } catch { Media-PlayPause }
}

function Spotify-Pause {
    $pick = Get-SpotifyGsmTcSession
    if ($null -eq $pick -or $null -eq $pick.Session) { Media-PlayPause; return }
    try { $null = Await-WinRt ($pick.Session.TryPauseAsync()) } catch { Media-PlayPause }
}

function Spotify-Toggle {
    $pick = Get-SpotifyGsmTcSession
    if ($null -eq $pick -or $null -eq $pick.Session) { Media-PlayPause; return }
    $status = ""
    try { $status = $pick.Session.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
    if ($status -eq "Playing") { Spotify-Pause } else { Spotify-Play }
}

function Spotify-Next {
    $pick = Get-SpotifyGsmTcSession
    if ($null -eq $pick -or $null -eq $pick.Session) { Media-Next; return }
    try { $null = Await-WinRt ($pick.Session.TrySkipNextAsync()) } catch { Media-Next }
}

function Spotify-Prev {
    $pick = Get-SpotifyGsmTcSession
    if ($null -eq $pick -or $null -eq $pick.Session) { Media-Prev; return }
    try { $null = Await-WinRt ($pick.Session.TrySkipPreviousAsync()) } catch { Media-Prev }
}

function Show-SpotifyDjUiNew {
    Ensure-Utf8Console
    Ensure-AudioMeterType
    Enable-VT

    $p = if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) { Get-ThemePalette } else { @{ accent2="#5A8CFF"; accent3="#4E75D8"; accent4="#7AA2F7"; dim="#777777"; text="#E6E6E6" } }

    $baseButtons = @("Play/Pause", "Start", "Prev", "Next", "Vol-", "Vol+", "Mute", "Back", "Quit")
    $sel = 0

    # Symmetric "bands": wider, but not too tall (prettier)
    $bandCount = 41
    $levels = New-Object double[] $bandCount
    $decay = New-Object double[] $bandCount
    $gain  = New-Object double[] $bandCount
    $center = [int][Math]::Floor($bandCount / 2)
    for ($i = 0; $i -lt $bandCount; $i++) {
        $d = [Math]::Abs($i - $center) / [double]$center   # 0..1
        $gain[$i] = Clamp01 (0.80 + 0.55 * $d) + 0.25      # edges a bit hotter
        $decay[$i] = Clamp01 (0.94 - 0.22 * $d)            # center smoother
        if ($decay[$i] -lt 0.68) { $decay[$i] = 0.68 }
        if ($decay[$i] -gt 0.96) { $decay[$i] = 0.96 }
    }

    # Columns map: 20 bars | gap | center | gap | 20 bars  (wide DJ)
    $columns = @()
    $columns += 0..19
    $columns += @(-1, -1, -1)
    $columns += 20
    $columns += @(-1, -1, -1)
    $columns += 21..40
    $columns = [int[]]$columns

    # Lower (shorter) but wider looks nicer in terminal
    $height = 10
    $esc = [char]27
    $hideCursor = "$esc[?25l"
    $showCursor = "$esc[?25h"

    try {
        $meter = [FoxTerm.AudioMeter]::Create()
    } catch {
        Write-Host "Audio meter failed. Run as normal user (not admin) and try again."
        Write-Host $_.Exception.Message
        return
    }

    $cachedIconWidth = -1
    $cachedIconLines = @()
    $layout = $null
    $lastSel = -1
    $lastVizTopY = -1
    $lastVizHeight = -1
    $lastWinW = -1
    $lastWinH = -1
    $didClear = $false

    try {
        Clear-Host
        Write-Host -NoNewline $hideCursor
        while ($true) {
            # Now playing (best-effort; throttle)
            if (-not $script:__spui_lastNowRefreshUtc) { $script:__spui_lastNowRefreshUtc = [DateTime]::UtcNow.AddYears(-1) }
            if (-not $script:__spui_cachedNow) { $script:__spui_cachedNow = @{ Track=""; Artist=""; Raw=""; Status=""; Id="" } }
            $now = $script:__spui_cachedNow
            $utcNow = [DateTime]::UtcNow
            if (($utcNow - $script:__spui_lastNowRefreshUtc).TotalMilliseconds -ge 850) {
                $script:__spui_lastNowRefreshUtc = $utcNow
                $now = Try-Get-NowPlayingFromGsmTc
                if ($null -eq $now) {
                    $rawTitle = Get-SpotifyFirefoxWindowTitle
                    $now = Parse-SpotifyTitleToNowPlaying $rawTitle
                }
                $script:__spui_cachedNow = $now
            }

            $hasTrack = (-not [string]::IsNullOrWhiteSpace($now.Track)) -or (-not [string]::IsNullOrWhiteSpace($now.Artist))
            $hasStatus = ($now.ContainsKey("Status")) -and (-not [string]::IsNullOrWhiteSpace([string]$now.Status))
            $isPaused = $hasStatus -and ($now.Status -eq "Paused")
            $idLooksRight = ($now.ContainsKey("Id")) -and ([string]$now.Id -match '(?i)spotify|firefox|mozilla')
            $showContinue = $isPaused -and ($hasTrack -or $idLooksRight)

            # Buttons become dynamic: show Continue when paused track exists
            $buttons = if ($showContinue) { @("Continue") + $baseButtons } else { $baseButtons }
            if ($sel -ge $buttons.Count) { $sel = [Math]::Max(0, $buttons.Count - 1) }

            $btnSig = ($buttons -join "|")
            if (-not $script:__spui_buttonsSig) { $script:__spui_buttonsSig = $btnSig }
            if ($btnSig -ne $script:__spui_buttonsSig) {
                $script:__spui_buttonsSig = $btnSig
                $layout = $null  # force full redraw to avoid misaligned layout
            }

            # input
            $k = $null
            try { $k = Read-KeyOptional } catch { $k = $null }
            if ($null -ne $k) {
                $kn = Get-KeyName $k
                switch ($kn) {
                    'LeftArrow'  { if ($sel -gt 0) { $sel-- } }
                    'RightArrow' { if ($sel -lt ($buttons.Count - 1)) { $sel++ } }
                    'Escape'     { break }
                    'Enter' {
                        switch ($buttons[$sel]) {
                            "Continue"   { Spotify-Play }
                            "Play/Pause" { Spotify-Toggle }
                            "Start"      { Spotify-Play }
                            "Prev"       { Spotify-Prev }
                            "Next"       { Spotify-Next }
                            "Vol-"       { Media-VolDown }
                            "Vol+"       { Media-VolUp }
                            "Mute"       { Media-Mute }
                            "Back"       { return }
                            "Quit"       { exit 0 }
                        }
                    }
                    'Spacebar' { Spotify-Toggle }
                }
            }

            $peak = 0.0
            try { $peak = [double]$meter.GetPeak() } catch { $peak = 0.0 }
            $peak = Clamp01 $peak

            # Update bands: each "responsible" for its own response curve.
            for ($i = 0; $i -lt $bandCount; $i++) {
                $noise = ((Get-Random -Minimum 0 -Maximum 1000) / 1000.0) * 0.06
                $target = Clamp01 (($peak * $gain[$i]) + $noise - 0.03)
                $v = ($levels[$i] * $decay[$i])
                if ($target -gt $v) { $v = $target }
                $levels[$i] = Clamp01 $v
            }

            # render (minimize flicker: full redraw only when needed)
            $winW = 120
            $winH = 40
            try { $winW = [Console]::WindowWidth } catch { }
            try { $winH = [Console]::WindowHeight } catch { }
            # Avoid writing exactly last column (can cause wrap in some hosts)
            $frameW = [Math]::Max(40, $winW - 1)
            $frameH = [Math]::Max(20, $winH)

            $title = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.accent2 "SPOTIFY DJ" } else { "SPOTIFY DJ" }
            $hint  = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.dim "Left/Right + Enter. Esc = back." } else { "Left/Right + Enter. Esc = back." }
            $btnLine = Render-Buttons $p $buttons $sel
            $vizLines = Render-Visualizer $p $levels $columns $height

            $nowPlain = ""
            if (-not [string]::IsNullOrWhiteSpace($now.Track) -and -not [string]::IsNullOrWhiteSpace($now.Artist)) {
                $prefix = if ($isPaused) { "Paused" } else { "Now playing" }
                $nowPlain = ("{0}: {1} - {2}" -f $prefix, $now.Track, $now.Artist)
            } elseif (-not [string]::IsNullOrWhiteSpace($now.Track)) {
                $prefix = if ($isPaused) { "Paused" } else { "Now playing" }
                $nowPlain = ("{0}: {1}" -f $prefix, $now.Track)
            } else {
                $nowPlain = if ($isPaused) { "Paused: (not detected)" } else { "Now playing: (not detected)" }
            }
            $maxNowWidth = [Math]::Min(70, [Math]::Max(28, $frameW - 22))
            $nowPlain = Truncate-PlainToWidth $nowPlain $maxNowWidth
            $nowLine = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.text $nowPlain } else { $nowPlain }

            $iconWidth = $null
            if ($env:FOXTERM_SPOTIFY_ICON_WIDTH -and $env:FOXTERM_SPOTIFY_ICON_WIDTH -match '^\d+$') {
                $iconWidth = [int]$env:FOXTERM_SPOTIFY_ICON_WIDTH
            } else {
                # Slightly bigger by default (still not huge); user can override via env
                $iconWidth = [int]($frameW * 0.55)
            }
            if ($iconWidth -lt 30) { $iconWidth = 30 }
            if ($iconWidth -gt 90) { $iconWidth = 90 }
            if ($iconWidth -ne $cachedIconWidth) {
                $cachedIconWidth = $iconWidth
                $cachedIconLines = Render-SpotifyIcon $iconWidth
            }
            # Center icon within its own column width
            $iconLinesRaw = $cachedIconLines
            $iconWidthPlain = 0
            foreach ($ln in $iconLinesRaw) { $iconWidthPlain = [Math]::Max($iconWidthPlain, (Strip-AnsiLocal $ln).Length) }
            $iconLines = @()
            foreach ($ln in $iconLinesRaw) { $iconLines += (Center-InWidth $ln $iconWidthPlain) }

            $leftHeaderLines = @($title, $hint, $nowLine, "", $btnLine)
            $rightLines = $iconLines

            $leftPlainMax = 0
            foreach ($ln in $leftHeaderLines) { $leftPlainMax = [Math]::Max($leftPlainMax, (Strip-AnsiLocal $ln).Length) }
            $rightPlainMax = 0
            foreach ($ln in $rightLines) { $rightPlainMax = [Math]::Max($rightPlainMax, (Strip-AnsiLocal $ln).Length) }
            $gap = 4
            $rightStart = [Math]::Max($leftPlainMax + $gap, $frameW - $rightPlainMax)
            if ($rightStart -lt ($leftPlainMax + 2)) { $rightStart = $leftPlainMax + 2 }

            $headerRows = [Math]::Max($leftHeaderLines.Count, $rightLines.Count)
            $free = $frameH - $headerRows - $vizLines.Count - 1
            if ($free -lt 1) { $free = 1 }

            # Layout metrics
            $vizTopY = $headerRows + $free
            # Center logo vertically in the right column area ABOVE the visualizer
            $topAreaRows = $vizTopY
            $rightPadTop = 0
            if ($rightLines.Count -lt $topAreaRows) {
                $rightPadTop = [int][Math]::Floor(($topAreaRows - $rightLines.Count) / 2)
            }

            # Robust redraw: always render full frame from top.
            $resized = ($lastWinW -ne $winW) -or ($lastWinH -ne $winH)
            $lastWinW = $winW
            $lastWinH = $winH
            if (-not $didClear -or $resized) {
                $didClear = $true
                Write-Console (Ansi-ClearScreen)
            } else {
                Write-Console (Ansi-Home)
            }
            Write-Console $hideCursor

            $frameLines = New-Object System.Collections.Generic.List[string]
            for ($i = 0; $i -lt $topAreaRows; $i++) {
                $l = if ($i -lt $leftHeaderLines.Count) { $leftHeaderLines[$i] } else { "" }
                $ri = $i - $rightPadTop
                $r = if ($ri -ge 0 -and $ri -lt $rightLines.Count) { $rightLines[$ri] } else { "" }
                $lPlainLen = (Strip-AnsiLocal $l).Length
                $pad = if ($lPlainLen -lt $rightStart) { (" " * ($rightStart - $lPlainLen)) } else { " " }
                $frameLines.Add((Pad-ToWidth ($l + $pad + $r) $frameW))
            }
            foreach ($ln in $vizLines) { $frameLines.Add((Pad-ToWidth $ln $frameW)) }

            # Fill remaining lines so old content doesn't remain visible
            while ($frameLines.Count -lt $frameH) {
                $frameLines.Add((" " * $frameW))
            }

            # Use CRLF to avoid "diagonal" drift in some consoles
            Write-Console (($frameLines.ToArray() -join "`r`n"))

            Start-Sleep -Milliseconds 90
        }
    } catch {
        Write-Log ("DJ UI crashed: " + ($_.Exception.ToString()))
        Write-Host ""
        Write-Host "DJ UI crashed: $($_.Exception.Message)"
    } finally {
        try { $meter.Dispose() } catch { }
        Write-Host ""
        Write-Host $showCursor
    }
}

function Show-SpotifyDjUiLegacy {
    Ensure-Utf8Console
    Ensure-AudioMeterType

    $p = if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) { Get-ThemePalette } else { @{ accent2="#5A8CFF"; accent3="#4E75D8"; accent4="#7AA2F7"; dim="#777777"; text="#E6E6E6" } }

    $baseButtons = @("Play/Pause", "Start", "Prev", "Next", "Vol-", "Vol+", "Mute", "Back", "Quit")
    $sel = 0

    $bandCount = 41
    $levels = New-Object double[] $bandCount
    $decay = New-Object double[] $bandCount
    $gain  = New-Object double[] $bandCount
    $center = [int][Math]::Floor($bandCount / 2)
    for ($i = 0; $i -lt $bandCount; $i++) {
        $d = [Math]::Abs($i - $center) / [double]$center
        $gain[$i] = Clamp01 (0.80 + 0.55 * $d) + 0.25
        $decay[$i] = Clamp01 (0.94 - 0.22 * $d)
        if ($decay[$i] -lt 0.68) { $decay[$i] = 0.68 }
        if ($decay[$i] -gt 0.96) { $decay[$i] = 0.96 }
    }

    $columns = @()
    $columns += 0..19
    $columns += @(-1, -1, -1)
    $columns += 20
    $columns += @(-1, -1, -1)
    $columns += 21..40
    $columns = [int[]]$columns

    $height = 10
    $esc = [char]27
    $hideCursor = "$esc[?25l"
    $showCursor = "$esc[?25h"

    try {
        $meter = [FoxTerm.AudioMeter]::Create()
    } catch {
        Write-Host "Audio meter failed. Run as normal user (not admin) and try again."
        Write-Host $_.Exception.Message
        return
    }

    $cachedIconWidth = -1
    $cachedIconLines = @()
    $layout = $null
    $lastSel = -1
    $lastWinW = -1
    $lastWinH = -1

    try {
        Clear-Host
        Write-Host -NoNewline $hideCursor
        while ($true) {
            # Now playing (best-effort; throttle)
            if (-not $script:__spui_lastNowRefreshUtc) { $script:__spui_lastNowRefreshUtc = [DateTime]::UtcNow.AddYears(-1) }
            if (-not $script:__spui_cachedNow) { $script:__spui_cachedNow = @{ Track=""; Artist=""; Raw=""; Status=""; Id="" } }
            $now = $script:__spui_cachedNow
            $utcNow = [DateTime]::UtcNow
            if (($utcNow - $script:__spui_lastNowRefreshUtc).TotalMilliseconds -ge 850) {
                $script:__spui_lastNowRefreshUtc = $utcNow
                $now = Try-Get-NowPlayingFromGsmTc
                if ($null -eq $now) {
                    $rawTitle = Get-SpotifyFirefoxWindowTitle
                    $now = Parse-SpotifyTitleToNowPlaying $rawTitle
                }
                $script:__spui_cachedNow = $now
            }

            $hasTrack = (-not [string]::IsNullOrWhiteSpace($now.Track)) -or (-not [string]::IsNullOrWhiteSpace($now.Artist))
            $hasStatus = ($now.ContainsKey("Status")) -and (-not [string]::IsNullOrWhiteSpace([string]$now.Status))
            $isPaused = $hasStatus -and ($now.Status -eq "Paused")
            $idLooksRight = ($now.ContainsKey("Id")) -and ([string]$now.Id -match '(?i)spotify|firefox|mozilla')
            $showContinue = $isPaused -and ($hasTrack -or $idLooksRight)

            # Buttons become dynamic: show Continue when paused track exists
            $buttons = if ($showContinue) { @("Continue") + $baseButtons } else { $baseButtons }
            if ($sel -ge $buttons.Count) { $sel = [Math]::Max(0, $buttons.Count - 1) }

            $nowPlain = ""
            if (-not [string]::IsNullOrWhiteSpace($now.Track) -and -not [string]::IsNullOrWhiteSpace($now.Artist)) {
                $prefix = if ($isPaused) { "Paused" } else { "Now playing" }
                $nowPlain = ("{0}: {1} - {2}" -f $prefix, $now.Track, $now.Artist)
            } elseif (-not [string]::IsNullOrWhiteSpace($now.Track)) {
                $prefix = if ($isPaused) { "Paused" } else { "Now playing" }
                $nowPlain = ("{0}: {1}" -f $prefix, $now.Track)
            } else {
                $nowPlain = if ($isPaused) { "Paused: (not detected)" } else { "Now playing: (not detected)" }
            }

            $btnSig = ($buttons -join "|")

            $k = $null
            try { $k = Read-KeyOptional } catch { $k = $null }
            if ($null -ne $k) {
                $kn = Get-KeyName $k
                switch ($kn) {
                    'LeftArrow'  { if ($sel -gt 0) { $sel-- } }
                    'RightArrow' { if ($sel -lt ($buttons.Count - 1)) { $sel++ } }
                    'Escape'     { break }
                    'Enter' {
                        switch ($buttons[$sel]) {
                            "Continue"   { Spotify-Play }
                            "Play/Pause" { Spotify-Toggle }
                            "Start"      { Spotify-Play }
                            "Prev"       { Spotify-Prev }
                            "Next"       { Spotify-Next }
                            "Vol-"       { Media-VolDown }
                            "Vol+"       { Media-VolUp }
                            "Mute"       { Media-Mute }
                            "Back"       { return }
                            "Quit"       { exit 0 }
                        }
                    }
                    'Spacebar' { Spotify-Toggle }
                }
            }

            $peak = 0.0
            try { $peak = [double]$meter.GetPeak() } catch { $peak = 0.0 }
            $peak = Clamp01 $peak

            for ($i = 0; $i -lt $bandCount; $i++) {
                $noise = ((Get-Random -Minimum 0 -Maximum 1000) / 1000.0) * 0.06
                $target = Clamp01 (($peak * $gain[$i]) + $noise - 0.03)
                $v = ($levels[$i] * $decay[$i])
                if ($target -gt $v) { $v = $target }
                $levels[$i] = Clamp01 $v
            }

            $winW = 120
            $winH = 40
            try { $winW = $host.UI.RawUI.WindowSize.Width } catch { }
            try { $winH = $host.UI.RawUI.WindowSize.Height } catch { }

            $title = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.accent2 "SPOTIFY DJ" } else { "SPOTIFY DJ" }
            $hint  = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.dim "Left/Right + Enter. Esc = back." } else { "Left/Right + Enter. Esc = back." }

            $maxNowWidth = [Math]::Min(70, [Math]::Max(28, $winW - 22))
            $nowPlain = Truncate-PlainToWidth $nowPlain $maxNowWidth
            $nowLine = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.text $nowPlain } else { $nowPlain }

            $btnLine = Render-Buttons $p $buttons $sel
            $vizLines = Render-Visualizer $p $levels $columns $height

            $iconWidth = $null
            if ($env:FOXTERM_SPOTIFY_ICON_WIDTH -and $env:FOXTERM_SPOTIFY_ICON_WIDTH -match '^\d+$') {
                $iconWidth = [int]$env:FOXTERM_SPOTIFY_ICON_WIDTH
            } else {
                $iconWidth = [int]($winW * 0.48)
            }
            if ($iconWidth -lt 30) { $iconWidth = 30 }
            if ($iconWidth -gt 80) { $iconWidth = 80 }
            if ($iconWidth -ne $cachedIconWidth) {
                $cachedIconWidth = $iconWidth
                $cachedIconLines = Render-SpotifyIcon $iconWidth
            }

            $iconLinesRaw = $cachedIconLines
            $iconWidthPlain = 0
            foreach ($ln in $iconLinesRaw) { $iconWidthPlain = [Math]::Max($iconWidthPlain, (Strip-AnsiLocal $ln).Length) }
            $iconLines = @()
            foreach ($ln in $iconLinesRaw) { $iconLines += (Center-InWidth $ln $iconWidthPlain) }

            $leftHeaderLines = @($title, $hint, $nowLine, "", $btnLine)
            $rightLines = $iconLines

            $leftPlainMax = 0
            foreach ($ln in $leftHeaderLines) { $leftPlainMax = [Math]::Max($leftPlainMax, (Strip-AnsiLocal $ln).Length) }
            $rightPlainMax = 0
            foreach ($ln in $rightLines) { $rightPlainMax = [Math]::Max($rightPlainMax, (Strip-AnsiLocal $ln).Length) }
            $gap = 4
            $rightStart = [Math]::Max($leftPlainMax + $gap, $winW - $rightPlainMax)
            if ($rightStart -lt ($leftPlainMax + 2)) { $rightStart = $leftPlainMax + 2 }

            $headerRows = [Math]::Max($leftHeaderLines.Count, $rightLines.Count)
            $free = $winH - $headerRows - $vizLines.Count - 1
            if ($free -lt 1) { $free = 1 }

            $needFull = $false
            if ($lastWinW -ne $winW -or $lastWinH -ne $winH) { $needFull = $true }
            if ($null -eq $layout) { $needFull = $true }
            if ($btnSig -ne $script:__spui_buttonsSig) { $needFull = $true }
            if ($nowPlain -ne $script:__spui_lastNowLinePlain) { $needFull = $true }

            # update change trackers (used only to trigger a full redraw)
            $script:__spui_buttonsSig = $btnSig
            $script:__spui_lastNowLinePlain = $nowPlain
            if ($needFull) {
                $lastWinW = $winW
                $lastWinH = $winH
            }

            $vizTopY = $headerRows + $free
            $topAreaRows = $vizTopY
            $rightPadTop = 0
            if ($rightLines.Count -lt $topAreaRows) {
                $rightPadTop = [int][Math]::Floor(($topAreaRows - $rightLines.Count) / 2)
            }

            if ($needFull) {
                $layout = @{
                    winW = $winW
                    rightStart = $rightStart
                    rightPadTop = $rightPadTop
                    rightLines = $rightLines
                    topAreaRows = $topAreaRows
                    vizTopY = $vizTopY
                }
                $lastSel = -1
                try { [Console]::SetCursorPosition(0, 0) } catch { Clear-Host }
                Clear-Host
                Write-Host -NoNewline $hideCursor

                for ($i = 0; $i -lt $topAreaRows; $i++) {
                    $l = if ($i -lt $leftHeaderLines.Count) { $leftHeaderLines[$i] } else { "" }
                    $ri = $i - $rightPadTop
                    $r = if ($ri -ge 0 -and $ri -lt $rightLines.Count) { $rightLines[$ri] } else { "" }
                    $lPlainLen = (Strip-AnsiLocal $l).Length
                    $pad = if ($lPlainLen -lt $rightStart) { (" " * ($rightStart - $lPlainLen)) } else { " " }
                    Write-Host (Pad-ToWidth ($l + $pad + $r) $winW)
                }
                foreach ($ln in $vizLines) { Write-Host (Pad-ToWidth $ln $winW) }
            } else {
                if ($sel -ne $lastSel) {
                    $lastSel = $sel
                    $btnLine2 = Render-Buttons $p $buttons $sel
                    $row = $leftHeaderLines.Count - 1
                    if ($row -lt $layout.topAreaRows) {
                        $l = $btnLine2
                        $ri = $row - $layout.rightPadTop
                        $r = if ($ri -ge 0 -and $ri -lt $layout.rightLines.Count) { $layout.rightLines[$ri] } else { "" }
                        $lPlainLen = (Strip-AnsiLocal $l).Length
                        $pad = if ($lPlainLen -lt $layout.rightStart) { (" " * ($layout.rightStart - $lPlainLen)) } else { " " }
                        try { [Console]::SetCursorPosition(0, $row) } catch { }
                        Write-Host -NoNewline (Pad-ToWidth ($l + $pad + $r) $layout.winW)
                    }
                }
                if ($layout.vizTopY -ge 0) {
                    for ($i = 0; $i -lt $vizLines.Count; $i++) {
                        try { [Console]::SetCursorPosition(0, $layout.vizTopY + $i) } catch { }
                        Write-Host -NoNewline (Pad-ToWidth $vizLines[$i] $layout.winW)
                    }
                }
            }

            Start-Sleep -Milliseconds 90
        }
    } finally {
        try { $meter.Dispose() } catch { }
        Write-Host ""
        Write-Host $showCursor
    }
}

function Show-SpotifyDjUi {
    $useNew = $false
    if ($env:FOXTERM_SP_UI_NEW) {
        $v = [string]$env:FOXTERM_SP_UI_NEW
        if ($v -match '^(?i)(1|true|yes|on)$') { $useNew = $true }
    }
    if ($useNew) { Show-SpotifyDjUiNew } else { Show-SpotifyDjUiLegacy }
}

function Select-List([string]$title, [string[]]$options, [int]$defaultIndex, [bool]$horizontal) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = [Math]::Max(0, [Math]::Min($defaultIndex, $options.Count - 1))
    while ($true) {
        Clear-Host
        Write-Host ("=== {0} ===" -f $title)
        Write-Host ""

        if ($horizontal) {
            for ($i = 0; $i -lt $options.Count; $i++) {
                if ($i -eq $index) {
                    Write-Host -NoNewline ("[{0}]" -f $options[$i])
                } else {
                    Write-Host -NoNewline (" {0} " -f $options[$i])
                }
                Write-Host -NoNewline "  "
            }
            Write-Host ""
        } else {
            for ($i = 0; $i -lt $options.Count; $i++) {
                if ($i -eq $index) { Write-Host (" > {0}" -f $options[$i]) }
                else { Write-Host ("   {0}" -f $options[$i]) }
            }
        }

        Write-Host ""
        Write-Host "Arrows = move | Enter = select | Esc = back/exit"
        try {
            $key = Read-KeyBlocking
        } catch {
            Write-Log ("Select-List ReadKey failed: " + $_.Exception.Message)
            Write-Host ""
            Write-Host "No key input available in this console. Exiting."
            return -1
        }
        $kn = Get-KeyName $key
        switch ($kn) {
            'UpArrow'    { if (-not $horizontal -and $index -gt 0) { $index-- } }
            'DownArrow'  { if (-not $horizontal -and $index -lt ($options.Count - 1)) { $index++ } }
            'LeftArrow'  { if ($horizontal -and $index -gt 0) { $index-- } }
            'RightArrow' { if ($horizontal -and $index -lt ($options.Count - 1)) { $index++ } }
            'Enter'      { return $index }
            'Escape'     { return -1 }
        }
    }
}

function Show-ControlsUi {
    Show-SpotifyDjUi
}

# ---- Entry

$query = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if (-not [string]::IsNullOrWhiteSpace($query)) {
    $null = Start-SpotifyApp $query
    Start-Sleep -Milliseconds 600
    try { Spotify-Play } catch { }
    Show-ControlsUi
    exit 0
}

$bindings = Load-SpotifyBindings
$aliases = @()
if ($bindings.Count -gt 0) { $aliases = @($bindings.Keys | Sort-Object) }

$menu = @("Search...", "Open Home") + ($aliases | ForEach-Object { "Play: $($_)" }) + @("Controls only", "Exit")
while ($true) {
    $sel = Select-List "Spotify (Desktop app) - select" $menu 0 $false
    if ($sel -lt 0) { exit 0 }

    $picked = $menu[$sel]
    if ($picked -eq "Exit") { exit 0 }
    if ($picked -eq "Controls only") { Show-ControlsUi; continue }
    if ($picked -eq "Open Home") {
        $null = Start-SpotifyApp ""
        Start-Sleep -Milliseconds 600
        try { Spotify-Play } catch { }
        Show-ControlsUi
        continue
    }
    if ($picked -eq "Search...") {
        $q = Read-Host "Search query (empty cancels)"
        if ($null -eq $q) { $q = "" }
        $q = $q.Trim()
        if ([string]::IsNullOrWhiteSpace($q)) { continue }
        $null = Start-SpotifyApp $q
        Start-Sleep -Milliseconds 600
        try { Spotify-Play } catch { }
        Show-ControlsUi
        continue
    }
    if ($picked -like "Play: *") {
        $alias = $picked.Substring(6).Trim()
        $null = Start-SpotifyApp $alias
        Start-Sleep -Milliseconds 600
        try { Spotify-Play } catch { }
        Show-ControlsUi
        continue
    }
}

