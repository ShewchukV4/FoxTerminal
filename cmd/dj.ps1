param()

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

function Ensure-AudioMeterType {
    if ("FoxTerm.AudioMeter" -as [type]) { return }
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace FoxTerm {
  public sealed class AudioMeter : IDisposable {
    // CoreAudio COM interop for default render endpoint peak meter
    private IMMDeviceEnumerator _enumerator;
    private IMMDevice _device;
    private IAudioMeterInformation _meter;

    private AudioMeter() { }

    public static AudioMeter Create() {
      var a = new AudioMeter();
      a.Init();
      return a;
    }

    private void Init() {
      var clsid = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"); // MMDeviceEnumerator
      var type = Type.GetTypeFromCLSID(clsid, true);
      _enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(type);
      _enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out _device);
      var iid = typeof(IAudioMeterInformation).GUID;
      object o;
      _device.Activate(ref iid, (int)CLSCTX.CLSCTX_ALL, IntPtr.Zero, out o);
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
      int NotImpl1();
      [PreserveSig]
      int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice ppDevice);
      // rest not needed
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice {
      [PreserveSig]
      int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
      // rest not needed
    }

    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioMeterInformation {
      [PreserveSig]
      int GetPeakValue(out float pfPeak);
      // rest not needed
    }
  }
}
"@ -ErrorAction Stop | Out-Null
}

Ensure-Utf8Console
Ensure-AudioMeterType

$esc = [char]27
$hideCursor = "$esc[?25l"
$showCursor = "$esc[?25h"
$reset = "$esc[0m"

# Keep file ASCII-safe: build non-ASCII strings at runtime.
$blockFull = [char]0x2588  # █
$blockLow  = [char]0x2581  # ▁
$dashEm    = [char]0x2014  # —
$djTitle = "FOXTERM DJ  (Esc = exit)"
$djPhrase = -join @([char]0x042F,[char]0x0020,[char]0x0432,[char]0x0020,[char]0x0434,[char]0x0456,[char]0x0434,[char]0x0436,[char]0x0435,[char]0x044F) # "Я в діджея"
$djTip = -join @(
    "Tip: ",
    [char]0x0437,[char]0x0430,[char]0x043F,[char]0x0443,[char]0x0441,[char]0x0442,[char]0x0438,[char]0x0020,
    [char]0x043C,[char]0x0443,[char]0x0437,[char]0x0438,[char]0x043A,[char]0x0443,[char]0x002F,
    [char]0x0432,[char]0x0456,[char]0x0434,[char]0x0435,[char]0x043E,[char]0x0020,
    $dashEm,[char]0x0020,
    [char]0x043F,[char]0x0440,[char]0x044F,[char]0x043C,[char]0x043E,[char]0x043A,[char]0x0443,[char]0x0442,[char]0x043D,[char]0x0438,[char]0x043A,[char]0x0438,[char]0x0020,
    [char]0x043E,[char]0x0436,[char]0x0438,[char]0x0432,[char]0x0443,[char]0x0442,[char]0x044C,[char]0x002E
)

function ClampInt([int]$v, [int]$min, [int]$max) {
    if ($v -lt $min) { return $min }
    if ($v -gt $max) { return $max }
    return $v
}

function Render-Frame([double]$level, [int]$widthBars, [int]$heightBars) {
    $filled = [int][Math]::Round($level * $heightBars)
    $filled = ClampInt $filled 0 $heightBars

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append($hideCursor)

    [void]$sb.AppendLine($djTitle)
    [void]$sb.AppendLine(("{0} | Level: {1,3:P0}" -f $djPhrase, $level))
    [void]$sb.AppendLine("")

    for ($y = $heightBars; $y -ge 1; $y--) {
        for ($x = 0; $x -lt $widthBars; $x++) {
            if ($y -le $filled) {
                # gradient by height
                if ($y -le [Math]::Max(1, [int]($heightBars * 0.33))) {
                    [void]$sb.Append("$esc[38;2;90;255;140m")
                } elseif ($y -le [Math]::Max(1, [int]($heightBars * 0.66))) {
                    [void]$sb.Append("$esc[38;2;255;220;90m")
                } else {
                    [void]$sb.Append("$esc[38;2;255;90;90m")
                }
                [void]$sb.Append($blockFull)
            } else {
                [void]$sb.Append("$esc[38;2;60;60;60m")
                [void]$sb.Append($blockLow)
            }
            [void]$sb.Append($reset)
        }
        [void]$sb.AppendLine("")
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($djTip)
    return $sb.ToString()
}

try {
    $meter = [FoxTerm.AudioMeter]::Create()
} catch {
    Write-Host "Не можу підключитися до системного аудіо-метра."
    Write-Host "Спробуй запустити Ghostty/PowerShell як звичайний юзер (не адмін) і ще раз."
    Write-Host $_.Exception.Message
    exit 1
}

$widthBars = 40
$heightBars = 12
$smooth = 0.0

try {
    Clear-Host
    while ($true) {
        if ([Console]::KeyAvailable) {
            $k = [Console]::ReadKey($true)
            if ($k.Key -eq "Escape") { break }
        }

        $peak = 0.0
        try { $peak = [double]$meter.GetPeak() } catch { $peak = 0.0 }

        # smoothing
        $smooth = ($smooth * 0.80) + ($peak * 0.20)

        # move cursor to top-left (no full clear = smoother)
        try { [Console]::SetCursorPosition(0, 0) } catch { Clear-Host }
        $frame = Render-Frame $smooth $widthBars $heightBars
        Write-Host -NoNewline $frame
        Start-Sleep -Milliseconds 60
    }
} finally {
    try { $meter.Dispose() } catch { }
    Write-Host $showCursor
}

