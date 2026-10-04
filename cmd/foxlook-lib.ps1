# FoxOS look: the Windows chrome FoxOS owns while the look is on.
# Parts (all per-user, no admin): dark, icons, taskbar, sounds, cursors, lockscreen, winkeys.
# Admin part, asked once: oem (Settings > About shows FoxOS). Optional: winlock (Win+L -> Fox lock).
# First apply of every part snapshots the Windows value; foxlook off puts it back and drops the snapshot.
# Loaded after foxos-lib.ps1 (uses Get-FoxOsDir, Get-RegDword, Set-FoxOsRegDword, Broadcast-FoxOsChange, FoxOsWall).

$script:FoxLookParts = @("dark", "icons", "taskbar", "sounds", "cursors", "lockscreen", "winkeys", "oem")
$script:FoxLookOptional = @("winlock", "shell")

function Get-FoxLookDir { return (Get-FoxOsDir) }
function Get-FoxLookBackupPath { return (Join-Path (Get-FoxLookDir) "look-backup.json") }
function Get-FoxLookOemBackupPath { return (Join-Path (Get-FoxLookDir) "look-oem-backup.json") }
function Get-FoxLookStatePath { return (Join-Path (Get-FoxLookDir) "look.json") }
function Get-FoxLookWinKeysPath { return (Join-Path (Get-FoxLookDir) "winkeys.txt") }

function Write-FoxLookJson([string]$path, $obj) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 8), $utf8)
}

function Read-FoxLookJson([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8 -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return ($raw | ConvertFrom-Json)
    } catch { return $null }
}

# ---- state -----------------------------------------------------------------

function Read-FoxLookState {
    $s = @{
        on = $false; parts = @{}; wall = "overlay"; lockKey = ""
        cursor = "neon"; cursorScale = 2; cursorKey = ""
        dockStyle = "pill"; dockPos = "bottom"; dockSize = "normal"
        dockHide = $false; dockWins = "titles"; dockTray = "full"
        dockWidgets = $true; dockHome = $true
    }
    $j = Read-FoxLookJson (Get-FoxLookStatePath)
    if ($j) {
        if ($null -ne $j.on) { $s.on = [bool]$j.on }
        if ($j.wall -in @("overlay", "behind")) { $s.wall = [string]$j.wall }
        if ($j.lockKey) { $s.lockKey = [string]$j.lockKey }
        if ($j.cursor) { $s.cursor = [string]$j.cursor }
        if ($j.cursorScale) { $s.cursorScale = [int]$j.cursorScale }
        if ($j.cursorKey) { $s.cursorKey = [string]$j.cursorKey }
        if ($j.dockStyle -in @("rail", "pill", "glass", "slim")) { $s.dockStyle = [string]$j.dockStyle }
        if ($j.dockPos -in @("top", "bottom")) { $s.dockPos = [string]$j.dockPos }
        if ($j.dockSize -in @("compact", "normal", "large")) { $s.dockSize = [string]$j.dockSize }
        if ($null -ne $j.dockHide) { $s.dockHide = [bool]$j.dockHide }
        if ($j.dockWins -in @("titles", "dots", "off")) { $s.dockWins = [string]$j.dockWins }
        if ($j.dockTray -in @("full", "clock", "off")) { $s.dockTray = [string]$j.dockTray }
        if ($null -ne $j.dockWidgets) { $s.dockWidgets = [bool]$j.dockWidgets }
        if ($null -ne $j.dockHome) { $s.dockHome = [bool]$j.dockHome }
        if ($j.parts) {
            foreach ($p in $j.parts.PSObject.Properties) { $s.parts[$p.Name] = [bool]$p.Value }
        }
    }
    return $s
}

function Write-FoxLookState($s) {
    Write-FoxLookJson (Get-FoxLookStatePath) ([ordered]@{
        on          = [bool]$s.on
        parts       = $s.parts
        wall        = $s.wall
        lockKey     = $s.lockKey
        cursor      = $s.cursor
        cursorScale = [int]$s.cursorScale
        cursorKey   = $s.cursorKey
        dockStyle   = $s.dockStyle
        dockPos     = $s.dockPos
        dockSize    = $s.dockSize
        dockHide    = [bool]$s.dockHide
        dockWins    = $s.dockWins
        dockTray    = $s.dockTray
        dockWidgets = [bool]$(if ($null -ne $s.dockWidgets) { $s.dockWidgets } else { $true })
        dockHome    = [bool]$(if ($null -ne $s.dockHome) { $s.dockHome } else { $true })
    })
    if (Get-Command Save-FoxUserWorld -ErrorAction SilentlyContinue) {
        try { Save-FoxUserWorld } catch {}
    }
}

function Test-FoxLookEnabled { return [bool](Read-FoxLookState).on }
function Get-FoxLookWall { return (Read-FoxLookState).wall }

function Test-FoxLookPart([string]$part) {
    $s = Read-FoxLookState
    return ($s.parts.ContainsKey($part) -and [bool]$s.parts[$part])
}

# ---- backup ----------------------------------------------------------------

function Read-FoxLookBackup {
    $b = Read-FoxLookJson (Get-FoxLookBackupPath)
    if ($b) { return $b }
    return (New-Object PSObject)
}

function Get-FoxLookBackupValue([string]$key) {
    $b = Read-FoxLookBackup
    $p = $b.PSObject.Properties[$key]
    if ($p) { return $p.Value }
    return $null
}

function Test-FoxLookBackupHas([string]$key) {
    return [bool]((Read-FoxLookBackup).PSObject.Properties[$key])
}

function Save-FoxLookBackupValue([string]$key, $value) {
    $b = Read-FoxLookBackup
    if ($b.PSObject.Properties[$key]) { return }
    $b | Add-Member -NotePropertyName $key -NotePropertyValue $value -Force
    Write-FoxLookJson (Get-FoxLookBackupPath) $b
}

function Remove-FoxLookBackupValue([string[]]$keys) {
    $b = Read-FoxLookBackup
    $changed = $false
    foreach ($k in $keys) {
        if ($b.PSObject.Properties[$k]) { $b.PSObject.Properties.Remove($k); $changed = $true }
    }
    if ($changed) { Write-FoxLookJson (Get-FoxLookBackupPath) $b }
}

function Get-RegString([string]$path, [string]$name) {
    try {
        $v = (Get-ItemProperty -Path $path -Name $name -ErrorAction Stop).$name
        if ($null -eq $v) { return $null }
        return [string]$v
    } catch { return $null }
}

function Get-RegDefault([string]$path) {
    try {
        $v = (Get-ItemProperty -Path $path -ErrorAction Stop).'(default)'
        if ($null -eq $v) { return $null }
        return [string]$v
    } catch { return $null }
}

