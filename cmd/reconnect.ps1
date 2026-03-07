param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

function Get-CurrentSsid {
    $raw = netsh wlan show interfaces 2>$null
    if (-not $raw) { return $null }
    foreach ($line in $raw) {
        if ($line -match '^\s*SSID\s*:\s*(.+)$') {
            return $Matches[1].Trim()
        }
    }
    return $null
}

function Get-Profiles {
    $raw = netsh wlan show profiles 2>$null
    if (-not $raw) { return @() }
    $profiles = @()
    foreach ($line in $raw) {
        if ($line -match '^\s*All User Profile\s*:\s*(.+)$') {
            $profiles += $Matches[1].Trim()
        }
    }
    return $profiles
}

function Show-Status {
    $raw = netsh wlan show interfaces 2>$null
    if (-not $raw) { return }
    $state = $null
    $ssid = $null
    $signal = $null
    foreach ($line in $raw) {
        if ($line -match '^\s*State\s*:\s*(.+)$') { $state = $Matches[1].Trim(); continue }
        if ($line -match '^\s*SSID\s*:\s*(.+)$') { $ssid = $Matches[1].Trim(); continue }
        if ($line -match '^\s*Signal\s*:\s*(\d+)%') { $signal = $Matches[1].Trim(); continue }
    }
    if ($state) {
        $label = if ($ssid) { $ssid } else { "(none)" }
        $sig = if ($signal) { "$signal%" } else { "?" }
        Write-Host ("Wi-Fi: {0} | SSID: {1} | Signal: {2}" -f $state, $label, $sig)
    }
}

$profile = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($profile)) {
    $profile = Get-CurrentSsid
}
if ([string]::IsNullOrWhiteSpace($profile)) {
    $profiles = Get-Profiles
    if ($profiles.Count -eq 0) {
        Write-Host "No Wi-Fi profiles found."
        exit 1
    }
    $profile = $profiles[0]
}

Write-Host ("Reconnecting to: " + $profile)
try { netsh wlan disconnect | Out-Null } catch {}
Start-Sleep -Seconds 2
try { netsh wlan connect name="$profile" | Out-Null } catch {}
Start-Sleep -Seconds 2
Show-Status
