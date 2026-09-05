param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$name = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
if ([string]::IsNullOrWhiteSpace($name)) {
    Write-Host "Usage: view <file>"
    exit 1
}

$path = if ([System.IO.Path]::IsPathRooted($name)) {
    [System.IO.Path]::GetFullPath($name)
} else {
    [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $name))
}

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "File not found: $path"
    exit 1
}

try {
    . "$PSScriptRoot\note-lib.ps1"
    Suspend-WaiPinForEditor
    Get-Content -LiteralPath $path | Out-Host -Paging
} finally {
    if (Get-Command Resume-WaiPinAfterEditor -ErrorAction SilentlyContinue) {
        Resume-WaiPinAfterEditor
    }
}
