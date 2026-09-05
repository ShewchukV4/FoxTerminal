param(
    [Parameter(Position = 0)]
    [string]$Image,
    [switch]$Kitty,
    [switch]$Fast
)

. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

try {
    chcp 65001 > $null
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Get-ChafaPath {
    $cmd = Get-Command chafa -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    foreach ($dir in @(($machine + ";" + $user) -split ";" | Where-Object { $_ })) {
        foreach ($name in @("Chafa.exe", "chafa.exe", "chafa")) {
            $hit = Join-Path $dir $name
            if (Test-Path -LiteralPath $hit) { return $hit }
        }
    }
    return $null
}

function Get-DemoImage {
    $root = Split-Path $PSScriptRoot -Parent
    $candidates = @(
        (Join-Path $root "FoxTerminal\assets\demo-photo.jpg"),
        (Join-Path $root "sites\dota-items-randomizer\assets\img\hoodwink_full.png")
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

$chafa = Get-ChafaPath
if (-not $chafa) {
    Write-Host "chafa missing: winget install hpjansson.Chafa" -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Image)) { $Image = Get-DemoImage }
if (-not $Image -or -not (Test-Path -LiteralPath $Image)) {
    Write-Host "foximg [path\to\photo.jpg]" -ForegroundColor Yellow
    exit 1
}

# Leave 1 col so the last glyph never wraps (that wrap makes every row look shifted).
$cols = 80; $rows = 24
try {
    $cols = [Math]::Max(24, [Console]::WindowWidth - 1)
    $rows = [Math]::Max(8, [Console]::WindowHeight - 2)
} catch {}

$useKitty = $Kitty -or ((-not (Test-FoxIsWindows)) -and (Test-InGhostty))
if ($useKitty) {
    Clear-Host
    & $chafa --format kitty --scale max --size "${cols}x${rows}" `
        --align top,left --margin-bottom 1 --margin-right 1 `
        --animate off --passthrough none --probe off $Image
    exit $LASTEXITCODE
}

# Only 1-cell glyphs Cascadia/Nerd Font actually has. "all" pulled in latin
# letters and missing sextants — those are double-width on Windows, so rows
# wrap and the photo looks crooked.
$work = if ($Fast) { "5" } else { "9" }
Clear-Host
& $chafa --format symbols --scale max --size "${cols}x${rows}" `
    --align top,left --margin-bottom 1 --margin-right 1 `
    --relative off --animate off --probe off `
    --colors full --color-space din99d --preprocess on --optimize 9 --work $work `
    --bg "#0B0F1A" --font-ratio 1/2 `
    --symbols "block+space+vhalf+hhalf+quad+braille" `
    --fill "block+space+vhalf+quad" `
    $Image
