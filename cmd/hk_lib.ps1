# Shared helpers for foxhotkeys / foxinfo.
# Dot-source this file; do NOT run directly.

# --- Comprehensive AutoHotkey detection ---
# Checks PATH, registry (App Paths, install key, uninstall entries),
# known install dirs, LocalAppData user-level installs, and winget list.
function Find-AHK {
    # 1. Get-Command (covers PATH and .exe associations)
    foreach ($name in @("AutoHotkey64", "AutoHotkey32", "AutoHotkey")) {
        $c = Get-Command $name -ErrorAction SilentlyContinue
        if ($c -and (Test-Path $c.Source)) { return $c.Source }
    }

    # 2. where.exe (resolves PATH entries that Get-Command misses on some setups)
    foreach ($name in @("AutoHotkey64.exe", "AutoHotkey.exe")) {
        try {
            $r = & where.exe $name 2>$null
            if ($r -and (Test-Path $r)) { return $r }
        } catch {}
    }

    # 3. Registry - App Paths (set by installers)
    foreach ($reg in @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\AutoHotkey64.exe",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\AutoHotkey.exe",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\AutoHotkey64.exe",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\AutoHotkey.exe"
    )) {
        try {
            $val = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).'(default)'
            if ($val -and (Test-Path $val)) { return $val }
        } catch {}
    }

    # 4. Registry - AutoHotkey InstallDir key
    foreach ($reg in @(
        "HKLM:\SOFTWARE\AutoHotkey",
        "HKCU:\SOFTWARE\AutoHotkey",
        "HKLM:\SOFTWARE\WOW6432Node\AutoHotkey"
    )) {
        try {
            $base = (Get-ItemProperty $reg -ErrorAction SilentlyContinue).InstallDir
            if (-not $base) { continue }
            foreach ($rel in @("v2\AutoHotkey64.exe","v2\AutoHotkey.exe","AutoHotkey64.exe","AutoHotkey.exe")) {
                $p = Join-Path $base $rel
                if (Test-Path $p) { return $p }
            }
        } catch {}
    }

    # 5. Known install directories (ProgramFiles, LocalAppData user install, scoop, etc.)
    $roots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        "$env:LOCALAPPDATA\Programs",
        "$env:LOCALAPPDATA\AutoHotkey",
        "$env:APPDATA\AutoHotkey",
        "$env:LOCALAPPDATA\scoop\apps\autohotkey\current",
        "$env:USERPROFILE\scoop\apps\autohotkey\current"
    ) | Where-Object { $_ }
    foreach ($root in $roots) {
        foreach ($sub in @("AutoHotkey\v2","AutoHotkey","autohotkey\v2","autohotkey")) {
            $base = Join-Path $root $sub
            foreach ($exe in @("AutoHotkey64.exe","AutoHotkey.exe")) {
                $p = Join-Path $base $exe
                if (Test-Path $p) { return $p }
            }
        }
    }

    # 6. Registry Uninstall entries (catches non-standard install locations)
    foreach ($hive in @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
    )) {
        try {
            Get-ChildItem $hive -ErrorAction SilentlyContinue | ForEach-Object {
                $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($props.DisplayName -like "*AutoHotkey*" -and $props.InstallLocation) {
                    foreach ($rel in @("v2\AutoHotkey64.exe","v2\AutoHotkey.exe","AutoHotkey64.exe","AutoHotkey.exe")) {
                        $p = Join-Path $props.InstallLocation $rel
                        if (Test-Path $p) { return $p }
                    }
                    # Also check DisplayIcon (path to the exe, sometimes)
                    if ($props.DisplayIcon -like "*.exe") {
                        $icon = $props.DisplayIcon -replace ',\d+$', ''
                        if (Test-Path $icon) { return $icon }
                    }
                }
            }
        } catch {}
    }

    # 7. winget list (last resort - slower, but catches portable/scoped installs)
    try {
        $wgOut = & winget list --id AutoHotkey.AutoHotkey 2>$null
        if ($wgOut -match "AutoHotkey") {
            # winget found it but it's not on PATH - ask winget for location
            $wgLoc = & winget show --id AutoHotkey.AutoHotkey 2>$null |
                Select-String "Install location" | ForEach-Object { ($_ -split ":\s*",2)[1].Trim() }
            if ($wgLoc) {
                foreach ($rel in @("v2\AutoHotkey64.exe","v2\AutoHotkey.exe","AutoHotkey64.exe","AutoHotkey.exe")) {
                    $p = Join-Path $wgLoc $rel
                    if (Test-Path $p) { return $p }
                }
            }
        }
    } catch {}

    return $null
}