# ---- native ----------------------------------------------------------------

function Ensure-FoxLookNative {
    if ("FoxLookNative" -as [type]) { return $true }
    try {
        Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FoxLookNative {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] public struct APPBARDATA {
        public uint cbSize; public IntPtr hWnd; public uint uCallbackMessage; public uint uEdge; public RECT rc; public int lParam;
    }
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("shell32.dll")] static extern UIntPtr SHAppBarMessage(uint msg, ref APPBARDATA data);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern IntPtr FindWindow(string cls, string name);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern int SystemParametersInfo(int a, int b, IntPtr c, int d);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);

    static APPBARDATA Bar() {
        var d = new APPBARDATA();
        d.cbSize = (uint)Marshal.SizeOf(typeof(APPBARDATA));
        d.hWnd = FindWindow("Shell_TrayWnd", null);
        return d;
    }
    public static int GetTaskbarState() {
        var d = Bar();
        return (int)SHAppBarMessage(4, ref d).ToUInt64();
    }
    public static void SetTaskbarState(int state) {
        var d = Bar();
        d.lParam = state;
        SHAppBarMessage(10, ref d);
    }
    static void SetBarVis(IntPtr h, bool show) {
        if (h != IntPtr.Zero) ShowWindow(h, show ? 5 : 0);
    }
    public static void HideTaskbars() {
        SetBarVis(FindWindow("Shell_TrayWnd", null), false);
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            var sb = new StringBuilder(40);
            GetClassName(h, sb, 40);
            string c = sb.ToString();
            if (c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") SetBarVis(h, false);
            return true;
        }, IntPtr.Zero);
    }
    public static void ShowTaskbars() {
        SetBarVis(FindWindow("Shell_TrayWnd", null), true);
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            var sb = new StringBuilder(40);
            GetClassName(h, sb, 40);
            string c = sb.ToString();
            if (c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") SetBarVis(h, true);
            return true;
        }, IntPtr.Zero);
    }
    public static IntPtr FindDefView() {
        IntPtr progman = FindWindow("Progman", null);
        IntPtr def = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (def != IntPtr.Zero) return def;
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            var sb = new StringBuilder(64);
            GetClassName(h, sb, 64);
            if (sb.ToString() != "WorkerW") return true;
            IntPtr d = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (d != IntPtr.Zero) { found = d; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static bool ToggleDesktopIcons() {
        IntPtr def = FindDefView();
        if (def == IntPtr.Zero) return false;
        SendMessage(def, 0x0111, new IntPtr(0x7402), IntPtr.Zero);
        return true;
    }
    public static void ReloadCursors() {
        SystemParametersInfo(0x0057, 0, IntPtr.Zero, 0x03);
    }
}
"@
        return $true
    } catch { return $false }
}

# ---- dark ------------------------------------------------------------------

$script:FoxLookPersonalize = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"

function Apply-FoxLookDark {
    Save-FoxLookBackupValue "appsLight" (Get-RegDword $script:FoxLookPersonalize "AppsUseLightTheme")
    Save-FoxLookBackupValue "systemLight" (Get-RegDword $script:FoxLookPersonalize "SystemUsesLightTheme")
    $changed = ((Get-RegDword $script:FoxLookPersonalize "AppsUseLightTheme") -ne 0) -or
               ((Get-RegDword $script:FoxLookPersonalize "SystemUsesLightTheme") -ne 0)
    Set-FoxOsRegDword $script:FoxLookPersonalize "AppsUseLightTheme" 0
    Set-FoxOsRegDword $script:FoxLookPersonalize "SystemUsesLightTheme" 0
    if ($changed -and (Get-Command Broadcast-FoxOsChange -ErrorAction SilentlyContinue)) { Broadcast-FoxOsChange }
    return $true
}

function Restore-FoxLookDark {
    $apps = Get-FoxLookBackupValue "appsLight"
    $sys = Get-FoxLookBackupValue "systemLight"
    Set-FoxOsRegDword $script:FoxLookPersonalize "AppsUseLightTheme" $(if ($null -eq $apps) { 1 } else { $apps })
    Set-FoxOsRegDword $script:FoxLookPersonalize "SystemUsesLightTheme" $(if ($null -eq $sys) { 1 } else { $sys })
    if (Get-Command Broadcast-FoxOsChange -ErrorAction SilentlyContinue) { Broadcast-FoxOsChange }
    Remove-FoxLookBackupValue @("appsLight", "systemLight")
}

# ---- icons -----------------------------------------------------------------

$script:FoxLookAdvanced = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"

function Set-FoxLookDesktopIcons([bool]$hidden) {
    $want = if ($hidden) { 1 } else { 0 }
    $cur = Get-RegDword $script:FoxLookAdvanced "HideIcons"
    if ($null -eq $cur) { $cur = 0 }
    if ($cur -eq $want) { return $true }
    # Explorer's own "Show desktop icons" toggle: instant, and Explorer writes HideIcons itself.
    if ((Ensure-FoxLookNative) -and [FoxLookNative]::ToggleDesktopIcons()) {
        Start-Sleep -Milliseconds 400
        $after = Get-RegDword $script:FoxLookAdvanced "HideIcons"
        if ($after -eq $want) { return $true }
    }
    Set-FoxOsRegDword $script:FoxLookAdvanced "HideIcons" $want
    return $false
}

function Apply-FoxLookIcons {
    Save-FoxLookBackupValue "hideIcons" (Get-RegDword $script:FoxLookAdvanced "HideIcons")
    return (Set-FoxLookDesktopIcons $true)
}

function Restore-FoxLookIcons {
    $v = Get-FoxLookBackupValue "hideIcons"
    Set-FoxLookDesktopIcons ($null -ne $v -and [int]$v -eq 1) | Out-Null
    Remove-FoxLookBackupValue @("hideIcons")
}

# ---- taskbar ---------------------------------------------------------------

function Apply-FoxLookTaskbar {
    if (-not (Ensure-FoxLookNative)) { return $false }
    $cur = [FoxLookNative]::GetTaskbarState()
    Save-FoxLookBackupValue "taskbarState" $cur
    if (($cur -band 1) -eq 0) { [FoxLookNative]::SetTaskbarState(1) }
    # Hard-hide only when FoxOS shell/dock owns the bar. Otherwise autohide
    # alone — ShowWindow(0) left users with no taskbar when shell was off.
    $shellOn = $false
    try {
        $s = Read-FoxLookState
        if ($s.parts.ContainsKey("shell") -and [bool]$s.parts["shell"]) { $shellOn = $true }
    } catch {}
    if ($shellOn) {
        try { [FoxLookNative]::HideTaskbars() } catch {}
    } else {
        try { [FoxLookNative]::ShowTaskbars() } catch {}
    }
    return $true
}

