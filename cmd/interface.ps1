param(
    [switch]$Split,       # Створити split праворуч у поточному вікні Ghostty
    [switch]$TwoWindows,  # Відкрити друге окреме вікно Ghostty
    [switch]$Keys,        # Тільки показати keybinds split-режиму
    [switch]$Gui          # Windows GUI split (WinForms), без Ghostty
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

if ($Gui) {
    $gui = Join-Path $PSScriptRoot "interface-gui.ps1"
    if (-not (Test-Path $gui)) {
        Write-Host "interface-gui.ps1 not found." -ForegroundColor Red
        exit 1
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $gui
    exit $LASTEXITCODE
}

function Show-SplitKeys {
    $p = Get-ThemePalette
    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxTerminal interface: Ghostty splits ===")
    Write-Host ""
    Write-Host (Color-Text $p.dim "Ghostty renders splits natively, so FoxTerminal no longer needs tmux or mintty.")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Layout")
    Write-Host "  ctrl+shift+enter    split along the larger side"
    Write-Host "  ctrl+shift+l        split right"
    Write-Host "  ctrl+shift+j        split down"
    Write-Host "  ctrl+shift+z        zoom / unzoom the focused split"
    Write-Host "  ctrl+shift+e        equalize all splits"
    Write-Host "  ctrl+alt+arrows     resize the focused split by 40px"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Focus")
    Write-Host "  alt+arrows          move between splits"
    Write-Host "  ctrl+shift+t        new tab"
    Write-Host "  ctrl+shift+w        close the split / tab (Ghostty default)"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "FoxTerminal")
    Write-Host "  ctrl+shift+p        command palette with all Fox commands"
    Write-Host "  ctrl+shift+h        foxhelp"
    Write-Host "  ctrl+shift+k        chek"
    Write-Host "  ctrl+shift+backquote  quick terminal (drop-down)"
    Write-Host ""
    Write-Host (Color-Text $p.dim "  ctrl+backquote also toggles it system-wide on macOS/Linux;")
    Write-Host (Color-Text $p.dim "  on Windows foxhotkeys uses Shift+Alt+T (show) and Shift+Ctrl+Alt+T (close).")
    Write-Host ""
    Write-Host (Color-Text $p.dim "Each split keeps its own colors: sw / themes in this pane")
    Write-Host (Color-Text $p.dim "do not recolor the other pane. A new split copies this pane;")
    Write-Host (Color-Text $p.dim "sw colors like slate stay here, they are not Fox Default.")
    Write-Host ""
    Write-Host (Color-Text $p.dim "All of these live in the Ghostty config: term -Edit")
    Write-Host ""
}

function Invoke-GhosttyAction([string]$action) {
    $ghostty = Get-GhosttyCommand
    if (-not $ghostty) { return $false }
    try {
        $null = & (Get-GhosttyCliPath $ghostty) "+perform-action" $action 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

if ($Keys) {
    Show-SplitKeys
    exit 0
}

$p = Get-ThemePalette
$warn = if (Test-NoirActive) { $p.accent4 } else { "#FBD38D" }
$ghostty = Get-GhosttyCommand

if (-not $ghostty) {
    Write-Host (Color-Text $warn "Ghostty not found - interface mode needs it.")
    foreach ($line in (Get-GhosttyInstallHint)) { Write-Host (Color-Text $p.dim ("  " + $line)) }
    Write-Host ""
    Write-Host (Color-Text $p.dim "Windows GUI fallback that needs no terminal: interface -Gui")
    exit 1
}

if ($TwoWindows) {
    try {
        Start-Process -FilePath $ghostty.Path -ArgumentList @("+new-window") -WorkingDirectory (Get-Location).Path | Out-Null
        Write-Host (Color-Text $p.accent2 "Opened a second Ghostty window.")
    } catch {
        Write-Host (Color-Text $warn ("Cannot open a second window: " + $_))
        exit 1
    }
    exit 0
}

if ($Split) {
    if (Invoke-GhosttyAction "new_split:right") {
        Write-Host (Color-Text $p.accent2 "Split created to the right.")
        exit 0
    }
    Write-Host (Color-Text $warn "This Ghostty build has no CLI split action (+perform-action).")
    Write-Host (Color-Text $p.dim "Use the keybind instead:")
    Write-Host ""
    Show-SplitKeys
    exit 0
}

Show-SplitKeys
Write-Host (Color-Text $p.accent2 "Options")
Write-Host "  interface -Split        try to split from the CLI"
Write-Host "  interface -TwoWindows   open a second Ghostty window"
Write-Host "  interface -Keys         keybinds only"
Write-Host "  interface -Gui          Windows GUI split (no Ghostty needed)"
Write-Host ""
