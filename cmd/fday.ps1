param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$root = $PSScriptRoot
Write-Host "FoxTerminal day"
Write-Host ""

& "$root\ftime.ps1"
Write-Host ""
& "$root\weather.ps1" @Args
Write-Host ""
& "$root\wifi.ps1"
Write-Host ""
& "$root\ip.ps1"
