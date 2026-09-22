param(
    [switch]$AnyPath,
    [switch]$ReadOnly,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\note-lib.ps1"

if (Get-Command Ensure-Utf8Console -ErrorAction SilentlyContinue) {
    Ensure-Utf8Console
} else {
    try {
        $utf8 = New-Object System.Text.UTF8Encoding $false
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $OutputEncoding = $utf8
    } catch { }
}

if (-not (Ensure-Login)) { return }

$paths = Initialize-NotesPaths $PSScriptRoot $env:FOXTERM_USER
$cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome

$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host "Usage: edit <path-or-name>" -ForegroundColor Yellow
    Write-Host "Examples: edit notes.txt | edit .\app\settings.json | edit C:\tmp\todo.md" -ForegroundColor DarkGray
    return
}

$isPathLike = $AnyPath -or
    [System.IO.Path]::IsPathRooted($name) -or
    ($name -match "[\\/]" ) -or
    $name.StartsWith(".")

if ($isPathLike) {
    $filePath = if ([System.IO.Path]::IsPathRooted($name)) {
        [System.IO.Path]::GetFullPath($name)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $name))
    }
} else {
    $filePath = Resolve-UnderNotes $cwd $name $paths.NotesRoot
    if ($null -eq $filePath) {
        Write-Host "Invalid path." -ForegroundColor Yellow
        return
    }
}

if (-not (Test-Path -LiteralPath $filePath)) {
    if ($ReadOnly) {
        Write-Host "File not found: $filePath" -ForegroundColor Yellow
        return
    }
    $parent = Split-Path -Path $filePath -Parent
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        Write-Host "Folder does not exist: $parent" -ForegroundColor Yellow
        return
    }
    New-Item -ItemType File -Path $filePath | Out-Null
    Write-Host "Created: $filePath" -ForegroundColor DarkGray
}

$lines = New-Object System.Collections.Generic.List[string]
$existing = @()
try {
    $existing = [System.IO.File]::ReadAllLines($filePath, [System.Text.UTF8Encoding]::new($false))
} catch {
    $existing = Get-Content -LiteralPath $filePath -Encoding UTF8 -ErrorAction SilentlyContinue
}
if ($null -ne $existing) { $lines.AddRange([string[]]$existing) }
if ($lines.Count -eq 0) { $lines.Add("") }

$esc = [char]27
$p = Get-ThemePalette
$dot = [char]0x00B7
$displayName = Split-Path -Leaf $filePath
$cursorLine = 0
$cursorCol = 0
$topLine = 0
$leftCol = 0
$modified = $false
$script:foxEditReadOnly = [bool]$ReadOnly
$dirty = "all"
$dirtyLine = 0
$oldTreatControlC = $false
$enteredAlt = $false
$script:foxEditCaret = @{ On = $false; Line = -1; Col = -1; X = 0; Y = 0 }

function Get-FoxEditView([int]$lineCount) {
    $h = 0
    $w = 0
    try { $h = [Console]::WindowHeight } catch {}
    try { $w = [Console]::WindowWidth } catch {}
    try {
        $ui = $Host.UI.RawUI
        if ($ui.WindowSize.Height -gt $h) { $h = $ui.WindowSize.Height }
        if ($ui.WindowSize.Width -gt $w) { $w = $ui.WindowSize.Width }
        if ($h -lt 12 -and $ui.MaxPhysicalWindowSize.Height -gt $h) { $h = $ui.MaxPhysicalWindowSize.Height }
        if ($w -lt 40 -and $ui.MaxPhysicalWindowSize.Width -gt $w) { $w = $ui.MaxPhysicalWindowSize.Width }
    } catch {}
    $envH = 0
    $envW = 0
    [void][int]::TryParse($env:LINES, [ref]$envH)
    [void][int]::TryParse($env:COLUMNS, [ref]$envW)
    if ($envH -gt $h) { $h = $envH }
    if ($envW -gt $w) { $w = $envW }
    if ($h -lt 12) { $h = 24 }
    if ($w -lt 40) { $w = 80 }
    $digits = ([string][Math]::Max(1, $lineCount)).Length
    $gutter = [Math]::Max(4, $digits + 1)
    if ($gutter -gt ($w - 12)) { $gutter = [Math]::Max(3, $w - 12) }
    return @{
        Width      = $w
        Height     = $h
        BodyTop    = 1
        BodyHeight = $h - 2
        StatusY    = $h - 1
        Gutter     = $gutter
        TextWidth  = [Math]::Max(8, $w - 1 - $gutter)
    }
}

