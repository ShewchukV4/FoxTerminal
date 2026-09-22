param(
    [string]$ConfigPath = "$PSScriptRoot\ghostty\config",
    [switch]$DisableBloat,  # Вимкнути служби, що навантажують (потрібен запуск від адміна)
    [switch]$DisableAds,    # Вимкнути рекламу та підказки Windows (реєстр, адмін не потрібен)
    [switch]$Status,        # Показати, що вимкнено / увімкнено
    [switch]$Enable,        # Увімкнути назад служби та рекламу/підказки
    [switch]$NoShortcut,    # Не створювати ярлик на робочому столі
    [switch]$NoLogonStart,  # Не відкривати FoxTerminal після входу в Windows
    [switch]$Force          # Перезаписати конфіг Ghostty без запитань
)

# Тільки служби, що найбільше навантажують (телеметрія, префетч, ігри, синхро, звіти, карти)
$bloatServices = @('DiagTrack','dmwappushservice','SysMain','GamingServices','GamingServicesNet','OneSyncSvc','PimIndexMaintenanceSvc','WerSvc','MapsBroker')
# CDPUserSvc can have suffix _xxxxx - we disable all
$bloatPatterns = @('CDPUserSvc*','PimIndexMaintenanceSvc_*')
# Registry keys for ads/tips (path, name, 0=disabled)
$adsReg = @(
    @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'; Names = @('Start_TrackDocs','Start_TrackProgs') },
    @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'; Names = @('SubscribedContent-310093Enabled','SubscribedContent-338388Enabled','SubscribedContent-338393Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled','SoftLandingEnabled','SystemPaneSuggestionsEnabled') },
    @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy'; Names = @('TailoredExperiencesWithDiagnosticDataEnabled') }
)

if ($DisableBloat) {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { Write-Host "Run PowerShell as Administrator for -DisableBloat." ; exit 1 }
    foreach ($sn in $bloatServices) {
        $svc = Get-Service -Name $sn -ErrorAction SilentlyContinue
        if ($svc -and $svc.StartType -ne 'Disabled') {
            if ($svc.Status -eq 'Running') { Stop-Service -Name $sn -Force -ErrorAction SilentlyContinue }
            Set-Service -Name $sn -StartupType Disabled -ErrorAction SilentlyContinue
            Write-Host "Вимкнено: $sn"
        }
    }
    foreach ($pat in $bloatPatterns) {
        Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $pat } | ForEach-Object {
            if ($_.StartType -ne 'Disabled') {
                if ($_.Status -eq 'Running') { Stop-Service -Name $_.Name -Force -ErrorAction SilentlyContinue }
                Set-Service -Name $_.Name -StartupType Disabled -ErrorAction SilentlyContinue
                Write-Host "Вимкнено: $($_.Name)"
            }
        }
    }
    Write-Host "Services disabled. Reboot if needed."
}

if ($DisableAds) {
    $zero = 0
    $base = 'Software\Microsoft\Windows\CurrentVersion'
    # Current user (HKCU)
    $cdm = "HKCU:\$base\ContentDeliveryManager"
    $exp = "HKCU:\$base\Explorer\Advanced"
    $prv = "HKCU:\$base\Privacy"
    foreach ($p in @($cdm,$exp,$prv)) { if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null } }
    @('Start_TrackDocs','Start_TrackProgs') | ForEach-Object { Set-ItemProperty -Path $exp -Name $_ -Value $zero -Type DWord -ErrorAction SilentlyContinue }
    Set-ItemProperty -Path $cdm -Name 'SubscribedContent-310093Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SubscribedContent-338388Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SubscribedContent-338393Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SubscribedContent-353694Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SubscribedContent-353696Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SoftLandingEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $cdm -Name 'SystemPaneSuggestionsEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $prv -Name 'TailoredExperiencesWithDiagnosticDataEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
    # Default User (so new accounts get it too) - need admin
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        $hu = "Registry::HKEY_USERS\.DEFAULT"
        $cdmD = "$hu\$base\ContentDeliveryManager"
        $expD = "$hu\$base\Explorer\Advanced"
        $prvD = "$hu\$base\Privacy"
        foreach ($p in @($cdmD,$expD,$prvD)) { if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null } }
        @('Start_TrackDocs','Start_TrackProgs') | ForEach-Object { Set-ItemProperty -Path $expD -Name $_ -Value $zero -Type DWord -ErrorAction SilentlyContinue }
        Set-ItemProperty -Path $cdmD -Name 'SubscribedContent-310093Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SubscribedContent-338388Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SubscribedContent-338393Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SubscribedContent-353694Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SubscribedContent-353696Enabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SoftLandingEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $cdmD -Name 'SystemPaneSuggestionsEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $prvD -Name 'TailoredExperiencesWithDiagnosticDataEnabled' -Value $zero -Type DWord -ErrorAction SilentlyContinue
        Write-Host "Ads/tips disabled for current user and Default User (new accounts). Restart Explorer or log off/on."
    } else {
        Write-Host "Ads/tips disabled for current user. Run as Administrator to apply to new user accounts too. Restart Explorer or log off/on."
    }
}

