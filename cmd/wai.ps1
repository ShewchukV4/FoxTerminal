param(
    [switch]$Pin,
    [switch]$Unpin,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

foreach ($token in @($Rest)) {
    $t = [string]$token
    if ($t -match '^(?i)-?pin$') { $Pin = $true }
    if ($t -match '^(?i)-?unpin$') { $Unpin = $true }
}

$pinRequest = [bool]$Pin -or [bool]$Unpin

if (-not $pinRequest -and -not (Test-WaiPinEnabled) -and $env:FOXTERM_SYNC_CONTEXT -ne "daemon") {
    $ffsyncPath = Join-Path $PSScriptRoot "ffsync.ps1"
    if ((Test-FfsyncDaemonAlive) -and (Test-Path $ffsyncPath)) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $ffsyncPath exec "wai"
        if ($LASTEXITCODE -eq 0) { exit 0 }
    }
}

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

if ($Unpin) {
    Uninstall-WaiPin
    if (Get-Command Clear-FoxScreen -ErrorAction SilentlyContinue) {
        Clear-FoxScreen
    } else {
        $esc = [char]27
        if (Get-Command Reset-WaiScrollRegion -ErrorAction SilentlyContinue) {
            try { Reset-WaiScrollRegion } catch {}
        }
        Clear-Host
        if (Get-Command Repair-TerminalColors -ErrorAction SilentlyContinue) {
            Repair-TerminalColors
        }
        try { [Console]::Write("$esc[3J") } catch {}
    }
    $p = Get-NotesPalette
    Write-Host (Color-Text $p.dim ("  " + (Get-NotesIcon 0xF08D) + "  wai unpinned"))
    return
}

if ($Pin) {
    Install-WaiPin $cwd $paths.NotesRoot $paths.User
    return
}

Show-Wai $cwd $paths.NotesRoot $paths.User
