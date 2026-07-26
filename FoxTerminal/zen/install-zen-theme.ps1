param(
    [switch]$SkipLaunchHint,
    [switch]$RestartZen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$themeRoot = $PSScriptRoot
$chromeSrc = Join-Path $themeRoot "userChrome.css"
$contentSrc = Join-Path $themeRoot "userContent.css"
$userJsSrc = Join-Path $themeRoot "user.js"
$profilesIni = Join-Path $env:APPDATA "zen\profiles.ini"

if (-not (Test-Path $chromeSrc)) { throw "Missing $chromeSrc" }
if (-not (Test-Path $profilesIni)) {
    throw "Zen profile not found. Launch Zen once, then rerun.`nExpected: $profilesIni"
}

function Get-ZenProfilePaths {
    $ini = Get-Content -Path $profilesIni -ErrorAction Stop
    $current = @{}
    $profiles = @()
    foreach ($line in $ini) {
        if ($line -match '^\s*\[(.+)\]\s*$') {
            if ($current.Count -gt 0) { $profiles += [pscustomobject]$current }
            $current = @{ Section = $Matches[1] }
            continue
        }
        if ($line -match '^\s*([^=]+)=(.*)$') {
            $current[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    if ($current.Count -gt 0) { $profiles += [pscustomobject]$current }

    $paths = @()
    foreach ($p in $profiles) {
        if ($p.Section -notmatch '^Profile') { continue }
        if (-not $p.Path) { continue }
        $isRelative = $true
        if ($p.PSObject.Properties.Name -contains 'IsRelative') {
            $isRelative = ($p.IsRelative -eq '1')
        }
        $full = if ($isRelative -or $p.Path -notmatch '^[A-Za-z]:\\') {
            Join-Path (Join-Path $env:APPDATA "zen") $p.Path
        } else {
            $p.Path
        }
        if (Test-Path $full) { $paths += $full }
    }
    return @($paths | Select-Object -Unique)
}

function Install-ThemeIntoProfile([string]$profilePath) {
    $chromeDir = Join-Path $profilePath "chrome"
    New-Item -ItemType Directory -Force -Path $chromeDir | Out-Null
    Copy-Item -Force -Path $chromeSrc -Destination (Join-Path $chromeDir "userChrome.css")
    if (Test-Path $contentSrc) {
        Copy-Item -Force -Path $contentSrc -Destination (Join-Path $chromeDir "userContent.css")
    }

    $userJsPath = Join-Path $profilePath "user.js"
    if (Test-Path $userJsSrc) {
        Copy-Item -Force -Path $userJsSrc -Destination $userJsPath
    } else {
        Set-Content -Path $userJsPath -Value 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);' -Encoding UTF8
    }

    # Ensure prefs.js also has the legacy flag if present (helps some Zen builds).
    $prefsPath = Join-Path $profilePath "prefs.js"
    if (Test-Path $prefsPath) {
        $prefs = Get-Content -Raw -Path $prefsPath
        if ($prefs -notmatch 'toolkit\.legacyUserProfileCustomizations\.stylesheets') {
            Add-Content -Path $prefsPath -Value 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);' -Encoding UTF8
        } else {
            $updated = [regex]::Replace(
                $prefs,
                'user_pref\(\s*"toolkit\.legacyUserProfileCustomizations\.stylesheets"\s*,\s*(true|false)\s*\)\s*;',
                'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
            )
            if ($updated -ne $prefs) {
                Set-Content -Path $prefsPath -Value $updated -Encoding UTF8
            }
        }
    }

    Write-Host "Installed -> $profilePath"
}

$paths = Get-ZenProfilePaths
if ($paths.Count -eq 0) { throw "No Zen profile directories found." }

foreach ($path in $paths) {
    Install-ThemeIntoProfile $path
}

if ($RestartZen) {
    Get-Process -Name zen -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    $zen = @(
        "$env:ProgramFiles\Zen Browser\zen.exe",
        "$env:LOCALAPPDATA\Zen Browser\zen.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($zen) {
        Start-Process -FilePath $zen -ArgumentList @("-new-tab", "about:home")
        Write-Host "Zen restarted."
    }
} elseif (-not $SkipLaunchHint) {
    Write-Host ""
    Write-Host "Restart Zen Browser to apply styles."
    Write-Host "about:config -> toolkit.legacyUserProfileCustomizations.stylesheets = true"
}
