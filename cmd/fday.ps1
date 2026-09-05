param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"

$p = Get-ThemePalette
$root = $PSScriptRoot
Write-Host ""
Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF073) + "  FoxTerminal day"))
Write-Host ""

& "$root\ftime.ps1"
& "$root\weather.ps1" @Args
& "$root\wifi.ps1"
& "$root\ip.ps1"
