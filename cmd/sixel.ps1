param(
    [string]$Image   # Optional: render this image inline to prove graphics work
)

. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

function Write-Ok([string]$text) { Write-Host $text -ForegroundColor Green }
function Write-Warn([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Info([string]$text) { Write-Host $text -ForegroundColor Cyan }

Write-Host "=== FoxTerminal graphics check ==="
Write-Host ("TERM:         " + $(if ($env:TERM) { $env:TERM } else { "<empty>" }))
Write-Host ("TERM_PROGRAM: " + $(if ($env:TERM_PROGRAM) { $env:TERM_PROGRAM } else { "<empty>" }))
Write-Host ""

Write-Info "Ghostty renders inline images through the Kitty graphics protocol."
Write-Host "SIXEL is a different, older protocol and is not what Ghostty uses -"
Write-Host "this command kept its old name so existing notes and aliases still work."
Write-Host ""

if (-not (Test-InGhostty)) {
    Write-Warn "Not a Ghostty session - inline images will not render here."
    Write-Host "Start FoxTerminal from Ghostty (term -New), then run this again."
    Write-Host ""
} else {
    Write-Ok "Ghostty session detected: Kitty graphics protocol available."
    Write-Host ""
}

$ghostty = Get-GhosttyCommand
if ($ghostty) {
    try {
        $limitLine = & (Get-GhosttyCliPath $ghostty) "+show-config" 2>$null | Select-String -Pattern "^image-storage-limit" | Select-Object -First 1
        if ($limitLine) {
            $raw = ($limitLine.ToString() -split "=", 2)[1].Trim()
            $bytes = 0
            if ([int64]::TryParse($raw, [ref]$bytes) -and $bytes -gt 0) {
                Write-Ok ("image-storage-limit: " + [math]::Round($bytes / 1MB, 1) + " MB per screen")
            } elseif ($raw -eq "0") {
                Write-Warn "image-storage-limit = 0 - image protocols are disabled in your config."
            } else {
                Write-Host ("image-storage-limit: " + $raw)
            }
        }
    } catch {}
    Write-Host ""
}

$tools = @(
    @{ name = "chafa";  hint = "chafa --format kitty <image>" },
    @{ name = "timg";   hint = "timg -p k <image>" },
    @{ name = "kitten"; hint = "kitten icat <image>" }
)

$found = @()
foreach ($tool in $tools) {
    $cmd = Get-Command $tool.name -ErrorAction SilentlyContinue
    if ($cmd) {
        Write-Ok ("Found tool: " + $tool.name + "  ->  " + $tool.hint)
        $found += $tool
    } else {
        Write-Warn ("Missing tool: " + $tool.name)
    }
}
Write-Host ""

if ($found.Count -eq 0) {
    Write-Info "Install one image renderer:"
    if (Test-FoxIsWindows) {
        Write-Host "  winget install hpjansson.Chafa"
        Write-Host "  or: scoop install chafa"
    } elseif (Test-FoxIsMacOS) {
        Write-Host "  brew install chafa"
    } else {
        Write-Host "  pacman -S chafa   /   dnf install chafa   /   apt install chafa"
    }
    Write-Host ""
}

if (-not [string]::IsNullOrWhiteSpace($Image)) {
    if (-not (Test-Path $Image)) {
        Write-Warn ("Image not found: " + $Image)
        return
    }
    $chafa = Get-Command chafa -ErrorAction SilentlyContinue
    if (-not $chafa) {
        Write-Warn "chafa is required for -Image. Install it first (see above)."
        return
    }
    Write-Info ("Rendering " + $Image + " ...")
    & chafa --format kitty $Image
    return
}

Write-Info "Quick test:"
Write-Host "  sixel -Image path\to\picture.png"
Write-Host ""
Write-Host "Tips:"
Write-Host "  - FoxTerminal art commands (sw, spider, dj, frederik) use text cells, not images,"
Write-Host "    so they work even without chafa."
Write-Host "  - Raise or lower the budget with image-storage-limit in the Ghostty config (term -Edit)."
