@param(
  [switch]$SkipWeb
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $SkipWeb) {
  Push-Location "$root\src\RemoteFlow.Web"
  npm install
  npm run build
  Pop-Location
  $www = "$root\src\RemoteFlow.Agent\wwwroot"
  Remove-Item $www -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $www | Out-Null
  Copy-Item -Recurse -Force "$root\src\RemoteFlow.Web\dist\*" $www
}
dotnet build "$root\RemoteFlow.slnx" -c Release
Write-Host "Output: $root\src\RemoteFlow.Agent\bin\Release\net10.0-windows10.0.19041.0\RemoteFlow.exe"
