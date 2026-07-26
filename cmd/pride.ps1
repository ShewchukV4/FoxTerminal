param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (-not (Test-Path $foxauthPath)) {
    Write-Host "foxauth.ps1 not found."
    exit 1
}

. $foxauthPath
Invoke-PrideToggle
