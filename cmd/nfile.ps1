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
$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host (Color-Text $p.dim ("  " + (Get-FoxIcon 0xF15B) + "  Usage: nfile <name.ext>  (e.g. nfile notes.txt)"))
    return
}
if (-not (Test-HasFileExtension $name)) {
    Write-Host (Color-Text $p.dim ("  " + (Get-FoxIcon 0xF15B) + "  Extension required. Example: nfile report.txt"))
    return
}

$filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
if ($null -eq $filePath) {
    Write-Host (Color-Text $p.dim ("  " + (Get-FoxIcon 0xF15B) + "  Invalid file name."))
    return
}
$st = Get-NotesFileStyle $name $p
if (-not (Test-Path -LiteralPath $filePath)) {
    New-Item -ItemType File -Path $filePath | Out-Null
    Write-Host (Color-Text $p.accent ("  " + $st.Icon + "  Created  ")) -NoNewline
    Write-Host (Color-Text $p.text $name)
} else {
    Write-Host (Color-Text $p.accent2 ("  " + $st.Icon + "  Already exists  ")) -NoNewline
    Write-Host (Color-Text $p.text $name)
}
Sync-WaiPinFromNotes $PSScriptRoot $env:FOXTERM_USER
