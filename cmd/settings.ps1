param(
    [switch]$Status,
    [switch]$Gui,
    [switch]$Serve,
    [switch]$StopGui
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "ghostty-lib.ps1")
$browser = Join-Path $PSScriptRoot "fox-browser.ps1"
if (Test-Path -LiteralPath $browser) { . $browser }

function Stop-FoxSettingsHostProcess {
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -like "*settings.ps1*" -and
            ($_.CommandLine -like "*-Serve*" -or $_.CommandLine -like "*-Gui*") -and
            $_.ProcessId -ne $PID
        } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($StopGui) {
    Stop-FoxSettingsHostProcess
    Write-Host "Control UI host stopped."
    return
}

if ($Status) {
    $s = Get-FoxSettingsState
    $p = Get-ThemePalette
    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxTerminal settings ===")
    Write-Host (Color-Text $p.dim ("  user     " + $s.user))
    Write-Host (Color-Text $p.dim ("  theme    " + $s.theme))
    Write-Host (Color-Text $p.dim ("  foxos    " + $(if ($s.foxos) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  look     " + $(if ($s.look) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  taskbar  " + $s.dockStyle + "  " + $s.dockPos + "  " + $s.dockSize))
    Write-Host (Color-Text $p.dim ("  bar      hide=" + $(if ($s.dockHide) { "on" } else { "off" }) + "  apps=" + $s.dockWins + "  tray=" + $s.dockTray))
    Write-Host (Color-Text $p.dim ("  cursor   " + $s.cursor))
    Write-Host (Color-Text $p.dim ("  shell    " + $(if ($s.shell) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  shader   " + $(if ($s.shader) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  logon    " + $(if ($s.autostart) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  hotkeys  " + $(if ($s.hotkeys) { "on" } else { "off" })))
    Write-Host (Color-Text $p.dim ("  idle     " + $(if ($s.lockMinutes -gt 0) { "$($s.lockMinutes) min" } else { "off" })))
    Write-Host ""
    return
}

if ($Serve) {
    Start-FoxSettingsHost -WebRoot (Get-FoxSettingsGuiDir)
    return
}

if ($Gui) {
    Stop-FoxSettingsHostProcess
    $ps1 = Join-Path $PSScriptRoot "settings.ps1"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ps1, "-Serve"
    ) -WindowStyle Hidden | Out-Null
    $url = "http://127.0.0.1:17321/settings.html"
    if (Get-Command Open-FoxBrowserUrl -ErrorAction SilentlyContinue) {
        Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
    } else {
        $zen = Resolve-FoxBrowserPath
        Start-Process -FilePath $zen -ArgumentList @("-new-tab", $url) | Out-Null
    }
    Write-Host "Control UI: $url"
    return
}

if (-not (Ensure-Login)) { return }
Show-FoxSettings
