. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

if ($cwd -ieq $paths.NotesRoot) {
    Write-Host "Already at notes root." -ForegroundColor DarkYellow
    return
}

$parent = Split-Path -Parent $cwd
if (-not $parent.StartsWith($paths.NotesRoot, [StringComparison]::OrdinalIgnoreCase)) {
    $parent = $paths.NotesRoot
}
Set-NoteSessionCwd $parent
Show-Wai $parent $paths.NotesRoot $paths.User
