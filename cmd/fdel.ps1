param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

$p = Get-ThemePalette
$trash = Get-FoxIcon 0xF1F8
$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host (Color-Text $p.dim ("  " + $trash + "  Usage: fdel <name.ext>"))
    return
}
if (-not (Test-HasFileExtension $name)) {
    Write-Host (Color-Text $p.dim ("  " + $trash + "  Extension required. Example: fdel old.txt"))
    return
}

$filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    Write-Host (Color-Text $p.dim ("  " + $trash + "  File not found: ")) -NoNewline
    Write-Host (Color-Text $p.text $name)
    return
}

$pw = Read-PasswordPlain "Password to delete"
if (Verify-User $env:FOXTERM_USER $pw) {
    Remove-Item -LiteralPath $filePath -Force
    Write-Host (Color-Text $p.accent ("  " + $trash + "  Deleted  ")) -NoNewline
    Write-Host (Color-Text $p.text $name)
    Sync-WaiPinFromNotes $PSScriptRoot $env:FOXTERM_USER
} else {
    Write-Host (Color-Text $p.dim ("  " + $trash + "  Canceled."))
}
