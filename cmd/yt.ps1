param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

if ($Args.Count -lt 1 -or [string]::IsNullOrWhiteSpace($Args[0])) {
    Write-Host "Usage: yt <query>"
    exit 1
}

. (Join-Path $PSScriptRoot "fox-browser.ps1")

$query = $Args -join " "
$encoded = [uri]::EscapeDataString($query)
$url = "https://www.youtube.com/results?search_query=$encoded"

try {
    Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
} catch {
    Write-Host "Failed to open: $url"
}
