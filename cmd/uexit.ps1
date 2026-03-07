. "$PSScriptRoot\foxauth.ps1"
if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) {
    Write-Host "Not logged in."
    Show-Users
    return
}
Clear-CurrentUser
Write-Host "Logged out."
Show-Users
