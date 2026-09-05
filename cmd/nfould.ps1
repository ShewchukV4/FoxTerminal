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
$folder = Get-FoxIcon 0xF07B
$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host (Color-Text $p.dim ("  " + $folder + "  Usage: nfould <folder-name>"))
    return
}
if ($name -match '[\\/]' -or $name -match '\.\.') {
    Write-Host (Color-Text $p.dim ("  " + $folder + "  One folder name only. Use: go path/to/parent  then nfould name"))
    return
}

$newPath = Join-Path $cwd $name
if (-not (Test-Path -LiteralPath $newPath)) {
    New-Item -ItemType Directory -Path $newPath | Out-Null
    Write-Host (Color-Text $p.accent ("  " + $folder + "  Created  ")) -NoNewline
    Write-Host (Color-Text $p.accent2 $name)
} else {
    Write-Host (Color-Text $p.accent2 ("  " + $folder + "  Already exists  ")) -NoNewline
    Write-Host (Color-Text $p.text $name)
}
Sync-WaiPinFromNotes $PSScriptRoot $env:FOXTERM_USER
