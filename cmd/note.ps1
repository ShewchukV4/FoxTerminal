param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
if (-not (Ensure-Login)) { return }
$user = $env:FOXTERM_USER

$notesRoot = Join-Path $PSScriptRoot ("notes\" + $user)
if (-not (Test-Path $notesRoot)) {
    New-Item -ItemType Directory -Path $notesRoot | Out-Null
}

if ($Args.Count -ge 1 -and $Args[0] -eq "open") {
    Start-Process -FilePath "explorer.exe" -ArgumentList @($notesRoot) | Out-Null
    return
}

function Show-List([string]$path, [string]$root) {
    Write-Host ""
    Write-Host ("Folder: " + $path)
    $dirs = Get-ChildItem -LiteralPath $path -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name
    $files = Get-ChildItem -LiteralPath $path -File -Filter *.txt -ErrorAction SilentlyContinue |
        Sort-Object Name

    if (($dirs.Count -eq 0) -and ($files.Count -eq 0)) {
        Write-Host "Empty."
    } else {
        foreach ($d in $dirs) { Write-Host ("[dir] " + $d.Name) }
        foreach ($f in $files) { Write-Host ("      " + $f.Name) }
    }
    Write-Host ""
    Write-Host "Commands: exit (up), exitt (quit), nfould <name> (new folder), nfile <name> (new txt), del <name>"
    Write-Host "Open: type folder name or note name (optional: '<name> open')"
}

function Edit-Note([string]$filePath) {
    $lines = New-Object System.Collections.Generic.List[string]
    if (Test-Path $filePath) {
        $existing = Get-Content -LiteralPath $filePath -ErrorAction SilentlyContinue
        if ($null -ne $existing) {
            $lines.AddRange([string[]]$existing)
        }
    }
    if ($lines.Count -eq 0) {
        $lines.Add("")
    }

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
        Write-Host ("Note: " + $filePath)
        Write-Host "Ctrl+S save | Ctrl+E save+exit | Ctrl+Q exit"

        for ($i = 0; $i -lt $viewHeight; $i++) {
            $lineIndex = $topLine + $i
            $text = ""
            if ($lineIndex -lt $lines.Count) {
                $text = $lines[$lineIndex]
            }
            if ($text.Length -gt $windowWidth) {
                $text = $text.Substring(0, $windowWidth)
            }
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
                "S" {
                    $lines | Set-Content -LiteralPath $filePath -Encoding UTF8
                    continue
                }
                "E" {
                    $lines | Set-Content -LiteralPath $filePath -Encoding UTF8
                    return
                }
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
                if ($cursorCol -gt 0) {
                    $cursorCol--
                } elseif ($cursorLine -gt 0) {
                    $cursorLine--
                    $cursorCol = $lines[$cursorLine].Length
                }
                continue
            }
            "RightArrow" {
                if ($cursorCol -lt $lines[$cursorLine].Length) {
                    $cursorCol++
                } elseif ($cursorLine -lt ($lines.Count - 1)) {
                    $cursorLine++
                    $cursorCol = 0
                }
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
}

$cwd = $notesRoot
while ($true) {
    Show-List $cwd $notesRoot
    $input = Read-Host "note"
    if ([string]::IsNullOrWhiteSpace($input)) { continue }

    $forceOpen = $false
    if ($input.Length -gt 5 -and $input.EndsWith(" open")) {
        $forceOpen = $true
        $input = $input.Substring(0, $input.Length - 5).TrimEnd()
        if ([string]::IsNullOrWhiteSpace($input)) {
            Write-Host "Name is empty."
            continue
        }
    }

    if ($input -eq "exitt") { break }
    if ($input -eq "exit") {
        if ($cwd -ne $notesRoot) {
            $cwd = Split-Path -Parent $cwd
        } else {
            Write-Host "Already at root."
        }
        continue
    }

    if ($input -like "nfould *") {
        $name = $input.Substring(7).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Folder name is empty."
            continue
        }
        $newPath = Join-Path $cwd $name
        if (-not (Test-Path $newPath)) {
            New-Item -ItemType Directory -Path $newPath | Out-Null
            Write-Host "Created."
        } else {
            Write-Host "Folder exists."
        }
        continue
    }

    if ($input -like "nfile *") {
        $name = $input.Substring(6).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "File name is empty."
            continue
        }
        if ($name -notmatch '\.txt$') { $name += ".txt" }
        $filePath = Join-Path $cwd $name
        if (-not (Test-Path $filePath)) {
            New-Item -ItemType File -Path $filePath | Out-Null
            Write-Host "Created."
        } else {
            Write-Host "File exists."
        }
        continue
    }

    if ($input -like "del *") {
        $name = $input.Substring(4).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "File name is empty."
            continue
        }
        if ($name -notmatch '\.txt$') { $name += ".txt" }
        $filePath = Join-Path $cwd $name
        if (-not (Test-Path $filePath -PathType Leaf)) {
            Write-Host "File not found."
            continue
        }
        $pw = Read-PasswordPlain "Password to delete"
        if (Verify-User $env:FOXTERM_USER $pw) {
            Remove-Item -LiteralPath $filePath -Force
            Write-Host "Deleted."
        } else {
            Write-Host "Canceled."
        }
        continue
    }

    $target = Join-Path $cwd $input
    if (Test-Path $target -PathType Container) {
        $cwd = $target
        continue
    }

    $fileName = $input
    if ($fileName -notmatch '\.txt$') { $fileName += ".txt" }
    $filePath = Join-Path $cwd $fileName
    if (-not (Test-Path $filePath)) {
        New-Item -ItemType File -Path $filePath | Out-Null
    }
    Edit-Note $filePath
}
