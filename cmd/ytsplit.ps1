param(
    [switch]$ReportOnly
)

Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "fox-browser.ps1")
function Resolve-FirefoxPath { Resolve-FoxBrowserPath }

function Ensure-YtSplitNativeType {
    if ("FoxTerm.YtSplitActiveOnlyV2" -as [type]) { return }

    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace FoxTerm {
    public class WindowInfoYtSplitActiveV2 {
        public IntPtr Handle { get; set; }
        public string Title { get; set; }
        public int ProcessId { get; set; }
    }

    public static class YtSplitActiveOnlyV2 {
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int nWidth, int nHeight, bool bRepaint);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        public const int SW_RESTORE = 9;

        public static List<WindowInfoYtSplitActiveV2> GetVisibleWindows() {
            var result = new List<WindowInfoYtSplitActiveV2>();
            EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;
                int len = GetWindowTextLength(hWnd);
                if (len <= 0) return true;

                var sb = new StringBuilder(len + 1);
                GetWindowText(hWnd, sb, sb.Capacity);
                var title = sb.ToString();
                if (string.IsNullOrWhiteSpace(title)) return true;

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                result.Add(new WindowInfoYtSplitActiveV2 {
                    Handle = hWnd,
                    Title = title,
                    ProcessId = unchecked((int)pid)
                });
                return true;
            }, IntPtr.Zero);
            return result;
        }
    }
}
"@
}

function Test-IsYouTubeMusicTitle([string]$title) {
    return ($title -match '(?i)\bYouTube\s+Music\b')
}

function Test-IsYouTubeTitle([string]$title) {
    return ($title -match '(?i)\bYouTube\b') -and -not (Test-IsYouTubeMusicTitle $title)
}

function Get-FirefoxWindows {
    $ffPids = @(
        Get-Process -Name zen, firefox -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Id
    )
    if ($ffPids.Count -eq 0) { return @() }

    $all = [FoxTerm.YtSplitActiveOnlyV2]::GetVisibleWindows()
    return @($all | Where-Object { $ffPids -contains $_.ProcessId })
}

function Pick-WindowsForSplit {
    param(
        [object[]]$Windows
    )

    $music = @($Windows | Where-Object { Test-IsYouTubeMusicTitle $_.Title } | Select-Object -First 1)
    $youtube = @($Windows | Where-Object { Test-IsYouTubeTitle $_.Title } | Select-Object -First 1)

    $m = if ($music.Count -gt 0) { $music[0] } else { $null }
    $y = if ($youtube.Count -gt 0) { $youtube[0] } else { $null }

    if ($m -and $y -and ($m.Handle -eq $y.Handle)) {
        $yAlt = @(
            $Windows |
            Where-Object { Test-IsYouTubeTitle $_.Title -and ($_.Handle -ne $m.Handle) } |
            Select-Object -First 1
        )
        if ($yAlt.Count -gt 0) { $y = $yAlt[0] }
    }

    if ($m -and $y -and ($m.Handle -eq $y.Handle)) {
        $mAlt = @(
            $Windows |
            Where-Object { Test-IsYouTubeMusicTitle $_.Title -and ($_.Handle -ne $y.Handle) } |
            Select-Object -First 1
        )
        if ($mAlt.Count -gt 0) { $m = $mAlt[0] }
    }

    return @{
        music = $m
        youtube = $y
    }
}

function Open-MissingWindow {
    param(
        [ValidateSet("youtube", "music")]
        [string]$Kind,
        [string]$FirefoxPath
    )

    $url = if ($Kind -eq "music") { "https://music.youtube.com/" } else { "https://www.youtube.com/" }
    try {
        Start-Process -FilePath $FirefoxPath -ArgumentList @("-new-window", $url) | Out-Null
    } catch {
        Write-Host ("Failed to open missing window: " + $Kind)
    }
}

function Move-ToHalf {
    param(
        [IntPtr]$Handle,
        [ValidateSet("Left", "Right")]
        [string]$Side,
        [System.Drawing.Rectangle]$Area
    )

    $leftWidth = [int][Math]::Floor($Area.Width / 2)
    $rightWidth = [int]($Area.Width - $leftWidth)

    $x = $Area.X
    $w = $leftWidth
    if ($Side -eq "Right") {
        $x = $Area.X + $leftWidth
        $w = $rightWidth
    }

    [FoxTerm.YtSplitActiveOnlyV2]::ShowWindow($Handle, [FoxTerm.YtSplitActiveOnlyV2]::SW_RESTORE) | Out-Null
    [FoxTerm.YtSplitActiveOnlyV2]::MoveWindow($Handle, $x, $Area.Y, $w, $Area.Height, $true) | Out-Null
}

