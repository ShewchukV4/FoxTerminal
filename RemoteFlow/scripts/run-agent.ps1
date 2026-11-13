$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Get-ChildItem "$root\src\RemoteFlow.Agent\bin\Release" -Recurse -Filter RemoteFlow.exe | Select-Object -First 1
if (-not $exe) { throw "Build first: .\scripts\build.ps1" }
Start-Process $exe.FullName
