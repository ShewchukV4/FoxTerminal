param()

. "$PSScriptRoot\foxauth.ps1"

function Format-Bytes([double]$bytes) {
    if ($bytes -ge 1TB) { return "{0:N2} TB" -f ($bytes / 1TB) }
    if ($bytes -ge 1GB) { return "{0:N2} GB" -f ($bytes / 1GB) }
    if ($bytes -ge 1MB) { return "{0:N2} MB" -f ($bytes / 1MB) }
    if ($bytes -ge 1KB) { return "{0:N2} KB" -f ($bytes / 1KB) }
    return "{0:N0} B" -f $bytes
}

$p = Get-ThemePalette
$hdd = Get-FoxIcon 0xF0A0
$drives = Get-PSDrive -PSProvider FileSystem
if ($null -eq $drives -or $drives.Count -eq 0) {
    Write-Host (Color-Text $p.dim ("  " + $hdd + "  No drives found."))
    exit 1
}

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + $hdd + "  disks"))
foreach ($d in $drives) {
    $used = $d.Used
    $free = $d.Free
    $size = $used + $free
    $pct = if ($size -gt 0) { [Math]::Round(($used / $size) * 100) } else { 0 }
    Write-Host (Color-Text $p.accent ("  " + $hdd + "  ")) -NoNewline
    Write-Host (Color-Text $p.text ($d.Name + ":")) -NoNewline
    Write-Host (Color-Text $p.dim ("  used ")) -NoNewline
    Write-Host (Color-Text $p.accent2 (Format-Bytes $used)) -NoNewline
    Write-Host (Color-Text $p.dim (" / " + (Format-Bytes $size) + " (")) -NoNewline
    Write-Host (Color-Text $p.accent2 ("{0}%" -f $pct)) -NoNewline
    Write-Host (Color-Text $p.dim (")  free ")) -NoNewline
    Write-Host (Color-Text $p.text (Format-Bytes $free))
}
Write-Host ""
