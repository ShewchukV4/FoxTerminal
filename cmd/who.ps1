param()

. "$PSScriptRoot\foxauth.ps1"

if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) {
    Write-Host "Not logged in."
    Show-Users
    return
}

Write-Host ("Current user: " + $env:FOXTERM_USER)
