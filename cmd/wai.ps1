. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if ($env:FOXTERM_SYNC_CONTEXT -ne "daemon") {
    $pidPath = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\daemon.pid"
    $ffsyncPath = Join-Path $PSScriptRoot "ffsync.ps1"
    if ((Test-Path $pidPath) -and (Test-Path $ffsyncPath)) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $ffsyncPath exec "wai"
        exit $LASTEXITCODE
    }
}

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome
Show-Wai $cwd $paths.NotesRoot $paths.User
