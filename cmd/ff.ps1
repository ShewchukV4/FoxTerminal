param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

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

function Show-Usage {
    Write-Host "Usage:"
    Write-Host "  ff open"
    Write-Host "  ff open <alias-or-url>"
    Write-Host "  youtube open"
}

if ($Args.Count -lt 1 -or $Args[0] -ne "open") {
    Show-Usage
    exit 1
}

$target = if ($Args.Count -ge 2) { $Args[1] } else { "youtube" }

function Get-Bindings {
    $path = Join-Path $PSScriptRoot "bindings.json"
    if (-not (Test-Path $path)) {
        return @{}
    }
    try {
        $json = Get-Content -Path $path -Raw
        if ([string]::IsNullOrWhiteSpace($json)) {
            return @{}
        }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) {
            return $obj
        }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

function Resolve-Url([string]$value, [hashtable]$bindings) {
    if ($bindings.ContainsKey($value)) {
        $resolved = [string]$bindings[$value]
        if ($resolved -notmatch '^https?://') {
            return "https://$resolved"
        }
        return $resolved
    }
    if ($value -eq "youtube") {
        return "https://www.youtube.com"
    }
    if ($value -match '^https?://') {
        return $value
    }
    if ($value -match '\.') {
        return "https://$value"
    }
    return $value
}

$bindings = Get-Bindings
$url = Resolve-Url $target $bindings

$isKnownBinding = $bindings.ContainsKey($target)
$isYoutube = $target -eq "youtube"
$isUrl = $target -match '^https?://'
$isDomain = $target -match '\.'

if (-not ($isKnownBinding -or $isYoutube -or $isUrl -or $isDomain)) {
    Write-Host "Unknown command/alias: $target"
    Write-Host "Run: bbind -> Site alias, to bind this name."
    exit 1
}
$firefox = Resolve-FirefoxPath

try {
    Start-Process -FilePath $firefox -ArgumentList @("-new-tab", $url) | Out-Null
} catch {
    Write-Host "Failed to open: $url"
}