function Restore-FoxLookTaskbar {
    if (Ensure-FoxLookNative) {
        $v = Get-FoxLookBackupValue "taskbarState"
        [FoxLookNative]::SetTaskbarState($(if ($null -eq $v) { 0 } else { [int]$v }))
        try { [FoxLookNative]::ShowTaskbars() } catch {}
    }
    Remove-FoxLookBackupValue @("taskbarState")
}

# ---- sounds ----------------------------------------------------------------

function Get-FoxLookSoundEventKeys {
    $apps = "HKCU:\AppEvents\Schemes\Apps"
    if (-not (Test-Path $apps)) { return @() }
    $keys = @()
    Get-ChildItem -Path $apps -ErrorAction SilentlyContinue | ForEach-Object {
        Get-ChildItem -Path $_.PSPath -ErrorAction SilentlyContinue | ForEach-Object {
            $cur = Join-Path $_.PSPath ".Current"
            if (Test-Path $cur) { $keys += $cur }
        }
    }
    return $keys
}

function Apply-FoxLookSounds {
    $schemes = "HKCU:\AppEvents\Schemes"
    Save-FoxLookBackupValue "soundScheme" (Get-RegDefault $schemes)
    if (-not (Test-FoxLookBackupHas "soundEvents")) {
        $snap = [ordered]@{}
        foreach ($k in (Get-FoxLookSoundEventKeys)) {
            $rel = ($k -replace '^.*?\\AppEvents\\Schemes\\Apps\\', '')
            $v = Get-RegDefault $k
            $snap[$rel] = $(if ($null -eq $v) { "" } else { $v })
        }
        Save-FoxLookBackupValue "soundEvents" $snap
    }
    foreach ($k in (Get-FoxLookSoundEventKeys)) {
        try { Set-ItemProperty -Path $k -Name "(default)" -Value "" -ErrorAction Stop } catch {}
    }
    try { Set-ItemProperty -Path $schemes -Name "(default)" -Value ".None" -ErrorAction Stop } catch {}
    return $true
}

function Restore-FoxLookSounds {
    $schemes = "HKCU:\AppEvents\Schemes"
    $events = Get-FoxLookBackupValue "soundEvents"
    if ($events) {
        foreach ($p in $events.PSObject.Properties) {
            $k = Join-Path "HKCU:\AppEvents\Schemes\Apps" $p.Name
            if (Test-Path $k) {
                try { Set-ItemProperty -Path $k -Name "(default)" -Value ([string]$p.Value) -ErrorAction Stop } catch {}
            }
        }
    }
    $scheme = Get-FoxLookBackupValue "soundScheme"
    if ($null -ne $scheme) {
        try { Set-ItemProperty -Path $schemes -Name "(default)" -Value ([string]$scheme) -ErrorAction Stop } catch {}
    }
    Remove-FoxLookBackupValue @("soundScheme", "soundEvents")
}

# ---- cursors ---------------------------------------------------------------

$script:FoxLookCursorNames = @(
    "Arrow", "Help", "AppStarting", "Wait", "Crosshair", "IBeam", "NWPen", "No",
    "SizeNS", "SizeWE", "SizeNWSE", "SizeNESW", "SizeAll", "UpArrow", "Hand"
)

function Get-FoxLookCursorScheme {
    $key = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Control Panel\Cursors\Schemes"
    foreach ($name in @("Windows Inverted (large)", "Windows Inverted", "Windows Black (large)", "Windows Black")) {
        $v = Get-RegString $key $name
        if (-not [string]::IsNullOrWhiteSpace($v)) { return @{ Name = $name; Files = $v.Split(",") } }
    }
    return $null
}

