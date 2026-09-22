Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FoxEnum {
  public delegate bool EnumProc(IntPtr h, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public struct RECT { public int L, T, R, B; }
}
"@
$want = (Get-Process winghostty | Select-Object -First 1).Id
Write-Host "pid=$want"
$cb = [FoxEnum+EnumProc]{
  param($h, $lp)
  $wp = [uint32]0
  [void][FoxEnum]::GetWindowThreadProcessId($h, [ref]$wp)
  if ($wp -eq $want) {
    $r = New-Object FoxEnum+RECT
    [void][FoxEnum]::GetWindowRect($h, [ref]$r)
    $sb = New-Object System.Text.StringBuilder 256
    $cl = New-Object System.Text.StringBuilder 256
    [void][FoxEnum]::GetWindowText($h, $sb, 256)
    [void][FoxEnum]::GetClassName($h, $cl, 256)
    $w = $r.R - $r.L; $ht = $r.B - $r.T
    Write-Host ("hwnd={0} vis={1} {2}x{3} class={4} title={5}" -f $h, [FoxEnum]::IsWindowVisible($h), $w, $ht, $cl, $sb)
  }
  return $true
}
[void][FoxEnum]::EnumWindows($cb, [IntPtr]::Zero)
