param(
    [string]$Set,
    [switch]$Now,
    [string]$App
)

. (Join-Path $PSScriptRoot "foxauth.ps1")

function Get-FoxConfigPath {
    return (Join-Path $HOME ".foxterminal.json")
}

function Load-FoxConfig {
    $path = Get-FoxConfigPath
    if (-not (Test-Path $path)) {
        return @{}
    }

    try {
        $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        $ht = @{}
        foreach ($p in $obj.PSObject.Properties) {
            $ht[$p.Name] = $p.Value
        }
        return $ht
    } catch {
        return @{}
    }
}

function Save-FoxConfig([hashtable]$cfg) {
    $path = Get-FoxConfigPath
    $cfg | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
}

function Find-BashCandidate {
    $candidates = @(
        @{ kind = "Cygwin"; path = "C:\cygwin64\bin\bash.exe" },
        @{ kind = "Cygwin"; path = "C:\cygwin\bin\bash.exe" },
        @{ kind = "MSYS2"; path = "C:\msys64\usr\bin\bash.exe" },
        @{ kind = "Git Bash"; path = "C:\Program Files\Git\bin\bash.exe" },
        @{ kind = "Git Bash"; path = "C:\Program Files\Git\usr\bin\bash.exe" }
    )

    foreach ($c in $candidates) {
        if (Test-Path $c.path) {
            return $c
        }
    }

    return $null
}

function Find-MinttyCandidate {
    $candidates = @(
        "C:\cygwin64\bin\mintty.exe",
        "C:\cygwin\bin\mintty.exe",
        "C:\msys64\bin\mintty.exe",
        "C:\msys64\usr\bin\mintty.exe",
        "C:\Program Files\Git\bin\mintty.exe",
        "C:\Program Files\Git\usr\bin\mintty.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            return $path
        }
    }

    return $null
}

function Select-Menu([string]$title, [string[]]$options) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = 0
    while ($true) {
        $p = Get-ThemePalette
        Clear-Host
        Write-Host (Color-Text $p.accent ("=== " + $title + " ==="))
        Write-Host ""
        for ($i = 0; $i -lt $options.Count; $i++) {
            if ($i -eq $index) {
                $label = "  " + $options[$i] + "  "
                Write-Host (Color-TextBg (Get-ContrastText $p.accent2) $p.accent2 $label)
            } else {
                Write-Host (Color-Text $p.text ("  " + $options[$i]))
            }
        }
        Write-Host ""
        Write-Host (Color-Text $p.dim "Up/Down: select, Enter: apply, Esc: cancel")

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow" { if ($index -gt 0) { $index-- } }
            "DownArrow" { if ($index -lt ($options.Count - 1)) { $index++ } }
            "Enter" { return $index }
            "Escape" { return -1 }
        }
    }
}

function Apply-Backend([string]$backend) {
    $cfg = Load-FoxConfig

    if ($backend -eq "auto") {
        $cfg["shellBackend"] = "auto"
        $cfg.Remove("shellPath")
        $cfg.Remove("shellArguments")
        Save-FoxConfig $cfg
        return "Set backend: auto (default Windows/cross-platform fallback)."
    }

    if ($backend -eq "windows") {
        $cfg["shellBackend"] = "windows"
        $cfg.Remove("shellPath")
        $cfg.Remove("shellArguments")
        Save-FoxConfig $cfg
        return "Set backend: windows (cmd/COMSPEC)."
    }

    if ($backend -eq "mintty") {
        $bash = Find-BashCandidate
        if ($null -eq $bash) {
            return "No bash.exe found (Cygwin/MSYS2/Git Bash). Install one or set shellPath manually."
        }

        $cfg["shellBackend"] = "mintty"
        $cfg["shellPath"] = $bash.path
        $cfg["shellArguments"] = "--login -i"
        Save-FoxConfig $cfg
        return ("Set backend: mintty using " + $bash.kind + " (" + $bash.path + ").")
    }

    if ($backend -eq "cygwin") {
        $cyg = @("C:\cygwin64\bin\bash.exe", "C:\cygwin\bin\bash.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($cyg)) {
            return "Cygwin bash not found at C:\cygwin64\bin\bash.exe or C:\cygwin\bin\bash.exe."
        }

        $cfg["shellBackend"] = "mintty"
        $cfg["shellPath"] = $cyg
        $cfg["shellArguments"] = "--login -i"
        Save-FoxConfig $cfg
        return ("Set backend: cygwin (" + $cyg + ").")
    }

    return "Unknown backend."
}

