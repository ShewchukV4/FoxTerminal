param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args = @()
)

Set-StrictMode -Version Latest

$script:LogPath = Join-Path $env:TEMP "ytm-ui.log"
$script:StatePath = Join-Path $env:TEMP "ytm-ui.state.json"
function Write-Log([string]$message) {
    try {
        $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
        Add-Content -Path $script:LogPath -Value ("[$ts] " + $message) -Encoding UTF8
    } catch { }
}

try {
    . (Join-Path $PSScriptRoot "foxauth.ps1")
} catch { }

function Load-YtmBindings {
    $path = Join-Path $PSScriptRoot "ytm_bindings.json"
    if (-not (Test-Path $path)) { return @{} }
    try {
        $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch { return @{} }
}

function Resolve-YtmUrl([string]$input) {
    if ($null -eq $input) { $input = "" }
    $input = $input.Trim()
    if ([string]::IsNullOrWhiteSpace($input)) { return "https://music.youtube.com/" }

    $bindings = Load-YtmBindings
    if ($bindings.ContainsKey($input)) { return [string]$bindings[$input] }

    if ($input -match '^https?://') { return $input }
    $encoded = [uri]::EscapeDataString($input)
    return "https://music.youtube.com/search?q=$encoded"
}

function Resolve-YtmBrowser {
    try {
        $custom = [string]$env:FOXTERM_YTM_BROWSER
        if (-not [string]::IsNullOrWhiteSpace($custom) -and (Test-Path $custom)) { return $custom }
    } catch { }
    $lib = Join-Path $PSScriptRoot "fox-browser.ps1"
    if (Test-Path -LiteralPath $lib) {
        . $lib
        if (Get-Command Resolve-FoxBrowserPath -ErrorAction SilentlyContinue) {
            return (Resolve-FoxBrowserPath)
        }
    }
    return $null
}

function Start-YtmUrl([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return $false }
    # Normalize to avoid share params breaking routing
    try {
        $url = $url.Trim()
        $u = $null
        try { $u = [Uri]$url } catch { $u = $null }
        if ($u -and $u.Host -match '(?i)music\.youtube\.com') {
            Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue | Out-Null
            $qs = [System.Web.HttpUtility]::ParseQueryString($u.Query)
            if ($qs["si"]) { $qs.Remove("si") }
            if ($qs["utm_source"]) { $qs.Remove("utm_source") }
            if ($qs["utm_medium"]) { $qs.Remove("utm_medium") }
            if ($qs["utm_campaign"]) { $qs.Remove("utm_campaign") }
            if ($qs["feature"]) { $qs.Remove("feature") }
            $b = New-Object System.UriBuilder($u)
            $b.Query = $qs.ToString()
            $url = $b.Uri.AbsoluteUri
        }
    } catch { }
    $browser = Resolve-YtmBrowser
    try {
        if ($browser) {
            $name = [System.IO.Path]::GetFileName($browser)
            if ($name -match '(?i)^(zen|firefox)') {
                Start-Process -FilePath $browser -ArgumentList @("-new-tab", $url) | Out-Null
            } elseif ($name -match '(?i)^(msedge|chrome)') {
                Start-Process -FilePath $browser -ArgumentList @("-new-tab", $url) | Out-Null
            } else {
                Start-Process -FilePath $browser -ArgumentList @("-new-tab", $url) | Out-Null
            }
        } else {
            if (Get-Command Open-FoxBrowserUrl -ErrorAction SilentlyContinue) {
                Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
            }
        }
        return $true
    } catch {
        Write-Log ("Start-YtmUrl failed: " + $_.Exception.Message)
        return $false
    }
}

function Open-Ytm([string]$queryOrAlias) {
    try {
        $url = Resolve-YtmUrl $queryOrAlias
        $null = Start-YtmUrl $url
        return $true
    } catch {
        Write-Log ("Open-Ytm failed: " + $_.Exception.Message)
        return $false
    }
}

function Read-State {
    try {
        if (-not (Test-Path $script:StatePath)) { return @{} }
        $json = Get-Content -Path $script:StatePath -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch { return @{} }
}

function Write-State([hashtable]$state) {
    try {
        $state | ConvertTo-Json -Depth 4 | Set-Content -Path $script:StatePath -Encoding UTF8
    } catch { }
}

function Ensure-YouTubeMusicOpen {
    # Best-effort: open site so media session can appear.
    try {
        if ($env:FOXTERM_YTM_NOOPEN -and $env:FOXTERM_YTM_NOOPEN -match '^(?i)(1|true|yes|on)$') { return }
        $null = Open-Ytm ""
    } catch { }
}

function Get-YtmLogoPath {
    # User can override with env var pointing to a PNG/JPG.
    try {
        $p = [string]$env:FOXTERM_YTM_LOGO
        if (-not [string]::IsNullOrWhiteSpace($p) -and (Test-Path $p)) { return $p }
    } catch { }
    # Default: logo image provided in this workspace
    $default = "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_Screenshot_2026-02-13_225129-8ddc5a18-1f9c-4636-9f52-2fe1a10ec02b.png"
    if (Test-Path $default) { return $default }
    return $null
}

function Render-LogoFromImage([string]$path, [int]$targetWidth, [double]$charAspect) {
    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path $path)) { return @() }
    try { Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue | Out-Null } catch { return @() }
    try {
        $img = [System.Drawing.Image]::FromFile($path)
    } catch { return @() }
    try {
        if ($targetWidth -lt 20) { $targetWidth = 20 }
        if ($targetWidth -gt 140) { $targetWidth = 140 }
        $aspect = $img.Height / [double]$img.Width
        $targetHeight = [int][Math]::Max(6, [Math]::Round($targetWidth * $aspect * $charAspect))
        $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
        $g.Dispose()

        # Dense ramp => sharper logo
        $ramp = @'
 .'`^",:;Il!i><~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$
'@
        $esc = [char]27
        $reset = "$esc[0m"
        $lines = New-Object System.Collections.Generic.List[string]
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $line = ""
            $cur = $null
            for ($x = 0; $x -lt $bmp.Width; $x++) {
                $c = $bmp.GetPixel($x, $y)
                # treat almost-transparent as space (rare for screenshots)
                if ($c.A -lt 10) {
                    if ($null -ne $cur) { $line += $reset; $cur = $null }
                    $line += " "
                    continue
                }

                # Background cleanup: treat near-black as transparent to avoid "dots" in dark areas.
                $maxRgb = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
                $b = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114) / 255.0
                if ($maxRgb -lt 40 -and $b -lt 0.18) {
                    if ($null -ne $cur) { $line += $reset; $cur = $null }
                    $line += " "
                    continue
                }

                # Slight gamma to keep logo crisp
                $b = [Math]::Pow($b, 0.90)
                $idx = [int][Math]::Round($b * ($ramp.Length - 1))
                if ($idx -lt 0) { $idx = 0 }
                if ($idx -ge $ramp.Length) { $idx = $ramp.Length - 1 }
                $ch = $ramp[$idx]

                # Quantize color for fewer ANSI switches
                $qr = [int]([Math]::Round($c.R / 32.0) * 32); if ($qr -gt 255) { $qr = 255 }
                $qg = [int]([Math]::Round($c.G / 32.0) * 32); if ($qg -gt 255) { $qg = 255 }
                $qb = [int]([Math]::Round($c.B / 32.0) * 32); if ($qb -gt 255) { $qb = 255 }
                $rgb = "$qr;$qg;$qb"

                # Another cleanup: if char is too faint in dark region, render as space.
                if ($b -lt 0.20 -and ($ch -eq "." -or $ch -eq "," -or $ch -eq "'" -or $ch -eq "`"")) {
                    if ($null -ne $cur) { $line += $reset; $cur = $null }
                    $line += " "
                    continue
                }

                if ($ch -eq " ") {
                    if ($null -ne $cur) { $line += $reset; $cur = $null }
                    $line += " "
                    continue
                }

                if ($cur -ne $rgb) {
                    $cur = $rgb
                    $line += ("$esc[38;2;{0}m" -f $rgb)
                }
                $line += $ch
            }
            if ($null -ne $cur) { $line += $reset }
            $lines.Add($line)
        }
        try { $bmp.Dispose() } catch { }
        return $lines.ToArray()
    } finally {
        try { $img.Dispose() } catch { }
    }
}

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

