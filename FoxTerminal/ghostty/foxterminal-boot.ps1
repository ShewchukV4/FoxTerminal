# FoxTerminal shell bootstrap for Ghostty (Windows / PowerShell).
#
# Ghostty launches this via the generated foxterminal-local.ghostty:
#   command = powershell.exe -NoLogo -NoExit -Command ". '<path>\foxterminal-boot.ps1'"
#
# It must be DOT-SOURCED, not run with -File: foxauth.ps1 defines the prompt,
# theme palette and login helpers, and those have to land in the session scope.

$foxGhosttyDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($foxGhosttyDir)) {
    $foxGhosttyDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$foxRoot = Split-Path -Parent (Split-Path -Parent $foxGhosttyDir)
$foxCmd = Join-Path $foxRoot "cmd"

$env:FOXTERM = "1"
$env:FOXTERM_HOST = "ghostty"
$env:FOXTERM_ROOT = $foxRoot
$env:FOXTERM_CMD_PATH_WIN = $foxCmd
# Unique per pane. Ghostty may copy the parent split's env, so always mint a
# new id here. Child commands (sw / foxhelp) inherit it and keep this pane's
# theme. The parent id is only used to seed a new split from that pane.
$foxParentThemeSurface = $env:FOXTERM_THEME_SURFACE
$env:FOXTERM_THEME_SURFACE = [guid]::NewGuid().ToString("N")

# UTF-8 so box drawing, Nerd Font glyphs and Cyrillic render correctly.
try {
    chcp 65001 > $null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

if ((Test-Path $foxCmd) -and ($env:PATH -notlike "*$foxCmd*")) {
    $env:PATH = $foxCmd + [System.IO.Path]::PathSeparator + $env:PATH
}

$foxAuth = Join-Path $foxCmd "foxauth.ps1"
if (Test-Path $foxAuth) {
    . $foxAuth
    $foxNoteLib = Join-Path $foxCmd "note-lib.ps1"
    if (Test-Path $foxNoteLib) { . $foxNoteLib }
    if (Get-Command Initialize-FoxPaneTheme -ErrorAction SilentlyContinue) {
        Initialize-FoxPaneTheme -ParentSurfaceId $foxParentThemeSurface
    }
    if (Get-Command Sync-FoxGhosttyShader -ErrorAction SilentlyContinue) {
        try { Sync-FoxGhosttyShader | Out-Null } catch {}
    }
    if (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue) {
        try { Sync-FoxOsSkin | Out-Null } catch {}
    }
    if (Get-Command Ensure-Login -ErrorAction SilentlyContinue) {
        Ensure-Login | Out-Null
    }
} else {
    Write-Host "FoxTerminal: cmd\foxauth.ps1 not found under $foxRoot" -ForegroundColor Yellow
    Write-Host "Re-run the installer: FoxTerminal\install.ps1" -ForegroundColor Yellow
}
