# Shared FoxTerminal browser resolver. Prefers Zen Browser, falls back to Firefox.

function Get-FoxBrowserCandidates {
    $list = New-Object System.Collections.Generic.List[string]

    foreach ($envName in @("FOXTERM_BROWSER", "FIREFOX_PATH", "FOXTERM_YTM_BROWSER")) {
        # Reading through the provider and dereferencing .Value throws under
        # StrictMode when the variable is unset, so go through the env: drive value.
        $custom = [Environment]::GetEnvironmentVariable($envName)
        if (-not [string]::IsNullOrWhiteSpace($custom)) {
            $list.Add($custom.Trim())
        }
    }

    $pf = ${env:ProgramFiles}
    $pfx86 = ${env:ProgramFiles(x86)}
    $local = $env:LOCALAPPDATA

    @(
        (Join-Path $pf "Zen Browser\zen.exe"),
        (Join-Path $local "Zen Browser\zen.exe"),
        (Join-Path $pf "Zen\zen.exe"),
        (Join-Path $local "Programs\Zen Browser\zen.exe"),
        (Join-Path $pf "Mozilla Firefox\firefox.exe"),
        (Join-Path $pfx86 "Mozilla Firefox\firefox.exe"),
        (Join-Path $local "Mozilla Firefox\firefox.exe")
    ) | ForEach-Object {
        if ($_ -and -not $list.Contains($_)) {
            $list.Add($_)
        }
    }

    return $list
}

function Resolve-FoxBrowserPath {
    foreach ($candidate in (Get-FoxBrowserCandidates)) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    foreach ($name in @("zen", "firefox")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) {
            return $cmd.Source
        }
    }

    return "zen"
}

function Get-FoxBrowserInfo {
    $path = Resolve-FoxBrowserPath
    $leaf = [System.IO.Path]::GetFileNameWithoutExtension($path).ToLowerInvariant()
    $isZen = $leaf -eq "zen" -or $path -match '(?i)Zen Browser|\\Zen\\'
    $isFirefox = $leaf -eq "firefox" -or $path -match '(?i)Mozilla Firefox'

    return [pscustomobject]@{
        Path = $path
        Name = if ($isZen) { "Zen" } elseif ($isFirefox) { "Firefox" } else { $leaf }
        ProcessName = if ($isZen) { "zen" } elseif ($isFirefox) { "firefox" } else { $leaf }
        WindowPattern = if ($isZen) { "Zen" } else { "Mozilla Firefox|Firefox" }
        IsZen = $isZen
        IsFirefox = $isFirefox
    }
}

function Open-FoxBrowserUrl {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [ValidateSet("tab", "window")][string]$Mode = "tab"
    )

    $info = Get-FoxBrowserInfo
    $flag = if ($Mode -eq "window") { "-new-window" } else { "-new-tab" }
    if ($info.Path -and (Test-Path -LiteralPath $info.Path)) {
        Start-Process -FilePath $info.Path -ArgumentList @($flag, $Url) | Out-Null
    } else {
        Start-Process -FilePath "zen.exe" -ArgumentList @($flag, $Url) | Out-Null
    }
    return $info
}

function Get-FoxWindowsDefaultBrowserId {
    $p = "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice"
    if (-not (Test-Path -LiteralPath $p)) { return "" }
    try {
        return [string](Get-ItemProperty -LiteralPath $p -Name ProgId -ErrorAction Stop).ProgId
    } catch {
        return ""
    }
}

function Test-FoxWindowsDefaultIsZen {
    $id = Get-FoxWindowsDefaultBrowserId
    if ([string]::IsNullOrWhiteSpace($id)) { return $false }
    if ($id -match '(?i)MSEdge|Chrome|IE\.|IExplore') { return $false }
    $cmd = ""
    foreach ($root in @("HKCU:\Software\Classes", "HKLM:\Software\Classes")) {
        $key = Join-Path $root ($id + "\shell\open\command")
        if (Test-Path -LiteralPath $key) {
            try { $cmd = [string](Get-ItemProperty -LiteralPath $key)."(default)" } catch {}
            if ($cmd) { break }
        }
    }
    return ($cmd -match '(?i)Zen Browser|\\zen\.exe')
}

function Set-FoxClassicBrowser {
    $info = Get-FoxBrowserInfo
    if (-not $info -or [string]::IsNullOrWhiteSpace($info.Path) -or -not (Test-Path -LiteralPath $info.Path)) {
        Write-Host "Zen Browser not found."
        return $false
    }
    if (-not $info.IsZen) {
        Write-Host ("Resolved browser is not Zen: " + $info.Path)
        return $false
    }

    $env:FOXTERM_BROWSER = $info.Path
    $env:FIREFOX_PATH = $info.Path
    $env:FOXTERM_YTM_BROWSER = $info.Path
    foreach ($name in @("FOXTERM_BROWSER", "FIREFOX_PATH", "FOXTERM_YTM_BROWSER")) {
        [Environment]::SetEnvironmentVariable($name, $info.Path, "User")
    }

    foreach ($arg in @("--setDefaultBrowser", "-setDefaultBrowser")) {
        try {
            Start-Process -FilePath $info.Path -ArgumentList @($arg) -Wait -WindowStyle Hidden | Out-Null
        } catch {}
    }

    return $true
}