if ($Status) {
    Write-Host "=== Служби (Bloat) ===" -ForegroundColor Cyan
    foreach ($sn in $bloatServices) {
        $svc = Get-Service -Name $sn -ErrorAction SilentlyContinue
        if ($svc) { Write-Host "  $sn : $($svc.StartType), $($svc.Status)" } else { Write-Host "  $sn : (not found)" }
    }
    foreach ($pat in $bloatPatterns) {
        Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $pat } | ForEach-Object { Write-Host "  $($_.Name) : $($_.StartType), $($_.Status)" }
    }
    Write-Host "`n=== Ads/tips (registry, 0=off) ===" -ForegroundColor Cyan
    foreach ($r in $adsReg) {
        if (-not (Test-Path $r.Path)) { continue }
        foreach ($n in $r.Names) {
            $v = (Get-ItemProperty -Path $r.Path -Name $n -ErrorAction SilentlyContinue).$n
            $s = if ($v -eq 0) { "off" } else { "on" }
            Write-Host "  $n = $v ($s)"
        }
    }
    exit 0
}

if ($Enable) {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { Write-Host "For -Enable run PowerShell as Administrator (needed for services and Default User)." }
    $one = 1
    foreach ($sn in $bloatServices) {
        $svc = Get-Service -Name $sn -ErrorAction SilentlyContinue
        if ($svc) {
            Set-Service -Name $sn -StartupType Manual -ErrorAction SilentlyContinue
            Write-Host "Enabled (Manual): $sn"
        }
    }
    foreach ($pat in $bloatPatterns) {
        Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $pat } | ForEach-Object {
            Set-Service -Name $_.Name -StartupType Manual -ErrorAction SilentlyContinue
            Write-Host "Enabled (Manual): $($_.Name)"
        }
    }
    foreach ($r in $adsReg) {
        if (-not (Test-Path $r.Path)) { New-Item -Path $r.Path -Force | Out-Null }
        foreach ($n in $r.Names) { Set-ItemProperty -Path $r.Path -Name $n -Value $one -Type DWord -ErrorAction SilentlyContinue }
    }
    if ($isAdmin) {
        $base = 'Software\Microsoft\Windows\CurrentVersion'
        $hu = "Registry::HKEY_USERS\.DEFAULT"
        $defPaths = @(
            "$hu\$base\ContentDeliveryManager",
            "$hu\$base\Explorer\Advanced",
            "$hu\$base\Privacy"
        )
        $defNames = @('SubscribedContent-310093Enabled','SubscribedContent-338388Enabled','SubscribedContent-338393Enabled','SubscribedContent-353694Enabled','SubscribedContent-353696Enabled','SoftLandingEnabled','SystemPaneSuggestionsEnabled','TailoredExperiencesWithDiagnosticDataEnabled','Start_TrackDocs','Start_TrackProgs')
        foreach ($dp in $defPaths) {
            if (Test-Path $dp) {
                foreach ($n in $defNames) { Set-ItemProperty -Path $dp -Name $n -Value $one -Type DWord -ErrorAction SilentlyContinue }
            }
        }
        Write-Host "Ads/tips re-enabled (current user + Default User). Services set to Manual."
    } else {
        Write-Host "Ads/tips re-enabled for current user. Services unchanged (run as Admin to restore services and Default User)."
    }
    exit 0
}

