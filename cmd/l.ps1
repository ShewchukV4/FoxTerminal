param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"

$name = $null
$password = $null
if ($Args.Count -ge 1) { $name = $Args[0] }
if ($Args.Count -ge 2) { $password = $Args[1] }

while ([string]::IsNullOrWhiteSpace($name)) {
    $name = Read-Host "Username"
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "Username cannot be empty."
    }
}
if ($null -eq $password) {
    $password = Read-PasswordPlain "Password"
}

$users = Load-Users
if (-not $users.ContainsKey($name)) {
    try {
        New-User $name $password
        Set-CurrentUser $name
        Write-Host "User registered: $name"
        return
    } catch {
        Write-Host $_.Exception.Message
        return
    }
}

if (Verify-User $name $password) {
    Set-CurrentUser $name
    Write-Host "Logged in as: $name"
} else {
    Write-Host "Invalid username/password."
}
