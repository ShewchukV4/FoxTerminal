param(
    [switch]$DryRun,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CmdArgs
)

Set-StrictMode -Version Latest

$bindingsPath = Join-Path $PSScriptRoot "app_bindings.json"

function Show-Usage {
    Write-Host "Usage:"
    Write-Host "  apps app1"
    Write-Host "  apps app1 left|right [top|down]"
    Write-Host "  apps app1 top|down"
    Write-Host "  apps app1 / app2"
    Write-Host "  apps app1 / app2 / app3"
    Write-Host "  apps app1 / app2 / app3 / app4"
    Write-Host "  apps ff white / ytm / ff black"
    Write-Host "  apps cmd"
    Write-Host "  apps cursor"
    Write-Host ""
    Write-Host "3-app layout:"
    Write-Host "  app3 = left half (full height)"
    Write-Host "  app1 = top-right, app2 = bottom-right"
    Write-Host ""
    Write-Host "Bind aliases:"
    Write-Host "  appbind"
    Write-Host "  appbind add app1 `"C:\Path\App.exe`" --args `"optional args`" --match `"Window title`""
    Write-Host "  appbind list"
}

. (Join-Path $PSScriptRoot "fox-browser.ps1")
function Resolve-FirefoxPath { Resolve-FoxBrowserPath }
function Get-FoxWindowMatch([string]$hint) {
    $base = "(?i)Zen Browser|Zen|Mozilla Firefox|Firefox"
    if ($hint) { return "(?i)$hint|$base" }
    return $base
}

function Resolve-CmdPath {
    $native = Join-Path $env:SystemRoot "System32\cmd.exe"
    if (Test-Path $native) { return $native }
    return "cmd"
}

function Resolve-CursorPath {
    if ($env:CURSOR_PATH -and (Test-Path $env:CURSOR_PATH)) {
        return $env:CURSOR_PATH
    }

    $candidates = @(
        "$env:LocalAppData\Programs\Cursor\Cursor.exe",
        "$env:LocalAppData\Cursor\Cursor.exe",
        "$env:ProgramFiles\Cursor\Cursor.exe",
        "$env:ProgramFiles(x86)\Cursor\Cursor.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    try {
        $cmd = Get-Command -Name "cursor" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cmd) {
            try { if ($cmd.Source) { return [string]$cmd.Source } } catch {}
            try { if ($cmd.Path) { return [string]$cmd.Path } } catch {}
            try { if ($cmd.Name) { return [string]$cmd.Name } } catch {}
        }
    } catch {}

    return $null
}

function Convert-ToCmdQuotedArg([string]$Arg) {
    if ($null -eq $Arg) { return '""' }
    if ($Arg -match '[\s"`|&<>^]') {
        return '"' + ($Arg -replace '"', '\"') + '"'
    }
    return $Arg
}

