param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

Set-StrictMode -Version Latest

$query = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }

function Resolve-YtmBrowser {
    # If you have YouTube Music installed as a PWA/app, deep links may open Home only.
    # To force deep links (playlist/search), we launch a real browser exe when available.
    try {
        $custom = [string]$env:FOXTERM_YTM_BROWSER
        if (-not [string]::IsNullOrWhiteSpace($custom) -and (Test-Path $custom)) { return $custom }
    } catch { }

    $pf = [string]$env:ProgramFiles
    $pfx86 = ""
    try { $pfx86 = [string]${env:ProgramFiles(x86)} } catch { $pfx86 = "" }
    $local = [string]$env:LOCALAPPDATA

    $candidates = @(
        (Join-Path $pfx86 "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $pf "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $pf "Google\Chrome\Application\chrome.exe"),
        (Join-Path $pfx86 "Google\Chrome\Application\chrome.exe"),
        (Join-Path $pf "Mozilla Firefox\firefox.exe"),
        (Join-Path $pfx86 "Mozilla Firefox\firefox.exe")
    )
    foreach ($c in $candidates) {
        try { if ($c -and (Test-Path $c)) { return $c } } catch { }
    }
    return $null
}

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
    $browser = Resolve-YtmBrowser
    try {
        if ($browser) {
            $name = [System.IO.Path]::GetFileName($browser)
            if ($name -match '(?i)^firefox') {
                Start-Process -FilePath $browser -ArgumentList @("--new-tab", $url) | Out-Null
            } elseif ($name -match '(?i)^(msedge|chrome)') {
                # Force a new window to avoid PWA/app scope swallowing deep links.
                # Also disable PWA link capturing in this process.
                Start-Process -FilePath $browser -ArgumentList @("--disable-features=PwaLinkCapturing,DesktopPWAsLinkCapturing", "--new-window", $url) | Out-Null
            } else {
                Start-Process -FilePath $browser -ArgumentList @($url) | Out-Null
            }
        } else {
            Start-Process $url | Out-Null
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

    $bindings = Load-YtmBindings
    if ($bindings.ContainsKey($input)) { return [string]$bindings[$input] }

    if ($input -match '^https?://') { return $input }
    $encoded = [uri]::EscapeDataString($input)
    return "https://music.youtube.com/search?q=$encoded"
}

try {
    $url = Resolve-YtmUrl $query
    $null = Start-YtmUrl $url
} catch {
    Write-Host "Failed to open YouTube Music."
}

