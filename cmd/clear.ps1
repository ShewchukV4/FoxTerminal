param()
. (Join-Path $PSScriptRoot "foxauth.ps1")

if (Get-Command Clear-FoxScreen -ErrorAction SilentlyContinue) {
    Clear-FoxScreen
} else {
    Clear-FoxHost
}