function Get-FoxEditLuma([string]$hex) {
    if ([string]::IsNullOrWhiteSpace($hex) -or -not (Get-Command Convert-HexToRgb -ErrorAction SilentlyContinue)) {
        return 0
    }
    $rgb = Convert-HexToRgb $hex
    return (0.2126 * $rgb.r + 0.7152 * $rgb.g + 0.0722 * $rgb.b)
}

function Get-FoxEditBrightBg($palette) {
    foreach ($hex in @($palette.accent4, $palette.accent2, $palette.accent, $palette.text)) {
        if ((Get-FoxEditLuma $hex) -ge 160) { return $hex }
    }
    return "#E6E6E6"
}

function Get-FoxEditPosLabel([int]$lineNo, [int]$colNo) {
    return (" line {0}  letter {1} " -f ($lineNo + 1), ($colNo + 1))
}

function Write-FoxEditFill([string]$text, [int]$max) {
    if ($text.Length -gt $max) { return $text.Substring(0, $max) }
    if ($text.Length -lt $max) { return $text + (" " * ($max - $text.Length)) }
    return $text
}

function Write-FoxEditChip([string]$text, [string]$bgHex, $palette) {
    $fg = "#0B0F1A"
    if (Get-Command Get-ContrastText -ErrorAction SilentlyContinue) {
        $fg = Get-ContrastText $bgHex
    }
    if (Get-Command Color-TextBg -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-TextBg $fg $bgHex $text))
    } else {
        [Console]::Write($text)
    }
}

function Write-FoxEditHeader($view, [string]$title, [bool]$isModified, [int]$lineNo, [int]$colNo, $palette) {
    $left = "  " + $title
    if ($script:foxEditReadOnly) { $left = $left + "  read" }
    elseif ($isModified) { $left = $left + "  +" }
    $right = Get-FoxEditPosLabel $lineNo $colNo
    $max = $view.Width - 1
    try { [Console]::SetCursorPosition(0, 0) } catch { return }
    $gap = $max - $left.Length - $right.Length
    if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-Text $palette.accent $left))
    } else {
        [Console]::Write($left)
    }
    if ($gap -lt 1) {
        [Console]::Write("$esc[K")
        try { [Console]::SetCursorPosition(0, 0) } catch { return }
        Write-FoxEditChip (Write-FoxEditFill $right $max) (Get-FoxEditBrightBg $palette) $palette
    } else {
        [Console]::Write((" " * $gap))
        Write-FoxEditChip $right (Get-FoxEditBrightBg $palette) $palette
    }
    [Console]::Write("$esc[K")
}

function Write-FoxEditStatus($view, [int]$lineNo, [int]$colNo, [bool]$isModified, $palette) {
    $left = if ($script:foxEditReadOnly) {
        "  arrows move  $script:dot  PgUp/PgDn  $script:dot  Q or Esc quit"
    } else {
        "  Ctrl+S save  $script:dot  Ctrl+E save+exit  $script:dot  Ctrl+Q quit"
    }
    $right = Get-FoxEditPosLabel $lineNo $colNo
    if ($isModified) { $right = " + " + $right }
    $max = $view.Width - 1
    $gap = $max - $left.Length - $right.Length
    try { [Console]::SetCursorPosition(0, $view.StatusY) } catch { return }
    if ($gap -lt 1) {
        Write-FoxEditChip (Write-FoxEditFill $right $max) (Get-FoxEditBrightBg $palette) $palette
    } else {
        if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
            [Console]::Write((Color-Text $palette.dim $left))
        } else {
            [Console]::Write($left)
        }
        [Console]::Write((" " * $gap))
        Write-FoxEditChip $right (Get-FoxEditBrightBg $palette) $palette
    }
    [Console]::Write("$esc[K")
}

