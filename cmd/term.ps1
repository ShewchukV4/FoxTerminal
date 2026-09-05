param(
    [switch]$Status,    # Показати стан Ghostty + шляхи конфігів
    [switch]$Apply,     # Перевстановити конфіг з репозиторію
    [switch]$Edit,      # Відкрити встановлений конфіг у редакторі
    [switch]$New,       # Відкрити нове вікно Ghostty
    [switch]$Doctor,    # Діагностика: бінарник, конфіг, шрифт, shell integration
    [switch]$Path,      # Вивести шлях до конфігу і вийти
    [string]$Set        # Сумісність зі старим "term -Set mintty|cygwin|windows"
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

# The FoxTerminal palette has no dedicated warning slot, and noir mode must stay
# monochrome, so pick the amber accent only when colour is allowed.
function Get-WarnColor {
    $p = Get-ThemePalette
    if (Test-NoirActive) { return $p.accent4 }
    return "#FBD38D"
}

function Write-Row([string]$label, [string]$value, [string]$color) {
    $p = Get-ThemePalette
    $pad = $label.PadRight(16)
    if ([string]::IsNullOrWhiteSpace($color)) { $color = $p.text }
    Write-Host (Color-Text $p.dim ("  " + $pad)) -NoNewline
    Write-Host (Color-Text $color $value)
}

function Show-Status {
    $p = Get-ThemePalette
    $warn = Get-WarnColor
    $ghostty = Get-GhosttyCommand
    $configPath = Get-GhosttyConfigPath
    $sourcePath = Join-Path (Get-FoxGhosttySourceDir) "config"
    $localPath = $null
    if ($configPath) { $localPath = Join-Path (Split-Path -Parent $configPath) "foxterminal-local.ghostty" }

    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxTerminal terminal: Ghostty ===")
    Write-Host ""

    if ($ghostty) {
        Write-Row "binary" ($ghostty.Flavor + " -> " + $ghostty.Path) $p.accent2
        $cli = Get-GhosttyCliPath $ghostty
        if ($cli -and $cli -ne $ghostty.Path) {
            Write-Row "cli" $cli $p.accent2
        }
    } else {
        Write-Row "binary" "not found" $warn
    }

    if (Test-InGhostty) {
        Write-Row "session" "running inside Ghostty" $p.accent2
    } else {
        Write-Row "session" "not a Ghostty session" $warn
    }

    Write-Row "TERM" ($(if ($env:TERM) { $env:TERM } else { "<empty>" })) $p.text
    Write-Row "TERM_PROGRAM" ($(if ($env:TERM_PROGRAM) { $env:TERM_PROGRAM } else { "<empty>" })) $p.text

    Write-Host ""
    Write-Row "source" $sourcePath $p.text

    if ($configPath) {
        if (Test-Path $configPath) {
            $isFox = (Get-Content -Path $configPath -Raw -ErrorAction SilentlyContinue) -match "FoxTerminal"
            Write-Row "installed" $configPath $(if ($isFox) { $p.accent2 } else { $warn })
            if (-not $isFox) { Write-Row "" "(config exists but is not the FoxTerminal one - run: term -Apply)" $warn }
        } else {
            Write-Row "installed" ($configPath + "  (missing)") $warn
        }
    }

    if ($localPath) {
        if (Test-Path $localPath) {
            Write-Row "local overlay" $localPath $p.accent2
        } else {
            Write-Row "local overlay" ($localPath + "  (missing - run: term -Apply)") $warn
        }
    }

    Write-Host ""
}

function Invoke-Apply {
    $p = Get-ThemePalette
    $installer = Join-Path (Get-FoxRepoRoot) "FoxTerminal\install.ps1"
    if (-not (Test-Path $installer)) {
        Write-Host (Color-Text (Get-WarnColor) ("Installer not found: " + $installer))
        return
    }

    Write-Host ""
    Write-Host (Color-Text $p.accent "Re-installing the FoxTerminal Ghostty config...")
    Write-Host ""
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer -NoShortcut -Force
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Press ctrl+shift+comma inside Ghostty to reload without restarting.")
}

function Invoke-Edit {
    $p = Get-ThemePalette
    $configPath = Get-GhosttyConfigPath
    if (-not $configPath -or -not (Test-Path $configPath)) {
        Write-Host (Color-Text (Get-WarnColor) "No installed config yet. Run: term -Apply")
        return
    }

    $ghostty = Get-GhosttyCommand
    if ($ghostty) {
        # Ghostty knows how to open its own config in the OS default editor.
        try {
            & (Get-GhosttyCliPath $ghostty) "+edit-config" 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host (Color-Text $p.accent2 ("Opened " + $configPath))
                return
            }
        } catch {}
    }

    try {
        Invoke-Item $configPath
        Write-Host (Color-Text $p.accent2 ("Opened " + $configPath))
    } catch {
        Write-Host (Color-Text (Get-WarnColor) ("Cannot open editor. Path: " + $configPath))
    }
}

