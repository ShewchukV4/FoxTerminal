param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CmdArgs
)

Set-StrictMode -Version Latest

function Ensure-Utf8Console {
    try {
        $chcp = Get-Command chcp -ErrorAction SilentlyContinue
        if ($chcp) { $null = & $chcp 65001 2>$null }
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $global:OutputEncoding = $utf8
    } catch {}
}

Ensure-Utf8Console

$query = if ($CmdArgs -and $CmdArgs.Count -gt 0) { ($CmdArgs -join " ").Trim() } else { "" }

. (Join-Path $PSScriptRoot "fox-browser.ps1")
function Resolve-YtmBrowser { Resolve-FoxBrowserPath }

function Normalize-YtmUrl([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return $url }
    try {
        $u = [Uri]$url
        # Drop noisy share params like "si" that sometimes cause weird routing.
        if ($u.Host -notmatch '(?i)music\.youtube\.com') { return $url }
        Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue | Out-Null
        $qs = [System.Web.HttpUtility]::ParseQueryString($u.Query)
        if ($qs["si"]) { $qs.Remove("si") }
        if ($qs["utm_source"]) { $qs.Remove("utm_source") }
        if ($qs["utm_medium"]) { $qs.Remove("utm_medium") }
        if ($qs["utm_campaign"]) { $qs.Remove("utm_campaign") }
        if ($qs["feature"]) { $qs.Remove("feature") }
        $b = New-Object System.UriBuilder($u)
        $b.Query = $qs.ToString()
        return $b.Uri.AbsoluteUri
    } catch {
        return $url
    }
}

function Start-YtmUrl([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return $false }
    $url = Normalize-YtmUrl $url
    $firefox = Resolve-YtmBrowser
    try {
        if ($firefox) {
            Start-Process -FilePath $firefox -ArgumentList @("-new-tab", $url) | Out-Null
        } else {
            Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
        }
        return $true
    } catch {
        return $false
    }
}

function Load-YtmBindings {
    $path = Join-Path $PSScriptRoot "ytm_bindings.json"
    if (-not (Test-Path $path)) { return @{} }
    try {
        $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch { return @{} }
}

function Resolve-YtmUrl([string]$input) {
    if ($null -eq $input) { $input = "" }
    $input = $input.Trim()
    if ([string]::IsNullOrWhiteSpace($input)) { return "https://music.youtube.com/" }

    if ($input -match '^https?://') { return $input }

    # If user typed a phrase, always treat it as search query.
    if ($input -match '\s+') {
        $encoded = [uri]::EscapeDataString($input)
        return "https://music.youtube.com/search?q=$encoded"
    }

    $bindings = Load-YtmBindings
    if ($bindings.ContainsKey($input)) { return [string]$bindings[$input] }

    $encoded = [uri]::EscapeDataString($input)
    return "https://music.youtube.com/search?q=$encoded"
}

try {
    $url = Resolve-YtmUrl $query
    $null = Start-YtmUrl $url
} catch {
    Write-Host "Failed to open YouTube Music."
}

