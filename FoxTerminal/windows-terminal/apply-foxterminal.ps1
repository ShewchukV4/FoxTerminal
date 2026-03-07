$settingsPath = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
$configPath = Join-Path $PSScriptRoot "foxterminal.json"

if (-not (Test-Path $settingsPath)) {
    Write-Host "Windows Terminal settings not found: $settingsPath"
    exit 1
}
if (-not (Test-Path $configPath)) {
    Write-Host "FoxTerminal config not found: $configPath"
    exit 1
}

$settings = Get-Content -Path $settingsPath -Raw | ConvertFrom-Json
$config = Get-Content -Path $configPath -Raw | ConvertFrom-Json

if (-not $settings.schemes) { $settings | Add-Member -NotePropertyName schemes -NotePropertyValue @() }
if (-not $settings.profiles) { $settings | Add-Member -NotePropertyName profiles -NotePropertyValue @{ list = @() } }
if (-not $settings.profiles.list) { $settings.profiles.list = @() }

$schemeName = $config.scheme.name
$settings.schemes = @($settings.schemes | Where-Object { $_.name -ne $schemeName })
$settings.schemes += $config.scheme

$profileGuid = $config.profile.guid
$settings.profiles.list = @($settings.profiles.list | Where-Object { $_.guid -ne $profileGuid })
$settings.profiles.list += $config.profile

$settings | ConvertTo-Json -Depth 6 | Set-Content -Path $settingsPath -Encoding UTF8
Write-Host "FoxTerminal profile applied."