function Write-FoxEditBodyLine($view, [int]$lineIndex, [int]$screenTop, [int]$hScroll, $src, [int]$currentLine, $palette) {
    $y = $view.BodyTop + ($lineIndex - $screenTop)
    if ($y -lt $view.BodyTop -or $y -ge $view.StatusY) { return }
    $digits = $view.Gutter - 1
    $isCurrent = ($lineIndex -eq $currentLine)
    if ($lineIndex -ge 0 -and $lineIndex -lt $src.Count) {
        $gutter = (([string]($lineIndex + 1)).PadLeft($digits) + " ")
    } else {
        $gutter = ("~".PadLeft($digits) + " ")
        $isCurrent = $false
    }
    $text = ""
    if ($lineIndex -ge 0 -and $lineIndex -lt $src.Count) { $text = $src[$lineIndex] }
    if ($hScroll -gt 0) {
        if ($hScroll -ge $text.Length) { $text = "" } else { $text = $text.Substring($hScroll) }
    }
    if ($text.Length -gt $view.TextWidth) { $text = $text.Substring(0, $view.TextWidth) }
    try { [Console]::SetCursorPosition(0, $y) } catch { return }
    $gutterColor = if ($isCurrent) { (Get-FoxEditBrightBg $palette) } else { $palette.dim }
    if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-Text $gutterColor $gutter))
    } else {
        [Console]::Write($gutter)
    }
    if ($text.Length -gt 0) { [Console]::Write($text) }
    [Console]::Write("$esc[K")
}

function Write-FoxEditBody($view, [int]$screenTop, [int]$hScroll, $src, [int]$currentLine, $palette) {
    for ($i = 0; $i -lt $view.BodyHeight; $i++) {
        Write-FoxEditBodyLine $view ($screenTop + $i) $screenTop $hScroll $src $currentLine $palette
    }
}

function Save-FoxEditFile([string]$path, $src) {
    $src | Set-Content -LiteralPath $path -Encoding UTF8
}

function Get-FoxEditCellChar($src, [int]$lineIndex, [int]$colIndex) {
    if ($lineIndex -lt 0 -or $lineIndex -ge $src.Count) { return " " }
    $text = $src[$lineIndex]
    if ($colIndex -lt 0 -or $colIndex -ge $text.Length) { return " " }
    $ch = $text[$colIndex]
    if ([char]::IsControl($ch)) { return " " }
    return [string]$ch
}

function Hide-FoxEditTerminalCursor {
    [Console]::Write("$esc[?25l")
    try { [Console]::CursorVisible = $false } catch { }
}

function Show-FoxEditTerminalCursor {
    # Block caret: Ghostty shell integration hides the bar while a command runs.
    [Console]::Write("$esc[2 q$esc[?25h")
    try { [Console]::CursorVisible = $true } catch { }
}

function Restore-FoxEditCaret($view, $src, [int]$screenTop, [int]$hScroll, $palette) {
    $mark = $script:foxEditCaret
    if ($null -eq $mark -or -not $mark.On) { return }
    $x = $view.Gutter + ($mark.Col - $hScroll)
    $y = $view.BodyTop + ($mark.Line - $screenTop)
    if ($x -lt $view.Gutter -or $x -ge ($view.Gutter + $view.TextWidth)) { return }
    if ($y -lt $view.BodyTop -or $y -ge $view.StatusY) { return }
    $ch = Get-FoxEditCellChar $src $mark.Line $mark.Col
    try { [Console]::SetCursorPosition($x, $y) } catch { return }
    [Console]::Write("$esc[0m")
    if (Get-Command Color-TextBg -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-TextBg $palette.text $palette.base $ch))
    } elseif (Get-Command Color-Text -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-Text $palette.text $ch))
    } else {
        [Console]::Write($ch)
    }
}

