param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

if ($Args.Count -lt 1 -or [string]::IsNullOrWhiteSpace($Args[0])) {
    Write-Host "Usage: yt <query>"
    exit 1
}

function Resolve-FirefoxPath {
    if ($env:FIREFOX_PATH -and (Test-Path $env:FIREFOX_PATH)) {
        return $env:FIREFOX_PATH
    }
    $candidates = @(
        "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
        "$env:ProgramFiles(x86)\Mozilla Firefox\firefox.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return "firefox"
}

$query = $Args -join " "
$encoded = [uri]::EscapeDataString($query)
$url = "https://www.youtube.com/results?search_query=$encoded"

$firefox = Resolve-FirefoxPath
try {
    Start-Process -FilePath $firefox -ArgumentList @("--new-tab", $url) | Out-Null
} catch {
    Write-Host "Failed to open: $url"
}
