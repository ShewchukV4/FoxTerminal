param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

if ($Args.Count -eq 0) {
    Write-Host "Usage: go <folder> or go path/to/folder" -ForegroundColor Yellow
    Write-Host ("Current: notes/" + $paths.User + "/" + (Get-NotesRelPath $cwd $paths.NotesRoot))
    return
}

$dest = ($Args -join " ").Trim()
$target = Resolve-NotesGoTarget $cwd $paths.NotesRoot $dest
if ($null -eq $target) {
    Write-Host "Folder not found." -ForegroundColor Yellow
    return
}

Set-NoteSessionCwd $target
Show-Wai $target $paths.NotesRoot $paths.User
