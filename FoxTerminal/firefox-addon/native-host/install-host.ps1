param(
    [string]$HostName = "com.foxterminal.bridge",
    [string]$ExtensionId = "foxterminal-companion@local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$hostDir = $PSScriptRoot
$runnerPath = Join-Path $hostDir "foxterminal-native-host.cmd"

if (-not (Test-Path $runnerPath)) {
    throw "Native host runner not found: $runnerPath"
}

$targets = @(
    @{
        Name = "Mozilla/Firefox/Zen (shared)"
        ManifestDir = (Join-Path $env:APPDATA "Mozilla\NativeMessagingHosts")
        RegPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\$HostName"
    },
    @{
        Name = "Zen Browser"
        ManifestDir = (Join-Path $env:APPDATA "zen\NativeMessagingHosts")
        RegPath = "HKCU:\Software\Zen\NativeMessagingHosts\$HostName"
    },
    @{
        Name = "Zen Browser (alt)"
        ManifestDir = (Join-Path $env:APPDATA "Zen Browser\NativeMessagingHosts")
        RegPath = "HKCU:\Software\Zen Browser\NativeMessagingHosts\$HostName"
    }
)

$manifest = [ordered]@{
    name = $HostName
    description = "FoxTerminal Native Messaging bridge"
    path = $runnerPath
    type = "stdio"
    allowed_extensions = @($ExtensionId)
}
$json = $manifest | ConvertTo-Json -Depth 6

foreach ($target in $targets) {
    if (-not (Test-Path $target.ManifestDir)) {
        New-Item -ItemType Directory -Path $target.ManifestDir -Force | Out-Null
    }

    $manifestPath = Join-Path $target.ManifestDir ($HostName + ".json")
    [System.IO.File]::WriteAllText($manifestPath, $json, [System.Text.Encoding]::UTF8)

    if (-not (Test-Path $target.RegPath)) {
        New-Item -Path $target.RegPath -Force | Out-Null
    }
    Set-ItemProperty -Path $target.RegPath -Name "(default)" -Value $manifestPath

    Write-Host ("Registered [{0}]" -f $target.Name)
    Write-Host ("  Manifest : {0}" -f $manifestPath)
    Write-Host ("  Registry : {0}" -f $target.RegPath)
}

Write-Host ""
Write-Host "Native host installed for Firefox + Zen."
Write-Host "Host name: $HostName"
Write-Host ""
Write-Host "Next (Zen Browser preferred):"
Write-Host "1) Open Zen -> about:debugging#/runtime/this-firefox"
Write-Host "2) Load Temporary Add-on OR install signed .xpi from about:addons"
Write-Host "3) Select:"
Write-Host "   $((Join-Path (Split-Path $hostDir -Parent) 'manifest.json'))"
Write-Host "4) Pin the extension and test sidebar / AI / sessions."
