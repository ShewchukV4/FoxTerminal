# Maps Seelen Settings (byTheme @foxsystem/fox-glass) → FoxTerminal style.json → foxstyle-apply
param(
    [switch]$Watch,
    [switch]$Once,
    [switch]$Http,
    [int]$IntervalMs = 15000,
    [int]$HttpPort = 17321
)
$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos'
$settingsPath = Join-Path $env:APPDATA 'com.seelen.seelen-ui\settings.json'
$stylePath = Join-Path $runtime 'style.json'
$themeId = '@foxsystem/fox-glass'
$cmdRoot = $PSScriptRoot
$stampPath = Join-Path $runtime 'seelen-bridge.stamp'

function Get-ThemeVars {
    if (-not (Test-Path -LiteralPath $settingsPath)) { return $null }
    try {
        $j = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $j.byTheme) { return @{} }
        $bag = $j.byTheme.$themeId
        if (-not $bag) { return @{} }
        $ht = @{}
        $bag.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch { return $null }
}

function V($vars, [string]$name, $fallback) {
    if ($null -eq $vars) { return $fallback }
    if ($vars.ContainsKey($name) -and $null -ne $vars[$name] -and "$($vars[$name])" -ne '') { return $vars[$name] }
    return $fallback
}

function Write-StyleFromSeelen([hashtable]$vars) {
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $doc = $null
    if (Test-Path -LiteralPath $stylePath) {
        try { $doc = Get-Content -LiteralPath $stylePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    }
    if (-not $doc) {
        $doc = [pscustomobject]@{
            version = '1'; name = 'FOX from Seelen'; preset = 'dark'
            colors = [pscustomobject]@{}; chrome = [pscustomobject]@{}; window = [pscustomobject]@{}
            panel = [pscustomobject]@{}; button = [pscustomobject]@{}; motion = [pscustomobject]@{}
            texture = [pscustomobject]@{}; labs = [pscustomobject]@{}
        }
    }
    if (-not $doc.colors) { $doc | Add-Member -NotePropertyName colors -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.chrome) { $doc | Add-Member -NotePropertyName chrome -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.window) { $doc | Add-Member -NotePropertyName window -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.button) { $doc | Add-Member -NotePropertyName button -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.motion) { $doc | Add-Member -NotePropertyName motion -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.texture) { $doc | Add-Member -NotePropertyName texture -NotePropertyValue ([pscustomobject]@{}) -Force }
    if (-not $doc.labs) { $doc | Add-Member -NotePropertyName labs -NotePropertyValue ([pscustomobject]@{}) -Force }

    $preset = [string](V $vars '--fox-preset' 'dark')
    $doc.preset = $preset
    $doc.name = "FOX Seelen · $preset"

    $doc.colors.theme = [string](V $vars '--fox-theme' $preset)
    $doc.colors.sw = [string](V $vars '--fox-sw' 'violet')
    $doc.colors.accent = [string](V $vars '--fox-accent' '#7B5CFF')
    $doc.colors.accent2 = [string](V $vars '--fox-accent2' '#DC7A14')
    $doc.colors.bg = [string](V $vars '--fox-bg' '#0B0A12')
    $doc.colors.surface = [string](V $vars '--fox-surface' '#161322')
    $doc.colors.ink = [string](V $vars '--fox-ink' '#E2E0F0')
    $doc.colors.glass = [int](V $vars '--fox-glass' 72)

    $doc.texture.dock = [string](V $vars '--fox-dock-style' 'pill')
    $doc.texture.kind = [string](V $vars '--fox-wall-kind' 'glass')
    $doc.texture.rain = [int](V $vars '--fox-wall-rain' 30)
    $doc.texture.strength = [int](V $vars '--fox-wall-strength' 60)
    $doc.texture.scale = [int](V $vars '--fox-wall-scale' 50)
    $doc.texture.veil = [int](V $vars '--fox-wall-veil' 55)

    $doc.chrome.opacity = [int](V $vars '--fox-dock-alpha' 72)
    $doc.chrome.blur = [int](V $vars '--fox-dock-blur' 18)
    $doc.chrome.height = [int](V $vars '--fox-dock-height' 36)

    $doc.window.radius = [int](V $vars '--fox-win-radius' 16)
    $doc.window.shadow = [int](V $vars '--fox-win-shadow' 60)
    $doc.window.openAnim = [string](V $vars '--fox-win-open' 'fade')

    $doc.button.style = [string](V $vars '--fox-btn-style' 'glass')
    $doc.button.pressScale = [int](V $vars '--fox-btn-press' 97)

    $doc.motion.preset = [string](V $vars '--fox-motion-preset' 'balanced')
    $doc.motion.scale = [string](V $vars '--fox-motion-scale' 'full')
    $doc.motion.speedPercent = [int](V $vars '--fox-motion-speed' 100)
    $doc.motion.intensityPercent = [int](V $vars '--fox-motion-intensity' 100)
    $doc.motion.fps = [string](V $vars '--fox-motion-fps' 'auto')
    $doc.motion.battery = [string](V $vars '--fox-motion-battery' 'auto')
    $doc.motion.med = [int](V $vars '--fox-motion-ms' 180)
    $doc.motion.enabled = $doc.motion.preset -ne 'off'
    $doc.motion.reducedMotion = $doc.motion.scale -eq 'reduced' -or $doc.motion.preset -eq 'economy'

    $glowOn = [int](V $vars '--fox-glow-on' 0)
    $doc.labs.foxGlow = ($glowOn -eq 1)
    $doc.labs.glowStrength = [int](V $vars '--fox-glow-strength' 50)
    $doc.labs.glowSpeed = [int](V $vars '--fox-glow-speed' 50)

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($stylePath, ($doc | ConvertTo-Json -Depth 8), $utf8)
    return $doc
}

function Invoke-BridgeOnce {
    $vars = Get-ThemeVars
    if ($null -eq $vars) {
        Write-Host 'Seelen settings not found yet.'
        return $false
    }
    $hash = ($vars.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '|'
    $prev = ''
    if (Test-Path -LiteralPath $stampPath) { $prev = Get-Content -LiteralPath $stampPath -Raw -ErrorAction SilentlyContinue }
    # Default OFF — continuous auto-apply was resetting theme/wallpaper in a loop.
    $auto = [int](V $vars '--fox-auto-apply' 0)
    if ($hash -eq $prev -and -not $Once) { return $false }

    Write-StyleFromSeelen $vars | Out-Null
    $hash | Set-Content -LiteralPath $stampPath -Encoding ASCII
    Write-Host 'Wrote style.json from Seelen FOX Glass settings.'

    # Never hammer apply while Shewchuk photo wallpaper is active
    $photoFile = Join-Path $runtime 'wall-photo.txt'
    if (Test-Path -LiteralPath $photoFile) {
        $p = ''
        try { $p = (Get-Content -LiteralPath $photoFile -Raw -EA SilentlyContinue).Trim().Trim('"') } catch {}
        if ($p -and (Test-Path -LiteralPath $p) -and -not $Once) {
            Write-Host 'Shewchuk wall photo active — skip foxstyle-apply.'
            return $true
        }
    }

    if ($auto -ne 1 -and -not $Once) {
        Write-Host 'Auto-apply off (default). Set Seelen --fox-auto-apply=1 or run Apply once.'
        return $true
    }

    $apply = Join-Path $cmdRoot 'foxstyle-apply.ps1'
    if (Test-Path -LiteralPath $apply) {
        Write-Host 'Running foxstyle-apply…'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $apply
    }
    return $true
}

function Start-BridgeHttp([int]$port) {
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    try { $listener.Start() } catch {
        Write-Host ("HTTP listen failed on $port : " + $_.Exception.Message)
        return $null
    }
    Write-Host "FOXSTYLE bridge HTTP http://127.0.0.1:$port/apply|/open-ui"
    return $listener
}

function Invoke-BridgeForceApply {
    $vars = Get-ThemeVars
    if ($null -eq $vars) { $vars = @{} }
    Write-StyleFromSeelen $vars | Out-Null
    $apply = Join-Path $cmdRoot 'foxstyle-apply.ps1'
    if (Test-Path -LiteralPath $apply) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $apply
    }
}

function Handle-BridgeHttp($listener) {
    if (-not $listener -or -not $listener.IsListening) { return }
    if (-not $listener.Pending()) { return }
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.AbsolutePath.ToLowerInvariant()
    $msg = 'ok'
    try {
        if ($path -eq '/apply' -or $path -eq '/apply/') {
            Invoke-BridgeForceApply | Out-Null
            $msg = 'applied'
        } elseif ($path -eq '/open-ui' -or $path -eq '/open-ui/') {
            $ui = Join-Path $cmdRoot 'foxui.ps1'
            Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$ui) -WindowStyle Hidden
            $msg = 'foxui launched'
        } else {
            $msg = 'use POST /apply or /open-ui'
        }
    } catch {
        $msg = $_.Exception.Message
    }
    $buf = [Text.Encoding]::UTF8.GetBytes($msg)
    $ctx.Response.ContentType = 'text/plain; charset=utf-8'
    $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
    $ctx.Response.OutputStream.Write($buf, 0, $buf.Length)
    $ctx.Response.Close()
}

if ($Watch -or $Http) {
    $listener = Start-BridgeHttp $HttpPort
    $tick = 0
    Write-Host "Watching Seelen → FOXSTYLE. HTTP :$HttpPort  Ctrl+C to stop."
    while ($true) {
        try {
            $tick += 200
            if ($Watch -and ($tick -ge $IntervalMs)) {
                Invoke-BridgeOnce | Out-Null
                $tick = 0
            }
            Handle-BridgeHttp $listener
        } catch { Write-Host $_.Exception.Message }
        Start-Sleep -Milliseconds 200
    }
} else {
    Invoke-BridgeOnce | Out-Null
}
