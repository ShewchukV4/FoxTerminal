param()

. "$PSScriptRoot\foxauth.ps1"

if (-not (Ensure-Login)) { return }
$name = $env:FOXTERM_USER
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host "Not logged in."
    return
}

$old = Read-PasswordPlain "Current password"
if (-not (Verify-User $name $old)) {
    Write-Host "Invalid password."
    return
}

$p1 = Read-PasswordPlain "New password"
$p2 = Read-PasswordPlain "Confirm password"
if ($p1 -ne $p2) {
    Write-Host "Passwords do not match."
    return
}

$users = Load-Users
if (-not $users.ContainsKey($name)) {
    Write-Host "User not found."
    return
}
$salt = New-Salt
$hash = Hash-Password $p1 $salt
$users[$name].salt = $salt
$users[$name].hash = $hash
$users[$name].updated = (Get-Date).ToString("s")
Save-Users $users
Write-Host "Password updated."
