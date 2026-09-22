# Logon watchdog: if the FoxOS shell did not heartbeat for 30s, give this user Explorer back.
# Registered as task FoxOS-ShellWatch for this user only. The other Windows account is untouched.
Start-Sleep -Seconds 30
$ErrorActionPreference = "Continue"
$cmdDir = $PSScriptRoot
. (Join-Path $cmdDir "foxos-lib.ps1")
. (Join-Path $cmdDir "foxlook-lib.ps1")
if (-not (Test-FoxLookPart "shell")) { exit 0 }
$alive = Read-FoxLookJson (Join-Path (Get-FoxOsDir) "shell-alive.json")
$ok = $false
if ($alive -and $alive.at) {
    try {
        $at = [DateTime]::Parse([string]$alive.at, $null, [Globalization.DateTimeStyles]::RoundtripKind)
        if ($at.Kind -eq [DateTimeKind]::Unspecified) { $at = [DateTime]::SpecifyKind($at, [DateTimeKind]::Utc) }
        $ok = (([DateTime]::UtcNow - $at.ToUniversalTime()).TotalSeconds -lt 25)
    } catch { $ok = $false }
}
if ($ok) { exit 0 }
try { Restore-FoxLookShell } catch {}
try { Start-Process -FilePath "explorer.exe" } catch {}
exit 0
