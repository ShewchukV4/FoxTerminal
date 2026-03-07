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

function Load-TgBindings {
    $path = Join-Path $PSScriptRoot "tg_bindings.json"
    if (-not (Test-Path $path)) {
        return @{}
    }
    try {
        $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

$url = "https://web.telegram.org/k/"
if ($Args.Count -ge 1) {
    $target = ($Args -join " ").Trim()
    if (-not [string]::IsNullOrWhiteSpace($target)) {
        $bindings = Load-TgBindings
        if ($bindings.ContainsKey($target)) {
            $entry = $bindings[$target]
            if ($entry -is [string]) {
                $target = [string]$entry
            } elseif ($entry -is [hashtable]) {
                if ($entry.ContainsKey("phone") -and -not [string]::IsNullOrWhiteSpace($entry.phone)) {
                    $target = "tg://resolve?phone=$($entry.phone)"
                } elseif ($entry.ContainsKey("username") -and -not [string]::IsNullOrWhiteSpace($entry.username)) {
                    $target = [string]$entry.username
                }
            }
        }
        if ($target -match '^https?://') {
            $url = $target
        } elseif ($target -match '^tg://') {
            $url = $target
        } else {
            if ($target -notmatch '^@') {
                $target = "@$target"
            }
            $url = "https://web.telegram.org/k/#$target"
        }
    }
}
$firefox = Resolve-FirefoxPath
try {
    Start-Process -FilePath $firefox -ArgumentList @("--new-tab", $url) | Out-Null
} catch {
    Write-Host "Failed to open: $url"
}