function Write-FoxEditCaret($view, [int]$lineIndex, [int]$colIndex, [int]$screenTop, [int]$hScroll, $src, $palette) {
    $x = $view.Gutter + ($colIndex - $hScroll)
    $y = $view.BodyTop + ($lineIndex - $screenTop)
    if ($x -lt $view.Gutter) { $x = $view.Gutter }
    if ($x -ge ($view.Gutter + $view.TextWidth)) { $x = $view.Gutter + $view.TextWidth - 1 }
    if ($y -lt $view.BodyTop) { $y = $view.BodyTop }
    if ($y -ge $view.StatusY) { $y = $view.StatusY - 1 }
    $ch = Get-FoxEditCellChar $src $lineIndex $colIndex
    try { [Console]::SetCursorPosition($x, $y) } catch { return }
    $bg = Get-FoxEditBrightBg $palette
    $fg = "#0B0F1A"
    if (Get-Command Get-ContrastText -ErrorAction SilentlyContinue) {
        $fg = Get-ContrastText $bg
    }
    if (Get-Command Color-TextBg -ErrorAction SilentlyContinue) {
        [Console]::Write((Color-TextBg $fg $bg $ch))
    } else {
        [Console]::Write("$esc[7m$ch$esc[0m")
    }
    try { [Console]::SetCursorPosition($x, $y) } catch { }
    Show-FoxEditTerminalCursor
    $script:foxEditCaret = @{ On = $true; Line = $lineIndex; Col = $colIndex; X = $x; Y = $y }
}

function Merge-FoxEditDirty([string]$cur, [string]$next) {
    if ([string]::IsNullOrWhiteSpace($cur) -or $cur -eq "none") { return $next }
    if ($cur -eq $next -or $cur -eq "all" -or $next -eq "none") { return $cur }
    if ($next -eq "all") { return "all" }
    $needBody = ($cur -eq "body" -or $next -eq "body" -or $cur -eq "all" -or $next -eq "all")
    $needLine = ($cur -eq "line" -or $next -eq "line" -or $cur -eq "linechrome" -or $next -eq "linechrome")
    $needHeader = ($cur -eq "chrome" -or $next -eq "chrome" -or $cur -eq "linechrome" -or $next -eq "linechrome" -or $cur -eq "all" -or $next -eq "all")
    if ($needBody -and $needHeader) { return "all" }
    if ($needBody) { return "body" }
    if ($needLine -and $needHeader) { return "linechrome" }
    if ($needLine) { return "line" }
    if ($needHeader) { return "chrome" }
    return "status"
}