# --- Auto-install AutoHotkey v2 ---
# Returns $true if installation succeeded and AHK is now findable.
function Install-AHK {
    $p = Get-ThemePalette

    # Try winget (silent, preferred)
    $winget = Get-Command "winget" -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host (Color-Text $p.accent2 "  Installing AutoHotkey v2 via winget...")
        try {
            $proc = Start-Process "winget" -ArgumentList `
                "install --id AutoHotkey.AutoHotkey --silent --accept-package-agreements --accept-source-agreements" `
                -PassThru -Wait -WindowStyle Hidden
            if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq -1978335189) {
                # -1978335189 = APPINSTALLER_ERROR_ALREADY_INSTALLED (treat as success)
                Write-Host (Color-Text $p.accent "  AutoHotkey installed via winget.")
                Start-Sleep -Milliseconds 800
                return (Find-AHK) -ne $null
            }
        } catch {}
        Write-Host (Color-Text $p.dim "  winget install failed, trying direct download...")
    }

    # Fall back: direct download of the v2 installer
    $url  = "https://www.autohotkey.com/download/ahk-v2.exe"
    $dest = "$env:TEMP\ahk-v2-setup.exe"
    Write-Host (Color-Text $p.accent2 "  Downloading AutoHotkey v2 from autohotkey.com...")
    try {
        $wc = New-Object System.Net.WebClient
        $wc.DownloadFile($url, $dest)
        Write-Host (Color-Text $p.accent2 "  Running installer (silent)...")
        $proc = Start-Process -FilePath $dest -ArgumentList "/silent" -PassThru -Wait
        Remove-Item $dest -Force -ErrorAction SilentlyContinue
        if ($proc.ExitCode -eq 0) {
            Write-Host (Color-Text $p.accent "  AutoHotkey installed.")
            Start-Sleep -Milliseconds 1200
            return (Find-AHK) -ne $null
        }
        Write-Host (Color-Text $p.dim "  Installer exited with code $($proc.ExitCode).")
        return $false
    } catch {
        Write-Host (Color-Text $p.dim "  Download/install failed: $_")
        Remove-Item $dest -Force -ErrorAction SilentlyContinue
        return $false
    }
}

# --- Ensure AHK exists, installing if needed ---
# Returns the path to AHK exe, or $null if unavailable.
function Ensure-AHK {
    param([switch]$Silent)
    $p   = Get-ThemePalette
    $ahk = Find-AHK
    if ($ahk) { return $ahk }

    Write-Host (Color-Text $p.dim "  AutoHotkey not found on this PC.")

    if (-not $Silent) {
        $choice = Select-Menu "Install AutoHotkey v2 now?" @("Yes, install automatically", "No, I will install manually")
        if ($choice -ne 0) {
            Write-Host (Color-Text $p.dim "  Get it at: https://www.autohotkey.com")
            return $null
        }
    } else {
        Write-Host (Color-Text $p.accent2 "  Auto-installing AutoHotkey v2...")
    }

    $ok = Install-AHK
    if ($ok) {
        return Find-AHK
    }
    Write-Host (Color-Text $p.dim "  Could not install automatically.")
    Write-Host (Color-Text $p.dim "  Please install manually: https://www.autohotkey.com")
    return $null
}
