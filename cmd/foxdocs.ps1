param(
    [switch]$List,
    [switch]$Paths
)

# One-screen docs picker:
#   Up/Down  - move in list (Back is last)
#   Left     - focus Terminal button
#   Right    - focus Explorer button
#   Enter    - run focused action (or exit on Back)
#   Esc / Q  - exit
# -Paths     - print paths only (foxtest)

. "$PSScriptRoot\foxauth.ps1"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Get-FoxDocsRoot {
    $root = $null
    if (Get-Command Get-FoxRoot -ErrorAction SilentlyContinue) {
        $root = Get-FoxRoot
    }
    if ([string]::IsNullOrWhiteSpace($root)) {
        $root = Split-Path -Parent $PSScriptRoot
    }
    return $root
}

function Get-FoxDocsCatalog([string]$root) {
    $items = @(
        @{ Title = "CHANGELOG"; Rel = "CHANGELOG.md"; Group = "History"; Desc = "Історія змін: що додали, виправили, прибрали" }
        @{ Title = "AGENTS"; Rel = "AGENTS.md"; Group = "History"; Desc = "Пам'ять для Cursor: шпаргалка і правила агента" }
        @{ Title = "README"; Rel = "FoxTerminal/README.md"; Group = "Guides"; Desc = "Встановлення Ghostty/winghostty, Ollama, старт" }
        @{ Title = "Guide UA"; Rel = "FoxTerminal/FOXTERMINAL_GUIDE_UA.md"; Group = "Guides"; Desc = "Повний гайд українською: FoxOS, команди, сценарії" }
        @{ Title = "Guide EN"; Rel = "FoxTerminal/FOXTERMINAL_GUIDE_EN.md"; Group = "Guides"; Desc = "Той самий повний гайд англійською" }
        @{ Title = "Windows MEGAGUIDE"; Rel = "FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md"; Group = "Windows"; Desc = "Перенос на інший Windows: залізо, DPI, Cursor" }
        @{ Title = "VERIFY_ALL"; Rel = "FoxTerminal/windows/VERIFY_ALL.md"; Group = "Windows"; Desc = "Прогін кожної команди + Alt+Tab / таскбар" }
        @{ Title = "HARDWARE_SCREEN"; Rel = "FoxTerminal/windows/HARDWARE_SCREEN.md"; Group = "Windows"; Desc = "Таблиці DPI / GPU / моніторів для foxlook" }
        @{ Title = "Windows AGENTS"; Rel = "FoxTerminal/windows/AGENTS.md"; Group = "Windows"; Desc = "Коротка пам'ять агента для Windows-паку" }
        @{ Title = "Windows README"; Rel = "FoxTerminal/windows/README.md"; Group = "Windows"; Desc = "Індекс Windows-паку + стартовий промпт" }
        @{ Title = "Linux MEGAGUIDE"; Rel = "FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md"; Group = "Linux"; Desc = "Kali/Linux: що працює, DE замість foxos" }
        @{ Title = "LINUX_GUIDE"; Rel = "FoxTerminal/linux/LINUX_GUIDE_UA.md"; Group = "Linux"; Desc = "Стіл, пропорції екрана, Ghostty на Linux" }
        @{ Title = "COMMANDS_LINUX"; Rel = "FoxTerminal/linux/COMMANDS_LINUX.md"; Group = "Linux"; Desc = "Шпаргалка: Windows-команда Fox -> Linux" }
        @{ Title = "Linux AGENTS"; Rel = "FoxTerminal/linux/AGENTS.md"; Group = "Linux"; Desc = "Коротка пам'ять агента для Linux-паку" }
        @{ Title = "Linux README"; Rel = "FoxTerminal/linux/README.md"; Group = "Linux"; Desc = "Індекс Linux-паку + стартовий промпт" }
        @{ Title = "Zen / Firefox addon"; Rel = "FoxTerminal/firefox-addon/README.md"; Group = "Addons"; Desc = "Companion: встановлення, pack, міст до терміналу" }
        @{ Title = "FOXSTYLE"; Rel = "sites/foxstyle/README.md"; Group = "FOXSTYLE"; Desc = "Студія вигляду: нативне вікно, пресети" }
        @{ Title = "FOXSTYLE architecture"; Rel = "sites/foxstyle/ARCHITECTURE.md"; Group = "FOXSTYLE"; Desc = "Модулі теми, Apply-цикл, збірка exe" }
        @{ Title = "FOXSTYLE CLI"; Rel = "sites/foxstyle/CLI.md"; Group = "FOXSTYLE"; Desc = "foxstyle / foxnodes / foxstt команди" }
        @{ Title = "ChatGPT dump"; Rel = "FoxTerminal/CHATGPT_PROJECT.md"; Group = "Guides"; Desc = "Один файл, щоб сторонній чат зрозумів увесь проєкт" }
    )

    $out = @()
    foreach ($it in $items) {
        $path = Join-Path $root ($it.Rel -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $out += [pscustomobject]@{
            Title = $it.Title
            Rel   = $it.Rel
            Group = $it.Group
            Desc  = $it.Desc
            Path  = $path
            File  = [IO.Path]::GetFileName($path)
        }
    }
    return $out
}

function Get-WinWidth {
    try {
        $w = [int]$Host.UI.RawUI.WindowSize.Width
        if ($w -gt 20) { return $w }
    } catch {}
    return 80
}

function Get-WinHeight {
    try {
        $h = [int]$Host.UI.RawUI.WindowSize.Height
        if ($h -gt 10) { return $h }
    } catch {}
    return 30
}

function Clip-Text([string]$s, [int]$max) {
    if ([string]::IsNullOrEmpty($s)) { return "" }
    if ($s.Length -le $max) { return $s }
    if ($max -le 3) { return $s.Substring(0, $max) }
    return $s.Substring(0, $max - 3) + "..."
}

function Open-FoxDocInTerminal([string]$path) {
    $edit = Join-Path $PSScriptRoot "edit.ps1"
    if (Test-Path -LiteralPath $edit) {
        & $edit -ReadOnly -AnyPath -- $path
        return
    }
    Get-Content -LiteralPath $path | Out-Host -Paging
}

function Show-FoxDocInExplorer([string]$path) {
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not (Test-Path -LiteralPath $full)) { return $false }
    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList @("/select,`"$full`"") -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Write-FoxDocsPill([string]$label, [bool]$active, $p, [bool]$enabled) {
    $pad = " " + $label + " "
    if (-not $enabled) {
        Write-Host (Color-Text $p.dim (" [" + $label + "] ")) -NoNewline
        return
    }
    if ($active) {
        $fg = Get-ContrastText $p.accent
        Write-Host (Color-TextBg $fg $p.accent $pad) -NoNewline
    } else {
        Write-Host (Color-Text $p.dim ("[")) -NoNewline
        Write-Host (Color-Text $p.text (" " + $label + " ")) -NoNewline
        Write-Host (Color-Text $p.dim ("]")) -NoNewline
    }
}

function Render-FoxDocs([object[]]$docs, [int]$index, [int]$action, [string]$flash, $p) {
    if (Get-Command Clear-FoxHost -ErrorAction SilentlyContinue) {
        Clear-FoxHost
    } else {
        Clear-Host
    }

    $winW = Get-WinWidth
    $winH = Get-WinHeight
    $inner = [Math]::Min(72, [Math]::Max(44, $winW - 6))
    $hz = [string][char]0x2500
    $book = ""
    try { $book = (Get-FoxIcon 0xF02D) + "  " } catch { $book = "" }

    $total = $docs.Count
    $onBack = ($index -ge $total)
    $pos = if ($onBack) { "back" } else { ("{0}/{1}" -f ($index + 1), $total) }

    Write-Host ""
    Write-Host (Color-Text $p.accent ("  " + $book + "foxdocs")) -NoNewline
    Write-Host (Color-Text $p.dim ("  " + $pos))
    Write-Host (Color-Text $p.dim ("  " + ($hz * [Math]::Min($inner, 40))))
    Write-Host ""

    # visible window of list rows (docs + Back)
    $rowCount = $total + 1
    $viewH = [Math]::Max(8, $winH - 16)
    if ($viewH -gt $rowCount) { $viewH = $rowCount }
    $top = 0
    if ($index -ge $viewH) { $top = $index - $viewH + 1 }

    $lastGroup = ""
    for ($i = $top; $i -lt [Math]::Min($rowCount, $top + $viewH); $i++) {
        if ($i -ge $total) {
            Write-Host ""
            if ($onBack) {
                $label = "  < Back  "
                Write-Host (Color-TextBg (Get-ContrastText $p.accent) $p.accent $label)
            } else {
                Write-Host (Color-Text $p.dim "  < Back")
            }
            continue
        }

        $d = $docs[$i]
        if ($d.Group -ne $lastGroup) {
            $lastGroup = $d.Group
            Write-Host (Color-Text $p.accent2 ("  " + $d.Group))
        }

        $sel = ($i -eq $index)
        $title = Clip-Text $d.Title 28
        $file = Clip-Text $d.File 22
        if ($sel) {
            $label = ("  > {0,-28} {1}  " -f $title, $file)
            Write-Host (Color-TextBg (Get-ContrastText $p.accent2) $p.accent2 $label)
        } else {
            Write-Host (Color-Text $p.text ("    {0,-28} " -f $title)) -NoNewline
            Write-Host (Color-Text $p.dim $file)
        }
    }

    Write-Host ""
    Write-Host (Color-Text $p.dim ("  " + ($hz * [Math]::Min($inner, 40))))

    if ($onBack) {
        Write-Host (Color-Text $p.dim "  leave foxdocs")
        Write-Host ""
        Write-FoxDocsPill "Terminal" $false $p $false
        Write-Host "  " -NoNewline
        Write-FoxDocsPill "Explorer" $false $p $false
        Write-Host ""
    } else {
        $doc = $docs[$index]
        Write-Host (Color-Text $p.text ("  " + (Clip-Text $doc.Desc ($inner - 2))))
        Write-Host (Color-Text $p.dim ("  " + (Clip-Text $doc.Path ($inner - 2))))
        Write-Host ""
        # action bar: Left = Terminal, Right = Explorer
        Write-Host "  " -NoNewline
        Write-FoxDocsPill "Terminal" ($action -eq 0) $p $true
        Write-Host "   " -NoNewline
        Write-FoxDocsPill "Explorer" ($action -eq 1) $p $true
        Write-Host ""
    }

    Write-Host ""
    if (-not [string]::IsNullOrWhiteSpace($flash)) {
        Write-Host (Color-Text $p.accent2 ("  " + $flash))
    }
    Write-Host (Color-Text $p.dim "  Up/Down list   Left Terminal   Right Explorer   Enter   Esc")
    Write-Host ""
}

$root = Get-FoxDocsRoot
$docs = @(Get-FoxDocsCatalog $root)

if ($Paths) {
    foreach ($d in $docs) {
        Write-Host ("{0,-12}  {1}" -f $d.Group, $d.Rel)
    }
    Write-Host ("({0} files)" -f $docs.Count)
    return
}

if (-not (Ensure-Login)) { return }

if ($docs.Count -eq 0) {
    Write-Host "No FoxTerminal docs found under: $root"
    return
}

$index = 0
$action = 0   # 0 = Terminal, 1 = Explorer
$flash = ""

while ($true) {
    $p = Get-ThemePalette
    Render-FoxDocs $docs $index $action $flash $p
    $flash = ""
    $k = [Console]::ReadKey($true)

    $backIdx = $docs.Count
    $onBack = ($index -ge $backIdx)

    if ($k.Key -eq "UpArrow" -or $k.Key -eq "K") {
        if ($index -gt 0) { $index-- }
        continue
    }
    if ($k.Key -eq "DownArrow" -or $k.Key -eq "J") {
        if ($index -lt $backIdx) { $index++ }
        continue
    }
    if ($k.Key -eq "Home") { $index = 0; continue }
    if ($k.Key -eq "End") { $index = $backIdx; continue }

    if ($k.Key -eq "LeftArrow") {
        if (-not $onBack) { $action = 0 }
        continue
    }
    if ($k.Key -eq "RightArrow") {
        if (-not $onBack) { $action = 1 }
        continue
    }

    if ($k.Key -eq "Escape" -or $k.Key -eq "Q" -or $k.Key -eq "Backspace" -or $k.Key -eq "BrowserBack" -or (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E")) {
        if (Get-Command Clear-FoxHost -ErrorAction SilentlyContinue) { Clear-FoxHost } else { Clear-Host }
        return
    }

    if ($k.Key -eq "Enter" -or $k.Key -eq "Spacebar") {
        if ($onBack) {
            if (Get-Command Clear-FoxHost -ErrorAction SilentlyContinue) { Clear-FoxHost } else { Clear-Host }
            return
        }
        $doc = $docs[$index]
        if ($action -eq 0) {
            if (Get-Command Clear-FoxHost -ErrorAction SilentlyContinue) { Clear-FoxHost } else { Clear-Host }
            Open-FoxDocInTerminal $doc.Path
            $flash = "closed viewer"
        } else {
            if (Show-FoxDocInExplorer $doc.Path) {
                $flash = "Explorer: file selected"
            } else {
                $flash = "Explorer failed"
            }
        }
        continue
    }

    # digit / letter T E shortcuts
    if ($k.Key -eq "T") { if (-not $onBack) { $action = 0 }; continue }
    if ($k.Key -eq "E") { if (-not $onBack) { $action = 1 }; continue }
}