try { $oldTreatControlC = [Console]::TreatControlCAsInput } catch { $oldTreatControlC = $false }
try {
    Suspend-WaiPinForEditor
    try { [Console]::TreatControlCAsInput = $true } catch { }
    [Console]::Write("$esc[?1049h$esc[?7l")
    Hide-FoxEditTerminalCursor
    $enteredAlt = $true

    $lastW = 0
    $lastH = 0
    $lastGutter = 0

    while ($true) {
        $view = Get-FoxEditView $lines.Count
        if ($view.Width -ne $lastW -or $view.Height -ne $lastH -or $view.Gutter -ne $lastGutter) {
            $dirty = "all"
            $lastW = $view.Width
            $lastH = $view.Height
            $lastGutter = $view.Gutter
        }

        if ($cursorLine -lt 0) { $cursorLine = 0 }
        if ($cursorLine -ge $lines.Count) { $cursorLine = $lines.Count - 1 }
        $lineLen = $lines[$cursorLine].Length
        if ($cursorCol -lt 0) { $cursorCol = 0 }
        if ($cursorCol -gt $lineLen) { $cursorCol = $lineLen }

        $scrolled = $false
        if ($cursorLine -lt $topLine) {
            $topLine = $cursorLine
            $scrolled = $true
        }
        if ($cursorLine -ge ($topLine + $view.BodyHeight)) {
            $topLine = $cursorLine - $view.BodyHeight + 1
            $scrolled = $true
        }
        if ($topLine -lt 0) { $topLine = 0 }

        $nextLeft = $leftCol
        if ($cursorCol -lt $nextLeft) { $nextLeft = $cursorCol }
        if (($cursorCol - $nextLeft) -ge $view.TextWidth) {
            $nextLeft = $cursorCol - $view.TextWidth + 1
        }
        if ($nextLeft -lt 0) { $nextLeft = 0 }
        if ($nextLeft -ne $leftCol) {
            $leftCol = $nextLeft
            $scrolled = $true
        }
        if ($scrolled) { $dirty = "all" }

        $busy = $false
        try { $busy = [Console]::KeyAvailable } catch { $busy = $false }

        if (-not $busy -and $dirty -ne "none") {
            Hide-FoxEditTerminalCursor
            $paintedAll = $false
            $paintedDirtyLine = $false
            switch ($dirty) {
                "all" {
                    $paintedAll = $true
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditBody $view $topLine $leftCol $lines $cursorLine $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
                "body" {
                    $paintedAll = $true
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditBody $view $topLine $leftCol $lines $cursorLine $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
                "line" {
                    $paintedDirtyLine = $true
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditBodyLine $view $dirtyLine $topLine $leftCol $lines $cursorLine $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
                "linechrome" {
                    $paintedDirtyLine = $true
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditBodyLine $view $dirtyLine $topLine $leftCol $lines $cursorLine $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
                "chrome" {
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
                "status" {
                    Write-FoxEditHeader $view $displayName $modified $cursorLine $cursorCol $p
                    Write-FoxEditStatus $view $cursorLine $cursorCol $modified $p
                }
            }
            $caretCovered = $paintedAll -or ($paintedDirtyLine -and $script:foxEditCaret.On -and $dirtyLine -eq $script:foxEditCaret.Line)
            if (-not $caretCovered) {
                Restore-FoxEditCaret $view $lines $topLine $leftCol $p
            } else {
                $script:foxEditCaret.On = $false
            }
            $dirty = "none"
        }

        if (-not $busy) {
            Write-FoxEditCaret $view $cursorLine $cursorCol $topLine $leftCol $lines $p
        }

        $key = [Console]::ReadKey($true)
        $wasModified = $modified
        $handled = $false

        if (($key.Modifiers -band [ConsoleModifiers]::Control) -ne 0) {
            switch ($key.Key) {
                "S" {
                    if (-not $script:foxEditReadOnly) {
                        Save-FoxEditFile $filePath $lines
                        $modified = $false
                        $dirty = Merge-FoxEditDirty $dirty "chrome"
                    }
                    $handled = $true
                }
                "E" {
                    if (-not $script:foxEditReadOnly) { Save-FoxEditFile $filePath $lines }
                    return
                }
                "Q" { return }
                "C" { return }
                "L" {
                    $dirty = "all"
                    $handled = $true
                }
            }
        }

        if (-not $handled) {
            switch ($key.Key) {
                "UpArrow" {
                    if ($cursorLine -gt 0) {
                        $cursorLine--
                        $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
                    }
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "body"
                }
                "DownArrow" {
                    if ($cursorLine -lt ($lines.Count - 1)) {
                        $cursorLine++
                        $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
                    }
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "body"
                }
                "LeftArrow" {
                    if ($cursorCol -gt 0) { $cursorCol-- }
                    elseif ($cursorLine -gt 0) {
                        $cursorLine--
                        $cursorCol = $lines[$cursorLine].Length
                        $dirty = Merge-FoxEditDirty $dirty "body"
                    }
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "chrome"
                }
                "RightArrow" {
                    if ($cursorCol -lt $lines[$cursorLine].Length) { $cursorCol++ }
                    elseif ($cursorLine -lt ($lines.Count - 1)) {
                        $cursorLine++
                        $cursorCol = 0
                        $dirty = Merge-FoxEditDirty $dirty "body"
                    }
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "chrome"
                }
                "PageUp" {
                    $cursorLine = [Math]::Max(0, $cursorLine - $view.BodyHeight)
                    $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "body"
                }
                "PageDown" {
                    $cursorLine = [Math]::Min($lines.Count - 1, $cursorLine + $view.BodyHeight)
                    $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "body"
                }
                "Home" {
                    $cursorCol = 0
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "chrome"
                }
                "End" {
                    $cursorCol = $lines[$cursorLine].Length
                    $handled = $true
                    $dirty = Merge-FoxEditDirty $dirty "chrome"
                }
                "Escape" {
                    if ($script:foxEditReadOnly) { return }
                    $handled = $true
                }
                "Backspace" {
                    if ($script:foxEditReadOnly) { $handled = $true; break }
                    if ($cursorCol -gt 0) {
                        $line = $lines[$cursorLine]
                        $lines[$cursorLine] = $line.Remove($cursorCol - 1, 1)
                        $cursorCol--
                        $modified = $true
                        $dirty = Merge-FoxEditDirty $dirty "line"
                        $dirtyLine = $cursorLine
                    } elseif ($cursorLine -gt 0) {
                        $prev = $lines[$cursorLine - 1]
                        $curr = $lines[$cursorLine]
                        $newCol = $prev.Length
                        $lines[$cursorLine - 1] = $prev + $curr
                        $lines.RemoveAt($cursorLine)
                        $cursorLine--
                        $cursorCol = $newCol
                        $modified = $true
                        $dirty = Merge-FoxEditDirty $dirty "body"
                    }
                    $handled = $true
                }
                "Delete" {
                    if ($script:foxEditReadOnly) { $handled = $true; break }
                    $line = $lines[$cursorLine]
                    if ($cursorCol -lt $line.Length) {
                        $lines[$cursorLine] = $line.Remove($cursorCol, 1)
                        $modified = $true
                        $dirty = Merge-FoxEditDirty $dirty "line"
                        $dirtyLine = $cursorLine
                    } elseif ($cursorLine -lt ($lines.Count - 1)) {
                        $next = $lines[$cursorLine + 1]
                        $lines[$cursorLine] = $line + $next
                        $lines.RemoveAt($cursorLine + 1)
                        $modified = $true
                        $dirty = Merge-FoxEditDirty $dirty "body"
                    }
                    $handled = $true
                }
                "Enter" {
                    if ($script:foxEditReadOnly) {
                        $cursorLine = [Math]::Min($lines.Count - 1, $cursorLine + $view.BodyHeight)
                        $cursorCol = [Math]::Min($cursorCol, $lines[$cursorLine].Length)
                        $dirty = Merge-FoxEditDirty $dirty "body"
                        $handled = $true
                        break
                    }
                    $line = $lines[$cursorLine]
                    $leftText = $line.Substring(0, $cursorCol)
                    $rightText = $line.Substring($cursorCol)
                    $lines[$cursorLine] = $leftText
                    $lines.Insert($cursorLine + 1, $rightText)
                    $cursorLine++
                    $cursorCol = 0
                    $modified = $true
                    $dirty = Merge-FoxEditDirty $dirty "body"
                    $handled = $true
                }
                "Tab" {
                    if ($script:foxEditReadOnly) { $handled = $true; break }
                    $line = $lines[$cursorLine]
                    $lines[$cursorLine] = $line.Insert($cursorCol, "  ")
                    $cursorCol += 2
                    $modified = $true
                    $dirty = Merge-FoxEditDirty $dirty "line"
                    $dirtyLine = $cursorLine
                    $handled = $true
                }
            }
        }

        if ($script:foxEditReadOnly -and -not $handled) {
            $ch = [string]$key.KeyChar
            if ($ch -eq "q" -or $ch -eq "Q") { return }
            $handled = $true
        }

        if (-not $handled -and $key.KeyChar -ne 0 -and -not [char]::IsControl($key.KeyChar)) {
            $line = $lines[$cursorLine]
            $lines[$cursorLine] = $line.Insert($cursorCol, $key.KeyChar)
            $cursorCol++
            $modified = $true
            $dirty = Merge-FoxEditDirty $dirty "line"
            $dirtyLine = $cursorLine
        }

        if ($modified -ne $wasModified) {
            switch ($dirty) {
                "line" { $dirty = "linechrome" }
                "body" { $dirty = "all" }
                "status" { $dirty = "chrome" }
                "none" { $dirty = "chrome" }
                default { $dirty = Merge-FoxEditDirty $dirty "chrome" }
            }
        }
    }
} finally {
    try { [Console]::TreatControlCAsInput = $oldTreatControlC } catch { }
    if ($enteredAlt) {
        [Console]::Write("$esc[0 q$esc[?7h$esc[?25h$esc[?1049l")
    }
    try { [Console]::CursorVisible = $true } catch { }
    Resume-WaiPinAfterEditor
}
