param(
    [string]$ConfigPath = "$PSScriptRoot\wezterm.lua",
    [switch]$DisableBloat,  # Вимкнути служби, що навантажують (потрібен запуск від адміна)
    [switch]$DisableAds,    # Вимкнути рекламу та підказки Windows (реєстр, адмін не потрібен)
    [switch]$Status,        # Показати, що вимкнено / увімкнено
    [switch]$Enable         # Увімкнути назад служби та рекламу/підказки
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
    if (-not (Test-Path $ConfigPath)) {
        Write-Host "Config not found: $ConfigPath"
        exit 1
    }
    $target = Join-Path $env:USERPROFILE ".wezterm.lua"
    Copy-Item -Path $ConfigPath -Destination $target -Force
    Write-Host "Installed config to $target"
    $wez = (Get-Command wezterm -ErrorAction SilentlyContinue)
    if (-not $wez) {
        Write-Host "WezTerm not found in PATH. Install it first."
        exit 0
    }
    $desktop = [Environment]::GetFolderPath("Desktop")
    $linkPath = Join-Path $desktop "FoxTerminal.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($linkPath)
    $shortcut.TargetPath = $wez.Source
    $shortcut.Arguments = ""
    $shortcut.WorkingDirectory = $env:USERPROFILE
    $shortcut.Description = "FoxTerminal (WezTerm)"
    $shortcut.Save()
    Write-Host "Created desktop shortcut: $linkPath"
}
