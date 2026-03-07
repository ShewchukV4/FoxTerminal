param()

function Format-Bytes([double]$bytes) {
    if ($bytes -ge 1TB) { return "{0:N2} TB" -f ($bytes / 1TB) }
    if ($bytes -ge 1GB) { return "{0:N2} GB" -f ($bytes / 1GB) }
    if ($bytes -ge 1MB) { return "{0:N2} MB" -f ($bytes / 1MB) }
    if ($bytes -ge 1KB) { return "{0:N2} KB" -f ($bytes / 1KB) }
    return "{0:N0} B" -f $bytes
}

$drives = Get-PSDrive -PSProvider FileSystem
if ($null -eq $drives -or $drives.Count -eq 0) {
    Write-Host "No drives found."
    exit 1
}

Write-Host "Disks"
foreach ($d in $drives) {
    $used = $d.Used
    $free = $d.Free
    $size = $used + $free
    $pct = if ($size -gt 0) { [Math]::Round(($used / $size) * 100) } else { 0 }
    Write-Host ("{0}: Used {1} / {2} ({3}%)  Free {4}" -f $d.Name, (Format-Bytes $used), (Format-Bytes $size), $pct, (Format-Bytes $free))
}
