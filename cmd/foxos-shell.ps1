# FoxOS session shell. Winlogon starts foxos-shell.cmd, which runs this and keeps
# it alive for the whole sign-in. If foxos-live dies three times in a minute,
# Shell is put back to Explorer and explorer.exe is started.
$ErrorActionPreference = "Continue"
$cmdDir = $PSScriptRoot
. (Join-Path $cmdDir "foxos-lib.ps1")
. (Join-Path $cmdDir "foxlook-lib.ps1")

function Write-FoxLookShellAlive {
    $dir = Get-FoxOsDir
    $obj = [ordered]@{
        at   = [DateTime]::UtcNow.ToString("o")
        pid  = $PID
        live = [bool](Test-FoxOsLiveRunning)
    }
    Write-FoxLookJson (Join-Path $dir "shell-alive.json") $obj
}

Write-FoxLookShellAlive
if (Get-Command Write-FoxOsLiveState -ErrorAction SilentlyContinue) {
    try { Write-FoxOsLiveState } catch {}
}
try { Start-FoxOsLive | Out-Null } catch {}

$hk = Join-Path $cmdDir "foxhotkeys.ps1"
if (Test-Path -LiteralPath $hk) {
    try {
        Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $hk
        ) -WindowStyle Hidden | Out-Null
    } catch {}
}

$logon = Join-Path $env:LOCALAPPDATA "FoxTerminal\fox-logon.cmd"
if (Test-Path -LiteralPath $logon) {
    try { Start-Process -FilePath $logon } catch {}
}

$crashes = 0
$window = Get-Date
while ($true) {
    Write-FoxLookShellAlive
    if (-not (Test-FoxOsLiveRunning)) {
        if (((Get-Date) - $window).TotalSeconds -gt 60) {
            $crashes = 0
            $window = Get-Date
        }
        $crashes++
        if ($crashes -ge 3) {
            try { Restore-FoxLookShell } catch {}
            try { Start-Process -FilePath "explorer.exe" } catch {}
            exit 0
        }
        try { Start-FoxOsLive | Out-Null } catch {}
    }
    Start-Sleep -Seconds 4
}