function Await-WinRt([object]$op) {
    if ($null -eq $op) { return $null }
    try { return $op.GetAwaiter().GetResult() } catch { }
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue | Out-Null
        return ([System.WindowsRuntimeSystemExtensions]::AsTask($op)).Result
    } catch { }
    return $null
}

function Ensure-GsmTcTypes {
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue | Out-Null
        $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
        return $true
    } catch {
        Write-Log ("Ensure-GsmTcTypes failed: " + $_.Exception.Message)
        return $false
    }
}

function Get-GsmTcSessions {
    if (-not (Ensure-GsmTcTypes)) { return @() }
    $mgr = Await-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
    if ($null -eq $mgr) { return @() }
    $sessions = $mgr.GetSessions()
    $list = New-Object System.Collections.Generic.List[object]
    if ($sessions -and $sessions.Count -gt 0) {
        foreach ($s in $sessions) {
            $id = ""
            $status = ""
            try { $id = [string]$s.SourceAppUserModelId } catch { $id = "" }
            try { $status = $s.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
            $props = $null
            try { $props = Await-WinRt ($s.TryGetMediaPropertiesAsync()) } catch { $props = $null }
            $title = ""; $artist = ""
            if ($props) {
                try { $title = ([string]$props.Title).Trim() } catch { $title = "" }
                try { $artist = ([string]$props.Artist).Trim() } catch { $artist = "" }
                if ([string]::IsNullOrWhiteSpace($artist)) {
                    try { $artist = ([string]$props.Subtitle).Trim() } catch { }
                }
            }
            $list.Add([pscustomobject]@{
                Session = $s
                Id = $id
                Status = $status
                Title = $title
                Artist = $artist
            }) | Out-Null
        }
    }
    return $list.ToArray()
}

function Read-KeyBlocking {
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

function Key-IsCtrlE($k) {
    if ($null -eq $k) { return $false }
    $kn = Get-KeyName $k
    if ($kn -ne "E") { return $false }
    try {
        if ($k -is [ConsoleKeyInfo]) {
            return (($k.Modifiers -band [ConsoleModifiers]::Control) -ne 0)
        }
    } catch { }
    try {
        if ($k.PSObject -and ($k.PSObject.Properties.Name -contains "ControlKeyState")) {
            $state = [int]$k.ControlKeyState
            $ctrlMask = [int]([System.Management.Automation.Host.ControlKeyStates]::LeftCtrlPressed) -bor
                        [int]([System.Management.Automation.Host.ControlKeyStates]::RightCtrlPressed)
            return (($state -band $ctrlMask) -ne 0)
        }
    } catch { }
    return $false
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

function Truncate-PlainToWidth([string]$s, [int]$width) {
    if ($null -eq $s) { return "" }
    if ($width -le 0) { return "" }
    if ($s.Length -le $width) { return $s }
    if ($width -le 3) { return $s.Substring(0, $width) }
    return ($s.Substring(0, $width - 3) + "...")
}

function Render-Buttons([hashtable]$p, [string[]]$buttons, [int]$selectedIndex) {
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

function Render-YtmLogo([hashtable]$p) {
    $lines = @(
        "  +-----------------------+  ",
        "  |      >  YOUTUBE       |  ",
        "  |         MUSIC         |  ",
        "  +-----------------------+  "
    )
    if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
        $out = @()
        foreach ($l in $lines) {
            $out += (Color-Text $p.accent2 $l)
        }
        return $out
    }
    return $lines
}

function Build-ColumnsForWidth([int]$targetWidth) {
    # Create a wide symmetric layout:
    # left bars | small gap | center | small gap | right bars
    if ($targetWidth -lt 20) { $targetWidth = 20 }
    $gap = 3
    $centerBars = 1
    $usable = $targetWidth - ($gap * 2) - $centerBars
    if ($usable -lt 2) { $usable = 2 }
    $leftCount = [int][Math]::Floor($usable / 2)
    $rightCount = $usable - $leftCount

    $cols = New-Object int[] $targetWidth
    $pos = 0
    for ($i = 0; $i -lt $leftCount; $i++) {
        $src = [int][Math]::Floor(($i * 20) / [double]$leftCount)
        if ($src -lt 0) { $src = 0 }
        if ($src -gt 19) { $src = 19 }
        $cols[$pos++] = $src
    }
    for ($g = 0; $g -lt $gap; $g++) { if ($pos -lt $targetWidth) { $cols[$pos++] = -1 } }
    if ($pos -lt $targetWidth) { $cols[$pos++] = 20 }
    for ($g = 0; $g -lt $gap; $g++) { if ($pos -lt $targetWidth) { $cols[$pos++] = -1 } }
    for ($i = 0; $i -lt $rightCount; $i++) {
        $src2 = 21 + [int][Math]::Floor(($i * 20) / [double]$rightCount)
        if ($src2 -lt 21) { $src2 = 21 }
        if ($src2 -gt 40) { $src2 = 40 }
        if ($pos -lt $targetWidth) { $cols[$pos++] = $src2 }
    }
    while ($pos -lt $targetWidth) { $cols[$pos++] = -1 }
    return $cols
}

function Select-List([string]$title, [object[]]$items) {
    if ($null -eq $items -or $items.Count -eq 0) { return -1 }
    $idx = 0
    while ($true) {
        Clear-Host
        Write-Host ("=== {0} ===" -f $title)
        Write-Host ""
        for ($i = 0; $i -lt $items.Count; $i++) {
            $line = [string]$items[$i]
            if ($i -eq $idx) { Write-Host (" > " + $line) } else { Write-Host ("   " + $line) }
        }
        Write-Host ""
        Write-Host "Up/Down + Enter. Esc = cancel."
        $k = $null
        try { $k = Read-KeyBlocking } catch { return -1 }
        $kn = Get-KeyName $k
        switch ($kn) {
            'UpArrow' { if ($idx -gt 0) { $idx-- } }
            'DownArrow' { if ($idx -lt ($items.Count - 1)) { $idx++ } }
            'Enter' { return $idx }
            'Escape' { return -1 }
        }
    }
}

function Pick-YouTubeMusicSession {
    $sessions = Get-GsmTcSessions
    # Heuristic: prefer sessions that look like music playback (has title/artist) and browser IDs.
    $candidates = @($sessions | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Title) -and $_.Id -match '(?i)chrome|edge|msedge|firefox|mozilla' })
    if ($candidates.Count -eq 0) { $candidates = @($sessions | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Title) }) }
    if ($candidates.Count -eq 0) { return $null }

    # If we have a previously chosen session Id, prefer it (helps when multiple tabs are playing).
    $state = Read-State
    $lastId = ""
    try { $lastId = [string]$state.lastId } catch { $lastId = "" }
    if (-not [string]::IsNullOrWhiteSpace($lastId)) {
        $match = @($candidates | Where-Object { $_.Id -eq $lastId })
        if ($match.Count -gt 0) { return $match[0] }
    }

    # If there's exactly one, just use it.
    if ($candidates.Count -eq 1) { return $candidates[0] }

    $lines = @()
    foreach ($c in $candidates) {
        $label = "[{0}] {1}" -f $c.Status, $c.Title
        if (-not [string]::IsNullOrWhiteSpace($c.Artist)) { $label += " - " + $c.Artist }
        $label += "  (" + ($c.Id -replace '^(.{40}).*$', '$1...') + ")"
        $lines += $label
    }
    $sel = Select-List "Pick YouTube Music session" $lines
    if ($sel -lt 0) { return $null }
    $picked = $candidates[$sel]
    try { Write-State @{ lastId = [string]$picked.Id } } catch { }
    return $picked
}

