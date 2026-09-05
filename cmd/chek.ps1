param()

. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

function Get-TerminalKind {
    if ($env:GHOSTTY_RESOURCES_DIR -or $env:GHOSTTY_BIN_DIR) { return "Ghostty" }
    if ($env:TERM_PROGRAM -and $env:TERM_PROGRAM.ToLowerInvariant().Contains("ghostty")) { return "Ghostty" }
    if ($env:TERM -and $env:TERM.ToLowerInvariant().Contains("ghostty")) { return "Ghostty" }
    if ($env:TERM_PROGRAM) { return "$($env:TERM_PROGRAM) (unsupported)" }
    if ($env:TERM) { return "$($env:TERM) (unsupported)" }
    return "Unknown (unsupported)"
}

function Get-ShellKind {
    if ($env:PSModulePath -and $PSVersionTable) {
        return ("PowerShell " + $PSVersionTable.PSVersion.ToString())
    }
    if ($env:SHELL) { return $env:SHELL }
    return "Unknown"
}

$terminal = Get-TerminalKind
$shell = Get-ShellKind
$inGhostty = Test-InGhostty
$ghostty = Get-GhosttyCommand

Write-Host "=== FoxTerminal Check ==="
Write-Host ("Terminal: {0}" -f $terminal)
Write-Host ("Shell:    {0}" -f $shell)
Write-Host ("Host:     {0}" -f ($(if ($ghostty) { $ghostty.Flavor + " -> " + $ghostty.Path } else { "Ghostty not installed" })))
Write-Host ""
Write-Host "Signals:"
Write-Host ("  TERM={0}" -f ($(if ($env:TERM) { $env:TERM } else { "<empty>" })))
Write-Host ("  TERM_PROGRAM={0}" -f ($(if ($env:TERM_PROGRAM) { $env:TERM_PROGRAM } else { "<empty>" })))
Write-Host ("  TERM_PROGRAM_VERSION={0}" -f ($(if ($env:TERM_PROGRAM_VERSION) { $env:TERM_PROGRAM_VERSION } else { "<empty>" })))
Write-Host ("  COLORTERM={0}" -f ($(if ($env:COLORTERM) { $env:COLORTERM } else { "<empty>" })))
Write-Host ("  GHOSTTY_RESOURCES_DIR={0}" -f ($(if ($env:GHOSTTY_RESOURCES_DIR) { $env:GHOSTTY_RESOURCES_DIR } else { "<empty>" })))
Write-Host ("  GHOSTTY_SHELL_INTEGRATION_NO_SUDO={0}" -f ($(if ($env:GHOSTTY_SHELL_INTEGRATION_NO_SUDO) { $env:GHOSTTY_SHELL_INTEGRATION_NO_SUDO } else { "<empty>" })))
Write-Host ("  FOXTERM={0}" -f ($(if ($env:FOXTERM) { $env:FOXTERM } else { "<empty>" })))
Write-Host ("  FOXTERM_HOST={0}" -f ($(if ($env:FOXTERM_HOST) { $env:FOXTERM_HOST } else { "<empty>" })))
Write-Host ""

if ($inGhostty) {
    Write-Host "FoxTerminal is running in its supported terminal." -ForegroundColor Green
} else {
    Write-Host "FoxTerminal only supports Ghostty." -ForegroundColor Yellow
    if ($ghostty) {
        Write-Host "Ghostty is installed - start FoxTerminal from it, or run: term -New" -ForegroundColor Yellow
    } else {
        foreach ($line in (Get-GhosttyInstallHint)) { Write-Host ("  " + $line) }
    }
    Write-Host "Then run: term -Apply" -ForegroundColor Yellow
}
