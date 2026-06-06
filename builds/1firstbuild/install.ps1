# ============================================================
#  FoxTerminal -- First Build Installer
#  Copies the full FoxTerminal base to a chosen location
#  and resets all configs to clean defaults.
# ============================================================

$ErrorActionPreference = 'Stop'

# ── helpers ─────────────────────────────────────────────────
function Write-Fox {
    param([string]$Text, [ConsoleColor]$Color = 'White')
    Write-Host $Text -ForegroundColor $Color
}

function Write-Divider { Write-Fox ('─' * 60) 'DarkGray' }

function Prompt-Input {
    param([string]$Prompt)
    Write-Host $Prompt -ForegroundColor Cyan -NoNewline
    return (Read-Host)
}

# ── fix encoding so ASCII art renders correctly ──────────────
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ── banner ───────────────────────────────────────────────────
function Get-PixelBanner {
    $B = [string][char]0x2588
    $D = [string][char]0x2500
    $g = @{
        'F' = @("${B}${B}${B}${B}${B}${B}${B}",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}  ",
                "${B}${B}     ",
                "${B}${B}     ")
        'O' = @(" ${B}${B}${B}${B}${B} ",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}",
                " ${B}${B}${B}${B}${B} ")
        'X' = @("${B}${B}   ${B}${B}",
                " ${B}${B} ${B}${B} ",
                "  ${B}${B}${B}  ",
                " ${B}${B} ${B}${B} ",
                "${B}${B}   ${B}${B}")
        'T' = @("${B}${B}${B}${B}${B}${B}${B}",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ",
                "  ${B}${B}${B}  ")
        'E' = @("${B}${B}${B}${B}${B}${B}${B}",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}  ",
                "${B}${B}     ",
                "${B}${B}${B}${B}${B}${B}${B}")
        'R' = @("${B}${B}${B}${B}${B}${B} ",
                "${B}${B}   ${B}${B}",
                "${B}${B}${B}${B}${B}${B} ",
                "${B}${B}${B}${B} ${B} ",
                "${B}${B}   ${B}${B}")
        'M' = @("${B}${B}   ${B}${B}",
                "${B}${B}${B} ${B}${B}${B}",
                "${B}${B} ${B} ${B}${B}",
                "${B}${B}   ${B}${B}",
                "${B}${B}   ${B}${B}")
    }
    $bannerW = 57
    $result  = @()
    for ($row = 0; $row -lt 5; $row++) {
        $line = ''
        foreach ($ch in 'F','O','X') { $line += $g[$ch][$row] + ' ' }
        $line += ' '
        foreach ($ch in 'T','E','R','M') { $line += $g[$ch][$row] + ' ' }
        $result += $line.TrimEnd()
    }
    $result += ($D * $bannerW)
    $tag = '  [ First Build Installer ]  '
    $tagPad = [Math]::Max(0, [int](($bannerW - $tag.Length) / 2))
    $result += (' ' * $tagPad) + $tag
    return $result
}

Clear-Host
try { $termW = $Host.UI.RawUI.WindowSize.Width } catch { $termW = 80 }
if ($termW -le 0) { $termW = 80 }
$bannerRows   = Get-PixelBanner
$bannerColors = @('DarkYellow','DarkYellow','Yellow','Yellow','DarkYellow','DarkGray','Cyan')
$bannerW = ($bannerRows | ForEach-Object { $_.Length } | Measure-Object -Maximum).Maximum
Write-Fox ""
for ($ri = 0; $ri -lt $bannerRows.Count; $ri++) {
    $pad   = [Math]::Max(0, [int](($termW - $bannerW) / 2))
    $color = if ($ri -lt $bannerColors.Count) { $bannerColors[$ri] } else { 'White' }
    Write-Fox ((' ' * $pad) + $bannerRows[$ri]) $color
}
Write-Fox ""
Write-Fox ""
Write-Divider

# ── resolve source root ──────────────────────────────────────
# Case A: running from inside builds\1firstbuild\ --> go 2 levels up
# Case B: running from zip root where FoxTerminal\ folder sits next to install.ps1
$candidate_a = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$candidate_b = $PSScriptRoot

$src = if (Test-Path (Join-Path $candidate_a 'cmd')) {
    $candidate_a
} elseif (Test-Path (Join-Path $candidate_b 'FoxTerminal')) {
    $candidate_b
} else {
    $candidate_b   # fallback: same folder as script
}

Write-Fox "  Source  : $src" 'Gray'

# ── ask destination ──────────────────────────────────────────
Write-Fox ""
$dest = Prompt-Input "  Install to (e.g. C:\FoxTerminal or D:\Tools\Fox) > "
$dest = $dest.Trim().Trim('"').Trim("'")

