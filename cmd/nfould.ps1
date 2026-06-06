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
    Write-Host "Usage: nfould <folder-name>" -ForegroundColor Yellow
    return
}
if ($name -match '[\\/]' -or $name -match '\.\.') {
    Write-Host "One folder name only. Use: go path/to/parent  then nfould name" -ForegroundColor Yellow
    return
}

$newPath = Join-Path $cwd $name
if (-not (Test-Path -LiteralPath $newPath)) {
    New-Item -ItemType Directory -Path $newPath | Out-Null
    Write-Host "Created folder: $name" -ForegroundColor Green
} else {
    Write-Host "Folder already exists: $name" -ForegroundColor DarkYellow
}
