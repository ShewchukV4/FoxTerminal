param()

function Write-Ok([string]$text) { Write-Host $text -ForegroundColor Green }
function Write-Warn([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Info([string]$text) { Write-Host $text -ForegroundColor Cyan }

$isMintty = $env:TERM_PROGRAM -eq "mintty" -or ($env:TERM -like "*xterm*")

Write-Host "=== FoxTerminal SIXEL check ==="
Write-Host ("TERM_PROGRAM: " + $(if ($env:TERM_PROGRAM) { $env:TERM_PROGRAM } else { "<empty>" }))
Write-Host ("TERM:         " + $(if ($env:TERM) { $env:TERM } else { "<empty>" }))
Write-Host ""

if (-not $isMintty) {
    Write-Warn "You are not in mintty now."
    Write-Host "Run: term -Set mintty -Now"
    Write-Host "SIXEL is enabled only for mintty launch in FoxTerminal."
    return
}

Write-Ok "mintty session detected."
Write-Host "SIXEL flag is passed by FoxTerminal launcher (-o Sixel=true)."
Write-Host ""

$bash = Get-Command bash.exe -ErrorAction SilentlyContinue
if (-not $bash) {
    Write-Warn "bash.exe not found in PATH (expected in mintty shells)."
    return
}

$tools = @("img2sixel", "chafa", "lsix")
foreach ($tool in $tools) {
    $exists = & bash.exe -lc "command -v $tool >/dev/null 2>&1; if [ \$? -eq 0 ]; then echo yes; else echo no; fi"
    if (($exists | Select-Object -First 1) -eq "yes") {
        Write-Ok ("Found tool: " + $tool)
    } else {
        Write-Warn ("Missing tool: " + $tool)
    }
}

Write-Host ""
Write-Info "Quick test commands in mintty:"
Write-Host "  bash -lc ""printf '\ePq#1;2;100;0;0#1!8~\$-\e\\'"""
Write-Host "  bash -lc ""img2sixel /path/to/image.png"""
Write-Host ""
Write-Host "Tips:"
Write-Host "  - MSYS2: pacman -S mingw-w64-ucrt-x86_64-chafa"
Write-Host "  - Cygwin: install libsixel package (img2sixel)"
