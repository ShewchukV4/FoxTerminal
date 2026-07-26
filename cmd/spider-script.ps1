param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SpiderArgs
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (Test-Path $foxauthPath) {
    try { . $foxauthPath } catch {}
}

if (-not (Get-Command Test-NoirActive -ErrorAction SilentlyContinue)) {
    Write-Host "foxauth.ps1 not loaded."
    exit 1
}

if (-not (Test-NoirActive)) {
    Write-Host ""
    Write-Host "  The shadows are quiet. Enable noir first."
    Write-Host "  Run: noir"
    Write-Host ""
    exit 0
}

$env:FOXTERM_SPIDER_PANEL = "1"
try {
    $swPath = Join-Path $PSScriptRoot "sw-script.ps1"
    if (-not (Test-Path $swPath)) {
        Write-Host "sw-script.ps1 not found."
        exit 1
    }
    if ($SpiderArgs -and $SpiderArgs.Count -gt 0) {
        & $swPath @SpiderArgs
    } else {
        & $swPath
    }
} finally {
    Remove-Item Env:FOXTERM_SPIDER_PANEL -ErrorAction SilentlyContinue
}