function Enter-BackendNow([string]$backend, [string]$app) {
    $cmdDirWin = $PSScriptRoot
    $cmdInit = Join-Path $cmdDirWin "foxterm-cmd-init.cmd"
    $bashInit = Join-Path $cmdDirWin "foxterm-bash-init.sh"
    $runInMintty = $app -eq "mintty"

    if ($backend -eq "windows" -or $backend -eq "auto") {
        Write-Host "Switching now to cmd shell with Fox profile..."
        if (Test-Path $cmdInit) {
            cmd.exe /K "call `"$cmdInit`""
        } else {
            cmd.exe /K
        }
        return
    }

    if ($backend -eq "mintty" -or $backend -eq "cygwin") {
        $cfg = Load-FoxConfig
        $path = $null
        if ($cfg.ContainsKey("shellPath")) {
            $path = [string]$cfg["shellPath"]
        }

        if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path $path)) {
            $candidate = Find-BashCandidate
            if ($null -ne $candidate) {
                $path = $candidate.path
            }
        }

        if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path $path)) {
            Write-Host "Cannot switch now: bash.exe not found."
            return
        }

        $cmdDirUnix = $null
        try {
            $cmdDirUnix = (& $path -lc "cygpath -u '$cmdDirWin'" 2>$null | Select-Object -First 1).Trim()
        } catch {
            $cmdDirUnix = $null
        }

        if ([string]::IsNullOrWhiteSpace($cmdDirUnix) -or -not (Test-Path $bashInit)) {
            Write-Host ("Switching now to bash (plain): " + $path)
            & $path --login -i
            return
        }

        $env:FOXTERM_CMD_PATH_UNIX = $cmdDirUnix
        $env:FOXTERM_CMD_PATH_WIN = $cmdDirWin

        $tmpInitWin = Join-Path $env:TEMP "foxterm-bash-init-runtime.sh"
        try {
            $content = [System.IO.File]::ReadAllText($bashInit)
            $content = $content -replace "`r`n", "`n"
            $content = $content -replace "`r", "`n"
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($tmpInitWin, $content, $utf8NoBom)
        } catch {
            Write-Host "Cannot prepare bash init script. Falling back to plain bash."
            & $path --login -i
            return
        }

        $tmpInitUnix = $null
        try {
            $tmpInitUnix = (& $path -lc "cygpath -u '$tmpInitWin'" 2>$null | Select-Object -First 1).Trim()
        } catch {
            $tmpInitUnix = $null
        }

        if ([string]::IsNullOrWhiteSpace($tmpInitUnix)) {
            Write-Host "Cannot resolve runtime init path in bash. Falling back to plain bash."
            & $path --login -i
            return
        }

        if ($runInMintty) {
            $mintty = Find-MinttyCandidate
            if ([string]::IsNullOrWhiteSpace($mintty)) {
                Write-Host "mintty.exe not found. Falling back to in-tab bash."
            } else {
                Write-Host ("Opening mintty window: " + $mintty)
                Write-Host "Current tab stays open; close it manually if not needed."
                $minttyArgs = @(
                    "-t", "FoxTerminal-mintty",
                    "-o", "Sixel=true",
                    "-e", $path, "--noprofile", "--rcfile", $tmpInitUnix, "-i"
                )

                $started = $false
                try {
                    # mintty launcher may exit quickly even when the window starts successfully.
                    # Treat a successful Start-Process call as a successful launch to avoid double windows.
                    Start-Process -FilePath $mintty -ArgumentList $minttyArgs -WorkingDirectory (Get-Location).Path | Out-Null
                    $started = $true
                } catch {
                    $started = $false
                }

                if ($started) {
                    return
                }

                Write-Host "mintty launch failed. Falling back to in-tab bash."
            }
        }

        Write-Host ("Switching now to bash with Fox profile: " + $path)
        & $path --noprofile --rcfile $tmpInitUnix -i
        return
    }
}

$cfg = Load-FoxConfig
$currentBackend = if ($cfg.ContainsKey("shellBackend")) { [string]$cfg["shellBackend"] } else { "auto" }
$currentPath = if ($cfg.ContainsKey("shellPath")) { [string]$cfg["shellPath"] } else { "<auto>" }

$selected = $null
if (-not [string]::IsNullOrWhiteSpace($Set)) {
    $selected = $Set.Trim().ToLowerInvariant()
} elseif ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
    $options = @(
        "auto (recommended)",
        "windows (cmd)",
        "mintty (auto-detect bash)",
        "cygwin (force Cygwin bash)",
        "cancel"
    )

    $choice = Select-Menu "FoxTerminal backend switch" $options
    if ($choice -lt 0 -or $choice -eq 4) {
        Write-Host "Cancelled."
        return
    }

    $selected = switch ($choice) {
        0 { "auto" }
        1 { "windows" }
        2 { "mintty" }
        3 { "cygwin" }
        default { "auto" }
    }
} else {
    Write-Host "Non-interactive mode detected."
    Write-Host "Use: term -Set auto|windows|mintty|cygwin"
    return
}

$selectedApp = if ([string]::IsNullOrWhiteSpace($App)) { "default" } else { $App.Trim().ToLowerInvariant() }
if ($Now -and $selected -eq "mintty" -and $selectedApp -eq "default") {
    $selectedApp = "mintty"
}

$msg = Apply-Backend $selected

Write-Host ""
Write-Host $msg
Write-Host ("Current (before): shellBackend=" + $currentBackend + ", shellPath=" + $currentPath)

$newCfg = Load-FoxConfig
$newBackend = if ($newCfg.ContainsKey("shellBackend")) { [string]$newCfg["shellBackend"] } else { "auto" }
$newPath = if ($newCfg.ContainsKey("shellPath")) { [string]$newCfg["shellPath"] } else { "<auto>" }
Write-Host ("Current (now):    shellBackend=" + $newBackend + ", shellPath=" + $newPath)
Write-Host ""
Write-Host "Restart FoxTerminalApp (or open a new app tab) to apply."
Write-Host "Tip: use 'term -Set <backend> -Now' for immediate switch in this terminal."
Write-Host "Tip: use '-App mintty' to open a real mintty window."

if ($Now) {
    Write-Host ""
    Enter-BackendNow $selected $selectedApp
}
