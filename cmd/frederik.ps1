param(
    [ValidateRange(12, 120)]
    [int]$Bars = 56,

    [ValidateRange(8, 40)]
    [int]$Height = 18,

    [ValidateRange(1.0, 20.0)]
    [double]$Sensitivity = 9.0,

    [ValidateRange(20, 200)]
    [int]$DelayMs = 45,

    [ValidateSet("Auto", "Mic", "System")]
    [string]$Source = "Auto",

    [string]$Mic = "",
    [switch]$ListMics,
    [switch]$SetMainMic
)

Set-StrictMode -Version Latest

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

function Enable-VT {
    $sig = @"
using System;
using System.Runtime.InteropServices;
public static class FoxVT {
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
        $h = [FoxVT]::GetStdHandle($STDOUT)
        $mode = 0
        if ([FoxVT]::GetConsoleMode($h, [ref]$mode)) {
            [FoxVT]::SetConsoleMode($h, $mode -bor $ENABLE_VIRTUAL_TERMINAL_PROCESSING) | Out-Null
        }
    } catch { }
}

function Ensure-MicMeterType {
    if ("FoxTerm.EndpointMeter" -as [type]) { return }

    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace FoxTerm {
  public sealed class AudioDeviceInfo {
    public int Index { get; set; }
    public string Id { get; set; }
    public string Name { get; set; }
    public bool IsDefault { get; set; }
  }

  public sealed class EndpointMeter : IDisposable {
    private IMMDeviceEnumerator _enumerator;
    private IMMDevice _device;
    private IAudioMeterInformation _meter;

    private EndpointMeter() { }

    public static EndpointMeter CreateCapture() {
      var a = new EndpointMeter();
      a.InitDefault(EDataFlow.eCapture);
      return a;
    }

    public static EndpointMeter CreateRender() {
      var a = new EndpointMeter();
      a.InitDefault(EDataFlow.eRender);
      return a;
    }

    public static EndpointMeter CreateCaptureById(string id) {
      var a = new EndpointMeter();
      a.InitById(EDataFlow.eCapture, id);
      return a;
    }

    public static AudioDeviceInfo[] ListCaptureDevices() {
      var list = new List<AudioDeviceInfo>();
      IMMDeviceEnumerator enumerator = null;
      IMMDeviceCollection collection = null;
      IMMDevice defDevice = null;
      try {
        var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
        var type = Type.GetTypeFromCLSID(clsid, true);
        enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(type);

        string defId = null;
        if (enumerator.GetDefaultAudioEndpoint(EDataFlow.eCapture, ERole.eMultimedia, out defDevice) == 0 && defDevice != null) {
          defId = GetDeviceId(defDevice);
        }

        int hrEnum = enumerator.EnumAudioEndpoints(EDataFlow.eCapture, DEVICE_STATE_ACTIVE, out collection);
        if (hrEnum != 0 || collection == null) {
          return list.ToArray();
        }

        uint count = 0;
        collection.GetCount(out count);
        for (uint i = 0; i < count; i++) {
          IMMDevice dev = null;
          try {
            if (collection.Item(i, out dev) != 0 || dev == null) continue;
            var id = GetDeviceId(dev);
            var name = GetFriendlyName(dev);
            list.Add(new AudioDeviceInfo {
              Index = (int)i,
              Id = id,
              Name = string.IsNullOrWhiteSpace(name) ? "(unnamed microphone)" : name,
              IsDefault = string.Equals(id, defId, StringComparison.OrdinalIgnoreCase)
            });
          } finally {
            try { if (dev != null) Marshal.FinalReleaseComObject(dev); } catch { }
          }
        }
      } finally {
        try { if (defDevice != null) Marshal.FinalReleaseComObject(defDevice); } catch { }
        try { if (collection != null) Marshal.FinalReleaseComObject(collection); } catch { }
        try { if (enumerator != null) Marshal.FinalReleaseComObject(enumerator); } catch { }
      }
      return list.ToArray();
    }

    private void InitDefault(EDataFlow flow) {
      var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
      var type = Type.GetTypeFromCLSID(clsid, true);
      _enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(type);
      int hr = _enumerator.GetDefaultAudioEndpoint(flow, ERole.eMultimedia, out _device);
      if (hr != 0 || _device == null) Marshal.ThrowExceptionForHR(hr);
      ActivateMeter();
    }

    private void InitById(EDataFlow flow, string id) {
      var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
      var type = Type.GetTypeFromCLSID(clsid, true);
      _enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(type);
      int hr;
      if (string.IsNullOrWhiteSpace(id)) {
        hr = _enumerator.GetDefaultAudioEndpoint(flow, ERole.eMultimedia, out _device);
      } else {
        hr = _enumerator.GetDevice(id, out _device);
      }
      if (hr != 0 || _device == null) Marshal.ThrowExceptionForHR(hr);
      ActivateMeter();
    }

    private void ActivateMeter() {
      var iid = typeof(IAudioMeterInformation).GUID;
      object o;
      int hr = _device.Activate(ref iid, (int)CLSCTX.CLSCTX_ALL, IntPtr.Zero, out o);
      if (hr != 0 || o == null) Marshal.ThrowExceptionForHR(hr);
      _meter = (IAudioMeterInformation)o;
    }

    public float GetPeak() {
      float v;
      _meter.GetPeakValue(out v);
      if (v < 0) return 0.0f;
      if (v > 1) return 1.0f;
      return v;
    }

    public void Dispose() {
      try { if (_meter != null) Marshal.FinalReleaseComObject(_meter); } catch { }
      try { if (_device != null) Marshal.FinalReleaseComObject(_device); } catch { }
      try { if (_enumerator != null) Marshal.FinalReleaseComObject(_enumerator); } catch { }
      _meter = null;
      _device = null;
      _enumerator = null;
    }

    private static string GetDeviceId(IMMDevice device) {
      IntPtr idPtr;
      int hr = device.GetId(out idPtr);
      if (hr != 0 || idPtr == IntPtr.Zero) return null;
      try { return Marshal.PtrToStringUni(idPtr); }
      finally { CoTaskMemFree(idPtr); }
    }

    private static string GetFriendlyName(IMMDevice device) {
      IPropertyStore store = null;
      try {
        int hr = device.OpenPropertyStore(STGM_READ, out store);
        if (hr != 0 || store == null) return null;
        var key = new PROPERTYKEY {
          fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
          pid = 14
        };
        PROPVARIANT value;
        hr = store.GetValue(ref key, out value);
        if (hr != 0) return null;
        try {
          if (value.vt == 31 || value.vt == 30) {
            return Marshal.PtrToStringUni(value.pointerValue);
          }
          return null;
        } finally {
          PropVariantClear(ref value);
        }
      } finally {
        try { if (store != null) Marshal.FinalReleaseComObject(store); } catch { }
      }
    }

    private const int DEVICE_STATE_ACTIVE = 0x00000001;
    private const int STGM_READ = 0x00000000;

    [DllImport("ole32.dll")]
    private static extern void CoTaskMemFree(IntPtr ptr);

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT pvar);

    private enum EDataFlow {
      eRender = 0,
      eCapture = 1,
      eAll = 2
    }

    private enum ERole {
      eConsole = 0,
      eMultimedia = 1,
      eCommunications = 2
    }

    [Flags]
    private enum CLSCTX {
      CLSCTX_INPROC_SERVER = 0x1,
      CLSCTX_INPROC_HANDLER = 0x2,
      CLSCTX_LOCAL_SERVER = 0x4,
      CLSCTX_REMOTE_SERVER = 0x10,
      CLSCTX_ALL = CLSCTX_INPROC_SERVER | CLSCTX_INPROC_HANDLER | CLSCTX_LOCAL_SERVER | CLSCTX_REMOTE_SERVER
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator {
      [PreserveSig]
      int EnumAudioEndpoints(EDataFlow dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
      [PreserveSig]
      int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
      [PreserveSig]
      int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
      int RegisterEndpointNotificationCallback(IntPtr pClient);
      int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [Guid("0BD7A1BE-7A1A-44DB-8397-C0A13CE8781F"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceCollection {
      [PreserveSig]
      int GetCount(out uint pcDevices);
      [PreserveSig]
      int Item(uint nDevice, out IMMDevice ppDevice);
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice {
      [PreserveSig]
      int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
      [PreserveSig]
      int OpenPropertyStore(int stgmAccess, out IPropertyStore ppProperties);
      [PreserveSig]
      int GetId(out IntPtr ppstrId);
      [PreserveSig]
      int GetState(out int pdwState);
    }

    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore {
      [PreserveSig]
      int GetCount(out int cProps);
      [PreserveSig]
      int GetAt(int iProp, out PROPERTYKEY pkey);
      [PreserveSig]
      int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
      [PreserveSig]
      int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
      [PreserveSig]
      int Commit();
    }

    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioMeterInformation {
      [PreserveSig]
      int GetPeakValue(out float pfPeak);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPERTYKEY {
      public Guid fmtid;
      public int pid;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct PROPVARIANT {
      [FieldOffset(0)] public ushort vt;
      [FieldOffset(8)] public IntPtr pointerValue;
    }
  }
}
"@ -ErrorAction Stop | Out-Null
}

function Start-SpeechMicTracker {
    try {
        Add-Type -AssemblyName System.Speech -ErrorAction Stop
        $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $recognizer.SetInputToDefaultAudioDevice()

        try {
            $dict = New-Object System.Speech.Recognition.DictationGrammar
            $recognizer.LoadGrammar($dict)
        } catch {
            $gb = New-Object System.Speech.Recognition.GrammarBuilder
            $gb.Append("fox")
            $g = New-Object System.Speech.Recognition.Grammar($gb)
            $recognizer.LoadGrammar($g)
        }

        $script:FrederikSpeechLevel = 0.0
        $script:FrederikSpeechLastUpdate = Get-Date
        $sub = Register-ObjectEvent -InputObject $recognizer -EventName AudioLevelUpdated -Action {
            try {
                $lvl = [double]$EventArgs.AudioLevel / 100.0
                Set-Variable -Scope Script -Name FrederikSpeechLevel -Value $lvl
                Set-Variable -Scope Script -Name FrederikSpeechLastUpdate -Value (Get-Date)
            } catch { }
        }

        $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
        return @{
            Recognizer = $recognizer
            Subscription = $sub
        }
    } catch {
        return $null
    }
}

function Stop-SpeechMicTracker([hashtable]$tracker) {
    if (-not $tracker) { return }
    try { $tracker.Recognizer.RecognizeAsyncCancel() } catch { }
    try { $tracker.Recognizer.RecognizeAsyncStop() } catch { }
    try { $tracker.Recognizer.Dispose() } catch { }
    try {
        if ($tracker.Subscription) {
            Unregister-Event -SubscriptionId $tracker.Subscription.Id -ErrorAction SilentlyContinue
            Remove-Job -Id $tracker.Subscription.Id -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

function Get-SpeechMicLevel([hashtable]$tracker) {
    if (-not $tracker) { return $null }
    if (-not (Get-Variable -Name FrederikSpeechLastUpdate -Scope Script -ErrorAction SilentlyContinue)) { return $null }
    $ageMs = ((Get-Date) - $script:FrederikSpeechLastUpdate).TotalMilliseconds
    if ($ageMs -gt 2500) { return $null }
    return [double]$script:FrederikSpeechLevel
}

function Try-CreateEndpointMeter([string]$kind, [string]$deviceId = "") {
    try {
        if ($kind -eq "capture") {
            if ([string]::IsNullOrWhiteSpace($deviceId)) {
                return [FoxTerm.EndpointMeter]::CreateCapture()
            }
            return [FoxTerm.EndpointMeter]::CreateCaptureById($deviceId)
        }
        if ($kind -eq "render") {
            return [FoxTerm.EndpointMeter]::CreateRender()
        }
        return $null
    } catch {
        return $null
    }
}

function Get-CaptureDevices {
    try {
        $arr = @([FoxTerm.EndpointMeter]::ListCaptureDevices())
        if ($null -eq $arr) { return @() }
        return $arr
    } catch {
        return @()
    }
}

function Show-CaptureDevices {
    $devices = @(Get-CaptureDevices)
    if ($devices.Count -eq 0) {
        Write-Host "No active microphone endpoints found."
        return
    }
    Write-Host "Available microphones:"
    foreach ($d in $devices) {
        $tag = if ($d.IsDefault) { " (default)" } else { "" }
        Write-Host ("  [{0}] {1}{2}" -f $d.Index, $d.Name, $tag)
    }
}

function Resolve-CaptureDevice([string]$selector) {
    $devices = @(Get-CaptureDevices)
    if ($devices.Count -eq 0) { return $null }

    if ([string]::IsNullOrWhiteSpace($selector)) {
        $def = $devices | Where-Object { $_.IsDefault } | Select-Object -First 1
        if ($def) { return $def }
        return $devices[0]
    }

    $sel = $selector.Trim()
    if ($sel -match '^\d+$') {
        $idx = [int]$sel
        return ($devices | Where-Object { $_.Index -eq $idx } | Select-Object -First 1)
    }

    $exact = $devices | Where-Object { $_.Name -eq $sel -or $_.Id -eq $sel } | Select-Object -First 1
    if ($exact) { return $exact }

    $needle = $sel.ToLowerInvariant()
    $partial = $devices | Where-Object {
        ($_.Name -and $_.Name.ToLowerInvariant().Contains($needle)) -or
        ($_.Id -and $_.Id.ToLowerInvariant().Contains($needle))
    } | Select-Object -First 1
    return $partial
}

function Get-MainMicPath {
    return (Join-Path $PSScriptRoot "frederik_mic.txt")
}

function Load-MainMicId {
    $path = Get-MainMicPath
    if (-not (Test-Path $path)) { return "" }
    try {
        return (Get-Content -Path $path -Raw -ErrorAction Stop).Trim()
    } catch {
        return ""
    }
}

function Save-MainMicId([string]$id) {
    if ([string]::IsNullOrWhiteSpace($id)) { return }
    $path = Get-MainMicPath
    $id | Set-Content -Path $path -Encoding UTF8
}

function Clamp01([double]$v) {
    if ($v -lt 0.0) { return 0.0 }
    if ($v -gt 1.0) { return 1.0 }
    return $v
}

function Build-Frame {
    param(
        [double[]]$ColumnLevels,
        [double]$MicLevel,
        [int]$FrameHeight,
        [int]$Center,
        [char]$Esc
    )

    $reset = "$Esc[0m"
    $hideCursor = "$Esc[?25l"
    $filledChar = [char]0x2588
    $emptyChar = " "
    $title = "FREDERIK VOICE WAVE  (Esc = exit)"
    $hint = "Speak into mic to animate waveform."
    $pct = [int][Math]::Round($MicLevel * 100.0)

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append($hideCursor)
    [void]$sb.AppendLine($title)
    [void]$sb.AppendLine(("Mic Level: {0,3}%" -f $pct))
    [void]$sb.AppendLine("")

    for ($row = 0; $row -lt $FrameHeight; $row++) {
        $dist = [Math]::Abs($row - $Center)
        for ($i = 0; $i -lt $ColumnLevels.Length; $i++) {
            $amp = [int][Math]::Round($ColumnLevels[$i] * $Center)
            if ($dist -le $amp) {
                $ratio = if ($Center -le 0) { 0.0 } else { [double]$dist / [double]$Center }
                $r = [int][Math]::Round(80 + (170 * (1.0 - $ratio)))
                $g = [int][Math]::Round(120 + (120 * (1.0 - $ratio)))
                $b = [int][Math]::Round(255 - (115 * $ratio))
                [void]$sb.Append("$Esc[38;2;$r;$g;$b" + "m")
                [void]$sb.Append($filledChar)
                [void]$sb.Append($reset)
            } else {
                [void]$sb.Append($emptyChar)
            }
        }
        [void]$sb.AppendLine("")
    }

    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($hint)
    return $sb.ToString()
}

Ensure-Utf8Console
Enable-VT
Ensure-MicMeterType

$esc = [char]27
$showCursor = "$esc[?25h"
$speechTracker = $null
$captureMeter = $null
$renderMeter = $null
$selectedMic = $null
$selectedMicLabel = ""
$savedMicId = ""

if ($ListMics) {
    Show-CaptureDevices
    Write-Host ""
    Write-Host "Pick by index or text:"
    Write-Host "  frederik -Source Mic -Mic 1"
    Write-Host "  frederik -Source Mic -Mic ""HyperX"""
    Write-Host "Save as main mic:"
    Write-Host "  frederik -Source Mic -Mic 1 -SetMainMic"
    exit 0
}

if ($Source -eq "Auto" -or $Source -eq "Mic") {
    if ([string]::IsNullOrWhiteSpace($Mic)) {
        $savedMicId = Load-MainMicId
    }
    $selector = if ([string]::IsNullOrWhiteSpace($Mic)) { $savedMicId } else { $Mic }
    $selectedMic = Resolve-CaptureDevice $selector

    if (-not [string]::IsNullOrWhiteSpace($selector) -and -not $selectedMic) {
        Write-Host ("Microphone not found: " + $selector)
        Write-Host ""
        Show-CaptureDevices
        exit 1
    }

    if ($selectedMic) {
        $selectedMicLabel = [string]$selectedMic.Name
        $captureMeter = Try-CreateEndpointMeter "capture" ([string]$selectedMic.Id)
    }

    if (-not $captureMeter -and [string]::IsNullOrWhiteSpace($selector)) {
        $speechTracker = Start-SpeechMicTracker
        if (-not $speechTracker) {
            $captureMeter = Try-CreateEndpointMeter "capture"
            if ($captureMeter) { $selectedMicLabel = "Default microphone" }
        }
    }
}

if ($Source -eq "Auto" -or $Source -eq "System") {
    $renderMeter = Try-CreateEndpointMeter "render"
}

if ($SetMainMic) {
    if ($selectedMic) {
        Save-MainMicId ([string]$selectedMic.Id)
        Write-Host ("Main mic saved: " + $selectedMic.Name)
    } else {
        Write-Host "Cannot save main mic: no microphone selected."
        Write-Host "Use: frederik -ListMics"
        exit 1
    }
}

if ($Source -eq "Mic" -and -not $speechTracker -and -not $captureMeter) {
    Write-Host "Microphone input meter is unavailable."
    Write-Host "Use: frederik -ListMics"
    Write-Host "Or:  frederik -Source Auto"
    exit 1
}
if ($Source -eq "System" -and -not $renderMeter) {
    Write-Host "System audio meter is unavailable."
    exit 1
}
if (-not $speechTracker -and -not $captureMeter -and -not $renderMeter) {
    Write-Host "Cannot access any audio meter source."
    exit 1
}

$barsClamped = [Math]::Max(12, [Math]::Min($Bars, 120))
$heightClamped = [Math]::Max(8, [Math]::Min($Height, 40))
$center = [int][Math]::Floor(($heightClamped - 1) / 2)
$levels = New-Object double[] $barsClamped
$rng = [System.Random]::new()
$smooth = 0.0
$tick = 0.0
$noiseFloor = 0.02

try {
    Clear-Host
    while ($true) {
        if ([Console]::KeyAvailable) {
            $k = [Console]::ReadKey($true)
            if ($k.Key -eq "Escape") { break }
        }

        $raw = $null
        $activeSource = ""

        if ($speechTracker) {
            $speechLevel = Get-SpeechMicLevel $speechTracker
            if ($null -ne $speechLevel) {
                $raw = [double]$speechLevel
                $activeSource = "MIC (speech default)"
            }
        }
        if ($null -eq $raw -and $captureMeter) {
            try {
                $raw = [double]$captureMeter.GetPeak()
                if ([string]::IsNullOrWhiteSpace($selectedMicLabel)) {
                    $activeSource = "MIC (endpoint)"
                } else {
                    $activeSource = ("MIC: " + $selectedMicLabel)
                }
            } catch { }
        }
        if ($null -eq $raw -and $renderMeter) {
            try {
                $raw = [double]$renderMeter.GetPeak()
                $activeSource = "SYSTEM-AUDIO"
            } catch { }
        }
        if ($null -eq $raw) {
            $raw = 0.0
            $activeSource = "NO SIGNAL"
        }

        if ($raw -lt $noiseFloor) {
            $noiseFloor = ($noiseFloor * 0.96) + ($raw * 0.04)
        } else {
            $noiseFloor = ($noiseFloor * 0.998) + ($raw * 0.002)
        }
        $noiseFloor = Clamp01 $noiseFloor

        $normalized = 0.0
        if ($raw -gt $noiseFloor) {
            $normalized = ($raw - $noiseFloor) / [Math]::Max(0.04, (1.0 - $noiseFloor))
        }

        $boosted = Clamp01 ($normalized * $Sensitivity)
        $smooth = ($smooth * 0.72) + ($boosted * 0.28)

        for ($i = 0; $i -lt $levels.Length; $i++) {
            $w1 = ([Math]::Sin($tick + ($i * 0.58)) + 1.0) * 0.5
            $w2 = ([Math]::Sin(($tick * 0.53) - ($i * 0.31)) + 1.0) * 0.5
            $n = $rng.NextDouble()
            $target = Clamp01 (($smooth * (0.30 + (0.60 * $w1))) + ($smooth * 0.22 * $w2) + ($smooth * 0.12 * $n))
            $levels[$i] = ($levels[$i] * 0.66) + ($target * 0.34)
        }

        try { [Console]::SetCursorPosition(0, 0) } catch { Clear-Host }
        $frame = Build-Frame -ColumnLevels $levels -MicLevel $smooth -FrameHeight $heightClamped -Center $center -Esc $esc
        Write-Host -NoNewline $frame
        Write-Host -NoNewline ("Source: " + $activeSource + " | Raw: " + ([int][Math]::Round($raw * 100.0)) + "% | Noise: " + ([int][Math]::Round($noiseFloor * 100.0)) + "%      ")

        $tick += 0.28
        Start-Sleep -Milliseconds $DelayMs
    }
} finally {
    try { if ($captureMeter) { $captureMeter.Dispose() } } catch { }
    try { if ($renderMeter) { $renderMeter.Dispose() } } catch { }
    Stop-SpeechMicTracker $speechTracker
    Write-Host ""
    Write-Host $showCursor
}
