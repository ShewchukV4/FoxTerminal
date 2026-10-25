param()

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (-not (Test-Path $foxauthPath)) {
    Write-Host "foxauth.ps1 not found."
    exit 1
}

. $foxauthPath
$changed = Set-MainTheme "orange"
if ($changed) {
    Write-Host ""
    Write-Host (Color-Text "#DC7A14" "  Fox Default ON.")
    Write-Host "  Wallpaper + terminal synced to orange."
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  Already on Fox Default."
    Write-Host ""
}
