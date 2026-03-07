param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

Set-StrictMode -Version Latest

function Resolve-SpotifyAppPath {
    $candidates = @(
        (Join-Path $env:APPDATA "Spotify\Spotify.exe"),
        (Join-Path $env:LOCALAPPDATA "Spotify\Spotify.exe")
    )
    foreach ($p in $candidates) {
        try { if ($p -and (Test-Path $p)) { return $p } } catch { }
    }
    return $null
}

function Load-SpotifyBindings {
    $path = Join-Path $PSScriptRoot "sp_bindings.json"
    if (-not (Test-Path $path)) { return @{} }
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

function Resolve-SpotifyUrl([string]$input) {
    if ($null -eq $input) { $input = "" }
    $input = $input.Trim()
    if ([string]::IsNullOrWhiteSpace($input)) { return "https://open.spotify.com/" }

    $bindings = Load-SpotifyBindings
    if ($bindings.ContainsKey($input)) {
        $bound = [string]$bindings[$input]
        if ($bound -notmatch '^https?://') { return "https://$bound" }
        return $bound
    }

    if ($input -match '^https?://') { return $input }

    $encoded = [uri]::EscapeDataString($input)
    return "https://open.spotify.com/search/$encoded"
}

$query = if ($Args.Count -gt 0) { ($Args -join " ").Trim() } else { "" }
try {
    if (-not [string]::IsNullOrWhiteSpace($query)) {
        if ($query -match '^https?://') {
            Start-Process $query | Out-Null
        } else {
            $encoded = [uri]::EscapeDataString($query)
            Start-Process ("spotify:search:" + $encoded) | Out-Null
        }
        exit 0
    }

    $exe = Resolve-SpotifyAppPath
    if ($exe) {
        Start-Process -FilePath $exe | Out-Null
    } else {
        Start-Process "spotify:" | Out-Null
    }
} catch {
    Write-Host "Failed to open Spotify."
}

