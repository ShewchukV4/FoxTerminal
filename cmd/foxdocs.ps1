param(
    [switch]$List
)

# Interactive FoxTerminal docs browser:
#   Up/Down  - select
#   Left     - open in terminal (read-only edit)
#   Right    - action screen: Open + show in Explorer
#   Enter    - open in terminal (same as Left) / Back exits
#   Esc / Q  - exit
# Back row is always at the bottom of the list.

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
        @{ Id = "changelog"; Title = "CHANGELOG - history"; Rel = "CHANGELOG.md"; Group = "History" }
        @{ Id = "agents"; Title = "AGENTS - project memory"; Rel = "AGENTS.md"; Group = "History" }
        @{ Id = "readme"; Title = "FoxTerminal README"; Rel = "FoxTerminal/README.md"; Group = "Guides" }
        @{ Id = "guide-ua"; Title = "Full guide (UA)"; Rel = "FoxTerminal/FOXTERMINAL_GUIDE_UA.md"; Group = "Guides" }
        @{ Id = "guide-en"; Title = "Full guide (EN)"; Rel = "FoxTerminal/FOXTERMINAL_GUIDE_EN.md"; Group = "Guides" }
        @{ Id = "win-mega"; Title = "Windows MEGAGUIDE (Cursor)"; Rel = "FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md"; Group = "Windows" }
        @{ Id = "win-verify"; Title = "VERIFY_ALL - command checklist"; Rel = "FoxTerminal/windows/VERIFY_ALL.md"; Group = "Windows" }
        @{ Id = "win-hw"; Title = "HARDWARE_SCREEN - DPI/GPU"; Rel = "FoxTerminal/windows/HARDWARE_SCREEN.md"; Group = "Windows" }
        @{ Id = "win-agents"; Title = "Windows AGENTS"; Rel = "FoxTerminal/windows/AGENTS.md"; Group = "Windows" }
        @{ Id = "win-readme"; Title = "Windows pack README"; Rel = "FoxTerminal/windows/README.md"; Group = "Windows" }
        @{ Id = "linux-mega"; Title = "Linux MEGAGUIDE (Cursor)"; Rel = "FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md"; Group = "Linux" }
        @{ Id = "linux-guide"; Title = "LINUX_GUIDE - desktop / DE"; Rel = "FoxTerminal/linux/LINUX_GUIDE_UA.md"; Group = "Linux" }
        @{ Id = "linux-cmds"; Title = "COMMANDS_LINUX - Win to Linux"; Rel = "FoxTerminal/linux/COMMANDS_LINUX.md"; Group = "Linux" }
        @{ Id = "linux-agents"; Title = "Linux AGENTS"; Rel = "FoxTerminal/linux/AGENTS.md"; Group = "Linux" }
        @{ Id = "linux-readme"; Title = "Linux pack README"; Rel = "FoxTerminal/linux/README.md"; Group = "Linux" }
        @{ Id = "addon"; Title = "Firefox / Zen Companion README"; Rel = "FoxTerminal/firefox-addon/README.md"; Group = "Addons" }
    )

    $out = @()
    foreach ($it in $items) {
        $path = Join-Path $root ($it.Rel -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $out += [pscustomobject]@{
            Id    = $it.Id
            Title = $it.Title
            Rel   = $it.Rel
            Group = $it.Group
            Path  = $path
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

function Clip-Text([string]$s, [int]$max) {
    if ([string]::IsNullOrEmpty($s)) { return "" }
    if ($s.Length -le $max) { return $s }
    if ($max -le 1) { return $s.Substring(0, $max) }
    return $s.Substring(0, $max - 1) + "..."
}

function Open-FoxDocInTerminal([string]$path) {
    $edit = Join-Path $PSScriptRoot "edit.ps1"
    if (Test-Path -LiteralPath $edit) {
        & $edit -ReadOnly -AnyPath -- $path
        return
    }
    Get-Content -LiteralPath $path | Out-Host -Paging
}

function Open-FoxDocInExplorer([string]$path) {
    $full = [System.IO.Path]::GetFullPath($path)
    if (-not (Test-Path -LiteralPath $full)) {
        return "file missing"
    }
    try {
        Invoke-Item -LiteralPath $full -ErrorAction Stop
    } catch {}
    try {
        Start-Process -FilePath "explorer.exe" -ArgumentList @("/select,`"$full`"") -ErrorAction Stop | Out-Null
        return "opened + Explorer"
    } catch {
        return "Explorer failed"
    }
}

function Render-FoxDocsList([object[]]$docs, [int]$index, $p, [string]$status) {
    Clear-Host
    $tl = [string][char]0x256D; $tr = [string][char]0x256E
    $bl = [string][char]0x2570; $br = [string][char]0x256F
    $hz = [string][char]0x2500
    $winW = Get-WinWidth
    $inner = [Math]::Min(68, [Math]::Max(48, $winW - 8))

    Write-Host ""
    Write-Host (Color-Text $p.dim ("  " + $tl + $hz + " ")) -NoNewline
    Write-Host (Color-Text $p.accent "foxdocs") -NoNewline
    Write-Host (Color-Text $p.dim (" " + ($hz * [Math]::Max(2, $inner - 12)) + " " + $tr))
    Write-Host (Color-Text $p.dim "  Left = terminal   Right = Explorer action   Enter = terminal")
    Write-Host (Color-Text $p.dim "  Up/Down select   Esc/Q exit")
    Write-Host ""

    $rows = @()
    foreach ($d in @($docs)) { $rows += $d }
    $rows += [pscustomobject]@{ Id = "__back"; Title = "Back"; Rel = ""; Group = ""; Path = "" }

    if ($index -lt 0) { $index = 0 }
    if ($index -ge $rows.Count) { $index = $rows.Count - 1 }

    $viewH = 18
    try { $viewH = [Math]::Max(10, $Host.UI.RawUI.WindowSize.Height - 12) } catch {}
    $top = 0
    if ($index -ge $viewH) { $top = $index - $viewH + 1 }

    $lastGroup = ""
    for ($i = $top; $i -lt [Math]::Min($rows.Count, $top + $viewH); $i++) {
        $r = $rows[$i]
        $sel = ($i -eq $index)

        if ($r.Id -eq "__back") {
            Write-Host ""
            $label = "<  Back"
            if ($sel) {
                Write-Host (Color-TextBg $p.accent "#0B0F1A" ("  > " + $label + " "))
            } else {
                Write-Host (Color-Text $p.accent2 ("    " + $label))
            }
            continue
        }

        if ($r.Group -ne $lastGroup) {
            $lastGroup = $r.Group
            Write-Host (Color-Text $p.dim ("  -- " + $r.Group + " --"))
        }

        $mark = if ($sel) { ">" } else { " " }
        $line = ("{0} {1}" -f $mark, (Clip-Text $r.Title ($inner - 4)))
        if ($sel) {
            Write-Host (Color-TextBg $p.accent2 "#0B0F1A" (" " + $line + " "))
            Write-Host (Color-Text $p.dim ("    " + (Clip-Text $r.Rel ($inner - 4))))
        } else {
            Write-Host (Color-Text $p.text (" " + $line))
        }
    }

    Write-Host ""
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        Write-Host (Color-Text $p.accent2 ("  " + $status))
    }
    Write-Host (Color-Text $p.dim ("  " + $bl + ($hz * ($inner - 2)) + $br))
    Write-Host ""
    return $index
}

function Render-FoxDocsAction([object]$doc, [int]$btn, $p, [string]$status) {
    Clear-Host
    $tl = [string][char]0x256D; $tr = [string][char]0x256E
    $bl = [string][char]0x2570; $br = [string][char]0x256F
    $hz = [string][char]0x2500
    $winW = Get-WinWidth
    $inner = [Math]::Min(68, [Math]::Max(48, $winW - 8))

    Write-Host ""
    Write-Host (Color-Text $p.dim ("  " + $tl + $hz + " ")) -NoNewline
    Write-Host (Color-Text $p.accent "foxdocs") -NoNewline
    Write-Host (Color-Text $p.dim (" - open " + ($hz * [Math]::Max(2, $inner - 18)) + " " + $tr))
    Write-Host ""
    Write-Host (Color-Text $p.text ("  " + $doc.Title))
    Write-Host (Color-Text $p.dim ("  " + $doc.Rel))
    Write-Host (Color-Text $p.dim ("  " + (Clip-Text $doc.Path ($inner - 2))))
    Write-Host ""
    Write-Host (Color-Text $p.dim "  Up/Down  Enter activate  Left/Esc Back")
    Write-Host ""

    $buttons = @(
        @{ Kind = "explorer"; Label = "Open file + show in Explorer" }
        @{ Kind = "back"; Label = "<  Back" }
    )
    if ($btn -lt 0) { $btn = 0 }
    if ($btn -ge $buttons.Count) { $btn = $buttons.Count - 1 }

    for ($i = 0; $i -lt $buttons.Count; $i++) {
        $b = $buttons[$i]
        $sel = ($i -eq $btn)
        if ($b.Kind -eq "back") { Write-Host "" }
        $prefix = if ($sel) { "> " } else { "  " }
        $line = $prefix + $b.Label
        if ($sel) {
            Write-Host (Color-TextBg $p.accent "#0B0F1A" ("  " + $line + " "))
        } elseif ($b.Kind -eq "back") {
            Write-Host (Color-Text $p.accent2 ("    " + $b.Label))
        } else {
            Write-Host (Color-Text $p.text ("    " + $b.Label))
        }
    }

    Write-Host ""
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        Write-Host (Color-Text $p.accent2 ("  " + $status))
    }
    Write-Host (Color-Text $p.dim ("  " + $bl + ($hz * ($inner - 2)) + $br))
    Write-Host ""
    return $btn
}

function Invoke-FoxDocsActionLoop([object]$doc, $p) {
    $btn = 0
    $status = ""
    while ($true) {
        $p = Get-ThemePalette
        $btn = Render-FoxDocsAction $doc $btn $p $status
        $k = [Console]::ReadKey($true)

        if ($k.Key -eq "UpArrow" -or $k.Key -eq "K") {
            if ($btn -gt 0) { $btn-- }
            continue
        }
        if ($k.Key -eq "DownArrow" -or $k.Key -eq "J") {
            if ($btn -lt 1) { $btn++ }
            continue
        }
        if ($k.Key -eq "Escape" -or $k.Key -eq "Backspace" -or $k.Key -eq "LeftArrow" -or $k.Key -eq "BrowserBack") {
            return "back"
        }
        if ($k.Key -eq "Q" -or (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E")) {
            return "quit"
        }
        if ($k.Key -eq "Enter" -or $k.Key -eq "Spacebar") {
            if ($btn -eq 1) { return "back" }
            $status = Open-FoxDocInExplorer $doc.Path
            continue
        }
    }
}

$root = Get-FoxDocsRoot
$docs = @(Get-FoxDocsCatalog $root)

if ($List) {
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
$status = ""
while ($true) {
    $p = Get-ThemePalette
    $index = Render-FoxDocsList $docs $index $p $status
    $status = ""
    $k = [Console]::ReadKey($true)

    $backIdx = $docs.Count
    if ($k.Key -eq "UpArrow" -or $k.Key -eq "K") {
        if ($index -gt 0) { $index-- }
        continue
    }
    if ($k.Key -eq "DownArrow" -or $k.Key -eq "J") {
        if ($index -lt $backIdx) { $index++ }
        continue
    }
    if ($k.Key -eq "Escape" -or $k.Key -eq "Q" -or (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E")) {
        Clear-Host
        return
    }
    if ($k.Key -eq "Backspace" -or $k.Key -eq "BrowserBack") {
        Clear-Host
        return
    }

    $onBack = ($index -ge $backIdx)

    if ($k.Key -eq "LeftArrow") {
        if ($onBack) { Clear-Host; return }
        $doc = $docs[$index]
        Clear-Host
        Open-FoxDocInTerminal $doc.Path
        $status = "closed terminal view"
        continue
    }

    if ($k.Key -eq "RightArrow") {
        if ($onBack) { continue }
        $doc = $docs[$index]
        $r = Invoke-FoxDocsActionLoop $doc $p
        if ($r -eq "quit") { Clear-Host; return }
        $status = ""
        continue
    }

    if ($k.Key -eq "Enter" -or $k.Key -eq "Spacebar") {
        if ($onBack) { Clear-Host; return }
        $doc = $docs[$index]
        Clear-Host
        Open-FoxDocInTerminal $doc.Path
        $status = "closed terminal view"
        continue
    }
}
