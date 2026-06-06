param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host "Usage: fdel <name.ext>" -ForegroundColor Yellow
    return
}
if (-not (Test-HasFileExtension $name)) {
    Write-Host "Extension required. Example: fdel old.txt" -ForegroundColor Yellow
    return
}

$filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    Write-Host "File not found: $name" -ForegroundColor Yellow
    return
}

$pw = Read-PasswordPlain "Password to delete"
if (Verify-User $env:FOXTERM_USER $pw) {
    Remove-Item -LiteralPath $filePath -Force
    Write-Host "Deleted: $name" -ForegroundColor Green
} else {
    Write-Host "Canceled." -ForegroundColor DarkYellow
}
