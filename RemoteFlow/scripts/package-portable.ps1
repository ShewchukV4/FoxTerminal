$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
& "$PSScriptRoot\build.ps1"
$src = Get-ChildItem "$root\src\RemoteFlow.Agent\bin\Release" -Directory -Recurse |
  Where-Object { Test-Path (Join-Path $_.FullName "RemoteFlow.exe") } |
  Select-Object -First 1
if (-not $src) { throw "RemoteFlow.exe not found" }
$out = Join-Path $root "artifacts\RemoteFlow-portable"
Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -Recurse -Force "$($src.FullName)\*" $out
Write-Host "Portable folder: $out"
Write-Host "Run: $out\RemoteFlow.exe"