function Save-FoxLookCursorBackup {
    if (Test-FoxLookBackupHas "cursors") { return }
    $snap = @()
    try {
        $rk = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Control Panel\Cursors", $false)
        if ($rk) {
            foreach ($n in $rk.GetValueNames()) {
                $kind = $rk.GetValueKind($n).ToString()
                if ($kind -notin @("String", "ExpandString", "DWord")) { continue }
                $v = $rk.GetValue($n, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
                $snap += [ordered]@{ name = $(if ($n -eq "") { "(default)" } else { $n }); kind = $kind; value = $v }
            }
            $rk.Close()
        }
    } catch {}
    Save-FoxLookBackupValue "cursors" $snap
}

# FoxOS pixel cursors (foxcursor-lib): style + scale from look.json, colours from the theme.
# Regenerated when the theme changes (Sync-FoxOsSkin); "inverted" falls back to the Windows scheme.
function Apply-FoxLookCursors {
    param([switch]$Force)
    $s = Read-FoxLookState
    if ($s.cursor -eq "inverted" -or -not (Get-Command New-FoxCursorSet -ErrorAction SilentlyContinue)) {
        return (Apply-FoxLookCursorsInverted)
    }
    $theme = Get-FoxOsThemeName
    $key = $s.cursor + "-" + $theme + "-x" + $s.cursorScale
    if (-not $Force -and $s.cursorKey -eq $key -and (Test-FoxLookPart "cursors")) { return $true }
    Save-FoxLookCursorBackup
    $files = New-FoxCursorSet -Style $s.cursor -Scale $s.cursorScale -Theme $theme
    if (-not $files) { return $false }
    try {
        $rk = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Control Panel\Cursors")
        $rk.SetValue("", "FoxOS " + $s.cursor, [Microsoft.Win32.RegistryValueKind]::String)
        $rk.SetValue("Scheme Source", 1, [Microsoft.Win32.RegistryValueKind]::DWord)
        foreach ($name in $script:FoxLookCursorNames) {
            if ($files.Contains($name)) {
                $rk.SetValue($name, [string]$files[$name], [Microsoft.Win32.RegistryValueKind]::String)
            } else {
                try { $rk.DeleteValue($name, $false) } catch {}
            }
        }
        $rk.Close()
    } catch { return $false }
    if (Ensure-FoxLookNative) { [FoxLookNative]::ReloadCursors() }
    $s = Read-FoxLookState
    $s.cursorKey = $key
    Write-FoxLookState $s
    return $true
}

function Set-FoxLookCursorStyle([string]$style, [int]$scale) {
    $allowed = @("inverted") + $(if ($script:FoxCursorStyles) { $script:FoxCursorStyles } else { @("pixel", "chunky", "neon", "fox") })
    if ($style -notin $allowed) { return $false }
    $s = Read-FoxLookState
    $s.cursor = $style
    if ($scale -ge 1 -and $scale -le 3) { $s.cursorScale = $scale }
    Write-FoxLookState $s
    if (Test-FoxLookPart "cursors") {
        if ($style -eq "inverted") { Restore-FoxLookCursors }
        return (Set-FoxLookPart -Part "cursors" -On $true)
    }
    return $true
}

function Apply-FoxLookCursorsInverted {
    $scheme = Get-FoxLookCursorScheme
    if (-not $scheme) { return $false }
    if (-not (Test-FoxLookBackupHas "cursors")) {
        $snap = @()
        try {
            $rk = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Control Panel\Cursors", $false)
            if ($rk) {
                foreach ($n in $rk.GetValueNames()) {
                    $kind = $rk.GetValueKind($n).ToString()
                    if ($kind -notin @("String", "ExpandString", "DWord")) { continue }
                    $v = $rk.GetValue($n, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
                    $snap += [ordered]@{ name = $(if ($n -eq "") { "(default)" } else { $n }); kind = $kind; value = $v }
                }
                $rk.Close()
            }
        } catch {}
        Save-FoxLookBackupValue "cursors" $snap
    }
    try {
        $rk = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Control Panel\Cursors")
        $rk.SetValue("", "FoxOS " + $scheme.Name, [Microsoft.Win32.RegistryValueKind]::String)
        $rk.SetValue("Scheme Source", 2, [Microsoft.Win32.RegistryValueKind]::DWord)
        for ($i = 0; $i -lt $script:FoxLookCursorNames.Count; $i++) {
            $name = $script:FoxLookCursorNames[$i]
            $file = if ($i -lt $scheme.Files.Count) { $scheme.Files[$i].Trim() } else { "" }
            if ($file) {
                $rk.SetValue($name, $file, [Microsoft.Win32.RegistryValueKind]::ExpandString)
            } else {
                try { $rk.DeleteValue($name, $false) } catch {}
            }
        }
        $rk.Close()
    } catch { return $false }
    if (Ensure-FoxLookNative) { [FoxLookNative]::ReloadCursors() }
    return $true
}

function Restore-FoxLookCursors {
    $snap = Get-FoxLookBackupValue "cursors"
    try {
        $rk = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Control Panel\Cursors")
        foreach ($name in ($script:FoxLookCursorNames + @("", "Scheme Source"))) {
            try { $rk.DeleteValue($name, $false) } catch {}
        }
        if ($snap) {
            foreach ($e in @($snap)) {
                $name = if ([string]$e.name -eq "(default)") { "" } else { [string]$e.name }
                $kind = [Microsoft.Win32.RegistryValueKind]::String
                if ([string]$e.kind -eq "ExpandString") { $kind = [Microsoft.Win32.RegistryValueKind]::ExpandString }
                if ([string]$e.kind -eq "DWord") { $kind = [Microsoft.Win32.RegistryValueKind]::DWord }
                $val = if ($kind -eq [Microsoft.Win32.RegistryValueKind]::DWord) { [int]$e.value } else { [string]$e.value }
                $rk.SetValue($name, $val, $kind)
            }
        }
        $rk.Close()
    } catch {}
    if (Ensure-FoxLookNative) { [FoxLookNative]::ReloadCursors() }
    Remove-FoxLookBackupValue @("cursors")
    $s = Read-FoxLookState
    $s.cursorKey = ""
    Write-FoxLookState $s
}

# ---- lock screen -----------------------------------------------------------

$script:FoxLookCdm = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"

function Test-FoxLookWinRt {
    return ($null -eq $PSVersionTable.PSEdition -or $PSVersionTable.PSEdition -eq "Desktop")
}

function Invoke-FoxLookAwait($op, $resultType) {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
    $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1
    }
    if ($resultType) {
        $m = ($methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
        $t = $m.MakeGenericMethod($resultType).Invoke($null, @($op))
        $t.Wait(-1) | Out-Null
        return $t.Result
    }
    $m = ($methods | Where-Object { $_.GetParameters()[0].ParameterType.Name -eq "IAsyncAction" })[0]
    $t = $m.Invoke($null, @($op))
    $t.Wait(-1) | Out-Null
}

function Set-FoxLookLockImage([string]$path) {
    if (-not (Test-FoxLookWinRt)) { return $false }
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    try {
        $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
        $null = [Windows.System.UserProfile.LockScreen, Windows.System.UserProfile, ContentType = WindowsRuntime]
        $file = Invoke-FoxLookAwait ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
        Invoke-FoxLookAwait ([Windows.System.UserProfile.LockScreen]::SetImageFileAsync($file)) $null
        return $true
    } catch { return $false }
}

function Save-FoxLookLockOriginal {
    if (Test-FoxLookBackupHas "lockImage") { return }
    $dest = ""
    if (Test-FoxLookWinRt) {
        try {
            $null = [Windows.System.UserProfile.LockScreen, Windows.System.UserProfile, ContentType = WindowsRuntime]
            $uri = [Windows.System.UserProfile.LockScreen]::OriginalImageFile
            if ($uri -and $uri.IsFile -and (Test-Path -LiteralPath $uri.LocalPath)) {
                Save-FoxLookBackupValue "lockImageSource" $uri.LocalPath
                $ext = [System.IO.Path]::GetExtension($uri.LocalPath)
                if ([string]::IsNullOrWhiteSpace($ext)) { $ext = ".jpg" }
                $dest = Join-Path (Get-FoxLookDir) ("lock-original" + $ext)
                Copy-Item -LiteralPath $uri.LocalPath -Destination $dest -Force
            } else {
                $s = [Windows.System.UserProfile.LockScreen]::GetImageStream()
                if ($s) {
                    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
                    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($s)
                    $ms = New-Object System.IO.MemoryStream
                    $net.CopyTo($ms)
                    $bytes = $ms.ToArray()
                    $ext = if ($bytes.Length -gt 4 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { ".png" } else { ".jpg" }
                    $dest = Join-Path (Get-FoxLookDir) ("lock-original" + $ext)
                    [System.IO.File]::WriteAllBytes($dest, $bytes)
                }
            }
        } catch { $dest = "" }
    }
    Save-FoxLookBackupValue "lockImage" $dest
}

function ConvertFrom-FoxLookHex([string]$hex) {
    $h = $hex.TrimStart("#")
    if ($h.Length -ne 6) { $h = "0B0F1A" }
    return @{
        r = [Convert]::ToInt32($h.Substring(0, 2), 16)
        g = [Convert]::ToInt32($h.Substring(2, 2), 16)
        b = [Convert]::ToInt32($h.Substring(4, 2), 16)
    }
}

function Get-FoxLookFoxPng {
    return (Join-Path (Split-Path $PSScriptRoot -Parent) "FoxTerminal\assets\fox.png")
}

function New-FoxLookLockImage([string]$OutPath) {
    if (-not (Ensure-FoxOsWall)) { return $null }
    $theme = Get-FoxOsThemeName
    $p = Get-FoxOsPalette
    $sz = Get-FoxOsScreenSize
    $w = [Math]::Max(1920, [int]$sz.W)
    $h = [Math]::Max(1080, [int]$sz.H)
    $night = ConvertFrom-FoxLookHex (Get-FoxOsNightHex $theme)
    $acc = ConvertFrom-FoxLookHex $p.accent
    $acc2 = ConvertFrom-FoxLookHex $p.accent2
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
        [FoxOsWall]::Paint($bmp, $night.r, $night.g, $night.b, $acc.r, $acc.g, $acc.b, $acc2.r, $acc2.g, $acc2.b, (Get-FoxOsSeed $theme))
        $fox = Get-FoxLookFoxPng
        if (Test-Path -LiteralPath $fox) {
            $src = [System.Drawing.Bitmap]::FromFile($fox)
            try { [FoxOsWall]::StampMark($bmp, $src, $acc.r, $acc.g, $acc.b) } finally { $src.Dispose() }
        }
        $dir = Split-Path -Parent $OutPath
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $bmp.Dispose() }
    return $OutPath
}

function Apply-FoxLookLockScreen {
    param([switch]$Force)
    $s = Read-FoxLookState
    $key = if (Get-Command Get-FoxOsSkinKey -ErrorAction SilentlyContinue) { Get-FoxOsSkinKey } else { "default" }
    Save-FoxLookBackupValue "rotatingLock" (Get-RegDword $script:FoxLookCdm "RotatingLockScreenEnabled")
    Save-FoxLookBackupValue "rotatingLockOverlay" (Get-RegDword $script:FoxLookCdm "RotatingLockScreenOverlayEnabled")
    Save-FoxLookLockOriginal
    Set-FoxOsRegDword $script:FoxLookCdm "RotatingLockScreenEnabled" 0
    Set-FoxOsRegDword $script:FoxLookCdm "RotatingLockScreenOverlayEnabled" 0
    if (-not $Force -and $s.lockKey -eq $key) { return $true }
    $img = Join-Path (Get-FoxLookDir) ("locks\" + $key + ".png")
    if ($Force -or -not (Test-Path -LiteralPath $img)) {
        if (-not (New-FoxLookLockImage $img)) { return $false }
    }
    if (-not (Set-FoxLookLockImage $img)) { return $false }
    $s.lockKey = $key
    Write-FoxLookState $s
    return $true
}

function Restore-FoxLookLockScreen {
    # Picture first: SetImageFileAsync switches Windows to "Picture" mode and zeroes the
    # Spotlight flags itself, so the registry values go back after it.
    $orig = Get-FoxLookBackupValue "lockImageSource"
    if (-not ($orig -and (Test-Path -LiteralPath ([string]$orig)))) { $orig = Get-FoxLookBackupValue "lockImage" }
    if ($orig -and (Test-Path -LiteralPath ([string]$orig))) {
        Set-FoxLookLockImage ([string]$orig) | Out-Null
    }
    $rot = Get-FoxLookBackupValue "rotatingLock"
    $ovl = Get-FoxLookBackupValue "rotatingLockOverlay"
    Set-FoxOsRegDword $script:FoxLookCdm "RotatingLockScreenEnabled" $(if ($null -eq $rot) { 1 } else { $rot })
    Set-FoxOsRegDword $script:FoxLookCdm "RotatingLockScreenOverlayEnabled" $(if ($null -eq $ovl) { 1 } else { $ovl })
    $s = Read-FoxLookState
    $s.lockKey = ""
    Write-FoxLookState $s
    Remove-FoxLookBackupValue @("rotatingLock", "rotatingLockOverlay", "lockImage", "lockImageSource")
}

# ---- Win keys (AutoHotkey) -------------------------------------------------

function Test-FoxLookHotkeysRunning {
    try {
        return [bool](Get-CimInstance Win32_Process -Filter "Name LIKE 'AutoHotkey%'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -like "*foxhotkeys.ahk*" } | Select-Object -First 1)
    } catch { return $false }
}

function Set-FoxLookWinKeys([bool]$on) {
    $path = Get-FoxLookWinKeysPath
    $want = if ($on) { "on" } else { "off" }
    $cur = ""
    if (Test-Path -LiteralPath $path) { $cur = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue).Trim() }
    if ($cur -ne $want) {
        $want | Set-Content -LiteralPath $path -Encoding ASCII
    }
    # Fox Alt+Tab lives in foxhotkeys while foxos-live runs — keep the daemon up
    # when winkeys is on (previously we only restarted if it was already alive).
    $hk = Join-Path $PSScriptRoot "foxhotkeys.ps1"
    if (-not (Test-Path -LiteralPath $hk)) { return $true }
    try {
        if ($on) {
            if (Test-FoxLookHotkeysRunning) {
                if ($cur -ne $want) { & $hk -Restart | Out-Null }
            } else {
                & $hk | Out-Null
            }
        } elseif (Test-FoxLookHotkeysRunning -and $cur -ne $want) {
            & $hk -Restart | Out-Null
        }
    } catch {}
    return $true
}

function Apply-FoxLookWinKeys { return (Set-FoxLookWinKeys $true) }
function Restore-FoxLookWinKeys { Set-FoxLookWinKeys $false | Out-Null }

# ---- winlock (optional): Win+L becomes the Fox lock ------------------------

$script:FoxLookPolicySystem = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System"

function Apply-FoxLookWinLock {
    Save-FoxLookBackupValue "disableLockWorkstation" (Get-RegDword $script:FoxLookPolicySystem "DisableLockWorkstation")
    Set-FoxOsRegDword $script:FoxLookPolicySystem "DisableLockWorkstation" 1
    return $true
}

function Restore-FoxLookWinLock {
    $v = Get-FoxLookBackupValue "disableLockWorkstation"
    if ($null -eq $v) {
        try { Remove-ItemProperty -Path $script:FoxLookPolicySystem -Name "DisableLockWorkstation" -ErrorAction Stop } catch {}
    } else {
        Set-FoxOsRegDword $script:FoxLookPolicySystem "DisableLockWorkstation" $v
    }
    Remove-FoxLookBackupValue @("disableLockWorkstation")
}

# ---- OEM (admin) -----------------------------------------------------------

$script:FoxLookOemKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation"
$script:FoxLookOemNames = @("Manufacturer", "Model", "SupportURL", "SupportHours", "SupportPhone", "Logo")

function Test-FoxLookIsAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function New-FoxLookOemLogo([string]$OutPath, [string]$nightHex) {
    Add-Type -AssemblyName System.Drawing | Out-Null
    $n = ConvertFrom-FoxLookHex $nightHex
    $bmp = New-Object System.Drawing.Bitmap 120, 120, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.Clear([System.Drawing.Color]::FromArgb($n.r, $n.g, $n.b))
        $fox = Get-FoxLookFoxPng
        if (Test-Path -LiteralPath $fox) {
            $src = [System.Drawing.Bitmap]::FromFile($fox)
            try {
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
                $scale = [Math]::Min(104.0 / $src.Width, 104.0 / $src.Height)
                $w = [int]($src.Width * $scale)
                $h = [int]($src.Height * $scale)
                $g.DrawImage($src, [int]((120 - $w) / 2), [int]((120 - $h) / 2), $w, $h)
            } finally { $src.Dispose() }
        }
    } finally { $g.Dispose() }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
    return $OutPath
}

# Runs elevated (foxlook.ps1 -Admin apply).
function Apply-FoxLookOemElevated([string]$nightHex) {
    $bk = Get-FoxLookOemBackupPath
    if (-not (Test-Path -LiteralPath $bk)) {
        $snap = [ordered]@{}
        foreach ($n in $script:FoxLookOemNames) { $snap[$n] = Get-RegString $script:FoxLookOemKey $n }
        Write-FoxLookJson $bk $snap
    }
    $logo = New-FoxLookOemLogo (Join-Path (Get-FoxLookDir) "oem-logo.bmp") $nightHex
    if (-not (Test-Path $script:FoxLookOemKey)) { New-Item -Path $script:FoxLookOemKey -Force | Out-Null }
    Set-ItemProperty -Path $script:FoxLookOemKey -Name "Manufacturer" -Value "FoxOS" -Type String
    Set-ItemProperty -Path $script:FoxLookOemKey -Name "Model" -Value "FoxTerminal" -Type String
    Set-ItemProperty -Path $script:FoxLookOemKey -Name "SupportURL" -Value "https://github.com/shew4uk/FoxTerminal" -Type String
    Set-ItemProperty -Path $script:FoxLookOemKey -Name "Logo" -Value $logo -Type String
    foreach ($n in @("SupportHours", "SupportPhone")) {
        try { Remove-ItemProperty -Path $script:FoxLookOemKey -Name $n -ErrorAction Stop } catch {}
    }
    return $true
}

# Runs elevated (foxlook.ps1 -Admin restore).
function Restore-FoxLookOemElevated {
    $bk = Get-FoxLookOemBackupPath
    $snap = Read-FoxLookJson $bk
    if (-not (Test-Path $script:FoxLookOemKey)) { New-Item -Path $script:FoxLookOemKey -Force | Out-Null }
    foreach ($n in $script:FoxLookOemNames) {
        $v = if ($snap) { $snap.$n } else { $null }
        if ([string]::IsNullOrEmpty($v)) {
            try { Remove-ItemProperty -Path $script:FoxLookOemKey -Name $n -ErrorAction Stop } catch {}
        } else {
            Set-ItemProperty -Path $script:FoxLookOemKey -Name $n -Value ([string]$v) -Type String
        }
    }
    if (Test-Path -LiteralPath $bk) { Remove-Item -LiteralPath $bk -Force -ErrorAction SilentlyContinue }
    return $true
}

function Invoke-FoxLookAdmin([string]$action) {
    $night = if (Get-Command Get-FoxOsNightHex -ErrorAction SilentlyContinue) { Get-FoxOsNightHex (Get-FoxOsThemeName) } else { "#0B0F1A" }
    if (Test-FoxLookIsAdmin) {
        if ($action -eq "apply") { return (Apply-FoxLookOemElevated $night) }
        return (Restore-FoxLookOemElevated)
    }
    $ps1 = Join-Path $PSScriptRoot "foxlook.ps1"
    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ps1, "-Admin", $action, "-Night", $night)
    try {
        $p = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Verb RunAs -Wait -PassThru -WindowStyle Hidden
        return ($p.ExitCode -eq 0)
    } catch {
        return $false
    }
}

function Apply-FoxLookOem { return (Invoke-FoxLookAdmin "apply") }
function Restore-FoxLookOem { Invoke-FoxLookAdmin "restore" | Out-Null }

# ---- shell (Level 2): this user's Winlogon Shell becomes FoxOS ---------------
# Next sign-in starts foxos-shell.cmd instead of Explorer. The other Windows
# account is untouched (its HKCU still says Explorer). Not part of foxlook on.

function Get-FoxLookWinlogonKey { return "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" }
function Get-FoxLookShellCmdPath { return (Join-Path (Get-FoxLookDir) "foxos-shell.cmd") }
function Get-FoxLookRestoreCmdPath { return (Join-Path (Get-FoxLookDir) "restore-windows.cmd") }
function Get-FoxLookShellWatchName { return "FoxOS-ShellWatch" }

function Write-FoxLookShellLaunchers {
    $dir = Get-FoxLookDir
    $ps1 = Join-Path $PSScriptRoot "foxos-shell.ps1"
    $look = Join-Path $PSScriptRoot "foxlook.ps1"
    $cmd = @(
        "@echo off",
        "title FoxOS",
        ("if not exist `"" + $ps1 + "`" goto :fallback"),
        ("powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"" + $ps1 + "`""),
        "goto :eof",
        ":fallback",
        ("if exist `"" + (Get-FoxOsLiveExe) + "`" start `"`" `"" + (Get-FoxOsLiveExe) + "`" `"" + (Get-FoxOsLiveStatePath) + "`""),
        "if errorlevel 1 start explorer.exe"
    )
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Get-FoxLookShellCmdPath), (($cmd -join "`r`n") + "`r`n"), $utf8)

    $rescue = @(
        "@echo off",
        "reg delete `"HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon`" /v Shell /f >nul 2>&1",
        "start `"`" explorer.exe",
        ("if exist `"" + $look + "`" powershell -NoProfile -ExecutionPolicy Bypass -File `"" + $look + "`" rescue")
    )
    [System.IO.File]::WriteAllText((Get-FoxLookRestoreCmdPath), (($rescue -join "`r`n") + "`r`n"), $utf8)
}

function Register-FoxLookShellWatch {
    $watch = Join-Path $PSScriptRoot "foxos-watch.ps1"
    if (-not (Test-Path -LiteralPath $watch)) { return $false }
    $who = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
        "-NoProfile -ExecutionPolicy Bypass -File `"$watch`""
    )
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $who
    try { $trigger.Delay = "PT0S" } catch {}
    $principal = New-ScheduledTaskPrincipal -UserId $who -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -StartWhenAvailable -MultipleInstances IgnoreNew
    $settings.ExecutionTimeLimit = "PT2M"
    $name = Get-FoxLookShellWatchName
    Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "If FoxOS shell is silent for 30s, restore Explorer for this user" -Force | Out-Null
    return $true
}

function Unregister-FoxLookShellWatch {
    Unregister-ScheduledTask -TaskName (Get-FoxLookShellWatchName) -Confirm:$false -ErrorAction SilentlyContinue
}

function Apply-FoxLookShell {
    if (-not (Test-FoxOsWindows)) { return $false }
    $key = Get-FoxLookWinlogonKey
    if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
    Save-FoxLookBackupValue "shell" (Get-RegString $key "Shell")
    Write-FoxLookShellLaunchers
    $cmd = Get-FoxLookShellCmdPath
    if (-not (Test-Path -LiteralPath $cmd)) { return $false }
    Set-ItemProperty -Path $key -Name "Shell" -Value $cmd -Type String
    try { Register-FoxLookShellWatch | Out-Null } catch {}
    $st = Read-FoxLookState
    $st.parts["shell"] = $true
    $st.on = $true
    Write-FoxLookState $st
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
        try { Write-FoxOsLiveState } catch {}
    }
    if ((Get-Command Test-FoxOsLiveRunning -ErrorAction SilentlyContinue) -and (Test-FoxOsLiveRunning)) {
        try {
            Stop-FoxOsLive
            Start-Sleep -Milliseconds 300
            Start-FoxOsLive | Out-Null
        } catch {}
    } elseif (Get-Command Start-FoxOsLive -ErrorAction SilentlyContinue) {
        try { Start-FoxOsLive | Out-Null } catch {}
    }
    return $true
}

function Restore-FoxLookShell {
    $key = Get-FoxLookWinlogonKey
    $prev = Get-FoxLookBackupValue "shell"
    if (Test-Path -LiteralPath $key) {
        if ([string]::IsNullOrEmpty($prev)) {
            try { Remove-ItemProperty -Path $key -Name "Shell" -ErrorAction Stop } catch {}
        } else {
            Set-ItemProperty -Path $key -Name "Shell" -Value ([string]$prev) -Type String
        }
    }
    Unregister-FoxLookShellWatch
    Remove-FoxLookBackupValue @("shell")
    $alive = Join-Path (Get-FoxLookDir) "shell-alive.json"
    if (Test-Path -LiteralPath $alive) { Remove-Item -LiteralPath $alive -Force -ErrorAction SilentlyContinue }
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
        # look.json part flag is cleared by Set-FoxLookPart after this returns;
        # write state after a tick so the dock goes away on the next live.json write.
        try {
            $s = Read-FoxLookState
            if ($s.parts.ContainsKey("shell")) { $s.parts["shell"] = $false }
            Write-FoxLookState $s
            Write-FoxOsLiveState
        } catch {}
    }
    if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
        try { Start-Process -FilePath "explorer.exe" } catch {}
    }
    if ((Get-Command Test-FoxOsLiveRunning -ErrorAction SilentlyContinue) -and (Test-FoxOsLiveRunning)) {
        try {
            Stop-FoxOsLive
            Start-Sleep -Milliseconds 300
            Start-FoxOsLive | Out-Null
        } catch {}
    }
}

# ---- dispatch --------------------------------------------------------------

function Apply-FoxLookPart([string]$part) {
    switch ($part) {
        "dark" { return (Apply-FoxLookDark) }
        "icons" { return (Apply-FoxLookIcons) }
        "taskbar" { return (Apply-FoxLookTaskbar) }
        "sounds" { return (Apply-FoxLookSounds) }
        "cursors" { return (Apply-FoxLookCursors) }
        "lockscreen" { return (Apply-FoxLookLockScreen) }
        "winkeys" { return (Apply-FoxLookWinKeys) }
        "winlock" { return (Apply-FoxLookWinLock) }
        "oem" { return (Apply-FoxLookOem) }
        "shell" { return (Apply-FoxLookShell) }
    }
    return $false
}

function Restore-FoxLookPart([string]$part) {
    switch ($part) {
        "dark" { Restore-FoxLookDark }
        "icons" { Restore-FoxLookIcons }
        "taskbar" { Restore-FoxLookTaskbar }
        "sounds" { Restore-FoxLookSounds }
        "cursors" { Restore-FoxLookCursors }
        "lockscreen" { Restore-FoxLookLockScreen }
        "winkeys" { Restore-FoxLookWinKeys }
        "winlock" { Restore-FoxLookWinLock }
        "oem" { Restore-FoxLookOem }
        "shell" { Restore-FoxLookShell }
    }
}

function Set-FoxLookPart {
    param([string]$Part, [bool]$On)
    if ($On) {
        $ok = Apply-FoxLookPart $Part
        $s = Read-FoxLookState   # after: a part may have written its own fields (lockKey)
        if ($ok) { $s.parts[$Part] = $true; $s.on = $true }
        Write-FoxLookState $s
        return $ok
    }
    $s = Read-FoxLookState
    if ($s.parts.ContainsKey($Part) -and $s.parts[$Part]) {
        Restore-FoxLookPart $Part
        $s = Read-FoxLookState
    }
    $s.parts[$Part] = $false
    $anyOn = $false
    foreach ($v in $s.parts.Values) { if ($v) { $anyOn = $true; break } }
    if (-not $anyOn) { $s.on = $false }
    Write-FoxLookState $s
    return $true
}

# foxlook on: every default part. -Quiet skips the UAC part (oem) — used by login and the Control UI.
function Enable-FoxLook {
    param([switch]$Quiet)
    if (-not (Test-FoxOsWindows)) { return @{} }
    $result = [ordered]@{}
    foreach ($part in $script:FoxLookParts) {
        if ($Quiet -and $part -eq "oem") { continue }
        $result[$part] = [bool](Set-FoxLookPart -Part $part -On $true)
    }
    $s = Read-FoxLookState
    $s.on = $true
    Write-FoxLookState $s
    return $result
}

function Disable-FoxLook {
    if (-not (Test-FoxOsWindows)) { return }
    $s = Read-FoxLookState
    foreach ($part in ($script:FoxLookParts + $script:FoxLookOptional)) {
        if ($s.parts.ContainsKey($part) -and $s.parts[$part]) {
            try { Restore-FoxLookPart $part } catch {}
        }
    }
    $s = Read-FoxLookState
    foreach ($k in @($s.parts.Keys)) { $s.parts[$k] = $false }
    $s.on = $false
    Write-FoxLookState $s
}

# Login / theme change: re-assert the cheap parts, redo the lock picture when the theme moved.
function Sync-FoxLook {
    if (-not (Test-FoxOsWindows)) { return $false }
    $s = Read-FoxLookState
    if (-not $s.on) { return $false }
    foreach ($part in @("dark", "icons", "taskbar", "winkeys", "lockscreen")) {
        if ($s.parts.ContainsKey($part) -and $s.parts[$part]) {
            try { Apply-FoxLookPart $part | Out-Null } catch {}
        }
    }
    return $true
}

function Set-FoxLookWall([string]$mode) {
    if ($mode -notin @("overlay", "behind")) { return $false }
    $s = Read-FoxLookState
    $s.wall = $mode
    Write-FoxLookState $s
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) { Write-FoxOsLiveState }
    if ((Get-Command Test-FoxOsLiveRunning -ErrorAction SilentlyContinue) -and (Test-FoxOsLiveRunning)) {
        Stop-FoxOsLive
        Start-Sleep -Milliseconds 300
        Start-FoxOsLive | Out-Null
    }
    return $true
}

function Get-FoxLookStatusInfo {
    $s = Read-FoxLookState
    $rows = [ordered]@{}
    foreach ($part in ($script:FoxLookParts + $script:FoxLookOptional)) {
        $rows[$part] = ($s.parts.ContainsKey($part) -and [bool]$s.parts[$part])
    }
    return @{
        Enabled = [bool]$s.on
        Parts   = $rows
        Wall    = $s.wall
        Cursor  = $s.cursor
        CursorScale = [int]$s.cursorScale
        DockStyle = $s.dockStyle
        DockPos = $s.dockPos
        DockSize = $s.dockSize
        DockHide = [bool]$s.dockHide
        DockWins = $s.dockWins
        DockTray = $s.dockTray
        Backup  = (@((Read-FoxLookBackup).PSObject.Properties).Count -gt 0)
    }
}

function Set-FoxLookDock {
    param([string]$Key, $Value)
    $s = Read-FoxLookState
    switch ($Key) {
        "dockStyle" { if ([string]$Value -notin @("rail", "pill", "glass", "slim")) { return $false }; $s.dockStyle = [string]$Value }
        "dockPos"   { if ([string]$Value -notin @("top", "bottom")) { return $false }; $s.dockPos = [string]$Value }
        "dockSize"  { if ([string]$Value -notin @("compact", "normal", "large")) { return $false }; $s.dockSize = [string]$Value }
        "dockHide"  {
            if ($Value -is [bool]) { $s.dockHide = [bool]$Value }
            else { $s.dockHide = ("$Value".Trim().ToLowerInvariant() -in @("on", "1", "true")) }
        }
        "dockWins"  { if ([string]$Value -notin @("titles", "dots", "off")) { return $false }; $s.dockWins = [string]$Value }
        "dockTray"  { if ([string]$Value -notin @("full", "clock", "off")) { return $false }; $s.dockTray = [string]$Value }
        "dockWidgets" {
            if ($Value -is [bool]) { $s.dockWidgets = [bool]$Value }
            else { $s.dockWidgets = ("$Value".Trim().ToLowerInvariant() -in @("on", "1", "true")) }
        }
        "dockHome" {
            if ($Value -is [bool]) { $s.dockHome = [bool]$Value }
            else { $s.dockHome = ("$Value".Trim().ToLowerInvariant() -in @("on", "1", "true")) }
        }
        default { return $false }
    }
    Write-FoxLookState $s
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
        try { Write-FoxOsLiveState } catch {}
    }
    return $true
}

function Get-FoxDockPinsPath { return (Join-Path (Get-FoxLookDir) "pins.json") }

function Ensure-FoxDockPins {
    $path = Get-FoxDockPinsPath
    if (Test-Path -LiteralPath $path) { return $path }
    $pins = @(
        @{ id = "cursor"; title = "Cursor"; path = (Resolve-FoxDockPin "cursor"); act = "" },
        @{ id = "zen"; title = "Zen"; path = (Resolve-FoxDockPin "zen"); act = "" },
        @{ id = "term"; title = "Terminal"; path = (Resolve-FoxDockPin "term"); act = "term" }
    )
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, ($pins | ConvertTo-Json -Depth 4), $utf8)
    return $path
}

function Export-FoxLookProfile([string]$OutPath) {
    if ([string]::IsNullOrWhiteSpace($OutPath)) {
        $OutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) ("foxos-profile-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".json")
    }
    Ensure-FoxDockPins | Out-Null
    $theme = ""
    $themePath = Join-Path $PSScriptRoot "theme.txt"
    if (Test-Path -LiteralPath $themePath) { $theme = (Get-Content -LiteralPath $themePath -Raw -ErrorAction SilentlyContinue) }
    $pins = $null
    try { $pins = Get-Content -LiteralPath (Get-FoxDockPinsPath) -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    $obj = [ordered]@{
        look = Read-FoxLookState
        theme = ("$theme".Trim())
        pins = $pins
        exported = (Get-Date).ToUniversalTime().ToString("o")
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($OutPath, ($obj | ConvertTo-Json -Depth 8), $utf8)
    return $OutPath
}

function Import-FoxLookProfile([string]$InPath) {
    if (-not (Test-Path -LiteralPath $InPath)) { return $false }
    $j = Get-Content -LiteralPath $InPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $j) { return $false }
    if ($j.look) {
        $s = Read-FoxLookState
        foreach ($p in $j.look.PSObject.Properties) {
            if ($p.Name -eq "parts") {
                $s.parts = @{}
                if ($p.Value) {
                    foreach ($pp in $p.Value.PSObject.Properties) { $s.parts[$pp.Name] = [bool]$pp.Value }
                }
            } else {
                $s[$p.Name] = $p.Value
            }
        }
        Write-FoxLookState $s
    }
    if ($j.theme) {
        $themePath = Join-Path $PSScriptRoot "theme.txt"
        ("$($j.theme)".Trim()) | Set-Content -LiteralPath $themePath -Encoding UTF8
    }
    if ($j.pins) {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText((Get-FoxDockPinsPath), ($j.pins | ConvertTo-Json -Depth 4), $utf8)
    }
    if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
        try { Write-FoxOsLiveState } catch {}
    }
    return $true
}
