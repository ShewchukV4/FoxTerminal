param(
    [switch]$Status,
    [switch]$Unlock
)

. (Join-Path $PSScriptRoot "foxauth.ps1")

if ($Status) {
    $p = Get-ThemePalette
    $on = Test-FoxSessionLocked
    Write-Host (Color-Text $p.accent "FoxTerminal lock")
    Write-Host ("  " + $(if ($on) { "LOCKED as " + (Get-FoxLockUser) } else { "open" }))
    return
}

if ($Unlock) {
    if (-not (Test-FoxSessionLocked)) {
        Write-Host "Not locked."
        return
    }
    if (Unlock-FoxSession) { Complete-FoxSession -Fresh }
    return
}

if (-not $env:FOXTERM_USER) {
    Write-Host "Log in first."
    return
}
Lock-FoxSession | Out-Null
Write-Host "Locked. Shift+Alt+T then password to unlock. Windows stays signed in."
