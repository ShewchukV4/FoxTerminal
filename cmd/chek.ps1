param()

function Get-TerminalKind {
    if ($env:WT_SESSION) { return "Windows Terminal" }
    if ($env:TERM_PROGRAM) { return "$($env:TERM_PROGRAM)" }
    if ($env:ConEmuPID) { return "ConEmu" }
    if ($env:TERM -match "xterm|screen|tmux|rxvt") { return "$($env:TERM)" }
    if ($env:ComSpec -and $env:ComSpec.ToLowerInvariant().Contains("cmd.exe")) { return "Windows Console (cmd host)" }
    return "Unknown"
}

function Get-ShellKind {
    if ($env:MSYSTEM) { return "MSYS2/Git Bash" }
    if ($env:OSTYPE -match "cygwin") { return "Cygwin Bash" }
    if ($env:TERM -match "cygwin") { return "Cygwin-compatible shell" }
    if ($env:PSModulePath) { return "PowerShell" }
    if ($env:ComSpec -and $env:ComSpec.ToLowerInvariant().Contains("cmd.exe")) { return "cmd.exe" }
    return "Unknown"
}

$terminal = Get-TerminalKind
$shell = Get-ShellKind

Write-Host "=== FoxTerminal Check ==="
Write-Host ("Terminal: {0}" -f $terminal)
Write-Host ("Shell:    {0}" -f $shell)
Write-Host ""
Write-Host "Signals:"
Write-Host ("  WT_SESSION={0}" -f ($(if ($env:WT_SESSION) { $env:WT_SESSION } else { "<empty>" })))
Write-Host ("  TERM={0}" -f ($(if ($env:TERM) { $env:TERM } else { "<empty>" })))
Write-Host ("  TERM_PROGRAM={0}" -f ($(if ($env:TERM_PROGRAM) { $env:TERM_PROGRAM } else { "<empty>" })))
Write-Host ("  OSTYPE={0}" -f ($(if ($env:OSTYPE) { $env:OSTYPE } else { "<empty>" })))
Write-Host ("  MSYSTEM={0}" -f ($(if ($env:MSYSTEM) { $env:MSYSTEM } else { "<empty>" })))