$onlyBloatOrAds = $DisableBloat -or $DisableAds -or $Status -or $Enable
if (-not $onlyBloatOrAds) {
    $foxRoot = Split-Path -Parent $PSScriptRoot
    $lib = Join-Path $foxRoot "cmd\ghostty-lib.ps1"
    if (-not (Test-Path $lib)) {
        Write-Host "cmd\ghostty-lib.ps1 not found. Run this script from inside the FireFoxBot repo." -ForegroundColor Red
        exit 1
    }
    . $lib

    if (-not (Test-Path $ConfigPath)) {
        Write-Host "Ghostty config not found: $ConfigPath" -ForegroundColor Red
        exit 1
    }

    Write-Host "=== FoxTerminal -> Ghostty ===" -ForegroundColor Cyan
    Write-Host ""

    $ghostty = Get-GhosttyCommand
    if ($ghostty) {
        Write-Host ("Terminal:  " + $ghostty.Flavor + " -> " + $ghostty.Path) -ForegroundColor Green
    } else {
        Write-Host "Terminal:  not found" -ForegroundColor Yellow
        foreach ($line in (Get-GhosttyInstallHint)) { Write-Host ("  " + $line) }
        Write-Host ""
        Write-Host "The config will still be installed so it is ready once Ghostty is present." -ForegroundColor Yellow
    }
    Write-Host ""

    $target = Get-GhosttyConfigPath
    if ([string]::IsNullOrWhiteSpace($target)) {
        Write-Host "Cannot resolve a Ghostty config path on this system." -ForegroundColor Red
        exit 1
    }

    $targetDir = Split-Path -Parent $target
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host ("Created config directory: " + $targetDir)
    }

    if ((Test-Path $target) -and -not $Force) {
        $existing = Get-Content -Path $target -Raw -ErrorAction SilentlyContinue
        if ($existing -and $existing -notmatch "FoxTerminal") {
            $backup = $target + ".backup-" + (Get-Date -Format "yyyyMMdd-HHmmss")
            Copy-Item -Path $target -Destination $backup -Force
            Write-Host ("Backed up your previous config to: " + $backup) -ForegroundColor Yellow
        }
    }

    Copy-Item -Path $ConfigPath -Destination $target -Force
    Write-Host ("Installed config: " + $target) -ForegroundColor Green

    # Machine-specific overlay: which shell to launch and where the repo lives.
    # The shared config ends with "config-file = ?foxterminal-local.ghostty".
    $bootScript = Join-Path $PSScriptRoot "ghostty\foxterminal-boot.ps1"
    $shellExe = "powershell.exe"
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwsh) { $shellExe = "pwsh" }

    $localLines = @(
        "# Generated by FoxTerminal\install.ps1 - do not edit by hand.",
        "# Re-generate with: term -Apply",
        "",
        ("env = FOXTERM_ROOT=" + $foxRoot),
        ("env = FOXTERM_BOOT=" + $bootScript),
        "env = FOXTERM=1",
        "env = FOXTERM_HOST=ghostty",
        "",
        "# `$env:FOXTERM_BOOT is expanded by PowerShell itself, which keeps this line",
        "# free of nested quotes even when the repo path contains spaces.",
        ("command = " + $shellExe + " -NoLogo -NoExit -Command . `$env:FOXTERM_BOOT"),
        ("working-directory = " + $foxRoot),
        "",
        "config-file = ?foxterminal-shaders.ghostty"
    )

    $localPath = Join-Path $targetDir "foxterminal-local.ghostty"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($localPath, (($localLines -join "`r`n") + "`r`n"), $utf8NoBom)
    Write-Host ("Installed local overlay: " + $localPath) -ForegroundColor Green
    Write-Host ("Shell: " + $shellExe + " -> " + $bootScript)
    Write-Host ""

    if ($ghostty) {
        Write-Host "Validating config..." -ForegroundColor Cyan
        try {
            $out = & (Get-GhosttyCliPath $ghostty) "+show-config" 2>&1
            $errs = $out | Select-String -Pattern "error|invalid|unknown field" -SimpleMatch:$false
            if ($errs) {
                Write-Host "Ghostty reported config problems:" -ForegroundColor Yellow
                foreach ($e in $errs) { Write-Host ("  " + $e) -ForegroundColor Yellow }
            } else {
                Write-Host "Config parsed with no errors." -ForegroundColor Green
            }
        } catch {
            Write-Host ("Could not run '" + $ghostty.Name + " +show-config': " + $_) -ForegroundColor Yellow
        }
        Write-Host ""

        if (-not $NoShortcut) {
            try {
                $desktop = [Environment]::GetFolderPath("Desktop")
                $linkPath = Join-Path $desktop "FoxTerminal.lnk"
                $wsh = New-Object -ComObject WScript.Shell
                $shortcut = $wsh.CreateShortcut($linkPath)
                $shortcut.TargetPath = $ghostty.Path
                $shortcut.Arguments = ""
                $shortcut.WorkingDirectory = $foxRoot
                $shortcut.Description = "FoxTerminal (Ghostty)"
                $shortcut.Save()
                Write-Host ("Created desktop shortcut: " + $linkPath) -ForegroundColor Green
            } catch {
                Write-Host ("Could not create desktop shortcut: " + $_) -ForegroundColor Yellow
            }
        }

        if ($NoLogonStart) {
            try {
                Remove-FoxGhosttyLogonStart | Out-Null
            } catch {}
        } else {
            try {
                $logonLink = Install-FoxGhosttyLogonStart -Ghostty $ghostty -WorkingDirectory $foxRoot
                if ($logonLink) {
                    Write-Host ("Windows logon will open FoxTerminal: " + $logonLink) -ForegroundColor Green
                }
            } catch {
                Write-Host ("Could not install logon autostart: " + $_) -ForegroundColor Yellow
            }
        }
    }

    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Start Ghostty (or press ctrl+shift+comma inside it to reload)."
    Write-Host "  2. Sign in to Windows: FoxTerminal opens. New machine runs foxsetup, then Home."
    Write-Host "  3. Run 'chek' to confirm FoxTerminal sees Ghostty."
    Write-Host "  4. Run 'foxdeps' to install the remaining dependencies (Nerd Font, Oh My Posh, Ollama)."
    Write-Host "  5. 'term' manages this config from now on."
}
