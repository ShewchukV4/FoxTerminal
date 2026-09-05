param()

. "$PSScriptRoot\foxauth.ps1"

function Get-WifiInfo {
    $raw = netsh wlan show interfaces 2>$null
    if (-not $raw) { return $null }

    $info = @{
        State = $null
        SSID = $null
        Signal = $null
        Radio = $null
        Channel = $null
        Rx = $null
        Tx = $null
    }

    foreach ($line in $raw) {
        if ($line -match '^\s*State\s*:\s*(.+)$') { $info.State = $Matches[1].Trim(); continue }
        if ($line -match '^\s*SSID\s*:\s*(.+)$') { $info.SSID = $Matches[1].Trim(); continue }
        if ($line -match '^\s*Signal\s*:\s*(\d+)%') { $info.Signal = [int]$Matches[1]; continue }
        if ($line -match '^\s*Radio type\s*:\s*(.+)$') { $info.Radio = $Matches[1].Trim(); continue }
        if ($line -match '^\s*Channel\s*:\s*(\d+)$') { $info.Channel = [int]$Matches[1]; continue }
        if ($line -match '^\s*Receive rate \(Mbps\)\s*:\s*(\d+)') { $info.Rx = [int]$Matches[1]; continue }
        if ($line -match '^\s*Transmit rate \(Mbps\)\s*:\s*(\d+)') { $info.Tx = [int]$Matches[1]; continue }
    }

    return $info
}

function Get-FrequencyLabel([int]$channel) {
    if (-not $channel) { return "unknown" }
    if ($channel -le 14) { return "2.4 GHz" }
    if ($channel -le 165) { return "5 GHz" }
    return "6 GHz"
}

$p = Get-ThemePalette
$wifi = Get-FoxIcon 0xF1EB

$info = Get-WifiInfo
if (-not $info) {
    Write-Host (Color-Text $p.dim ("  " + $wifi + "  Wi-Fi info not available."))
    exit 1
}

if ($info.State -and $info.State -notmatch 'connected') {
    Write-Host (Color-Text $p.accent2 ("  " + $wifi + "  Wi-Fi: ")) -NoNewline
    Write-Host (Color-Text $p.text $info.State)
    exit 0
}

$freq = Get-FrequencyLabel $info.Channel
$signal = if ($null -ne $info.Signal) { $info.Signal } else { 0 }
$ssidLabel = if ($null -ne $info.SSID -and $info.SSID -ne "") { $info.SSID } else { "(hidden)" }
$channelLabel = if ($null -ne $info.Channel) { $info.Channel } else { "?" }
$radioLabel = if ($null -ne $info.Radio -and $info.Radio -ne "") { $info.Radio } else { "?" }
$rxLabel = if ($null -ne $info.Rx) { $info.Rx } else { "?" }
$txLabel = if ($null -ne $info.Tx) { $info.Tx } else { "?" }
$barLen = 20

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + $wifi + "  Wi-Fi"))
Write-Host (Color-Text $p.dim "  SSID     ") -NoNewline
Write-Host (Color-Text $p.text $ssidLabel)
Write-Host (Color-Text $p.dim "  Signal   ") -NoNewline
Write-Host (Color-Text $p.accent2 ("{0}%" -f $signal))
Write-Host (Color-Text $p.dim "  Channel  ") -NoNewline
Write-Host (Color-Text $p.text ("{0} ({1})" -f $channelLabel, $freq))
Write-Host (Color-Text $p.dim "  Radio    ") -NoNewline
Write-Host (Color-Text $p.text $radioLabel)
Write-Host (Color-Text $p.dim "  Rx/Tx    ") -NoNewline
Write-Host (Color-Text $p.text ("{0}/{1} Mbps" -f $rxLabel, $txLabel))
Write-Host ""

$fill = [Math]::Round(($signal / 100) * $barLen)
$fill = [Math]::Max(0, [Math]::Min($barLen, $fill))
$barOn = [string][char]0x2588
$barOff = [string][char]0x2591
Write-Host (Color-Text $p.dim "  ") -NoNewline
Write-Host (Color-Text $p.accent ($barOn * $fill)) -NoNewline
Write-Host (Color-Text $p.dim ($barOff * ($barLen - $fill))) -NoNewline
Write-Host (Color-Text $p.accent2 ("  {0}%" -f $signal))
Write-Host ""
