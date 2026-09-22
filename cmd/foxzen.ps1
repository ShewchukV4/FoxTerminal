param(
    [Parameter(Position = 0)]
    [ValidateSet("status", "open", "theme", "host", "addon", "default", "help")]
    [string]$Action = "status",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$repoRoot = Split-Path $PSScriptRoot -Parent
$themeInstall = Join-Path $repoRoot "FoxTerminal\zen\install-zen-theme.ps1"
$hostInstall = Join-Path $repoRoot "FoxTerminal\firefox-addon\native-host\install-host.ps1"
$packScript = Join-Path $repoRoot "FoxTerminal\firefox-addon\native-host\pack-xpi.ps1"
$addonRoot = Join-Path $repoRoot "FoxTerminal\firefox-addon"

. (Join-Path $PSScriptRoot "fox-browser.ps1")

switch ($Action) {
    "status" {
        $info = Get-FoxBrowserInfo
        Write-Host "Browser : $($info.Name)"
        Write-Host "Path    : $($info.Path)"
        Write-Host "Process : $($info.ProcessName)"
        Write-Host "Env FOXTERM_BROWSER = $env:FOXTERM_BROWSER"
        Write-Host "Env FIREFOX_PATH    = $env:FIREFOX_PATH"
    }
    "open" {
        $url = if ($Rest -and $Rest.Count -gt 0) { $Rest[0] } else { "about:debugging#/runtime/this-firefox" }
        if ($url -notmatch '^(https?:|about:|file:)') {
            if ($url -match '\.') { $url = "https://$url" }
        }
        Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
        Write-Host "Opened: $url"
    }
    "theme" {
        powershell -NoProfile -ExecutionPolicy Bypass -File $themeInstall
        exit $LASTEXITCODE
    }
    "host" {
        powershell -NoProfile -ExecutionPolicy Bypass -File $hostInstall
        exit $LASTEXITCODE
    }
    "addon" {
        # Rebuild XPI and replace the permanently installed copy in Zen profile.
        # Editing files alone does NOT update about:addons installs.
        powershell -NoProfile -ExecutionPolicy Bypass -File $packScript
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        $manifest = Get-Content -Raw (Join-Path $addonRoot "manifest.json") | ConvertFrom-Json
        $xpi = Join-Path $addonRoot ("dist\foxterminal-companion-{0}.xpi" -f $manifest.version)
        if (-not (Test-Path $xpi)) {
            Write-Host "XPI not found: $xpi" -ForegroundColor Red
            exit 1
        }

        $profilesIni = Join-Path $env:APPDATA "zen\profiles.ini"
        if (-not (Test-Path $profilesIni)) {
            Write-Host "Zen profiles.ini not found." -ForegroundColor Red
            exit 1
        }

        $profilePath = $null
        $ini = Get-Content $profilesIni
        $block = @{}
        foreach ($line in $ini) {
            if ($line -match '^\s*\[(.+)\]\s*$') {
                if ($block.Path -and $block.Section -match '^Profile' -and $block.Default -eq '1') {
                    $profilePath = if ($block.IsRelative -eq '1') { Join-Path (Join-Path $env:APPDATA "zen") $block.Path } else { $block.Path }
                }
                $block = @{ Section = $Matches[1] }
                continue
            }
            if ($line -match '^\s*([^=]+)=(.*)$') { $block[$Matches[1].Trim()] = $Matches[2].Trim() }
        }
        if (-not $profilePath -and $block.Path) {
            $profilePath = if ($block.IsRelative -eq '1') { Join-Path (Join-Path $env:APPDATA "zen") $block.Path } else { $block.Path }
        }
        if (-not $profilePath) {
            # fallback: profile that already has the addon
            $profilePath = Get-ChildItem (Join-Path $env:APPDATA "zen\Profiles") -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName "extensions\foxterminal-companion@local.xpi") } |
                Select-Object -First 1 -ExpandProperty FullName
        }
        if (-not $profilePath) {
            Write-Host "Zen profile with addon not found. Install once via about:addons first." -ForegroundColor Red
            exit 1
        }

        Write-Host "Closing Zen..."
        Get-Process -Name zen -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1

        $profileDirs = @(Get-ChildItem (Join-Path $env:APPDATA "zen\Profiles") -Directory -ErrorAction SilentlyContinue)
        if ($profilePath) { $profileDirs = @($profilePath) + @($profileDirs | ForEach-Object { $_.FullName }) | Select-Object -Unique }

        $pref = 'user_pref("xpinstall.signatures.required", false);'
        foreach ($prof in $profileDirs) {
          $target = Join-Path $prof "extensions\foxterminal-companion@local.xpi"
          New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
          if (Test-Path $target) { Copy-Item -Force $target "$target.bak" }
          Copy-Item -Force $xpi $target
          $userJs = Join-Path $prof "user.js"
          if (Test-Path $userJs) {
            $raw = Get-Content -Raw $userJs
            if ($raw -notmatch 'xpinstall\.signatures\.required') { Add-Content $userJs $pref }
          } else {
            Set-Content $userJs $pref -Encoding UTF8
          }
          Get-ChildItem (Join-Path $prof "startupCache") -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
          Write-Host "Installed addon $($manifest.version) -> $target"
        }

        Start-Process "C:\Program Files\Zen Browser\zen.exe"
        Write-Host "Open popup: should show v$($manifest.version)."
        Write-Host "If disabled: about:config xpinstall.signatures.required=false"
        exit 0
    }
    "default" {
        if (Set-FoxClassicBrowser) {
            $info = Get-FoxBrowserInfo
            Write-Host ("Classic browser: " + $info.Name + " -> " + $info.Path)
            if (Test-FoxWindowsDefaultIsZen) {
                Write-Host "Windows http/https already open in Zen."
            } else {
                Write-Host "Windows still has another default. Opening Settings so you can Set default on Zen."
                Start-Process "ms-settings:defaultapps?registeredAppMachine=Zen"
            }
        }
        exit 0
    }
    default {
        Write-Host "foxzen usage:"
        Write-Host "  foxzen status   # which browser FoxTerminal will open"
        Write-Host "  foxzen open [url]"
        Write-Host "  foxzen default  # make Zen the classic browser (FoxTerminal + Windows)"
        Write-Host "  foxzen theme    # install FoxTerminal userChrome into Zen"
        Write-Host "  foxzen host     # register native messaging for Zen/Firefox"
        Write-Host "  foxzen addon    # rebuild+replace installed addon in Zen profile"
    }
}
