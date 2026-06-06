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
    Write-Host "Usage: edit <name.txt>" -ForegroundColor Yellow
    return
}
if (-not (Test-HasFileExtension $name)) {
    Write-Host "Specify .txt file. Example: edit notes.txt" -ForegroundColor Yellow
    return
}

$filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
if ($null -eq $filePath) {
    Write-Host "Invalid path." -ForegroundColor Yellow
    return
}
if ([System.IO.Path]::GetExtension($filePath).ToLowerInvariant() -ne ".txt") {
    Write-Host "Only .txt files can be edited. Use nfile for other types." -ForegroundColor Yellow
    return
}
if (-not (Test-Path -LiteralPath $filePath)) {
    New-Item -ItemType File -Path $filePath | Out-Null
    Write-Host "Created: $name" -ForegroundColor DarkGray
}

$lines = New-Object System.Collections.Generic.List[string]
$existing = Get-Content -LiteralPath $filePath -ErrorAction SilentlyContinue
if ($null -ne $existing) { $lines.AddRange([string[]]$existing) }
if ($lines.Count -eq 0) { $lines.Add("") }

$cursorLine = 0
$cursorCol = 0
$topLine = 0

while ($true) {
    $windowHeight = [Console]::WindowHeight
    $windowWidth = [Console]::WindowWidth
    if ($windowHeight -lt 6) { $windowHeight = 6 }
    if ($windowWidth -lt 20) { $windowWidth = 20 }
    $viewHeight = $windowHeight - 3

    Clear-Host
    Write-Host ("Edit: " + $name)
    Write-Host "Ctrl+S save | Ctrl+E save+exit | Ctrl+Q exit"

    for ($i = 0; $i -lt $viewHeight; $i++) {
        $lineIndex = $topLine + $i
        $text = ""
        if ($lineIndex -lt $lines.Count) { $text = $lines[$lineIndex] }
        if ($text.Length -gt $windowWidth) { $text = $text.Substring(0, $windowWidth) }
        Write-Host $text
    }

    if ($cursorLine -lt $topLine) { $topLine = $cursorLine }
    if ($cursorLine -ge ($topLine + $viewHeight)) { $topLine = $cursorLine - $viewHeight + 1 }

    $cursorY = 2 + ($cursorLine - $topLine)
    if ($cursorY -lt 2) { $cursorY = 2 }
    if ($cursorY -ge $windowHeight) { $cursorY = $windowHeight - 1 }
    $cursorX = [Math]::Min($cursorCol, $windowWidth - 1)
    [Console]::SetCursorPosition($cursorX, $cursorY)

    $key = [Console]::ReadKey($true)
    if (($key.Modifiers -band [ConsoleModifiers]::Control) -ne 0) {
        switch ($key.Key) {
            "S" { $lines | Set-Content -LiteralPath $filePath -Encoding UTF8; continue }
            "E" { $lines | Set-Content -LiteralPath $filePath -Encoding UTF8; return }
            "Q" { return }
        }
    }

    switch ($key.Key) {
        "UpArrow" {
            if ($cursorLine -gt 0) {
                $cursorLine--
                $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
            }
            continue
        }
        "DownArrow" {
            if ($cursorLine -lt ($lines.Count - 1)) {
                $cursorLine++
                $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
            }
            continue
        }
        "LeftArrow" {
            if ($cursorCol -gt 0) { $cursorCol-- }
            elseif ($cursorLine -gt 0) {
                $cursorLine--
                $cursorCol = $lines[$cursorLine].Length
            }
            continue
        }
        "RightArrow" {
            if ($cursorCol -lt $lines[$cursorLine].Length) { $cursorCol++ }
            elseif ($cursorLine -lt ($lines.Count - 1)) { $cursorLine++; $cursorCol = 0 }
            continue
        }
        "Home" { $cursorCol = 0; continue }
        "End" { $cursorCol = $lines[$cursorLine].Length; continue }
        "Backspace" {
            if ($cursorCol -gt 0) {
                $line = $lines[$cursorLine]
                $lines[$cursorLine] = $line.Remove($cursorCol - 1, 1)
                $cursorCol--
            } elseif ($cursorLine -gt 0) {
                $prev = $lines[$cursorLine - 1]
                $curr = $lines[$cursorLine]
                $newCol = $prev.Length
                $lines[$cursorLine - 1] = $prev + $curr
                $lines.RemoveAt($cursorLine)
                $cursorLine--
                $cursorCol = $newCol
            }
            continue
        }
        "Delete" {
            $line = $lines[$cursorLine]
            if ($cursorCol -lt $line.Length) {
                $lines[$cursorLine] = $line.Remove($cursorCol, 1)
            } elseif ($cursorLine -lt ($lines.Count - 1)) {
                $next = $lines[$cursorLine + 1]
                $lines[$cursorLine] = $line + $next
                $lines.RemoveAt($cursorLine + 1)
            }
            continue
        }
        "Enter" {
            $line = $lines[$cursorLine]
            $left = $line.Substring(0, $cursorCol)
            $right = $line.Substring($cursorCol)
            $lines[$cursorLine] = $left
            $lines.Insert($cursorLine + 1, $right)
            $cursorLine++
            $cursorCol = 0
            continue
        }
        "Tab" {
            $line = $lines[$cursorLine]
            $lines[$cursorLine] = $line.Insert($cursorCol, "  ")
            $cursorCol += 2
            continue
        }
    }

    if ($key.KeyChar -ne 0 -and -not [char]::IsControl($key.KeyChar)) {
        $line = $lines[$cursorLine]
        $lines[$cursorLine] = $line.Insert($cursorCol, $key.KeyChar)
        $cursorCol++
    }
}
