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
    Write-Host "Usage: nfile <name.ext>  (e.g. nfile notes.txt, nfile data.xlsx)" -ForegroundColor Yellow
    return
}
if (-not (Test-HasFileExtension $name)) {
    Write-Host "Extension required. Example: nfile report.txt" -ForegroundColor Yellow
    return
}

$filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
if ($null -eq $filePath) {
    Write-Host "Invalid file name." -ForegroundColor Yellow
    return
}
if (-not (Test-Path -LiteralPath $filePath)) {
    New-Item -ItemType File -Path $filePath | Out-Null
    Write-Host "Created: $name" -ForegroundColor Green
} else {
    Write-Host "File already exists: $name" -ForegroundColor DarkYellow
}