function Get-PreferredFrontHandle {
    param(
        [object[]]$Windows
    )

    try {
        $fg = [FoxTerm.YtSplitActiveOnlyV2]::GetForegroundWindow()
        if ($fg -eq [IntPtr]::Zero) { return [IntPtr]::Zero }

        $hit = @(
            $Windows |
            Where-Object {
                $_.Handle -eq $fg -and
                (Test-IsYouTubeTitle $_.Title -or Test-IsYouTubeMusicTitle $_.Title)
            } |
            Select-Object -First 1
        )
        if ($hit.Count -gt 0) { return $fg }
    } catch {}

    return [IntPtr]::Zero
}

function Bring-ToFront {
    param(
        [IntPtr]$Handle
    )
    if ($Handle -eq [IntPtr]::Zero) { return }
    [FoxTerm.YtSplitActiveOnlyV2]::ShowWindow($Handle, [FoxTerm.YtSplitActiveOnlyV2]::SW_RESTORE) | Out-Null
    [FoxTerm.YtSplitActiveOnlyV2]::SetForegroundWindow($Handle) | Out-Null
}

function Print-DetectedWindows {
    param(
        [object[]]$Windows
    )

    if ($Windows.Count -eq 0) {
        Write-Host "No Firefox windows detected."
        return
    }

    Write-Host "Firefox windows (active-title scan):"
    foreach ($w in $Windows) {
        $title = $w.Title
        if ($title.Length -gt 92) { $title = $title.Substring(0, 92) + "..." }

        $marks = @()
        if (Test-IsYouTubeTitle $w.Title) { $marks += "YT" }
        if (Test-IsYouTubeMusicTitle $w.Title) { $marks += "YTM" }
        $markTxt = if ($marks.Count -gt 0) { "[" + ($marks -join ",") + "]" } else { "[none]" }
        Write-Host ("  hWnd={0,-12} | {1,-9} | {2}" -f $w.Handle.ToInt64(), $markTxt, $title)
    }
}

Ensure-YtSplitNativeType
Add-Type -AssemblyName System.Windows.Forms

$firefox = Resolve-FirefoxPath
$wins = Get-FirefoxWindows
$picks = Pick-WindowsForSplit -Windows $wins
$preferredFront = Get-PreferredFrontHandle -Windows $wins

Print-DetectedWindows -Windows $wins
Write-Host ""

if ($ReportOnly) {
    if ($picks.youtube) { Write-Host ("YouTube window:      hWnd=" + $picks.youtube.Handle.ToInt64()) } else { Write-Host "YouTube window:      not detected" }
    if ($picks.music) { Write-Host ("YouTube Music window:hWnd=" + $picks.music.Handle.ToInt64()) } else { Write-Host "YouTube Music window:not detected" }
    exit 0
}

if (-not $picks.youtube) {
    Open-MissingWindow -Kind youtube -FirefoxPath $firefox
}
if (-not $picks.music) {
    Open-MissingWindow -Kind music -FirefoxPath $firefox
}

$attempts = 24
for ($i = 0; $i -lt $attempts; $i++) {
    $wins = Get-FirefoxWindows
    $picks = Pick-WindowsForSplit -Windows $wins
    if ($picks.youtube -and $picks.music -and ($picks.youtube.Handle -ne $picks.music.Handle)) {
        break
    }
    Start-Sleep -Milliseconds 250
}

if (-not $picks.youtube -or -not $picks.music) {
    Write-Host "Could not get both windows by active title. Opened what was missing."
    exit 1
}

$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
Move-ToHalf -Handle $picks.youtube.Handle -Side Left -Area $area
Move-ToHalf -Handle $picks.music.Handle -Side Right -Area $area

if ($preferredFront -ne [IntPtr]::Zero) {
    Bring-ToFront -Handle $preferredFront
} else {
    Bring-ToFront -Handle $picks.youtube.Handle
}

Write-Host "Done: active-title mode, auto-opened missing windows, arranged split."
