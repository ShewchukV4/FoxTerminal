param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$location = ""
if ($Args.Count -ge 1) {
    $location = ($Args -join " ").Trim()
}

$locEncoded = if ([string]::IsNullOrWhiteSpace($location)) { "" } else { [uri]::EscapeDataString($location) }
$url = if ($locEncoded -eq "") { "https://wttr.in/?format=3" } else { "https://wttr.in/$locEncoded?format=3" }

function Try-GetWeatherText([string]$requestUrl) {
    try {
        $headers = @{
            "User-Agent" = "curl/8.0"
            "Accept" = "text/plain"
        }
        $resp = Invoke-WebRequest -Uri $requestUrl -UseBasicParsing -TimeoutSec 8 -Headers $headers
        $content = $resp.Content
        if ($content -is [byte[]]) {
            $text = [System.Text.Encoding]::UTF8.GetString($content).Trim()
        } else {
            $text = ($content | Out-String).Trim()
        }
        if ([string]::IsNullOrWhiteSpace($text)) { return $null }
        if ($text -match '<!DOCTYPE html|<html') { return $null }
        return $text
    } catch {
        return $null
    }
}

function Get-CurrentSsid {
    $raw = netsh wlan show interfaces 2>$null
    if (-not $raw) { return $null }
    foreach ($line in $raw) {
        if ($line -match '^\s*SSID\s*:\s*(.+)$') { return $Matches[1].Trim() }
    }
    return $null
}

function Get-FirstProfile {
    $raw = netsh wlan show profiles 2>$null
    if (-not $raw) { return $null }
    foreach ($line in $raw) {
        if ($line -match '^\s*All User Profile\s*:\s*(.+)$') { return $Matches[1].Trim() }
    }
    return $null
}

function Reconnect-Silent([string]$profileName) {
    if ([string]::IsNullOrWhiteSpace($profileName)) { return }
    try { netsh wlan disconnect | Out-Null } catch {}
    Start-Sleep -Seconds 2
    try { netsh wlan connect name="$profileName" | Out-Null } catch {}
    Start-Sleep -Seconds 2
}

$text = Try-GetWeatherText $url
if ($null -ne $text) {
    Write-Host $text
    return
}

$ssid = Get-CurrentSsid
if ([string]::IsNullOrWhiteSpace($ssid)) {
    $ssid = Get-FirstProfile
}
Reconnect-Silent $ssid

$text = Try-GetWeatherText $url
if ($null -ne $text) {
    Write-Host $text
    return
}

Write-Host "Weather unavailable. Check connection or try again."
if (Get-Command Write-FoxToast -ErrorAction SilentlyContinue) {
    Write-FoxToast "weather unavailable"
}