function Find-YouTubeMusicSessionNonInteractive {
    # Best-effort pick without prompting (used for the DJ screen).
    $sessions = Get-GsmTcSessions
    if ($null -eq $sessions -or $sessions.Count -eq 0) { return $null }

    $candidates = @($sessions | Where-Object {
        (-not [string]::IsNullOrWhiteSpace($_.Title)) -and
        ($_.Id -match '(?i)chrome|edge|msedge|firefox|mozilla')
    })
    if ($candidates.Count -eq 0) {
        $candidates = @($sessions | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Title) })
    }
    if ($candidates.Count -eq 0) { return $null }

    $playing = @($candidates | Where-Object { $_.Status -eq "Playing" })
    if ($playing.Count -gt 0) { return $playing[0] }

    $paused = @($candidates | Where-Object { $_.Status -eq "Paused" })
    if ($paused.Count -gt 0) { return $paused[0] }

    return $candidates[0]
}

function Try-Play([object]$pick) {
    if ($null -eq $pick -or $null -eq $pick.Session) { return $false }
    try { $null = Await-WinRt ($pick.Session.TryPlayAsync()); return $true } catch { return $false }
}
function Try-Pause([object]$pick) {
    if ($null -eq $pick -or $null -eq $pick.Session) { return $false }
    try { $null = Await-WinRt ($pick.Session.TryPauseAsync()); return $true } catch { return $false }
}
function Try-Toggle([object]$pick) {
    $status = ""
    try { $status = $pick.Session.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
    if ($status -eq "Playing") { return (Try-Pause $pick) } else { return (Try-Play $pick) }
}
function Try-Next([object]$pick) {
    if ($null -eq $pick -or $null -eq $pick.Session) { return $false }
    try { $null = Await-WinRt ($pick.Session.TrySkipNextAsync()); return $true } catch { return $false }
}
function Try-Prev([object]$pick) {
    if ($null -eq $pick -or $null -eq $pick.Session) { return $false }
    try { $null = Await-WinRt ($pick.Session.TrySkipPreviousAsync()); return $true } catch { return $false }
}

function Ensure-WinApiTypes {
    if ("FoxTerm.WinApiV2" -as [type]) { return }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace FoxTerm {
  public static class WinApiV2 {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const int KEYEVENTF_KEYUP = 0x0002;
    public static void Press(byte vk) {
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY, 0);
      keybd_event(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }
  }
}
"@
}

function Media-Mute { Ensure-WinApiTypes; [FoxTerm.WinApiV2]::Press(0xAD) }
function Media-VolUp { Ensure-WinApiTypes; [FoxTerm.WinApiV2]::Press(0xAF) }
function Media-VolDown { Ensure-WinApiTypes; [FoxTerm.WinApiV2]::Press(0xAE) }

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

function Pad-ToWidth([string]$line, [int]$width) {
    $plain = Strip-AnsiLocal $line
    if ($plain.Length -ge $width) { return $line }
    return $line + (" " * ($width - $plain.Length))
}

function Center-InWidth([string]$line, [int]$width) {
    $plain = Strip-AnsiLocal $line
    if ($plain.Length -ge $width) { return $line }
    $padLeft = [int][Math]::Floor(($width - $plain.Length) / 2)
    return (" " * $padLeft) + $line
}

function Ansi-Home { $esc = [char]27; return "$esc[H" }
function Ansi-ClearScreen { $esc = [char]27; return "$esc[2J$esc[H" }

function Write-Console([string]$s) {
    try { [Console]::Write($s) } catch { Write-Host -NoNewline $s }
}

function Render-Visualizer([hashtable]$p, [double[]]$levels, [int[]]$columns, [int]$height) {
    $esc = [char]27
    $reset = "$esc[0m"
    # Smooth bar characters (0..8 units)
    $cell = @(
        " ",
        [string]([char]0x2581), # ▁
        [string]([char]0x2582), # ▂
        [string]([char]0x2583), # ▃
        [string]([char]0x2584), # ▄
        [string]([char]0x2585), # ▅
        [string]([char]0x2586), # ▆
        [string]([char]0x2587), # ▇
        [string]([char]0x2588)  # █
    )

    $rgbLow  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent3 } else { @{ r = 255; g = 100; b = 90 } }
    $rgbMid  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent2 } else { @{ r = 255; g = 170; b = 90 } }
    $rgbHigh = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.accent4 } else { @{ r = 255; g = 220; b = 120 } }
    $rgbOff  = if (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue) { Convert-HexToRgb $p.dim } else { @{ r = 60; g = 60; b = 60 } }

    $w = $columns.Count
    if ($w -le 0 -or $height -le 0) { return @() }

    function __LerpByte([int]$a, [int]$b, [double]$t) {
        $v = [int][Math]::Round($a + ($b - $a) * $t)
        if ($v -lt 0) { return 0 }
        if ($v -gt 255) { return 255 }
        return $v
    }
    function __SmoothStep([double]$t) {
        if ($t -lt 0) { return 0.0 }
        if ($t -gt 1) { return 1.0 }
        return ($t * $t * (3.0 - 2.0 * $t))
    }
    function __GradientRgb([double]$t) {
        # Smooth gradient: low -> mid -> high
        $t = __SmoothStep $t
        if ($height -le 1) { $t = 0.5 }
        if ($t -lt 0.5) {
            $u = $t / 0.5
            return @{
                r = (__LerpByte $rgbLow.r  $rgbMid.r  $u)
                g = (__LerpByte $rgbLow.g  $rgbMid.g  $u)
                b = (__LerpByte $rgbLow.b  $rgbMid.b  $u)
            }
        } else {
            $u = ($t - 0.5) / 0.5
            return @{
                r = (__LerpByte $rgbMid.r  $rgbHigh.r $u)
                g = (__LerpByte $rgbMid.g  $rgbHigh.g $u)
                b = (__LerpByte $rgbMid.b  $rgbHigh.b $u)
            }
        }
    }

    # Precompute per-column "units" (height * 8)
    $units = New-Object int[] $w
    for ($x = 0; $x -lt $w; $x++) {
        $idx = $columns[$x]
        if ($idx -lt 0 -or $idx -ge $levels.Length) { $units[$x] = 0; continue }
        $v = Clamp01 $levels[$idx]
        $u = [int][Math]::Round($v * $height * 8)
        if ($u -lt 0) { $u = 0 }
        $maxU = $height * 8
        if ($u -gt $maxU) { $u = $maxU }
        $units[$x] = $u
    }

    $lines = New-Object System.Collections.Generic.List[string]
    for ($y = $height; $y -ge 1; $y--) {
        $sb = New-Object System.Text.StringBuilder
        $cur = ""
        $t = if ($height -le 1) { 0.5 } else { ($y - 1) / [double]($height - 1) }
        $rgbRow = __GradientRgb $t
        $rowKey = "$($rgbRow.r);$($rgbRow.g);$($rgbRow.b)"
        for ($x = 0; $x -lt $w; $x++) {
            $u = $units[$x]
            $rowBase = ($y - 1) * 8
            $fill = $u - $rowBase
            if ($fill -lt 0) { $fill = 0 }
            if ($fill -gt 8) { $fill = 8 }

            if ($fill -le 0) {
                if ($cur -ne "") { [void]$sb.Append($reset); $cur = "" }
                [void]$sb.Append(" ")
            } else {
                if ($cur -ne $rowKey) {
                    $cur = $rowKey
                    [void]$sb.Append(("$esc[38;2;{0}m" -f $rowKey))
                }
                [void]$sb.Append($cell[$fill])
            }
        }
        if ($cur -ne "") { [void]$sb.Append($reset) }
        $lines.Add($sb.ToString())
    }

    return $lines.ToArray()
}

