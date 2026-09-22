param()
. (Join-Path $PSScriptRoot "foxauth.ps1")
if (-not (Ensure-Login)) { return }
Show-FoxHome
