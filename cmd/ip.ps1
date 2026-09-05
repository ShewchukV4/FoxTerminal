param()

. "$PSScriptRoot\foxauth.ps1"

$p = Get-ThemePalette
$globe = Get-FoxIcon 0xF0AC
$plug = Get-FoxIcon 0xF1E6

$public = $null
try {
    $public = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 6).Content.Trim()
} catch {
    $public = $null
}

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + $globe + "  IP"))
if (-not [string]::IsNullOrWhiteSpace($public)) {
    Write-Host (Color-Text $p.accent ("  " + $globe + "  ")) -NoNewline
    Write-Host (Color-Text $p.dim "public  ") -NoNewline
    Write-Host (Color-Text $p.text $public)
} else {
    Write-Host (Color-Text $p.dim ("  " + $globe + "  public  (unavailable)"))
}

try {
    $local = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
        Sort-Object InterfaceIndex
    if ($local -and $local.Count -gt 0) {
        foreach ($addr in $local) {
            $label = if ($addr.InterfaceAlias) { $addr.InterfaceAlias } else { $addr.InterfaceIndex }
            Write-Host (Color-Text $p.accent ("  " + $plug + "  ")) -NoNewline
            Write-Host (Color-Text $p.dim "local   ") -NoNewline
            Write-Host (Color-Text $p.text $addr.IPAddress) -NoNewline
            Write-Host (Color-Text $p.dim ("  (" + $label + ")"))
        }
    } else {
        Write-Host (Color-Text $p.dim ("  " + $plug + "  local   (none)"))
    }
} catch {
    Write-Host (Color-Text $p.dim ("  " + $plug + "  local   (unavailable)"))
}
Write-Host ""