function Start-DetachedNoConsole {
    param(
        [string]$FilePath,
        [string[]]$ArgList
    )

    $exe = Convert-ToCmdQuotedArg $FilePath
    $argText = ""
    if ($ArgList -and $ArgList.Count -gt 0) {
        $argText = " " + (($ArgList | ForEach-Object { Convert-ToCmdQuotedArg ([string]$_) }) -join " ")
    }

    $payload = "start `"`" $exe$argText 1>nul 2>nul"
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $payload) -WindowStyle Hidden | Out-Null
}

function Ensure-AppGridNativeType {
    if ("FoxTerm.AppGridNativeV1" -as [type]) { return }

    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace FoxTerm {
    public class AppGridWindowInfo {
        public IntPtr Handle { get; set; }
        public string Title { get; set; }
        public int ProcessId { get; set; }
    }

    public static class AppGridNativeV1 {
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

        public const int SW_RESTORE = 9;

        public static List<AppGridWindowInfo> GetVisibleWindows() {
            var result = new List<AppGridWindowInfo>();
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
                result.Add(new AppGridWindowInfo {
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

function Get-VisibleWindows {
    return @([FoxTerm.AppGridNativeV1]::GetVisibleWindows())
}

function New-HandleSet {
    param([object[]]$Windows)
    $set = New-Object "System.Collections.Generic.HashSet[long]"
    foreach ($w in $Windows) {
        $null = $set.Add($w.Handle.ToInt64())
    }
    return $set
}

function Load-AppBindings {
    if (-not (Test-Path $bindingsPath)) { return @{} }
    try {
        $json = Get-Content -Path $bindingsPath -Raw -ErrorAction SilentlyContinue
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

function Get-Slots([string[]]$ArgsIn) {
    $raw = ($ArgsIn -join " ").Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }

    # Use slash with spaces as delimiter: app1 / app2 / app3
    $slots = @($raw -split '\s+/\s+' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($slots.Count -eq 1 -and $raw -match '/') {
        # Fallback for compact style: app1/app2/app3 (URLs with // are not recommended here)
        $slots = @($raw -split '/' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    return $slots
}

function Parse-SingleAppPlacement {
    param([string]$SlotText)

    $result = @{
        slot = $SlotText
        placement = $null
    }

    if ([string]::IsNullOrWhiteSpace($SlotText)) { return $result }

    # Avoid stealing trailing words from browser queries (ff/yt/ytm).
    $firstWord = (($SlotText -split '\s+') | Where-Object { $_ } | Select-Object -First 1)
    if (-not [string]::IsNullOrWhiteSpace($firstWord)) {
        if ($firstWord.ToLowerInvariant() -in @("ff","yt","youtube","ytm")) {
            return $result
        }
    }

    $tokens = @($SlotText -split '\s+' | Where-Object { $_ })
    if ($tokens.Count -lt 2) { return $result }

    $h = $null
    $v = $null
    $consume = 0
    for ($i = $tokens.Count - 1; $i -ge 0; $i--) {
        $t = $tokens[$i].ToLowerInvariant()
        if (($t -eq "left" -or $t -eq "right") -and -not $h) {
            $h = $t
            $consume++
            continue
        }
        if (($t -eq "top" -or $t -eq "up" -or $t -eq "down" -or $t -eq "bottom") -and -not $v) {
            if ($t -eq "up") { $t = "top" }
            if ($t -eq "bottom") { $t = "down" }
            $v = $t
            $consume++
            continue
        }
        break
    }

    if ($consume -le 0) { return $result }
    if ($tokens.Count - $consume -lt 1) { return $result }

    $baseTokens = @($tokens[0..($tokens.Count - $consume - 1)])
    $baseSlot = ($baseTokens -join " ").Trim()
    if ([string]::IsNullOrWhiteSpace($baseSlot)) { return $result }

    $result.slot = $baseSlot
    $result.placement = @{
        horizontal = $h
        vertical = $v
    }
    return $result
}

function Get-UrlForFfToken([string]$query) {
    if ([string]::IsNullOrWhiteSpace($query)) { return "https://www.youtube.com/" }

    $q = $query.Trim()
    if ($q -match '^(?i)open\s+(.+)$') { $q = $Matches[1].Trim() }

    if ($q -match '^https?://') { return $q }
    if ($q -match '^[^ ]+\.[^ ]+$') { return "https://$q" }

    $encoded = [uri]::EscapeDataString($q)
    return "https://www.google.com/search?q=$encoded"
}

function Test-UrlLike([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return $false }
    $v = $value.Trim()
    if ($v -match '^(?i)https?://') { return $true }
    if ($v -match '^[^\\\/\s]+\.[^\\\/\s]+') { return $true }
    return $false
}

function Normalize-Url([string]$value) {
    $v = $value.Trim()
    if ($v -match '^(?i)https?://') { return $v }
    return ("https://" + $v)
}

function Get-TitleHintFromUrl([string]$url) {
    try {
        $u = [Uri]$url
        $host = $u.Host
        if ($host -match '(?i)music\.youtube\.com') { return 'YouTube Music' }
        if ($host -match '(?i)(^|\.)youtube\.com$') { return '\bYouTube\b' }
        if ([string]::IsNullOrWhiteSpace($host)) { return $null }
        return [regex]::Escape(($host -replace '^www\.', ''))
    } catch {
        return $null
    }
}

function Resolve-SlotSpec {
    param(
        [string]$Token,
        [hashtable]$Bindings,
        [string]$FirefoxPath
    )

    $t = $Token.Trim()
    if ([string]::IsNullOrWhiteSpace($t)) { return $null }

    # 1) Bound app alias (exe-based)
    if ($Bindings.ContainsKey($t)) {
        $entry = $Bindings[$t]
        if ($entry -is [string]) {
            $strEntry = [string]$entry
            if (Test-UrlLike $strEntry) {
                $urlEntry = Normalize-Url $strEntry
                $hint = Get-TitleHintFromUrl $urlEntry
                return @{
                    label = $t
                    filePath = $FirefoxPath
                    argList = @("-new-window", $urlEntry)
                    matchRegex = Get-FoxWindowMatch $hint
                }
            }
            return @{
                label = $t
                filePath = $strEntry
                argList = @()
                matchRegex = [regex]::Escape($t)
            }
        }

        $exec = $null
        $argsText = ""
        $match = ""
        $url = ""
        try { $exec = [string]$entry.exec } catch {}
        try { $argsText = [string]$entry.args } catch {}
        try { $match = [string]$entry.match } catch {}
        try { $url = [string]$entry.url } catch {}

        if (-not [string]::IsNullOrWhiteSpace($url)) {
            $url = Normalize-Url $url
            if ([string]::IsNullOrWhiteSpace($match)) {
                $hint = Get-TitleHintFromUrl $url
                $match = Get-FoxWindowMatch $hint
            }
            return @{
                label = $t
                filePath = $FirefoxPath
                argList = @("-new-window", $url)
                matchRegex = $match
            }
        }

        if ([string]::IsNullOrWhiteSpace($exec)) {
            throw "Binding '$t' has no exec path. Re-create it with appbind."
        }

        $argList = @()
        if (-not [string]::IsNullOrWhiteSpace($argsText)) { $argList = @($argsText) }

        return @{
            label = $t
            filePath = $exec
            argList = $argList
            matchRegex = if ([string]::IsNullOrWhiteSpace($match)) { [regex]::Escape($t) } else { $match }
        }
    }

    # 2) Built-in browser shortcuts
    if ($t -match '^(?i)ytm(?:\s+(.+))?$') {
        $q = if ($Matches[1]) { $Matches[1].Trim() } else { "" }
        $url = if ([string]::IsNullOrWhiteSpace($q)) {
            "https://music.youtube.com/"
        } elseif ($q -match '^https?://') {
            $q
        } else {
            "https://music.youtube.com/search?q=$([uri]::EscapeDataString($q))"
        }
        return @{
            label = $t
            filePath = $FirefoxPath
            argList = @("-new-window", $url)
            matchRegex = "(?i)YouTube\s+Music"
        }
    }

    if ($t -match '^(?i)(youtube|yt)(?:\s+(.+))?$') {
        $q = if ($Matches[2]) { $Matches[2].Trim() } else { "" }
        $url = if ([string]::IsNullOrWhiteSpace($q)) {
            "https://www.youtube.com/"
        } elseif ($q -match '^https?://') {
            $q
        } else {
            "https://www.youtube.com/results?search_query=$([uri]::EscapeDataString($q))"
        }
        return @{
            label = $t
            filePath = $FirefoxPath
            argList = @("-new-window", $url)
            matchRegex = "(?i)\bYouTube\b"
        }
    }

    if ($t -match '^(?i)ff(?:\s+(.+))?$') {
        $q = if ($Matches[1]) { $Matches[1].Trim() } else { "" }
        $url = Get-UrlForFfToken $q
        $hint = Get-TitleHintFromUrl $url
        return @{
            label = $t
            filePath = $FirefoxPath
            argList = @("-new-window", $url)
            matchRegex = Get-FoxWindowMatch $hint
        }
    }

    # 2.5) Built-in desktop app shortcuts
    if ($t -match '^(?i)cmd(?:\s+(.+))?$') {
        $cmdTail = if ($Matches[1]) { $Matches[1].Trim() } else { "" }
        $args = @()
        if (-not [string]::IsNullOrWhiteSpace($cmdTail)) {
            $args = @("/k", $cmdTail)
        }
        return @{
            label = $t
            filePath = Resolve-CmdPath
            argList = $args
            matchRegex = "(?i)command prompt|cmd\.exe|foxterminal \(cmd\)"
            processName = "cmd"
        }
    }

    if ($t -match '^(?i)cursor(?:\s+(.+))?$') {
        $cursorPath = Resolve-CursorPath
        if ([string]::IsNullOrWhiteSpace($cursorPath)) {
            throw "Cursor executable not found. Install Cursor, add it to PATH, or set CURSOR_PATH."
        }
        $target = if ($Matches[1]) { $Matches[1].Trim() } else { "" }
        $args = @("--new-window")
        if (-not [string]::IsNullOrWhiteSpace($target)) { $args += $target }
        return @{
            label = $t
            filePath = $cursorPath
            argList = $args
            matchRegex = "(?i)\bcursor\b|visual\s+studio\s+code"
            processName = "Cursor"
            captureTimeoutMs = 25000
            detached = $true
        }
    }

    # 3) Direct exe path as token
    if (Test-Path -LiteralPath $t) {
        return @{
            label = $t
            filePath = $t
            argList = @()
            matchRegex = $null
        }
    }

    throw "Unknown app token: '$t'. Bind it via appbind, or use ff/yt/ytm."
}

function Start-SlotSpec {
    param(
        [hashtable]$Spec
    )

    try {
        $isDetached = $false
        if ($Spec.ContainsKey("detached")) {
            try { $isDetached = [bool]$Spec.detached } catch { $isDetached = $false }
        }

        if ($isDetached) {
            Start-DetachedNoConsole -FilePath $Spec.filePath -ArgList $Spec.argList
        } else {
            Start-Process -FilePath $Spec.filePath -ArgumentList $Spec.argList | Out-Null
        }
        return $true
    } catch {
        Write-Host ("Failed to start [" + $Spec.label + "]: " + $_.Exception.Message)
        return $false
    }
}

function Pick-WindowForSpec {
    param(
        [hashtable]$Spec,
        [System.Collections.Generic.HashSet[long]]$KnownHandles,
        [System.Collections.Generic.HashSet[long]]$UsedHandles,
        [int]$TimeoutMs = 9000
    )

    $started = Get-Date
    while (((Get-Date) - $started).TotalMilliseconds -lt $TimeoutMs) {
        $wins = Get-VisibleWindows
        $cands = @(
            $wins | Where-Object {
                (-not $KnownHandles.Contains($_.Handle.ToInt64())) -and
                (-not $UsedHandles.Contains($_.Handle.ToInt64()))
            }
        )
        if ($cands.Count -gt 0) {
            if ($Spec.matchRegex) {
                $m = @($cands | Where-Object { $_.Title -match $Spec.matchRegex } | Select-Object -First 1)
                if ($m.Count -gt 0) { return $m[0] }
            } else {
                return ($cands | Select-Object -First 1)
            }
        }
        Start-Sleep -Milliseconds 150
    }

    # Fallback: try any visible window that matches and is not already used.
    $all = Get-VisibleWindows
    if ($Spec.matchRegex) {
        $m2 = @(
            $all | Where-Object {
                (-not $UsedHandles.Contains($_.Handle.ToInt64())) -and
                $_.Title -match $Spec.matchRegex
            } | Select-Object -First 1
        )
        if ($m2.Count -gt 0) { return $m2[0] }
    }

    # Process-based fallback (useful when title does not contain expected text yet).
    if ($Spec.ContainsKey("processName") -and -not [string]::IsNullOrWhiteSpace([string]$Spec.processName)) {
        $pids = @(
            Get-Process -Name ([string]$Spec.processName) -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty Id
        )
        if ($pids.Count -gt 0) {
            $byProc = @(
                $all | Where-Object {
                    ($pids -contains $_.ProcessId) -and
                    (-not $UsedHandles.Contains($_.Handle.ToInt64()))
                }
            )
            if ($byProc.Count -gt 0) {
                if ($Spec.matchRegex) {
                    $byProcMatch = @($byProc | Where-Object { $_.Title -match $Spec.matchRegex } | Select-Object -First 1)
                    if ($byProcMatch.Count -gt 0) { return $byProcMatch[0] }
                }
                return ($byProc | Select-Object -First 1)
            }
        }
    }

    return $null
}

function Move-WindowRect {
    param(
        [IntPtr]$Handle,
        [int]$X,
        [int]$Y,
        [int]$W,
        [int]$H
    )

    [FoxTerm.AppGridNativeV1]::ShowWindow($Handle, [FoxTerm.AppGridNativeV1]::SW_RESTORE) | Out-Null
    [FoxTerm.AppGridNativeV1]::MoveWindow($Handle, $X, $Y, $W, $H, $true) | Out-Null
}

function Get-LayoutRects {
    param(
        [int]$Count,
        [System.Drawing.Rectangle]$Area
    )

    $halfW = [int][Math]::Floor($Area.Width / 2)
    $rightW = [int]($Area.Width - $halfW)
    $halfH = [int][Math]::Floor($Area.Height / 2)
    $bottomH = [int]($Area.Height - $halfH)

    $r = @{}
    switch ($Count) {
        1 {
            $r[1] = @{ x = $Area.X; y = $Area.Y; w = $Area.Width; h = $Area.Height }
        }
        2 {
            $r[1] = @{ x = $Area.X; y = $Area.Y; w = $halfW; h = $Area.Height }
            $r[2] = @{ x = $Area.X + $halfW; y = $Area.Y; w = $rightW; h = $Area.Height }
        }
        3 {
            # Requested layout:
            # app3 -> left half full height
            # app1 -> right top
            # app2 -> right bottom
            $r[3] = @{ x = $Area.X; y = $Area.Y; w = $halfW; h = $Area.Height }
            $r[1] = @{ x = $Area.X + $halfW; y = $Area.Y; w = $rightW; h = $halfH }
            $r[2] = @{ x = $Area.X + $halfW; y = $Area.Y + $halfH; w = $rightW; h = $bottomH }
        }
        default {
            # 4 apps:
            # app1 left-top, app2 left-bottom, app3 right-top, app4 right-bottom
            $r[1] = @{ x = $Area.X; y = $Area.Y; w = $halfW; h = $halfH }
            $r[2] = @{ x = $Area.X; y = $Area.Y + $halfH; w = $halfW; h = $bottomH }
            $r[3] = @{ x = $Area.X + $halfW; y = $Area.Y; w = $rightW; h = $halfH }
            $r[4] = @{ x = $Area.X + $halfW; y = $Area.Y + $halfH; w = $rightW; h = $bottomH }
        }
    }
    return $r
}

function Get-SingleAppRect {
    param(
        [System.Drawing.Rectangle]$Area,
        [hashtable]$Placement
    )

    if ($null -eq $Placement) {
        return @{ x = $Area.X; y = $Area.Y; w = $Area.Width; h = $Area.Height }
    }

    $h = $null
    $v = $null
    try { $h = [string]$Placement.horizontal } catch {}
    try { $v = [string]$Placement.vertical } catch {}

    if ([string]::IsNullOrWhiteSpace($h) -and [string]::IsNullOrWhiteSpace($v)) {
        return @{ x = $Area.X; y = $Area.Y; w = $Area.Width; h = $Area.Height }
    }

    $halfW = [int][Math]::Floor($Area.Width / 2)
    $rightW = [int]($Area.Width - $halfW)
    $halfH = [int][Math]::Floor($Area.Height / 2)
    $bottomH = [int]($Area.Height - $halfH)

    if (-not [string]::IsNullOrWhiteSpace($h) -and -not [string]::IsNullOrWhiteSpace($v)) {
        $x = if ($h -eq "right") { $Area.X + $halfW } else { $Area.X }
        $y = if ($v -eq "down") { $Area.Y + $halfH } else { $Area.Y }
        $w = if ($h -eq "right") { $rightW } else { $halfW }
        $hh = if ($v -eq "down") { $bottomH } else { $halfH }
        return @{ x = $x; y = $y; w = $w; h = $hh }
    }

    if (-not [string]::IsNullOrWhiteSpace($h)) {
        if ($h -eq "right") {
            return @{ x = $Area.X + $halfW; y = $Area.Y; w = $rightW; h = $Area.Height }
        }
        return @{ x = $Area.X; y = $Area.Y; w = $halfW; h = $Area.Height }
    }

    if ($v -eq "down") {
        return @{ x = $Area.X; y = $Area.Y + $halfH; w = $Area.Width; h = $bottomH }
    }
    return @{ x = $Area.X; y = $Area.Y; w = $Area.Width; h = $halfH }
}

Ensure-AppGridNativeType
Add-Type -AssemblyName System.Windows.Forms

$slots = @(Get-Slots $CmdArgs)
if ($slots.Count -lt 1 -or $slots.Count -gt 4) {
    Show-Usage
    exit 1
}

$singlePlacement = $null
if ($slots.Count -eq 1) {
    $parsedSingle = Parse-SingleAppPlacement -SlotText $slots[0]
    $slots[0] = [string]$parsedSingle.slot
    $singlePlacement = $parsedSingle.placement
}

$firefox = Resolve-FirefoxPath
$bindings = Load-AppBindings
$specs = @()

try {
    foreach ($slot in $slots) {
        $specs += @(Resolve-SlotSpec -Token $slot -Bindings $bindings -FirefoxPath $firefox)
    }
} catch {
    Write-Host $_.Exception.Message
    Write-Host "Tip: use appbind to bind app aliases."
    exit 1
}

if ($DryRun) {
    Write-Host "Dry run:"
    for ($i = 0; $i -lt $specs.Count; $i++) {
        $s = $specs[$i]
        Write-Host ("  app{0}: {1} -> {2} {3}" -f ($i + 1), $s.label, $s.filePath, (($s.argList -join " ").Trim()))
    }
    exit 0
}

# Fast path for single app token:
# launch and return immediately (no window capture/layout wait loops).
if ($specs.Count -eq 1 -and $null -eq $singlePlacement) {
    $okSingle = Start-SlotSpec -Spec $specs[0]
    if ($okSingle) { exit 0 } else { exit 1 }
}

$usedHandles = New-Object "System.Collections.Generic.HashSet[long]"
$slotWindows = @{}

for ($i = 0; $i -lt $specs.Count; $i++) {
    $spec = $specs[$i]
    $slotIndex = $i + 1

    $before = Get-VisibleWindows
    $known = New-HandleSet $before

    $ok = Start-SlotSpec -Spec $spec
    if (-not $ok) { continue }

    $captureTimeoutMs = 9000
    if ($spec.ContainsKey("captureTimeoutMs")) {
        try {
            $tmpTimeout = [int]$spec.captureTimeoutMs
            if ($tmpTimeout -gt 0) { $captureTimeoutMs = $tmpTimeout }
        } catch {}
    }

    $picked = Pick-WindowForSpec -Spec $spec -KnownHandles $known -UsedHandles $usedHandles -TimeoutMs $captureTimeoutMs
    if ($null -eq $picked) {
        Write-Host ("Could not capture window for app" + $slotIndex + " (" + $spec.label + ")")
        continue
    }

    $slotWindows[$slotIndex] = $picked
    $null = $usedHandles.Add($picked.Handle.ToInt64())
}

if ($slotWindows.Count -ne $specs.Count) {
    Write-Host "Not all app windows were captured; layout cancelled."
    exit 1
}

$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$rects = $null
if ($specs.Count -eq 1 -and $null -ne $singlePlacement) {
    $rects = @{ 1 = (Get-SingleAppRect -Area $area -Placement $singlePlacement) }
} else {
    $rects = Get-LayoutRects -Count $specs.Count -Area $area
}

foreach ($k in $rects.Keys) {
    $win = $slotWindows[$k]
    $r = $rects[$k]
    Move-WindowRect -Handle $win.Handle -X $r.x -Y $r.y -W $r.w -H $r.h
}

# Keep app1 on top after arranging.
if ($slotWindows.ContainsKey(1)) {
    [FoxTerm.AppGridNativeV1]::SetForegroundWindow($slotWindows[1].Handle) | Out-Null
}

Write-Host ("Done: arranged " + $specs.Count + " app window(s).")
