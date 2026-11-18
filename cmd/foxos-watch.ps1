# Logon watchdog: if the FoxOS shell did not heartbeat for 30s, give this user Explorer back.
# Registered as task FoxOS-ShellWatch for this user only. The other Windows account is untouched.
Start-Sleep -Seconds 30
$ErrorActionPreference = "Continue"
$cmdDir = $PSScriptRoot
. (Join-Path $cmdDir "foxos-lib.ps1")
. (Join-Path $cmdDir "foxlook-lib.ps1")
function Start-WatchExplorer {
    if (Get-Process -Name explorer -ErrorAction SilentlyContinue) { return }
    try { Start-Process -FilePath "explorer.exe" } catch {}
}
$winShell = ""
try {
    $winShell = [string](Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name Shell -ErrorAction Stop).Shell
} catch {}
# look.json can say shell off while Winlogon still points at foxos-shell.cmd.
# The watchdog used to exit there and leave the sign-in with no Explorer.
if (-not (Test-FoxLookPart "shell")) {
    if ($winShell -like "*foxos-shell*") {
        try {
            Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name Shell -ErrorAction Stop
        } catch {}
    }
    Start-WatchExplorer
    exit 0
}
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
Start-WatchExplorer
exit 0
