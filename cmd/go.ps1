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
    $p = Get-ThemePalette
    $folder = Get-FoxIcon 0xF07B
    Write-Host (Color-Text $p.dim ("  " + $folder + "  Usage: go <folder> or go path/to/folder"))
    Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF041) + "  ")) -NoNewline
    Write-Host (Color-Text $p.text ("notes/" + $paths.User + "/" + (Get-NotesRelPath $cwd $paths.NotesRoot)))
    return
}

$dest = ($Args -join " ").Trim()
$target = Resolve-NotesGoTarget $cwd $paths.NotesRoot $dest
if ($null -eq $target) {
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.dim ("  " + (Get-FoxIcon 0xF07B) + "  Folder not found."))
    return
}

Set-NoteSessionCwd $target
Show-Wai $target $paths.NotesRoot $paths.User
