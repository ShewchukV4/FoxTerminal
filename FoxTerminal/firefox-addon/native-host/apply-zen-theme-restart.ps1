# Detached Zen theme applier: kill Zen -> patch prefs/sessions/CSS -> relaunch.
param(
    [Parameter(Mandatory = $true)][string]$PayloadPath
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Set-Pref([string]$PrefsPath, [string]$Name, [string]$ValueLiteral) {
    if (-not (Test-Path -LiteralPath $PrefsPath)) { return }
    $content = [System.IO.File]::ReadAllText($PrefsPath)
    $line = 'user_pref("{0}", {1});' -f $Name, $ValueLiteral
    $pattern = 'user_pref\(\s*"' + [regex]::Escape($Name) + '"\s*,\s*[^)]*\)\s*;'
    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, $line)
    } else {
        if (-not $content.EndsWith("`n")) { $content += "`n" }
        $content += $line + "`n"
    }
    [System.IO.File]::WriteAllText($PrefsPath, $content, $utf8)
}

function Wait-ZenExit([int]$TimeoutSec = 20) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $procs = @(Get-Process -Name zen -ErrorAction SilentlyContinue)
        if ($procs.Count -eq 0) { return $true }
        Start-Sleep -Milliseconds 250
    }
    Get-Process -Name zen -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
    return (@(Get-Process -Name zen -ErrorAction SilentlyContinue).Count -eq 0)
}

$data = Get-Content -Raw -LiteralPath $PayloadPath | ConvertFrom-Json
Start-Sleep -Seconds 1

Get-Process -Name zen -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
[void](Wait-ZenExit -TimeoutSec 25)

foreach ($profile in @($data.profiles)) {
    if ([string]::IsNullOrWhiteSpace($profile)) { continue }
    if (-not (Test-Path -LiteralPath $profile)) { continue }

    $prefs = Join-Path $profile "prefs.js"
    Set-Pref $prefs "toolkit.legacyUserProfileCustomizations.stylesheets" "true"
    Set-Pref $prefs "zen.theme.accent-color" ('"{0}"' -f $data.accent)
    Set-Pref $prefs "zen.theme.gradient-show-custom-colors" "true"
    Set-Pref $prefs "zen.theme.disable-lightweight" "false"
    Set-Pref $prefs "xpinstall.signatures.required" "false"

    $userJs = @(
        'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
        ('user_pref("zen.theme.accent-color", "{0}");' -f $data.accent)
        'user_pref("zen.theme.gradient-show-custom-colors", true);'
        'user_pref("zen.theme.disable-lightweight", false);'
        'user_pref("xpinstall.signatures.required", false);'
    ) -join "`n"
    [System.IO.File]::WriteAllText((Join-Path $profile "user.js"), $userJs + "`n", $utf8)

    if ($data.userChromeCss) {
        $chromeDir = Join-Path $profile "chrome"
        New-Item -ItemType Directory -Force -Path $chromeDir | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $chromeDir "userChrome.css"), [string]$data.userChromeCss, $utf8)
        # Zen mods backend loads this file at startup (higher priority than userChrome).
        $modsCss = @"
/* Zen Mods - FoxTerminal bridge */
/* FoxTerminal dynamic theme */
$($data.userChromeCss)
/* End of Zen Mods */
"@
        [System.IO.File]::WriteAllText((Join-Path $chromeDir "zen-themes.css"), $modsCss, $utf8)
    }

    if ($data.pyScript -and (Test-Path -LiteralPath $data.pyScript)) {
        $args = @(
            $data.pyScript,
            "--profile", $profile,
            "--accent", ([string]$data.accent),
            "--accent2", ([string]$data.accent2),
            "--bg", ([string]$data.bg)
        )
        $ok = $false
        foreach ($exe in @("python", "py")) {
            try {
                if ($exe -eq "py") {
                    & py -3 @args
                } else {
                    & python @args
                }
                if ($LASTEXITCODE -eq 0) { $ok = $true; break }
            } catch {}
        }
        if (-not $ok) {
            Write-Host "WARN: workspace theme patch failed for $profile"
        }
    }
}

if ($data.zenExe -and (Test-Path -LiteralPath $data.zenExe)) {
    Start-Process -FilePath $data.zenExe | Out-Null
}

Remove-Item -LiteralPath $PayloadPath -Force -ErrorAction SilentlyContinue
