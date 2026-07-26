# Shared FoxTerminal browser resolver. Prefers Zen Browser, falls back to Firefox.

function Get-FoxBrowserCandidates {
    $list = New-Object System.Collections.Generic.List[string]

    foreach ($envName in @("FOXTERM_BROWSER", "FIREFOX_PATH", "FOXTERM_YTM_BROWSER")) {
        $custom = [string](Get-Item -Path "Env:$envName" -ErrorAction SilentlyContinue).Value
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
    Start-Process -FilePath $info.Path -ArgumentList @($flag, $Url) | Out-Null
    return $info
}