function Invoke-NewWindow {
    $p = Get-ThemePalette
    $ghostty = Get-GhosttyCommand
    if (-not $ghostty) {
        Write-Host (Color-Text (Get-WarnColor) "Ghostty not found.")
        foreach ($line in (Get-GhosttyInstallHint)) { Write-Host (Color-Text $p.dim ("  " + $line)) }
        return
    }

    if (Start-FoxGhosttyWindow) {
        Write-Host (Color-Text $p.accent2 "Opened a new Ghostty window.")
    } else {
        Write-Host (Color-Text (Get-WarnColor) "Cannot start Ghostty.")
        foreach ($line in (Get-GhosttyInstallHint)) { Write-Host (Color-Text $p.dim ("  " + $line)) }
    }
}

function Invoke-Doctor {
    $p = Get-ThemePalette
    $warnColor = Get-WarnColor
    $script:foxDoctorOk = 0
    $script:foxDoctorWarn = 0

    function Check([string]$name, [bool]$ok, [string]$detail) {
        $mark = if ($ok) { "OK  " } else { "WARN" }
        $color = if ($ok) { $p.accent2 } else { $warnColor }
        Write-Host (Color-Text $color ("  [" + $mark + "] ")) -NoNewline
        Write-Host (Color-Text $p.text $name.PadRight(26)) -NoNewline
        Write-Host (Color-Text $p.dim $detail)
        if ($ok) { $script:foxDoctorOk++ } else { $script:foxDoctorWarn++ }
    }

    Write-Host ""
    Write-Host (Color-Text $p.accent "=== term -Doctor ===")
    Write-Host ""

    $ghostty = Get-GhosttyCommand
    Check "Ghostty binary" ($null -ne $ghostty) $(if ($ghostty) { $ghostty.Path } else { "install winghostty (Windows) or ghostty (Linux/macOS)" })
    if ($ghostty) {
        $cli = Get-GhosttyCliPath $ghostty
        Check "Ghostty CLI" ($null -ne $cli) $(if ($cli) { $cli } else { "winghostty.com missing next to the .exe" })
    }

    Check "Ghostty session" (Test-InGhostty) $(if (Test-InGhostty) { "TERM=$env:TERM" } else { "start FoxTerminal from Ghostty" })

    $sourcePath = Join-Path (Get-FoxGhosttySourceDir) "config"
    Check "Repo config" (Test-Path $sourcePath) $sourcePath

    $configPath = Get-GhosttyConfigPath
    $installed = $configPath -and (Test-Path $configPath)
    Check "Installed config" ([bool]$installed) $(if ($installed) { $configPath } else { "run: term -Apply" })

    if ($installed) {
        $raw = Get-Content -Path $configPath -Raw -ErrorAction SilentlyContinue
        Check "Config is FoxTerminal's" ([bool]($raw -match "FoxTerminal")) "looks for the FoxTerminal header"

        $localPath = Join-Path (Split-Path -Parent $configPath) "foxterminal-local.ghostty"
        Check "Local overlay" (Test-Path $localPath) $(if (Test-Path $localPath) { $localPath } else { "run: term -Apply" })

        $shaderOverlay = Join-Path (Split-Path -Parent $configPath) "foxterminal-shaders.ghostty"
        $shaderOn = $true
        if (Get-Command Test-FoxShadersEnabled -ErrorAction SilentlyContinue) {
            $shaderOn = Test-FoxShadersEnabled
        }
        $shaderDetail = if (Test-Path $shaderOverlay) {
            if ($shaderOn) { $shaderOverlay } else { "written, currently off — run: shader on" }
        } else {
            "missing — run: shader status"
        }
        Check "Shader overlay" ($(if ($shaderOn) { Test-Path $shaderOverlay } else { $true })) $shaderDetail
    }

    $cmdDir = Join-Path (Get-FoxRepoRoot) "cmd"
    Check "cmd\ on PATH" ($env:PATH -like "*$cmdDir*") $cmdDir

    $omp = Resolve-OhMyPoshExe
    Check "Oh My Posh" ($null -ne $omp) $(if ($omp) { $omp } else { "optional - run: foxdeps -Install" })

    if ($ghostty) {
        $configErrors = $null
        try {
            $out = & (Get-GhosttyCliPath $ghostty) "+show-config" 2>&1
            $configErrors = $out | Select-String -Pattern "error|invalid|unknown field"
        } catch {}
        Check "Ghostty parses config" ($null -eq $configErrors -or $configErrors.Count -eq 0) $(if ($configErrors) { "see: $($ghostty.Name) +show-config" } else { "+show-config is clean" })
    }

    Write-Host ""
    Write-Host (Color-Text $p.dim ("  " + $script:foxDoctorOk + " ok, " + $script:foxDoctorWarn + " to look at"))
    Write-Host ""
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
        Write-Host (Color-Text $p.dim "Up/Down: select, Enter: run, Esc: cancel")

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow" { if ($index -gt 0) { $index-- } }
            "DownArrow" { if ($index -lt ($options.Count - 1)) { $index++ } }
            "Enter" { return $index }
            "Escape" { return -1 }
        }
    }
}