if ([string]::IsNullOrWhiteSpace($dest)) {
    Write-Fox "  [!] No path entered. Aborting." 'Red'
    exit 1
}

# ── validate / create destination ───────────────────────────
if (Test-Path $dest) {
    $items = @(Get-ChildItem $dest -ErrorAction SilentlyContinue)
    if ($items.Count -gt 0) {
        Write-Fox ""
        Write-Fox "  [!] Folder already exists and is not empty." 'Yellow'
        $confirm = Prompt-Input "  Overwrite / merge? (y/N) > "
        if ($confirm -notmatch '^[yY]') {
            Write-Fox "  Aborting." 'Red'
            exit 1
        }
    }
} else {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

# ── folders to copy ──────────────────────────────────────────
$copyFolders = @('cmd', 'sites', 'FoxTerminal')
$skipFolders = @('.git', 'builds', '.vscode', 'FoxTerminalApp')

Write-Fox ""
Write-Divider
Write-Fox "  Copying files..." 'Cyan'

foreach ($folder in $copyFolders) {
    $folderSrc = Join-Path $src $folder
    if (-not (Test-Path $folderSrc)) { continue }
    $folderDst = Join-Path $dest $folder
    Write-Fox "    + $folder\" 'Gray'
    Copy-Item -Path $folderSrc -Destination $folderDst -Recurse -Force
}

# Copy root-level files (not folders, not ignored)
Get-ChildItem $src -File | Where-Object {
    $skipFolders -notcontains $_.Name
} | ForEach-Object {
    Write-Fox "    + $($_.Name)" 'DarkGray'
    Copy-Item $_.FullName -Destination $dest -Force
}

# ── reset to default configs ─────────────────────────────────
Write-Fox ""
Write-Fox "  Applying default settings..." 'Cyan'

$enc = [System.Text.UTF8Encoding]::new($false)
$cmdDst = Join-Path $dest 'cmd'

# bindings.json → empty
[System.IO.File]::WriteAllText(
    (Join-Path $cmdDst 'bindings.json'), '{}', $enc)
Write-Fox "    > bindings.json reset" 'DarkGray'

# sp / tg / ytm bindings → empty
foreach ($f in @('sp_bindings.json','tg_bindings.json','ytm_bindings.json')) {
    $p = Join-Path $cmdDst $f
    if (Test-Path $p) {
        [System.IO.File]::WriteAllText($p, '{}', $enc)
        Write-Fox "    > $f reset" 'DarkGray'
    }
}

# theme.txt → orange (default)
[System.IO.File]::WriteAllText(
    (Join-Path $cmdDst 'theme.txt'), "orange`n", $enc)
Write-Fox "    > theme.txt -> orange" 'DarkGray'

# users.json → clean (no users)
[System.IO.File]::WriteAllText(
    (Join-Path $cmdDst 'users.json'), '{}', $enc)
Write-Fox "    > users.json cleared (no users)" 'DarkGray'

# notes/ → keep folder, remove all files/subfolders
$notesDst = Join-Path $cmdDst 'notes'
if (Test-Path $notesDst) {
    Get-ChildItem $notesDst | Remove-Item -Recurse -Force
    Write-Fox "    > notes/ cleared" 'DarkGray'
}

# ── create a launch shortcut hint file ───────────────────────
$readmePath = Join-Path $dest 'HOW_TO_LAUNCH.txt'
$readmeContent = @"
=== FoxTerminal - How to Launch ===

1. CMD (Windows Command Prompt):
   Run this from cmd.exe:
     "$dest\cmd\foxterm-cmd-init.cmd"

   Or create a shortcut to cmd.exe with target:
     cmd.exe /k "$dest\cmd\foxterm-cmd-init.cmd"

2. Mintty / Git Bash / Cygwin:
   Open mintty and run:
     source "$dest/cmd/foxterm-bash-init.sh"
   
   Or launch via the 'term' command if already in FoxTerminal:
     term bash

3. FoxTerminalApp (GUI):
   Open:
     $dest\FoxTerminalApp

Enjoy FoxTerminal!
"@
[System.IO.File]::WriteAllText($readmePath, $readmeContent, $enc)

# ── done ─────────────────────────────────────────────────────
Write-Fox ""
Write-Divider
Write-Fox ""
Write-Fox "  INSTALLED SUCCESSFULLY!" 'Green'
Write-Fox "  Location  : $dest" 'Cyan'
Write-Fox "  To launch : see $dest\HOW_TO_LAUNCH.txt" 'Gray'
Write-Fox ""
Write-Fox "  Quick start:" 'Yellow'
Write-Fox "    cmd.exe /k `"$dest\cmd\foxterm-cmd-init.cmd`"" 'White'
Write-Fox ""