function Show-YtmDjUi {
    Ensure-Utf8Console
    Ensure-AudioMeterType

    # Palette: re-use FoxTerminal theme if available.
    $p = if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) {
        $pp = Get-ThemePalette
        # Ensure we have warm accents for YTM
        if (-not $pp.ContainsKey("accent2")) { $pp.accent2 = "#FF4E45" }
        if (-not $pp.ContainsKey("accent3")) { $pp.accent3 = "#FF9A45" }
        if (-not $pp.ContainsKey("accent4")) { $pp.accent4 = "#FFD37A" }
        $pp
    } else {
        @{ accent2="#FF4E45"; accent3="#FF9A45"; accent4="#FFD37A"; dim="#777777"; text="#E6E6E6" }
    }

    # Always show the UI; if no media session yet, keep retrying silently.
    $pick = Find-YouTubeMusicSessionNonInteractive

    # DJ visualizer bands
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

    $lastWinW = -1
    $lastWinH = -1
    $didClear = $false
    $lastNowPlain = ""
    $lastPickTryUtc = [DateTime]::UtcNow.AddYears(-1)

    try {
        Clear-Host
        Write-Host -NoNewline $hideCursor
        while ($true) {
            # Retry session detection periodically if missing or lost
            if ($null -eq $pick -or $null -eq $pick.Session) {
                $utcNow = [DateTime]::UtcNow
                if (($utcNow - $lastPickTryUtc).TotalMilliseconds -ge 800) {
                    $lastPickTryUtc = $utcNow
                    $pick = Find-YouTubeMusicSessionNonInteractive
                }
            }

            # Refresh status + props
            $status = ""
            if ($null -ne $pick -and $null -ne $pick.Session) {
                try { $status = $pick.Session.GetPlaybackInfo().PlaybackStatus.ToString() } catch { $status = "" }
            }
            $props = $null
            if ($null -ne $pick -and $null -ne $pick.Session) {
                try { $props = Await-WinRt ($pick.Session.TryGetMediaPropertiesAsync()) } catch { $props = $null }
            }
            $track = ""; $artist = ""
            if ($props) {
                try { $track = ([string]$props.Title).Trim() } catch { $track = "" }
                try { $artist = ([string]$props.Artist).Trim() } catch { $artist = "" }
                if ([string]::IsNullOrWhiteSpace($artist)) {
                    try { $artist = ([string]$props.Subtitle).Trim() } catch { }
                }
            }

            # input
            $k = $null
            try { $k = Read-KeyOptional } catch { $k = $null }
            if ($null -ne $k) {
                $kn = Get-KeyName $k
                if ($kn -eq "Escape" -or (Key-IsCtrlE $k)) { return }
            }

            # Visualizer levels
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

            # render
            $winW = 120
            $winH = 40
            try { $winW = [Console]::WindowWidth } catch { }
            try { $winH = [Console]::WindowHeight } catch { }
            $frameW = [Math]::Max(60, $winW - 1)
            $frameH = [Math]::Max(22, $winH)

            $titleLine = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.accent2 "YTM DJ" } else { "YTM DJ" }
            $hintLine  = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.dim "Exit: Esc or Ctrl+E" } else { "Exit: Esc or Ctrl+E" }

            # Render logo from provided image (ASCII)
            $logoPath = Get-YtmLogoPath
            $logoWidth = [int][Math]::Min([Math]::Max(30, [int]($frameW * 0.65)), 120)
            $logoLines = Render-LogoFromImage $logoPath $logoWidth 0.55
            if ($null -eq $logoLines -or $logoLines.Count -eq 0) { $logoLines = Render-YtmLogo $p }

            $prefix = if ($status -eq "Paused") { "Paused" } elseif ($status -eq "Playing") { "Now playing" } else { "Status" }
            $nowPlain = if (-not [string]::IsNullOrWhiteSpace($track) -and -not [string]::IsNullOrWhiteSpace($artist)) {
                ("{0}: {1} - {2}" -f $prefix, $track, $artist)
            } elseif (-not [string]::IsNullOrWhiteSpace($track)) {
                ("{0}: {1}" -f $prefix, $track)
            } else {
                ""
            }
            $maxNowWidth = [Math]::Min(92, [Math]::Max(28, $frameW - 2))
            $nowPlain = Truncate-PlainToWidth $nowPlain $maxNowWidth
            $nowLine = if (Get-Command Color-Text -ErrorAction SilentlyContinue) { Color-Text $p.text $nowPlain } else { $nowPlain }

            $topLines = @()
            $topLines += (Center-InWidth $titleLine $frameW)
            $topLines += (Center-InWidth $hintLine $frameW)
            $topLines += ""
            foreach ($ln in $logoLines) { $topLines += (Center-InWidth $ln $frameW) }
            $topLines += ""
            if (-not [string]::IsNullOrWhiteSpace((Strip-AnsiLocal $nowLine))) {
                $topLines += (Center-InWidth $nowLine $frameW)
            }
            $topLines += ""
            $topAreaRows = $topLines.Count

            # Visualizer: centered horizontally and pinned to bottom.
            $vizHeight = $frameH - $topAreaRows
            if ($vizHeight -lt 8) { $vizHeight = 8 }
            if ($vizHeight -gt 28) { $vizHeight = 28 }
            # Slightly narrower than full width (looks nicer)
            $vizWidth = [int][Math]::Min([Math]::Max(44, [int]($frameW * 0.76)), 120)
            # Smooth mapping across bands (no gaps) for waveform design
            $columns = New-Object int[] $vizWidth
            for ($x = 0; $x -lt $vizWidth; $x++) {
                $idx = [int][Math]::Floor(($x * 41) / [double]$vizWidth)
                if ($idx -lt 0) { $idx = 0 }
                if ($idx -gt 40) { $idx = 40 }
                $columns[$x] = $idx
            }
            $vizLinesRaw = Render-Visualizer $p $levels $columns $vizHeight
            $vizLines = @()
            foreach ($ln in $vizLinesRaw) { $vizLines += (Center-InWidth $ln $frameW) }

            $resized = ($lastWinW -ne $winW) -or ($lastWinH -ne $winH)
            $lastWinW = $winW; $lastWinH = $winH
            $lastNowPlain = $nowPlain

            if (-not $didClear -or $resized) {
                $didClear = $true
                Write-Console (Ansi-ClearScreen)
            } else {
                Write-Console (Ansi-Home)
            }
            Write-Console $hideCursor

            $frameLines = New-Object System.Collections.Generic.List[string]
            foreach ($ln in $topLines) { $frameLines.Add((Pad-ToWidth $ln $frameW)) }
            # push visualizer to the bottom
            $freeRows = $frameH - $topLines.Count - $vizLines.Count
            if ($freeRows -gt 0) {
                for ($i = 0; $i -lt $freeRows; $i++) { $frameLines.Add((" " * $frameW)) }
            }
            foreach ($ln in $vizLines) { $frameLines.Add((Pad-ToWidth $ln $frameW)) }
            while ($frameLines.Count -lt $frameH) { $frameLines.Add((" " * $frameW)) }
            Write-Console (($frameLines.ToArray() -join "`r`n"))

            Start-Sleep -Milliseconds 90
        }
    } finally {
        try { $meter.Dispose() } catch { }
        Write-Host ""
        Write-Host $showCursor
    }
}

# ---- Entry
Show-YtmDjUi

