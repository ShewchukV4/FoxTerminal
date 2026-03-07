param()

$public = $null
try {
    $public = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 6).Content.Trim()
} catch {
    $public = $null
}

Write-Host "IP info"
if (-not [string]::IsNullOrWhiteSpace($public)) {
    Write-Host ("  Public: " + $public)
} else {
    Write-Host "  Public: (unavailable)"
}

try {
    $local = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
        Sort-Object InterfaceIndex
    if ($local -and $local.Count -gt 0) {
        foreach ($ip in $local) {
            $label = if ($ip.InterfaceAlias) { $ip.InterfaceAlias } else { $ip.InterfaceIndex }
            Write-Host ("  Local:  {0} ({1})" -f $ip.IPAddress, $label)
        }
    } else {
        Write-Host "  Local:  (none)"
    }
} catch {
    Write-Host "  Local:  (unavailable)"
}