if (-not [string]::IsNullOrWhiteSpace($Set)) {
    $p = Get-ThemePalette
    Write-Host ""
    Write-Host (Color-Text (Get-WarnColor) "'term -Set' is gone. FoxTerminal now runs on Ghostty only.")
    Write-Host (Color-Text $p.dim "  The mintty / Cygwin / cmd backends were removed in the Ghostty migration.")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "What replaced them:")
    Write-Host "  term -Apply    reinstall the Ghostty config"
    Write-Host "  term -Doctor   diagnose the setup"
    Write-Host "  ctrl+shift+l   split right (was: interface / tmux)"
    Write-Host "  ctrl+shift+j   split down"
    Write-Host ""
    return
}

if ($Path) {
    $configPath = Get-GhosttyConfigPath
    if ($configPath) { Write-Host $configPath }
    return
}

if ($Status) { Show-Status; return }
if ($Apply) { Invoke-Apply; return }
if ($Edit) { Invoke-Edit; return }
if ($New) { Invoke-NewWindow; return }
if ($Doctor) { Invoke-Doctor; return }

if (-not ([Environment]::UserInteractive) -or [Console]::IsInputRedirected) {
    Show-Status
    Write-Host "Use: term [-Status] [-Apply] [-Edit] [-New] [-Doctor] [-Path]"
    return
}

$options = @(
    "Status - binary, session, config paths",
    "Apply - reinstall config from the repo",
    "Edit - open the installed config",
    "New window - launch Ghostty",
    "Doctor - full diagnostics",
    "cancel"
)

$choice = Select-Menu "FoxTerminal / Ghostty config" $options
Clear-Host

switch ($choice) {
    0 { Show-Status }
    1 { Invoke-Apply }
    2 { Invoke-Edit }
    3 { Invoke-NewWindow }
    4 { Invoke-Doctor }
    default { Write-Host "Cancelled." }
}
