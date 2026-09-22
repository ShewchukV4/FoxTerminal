# FoxTerminal Ghostty shader overlay (internal).
# Writes foxterminal-shaders.ghostty next to the installed Ghostty config.
# Ghostty can load only one shader per window, so we keep adaptive.glsl and
# let it pick the effect from each pane's OSC background. Theme changes do
# not swap the file, so a split does not repaint both sides.

if (-not (Get-Command Get-GhosttyConfigDir -ErrorAction SilentlyContinue)) {
    $ghosttyLib = Join-Path $PSScriptRoot "ghostty-lib.ps1"
    if (Test-Path -LiteralPath $ghosttyLib) { . $ghosttyLib }
}

function Get-FoxShaderStatePath {
    return (Join-Path $PSScriptRoot "shader_state.txt")
}

function Test-FoxShadersEnabled {
    if ($env:FOXTERM_SHADERS -eq "0") { return $false }
    $path = Get-FoxShaderStatePath
    if (-not (Test-Path -LiteralPath $path)) { return $true }
    $raw = (Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $raw) { return $true }
    $name = $raw.Trim().ToLowerInvariant()
    return ($name -ne "off" -and $name -ne "0" -and $name -ne "false")
}

function Save-FoxShaderState([bool]$enabled) {
    $value = if ($enabled) { "on" } else { "off" }
    $value | Set-Content -LiteralPath (Get-FoxShaderStatePath) -Encoding UTF8
    if (Get-Command Save-FoxUserWorld -ErrorAction SilentlyContinue) {
        try { Save-FoxUserWorld } catch {}
    }
}

function Get-FoxSwColorIds {
    return @(
        "orange", "blue", "purple", "cyan",
        "crimson", "rose", "magenta", "violet", "indigo",
        "sky", "teal", "mint", "emerald", "lime",
        "gold", "amber", "peach", "coral", "ruby",
        "slate", "ice", "neon", "forest", "mocha",
        "black", "white"
    )
}

function Get-FoxShaderIdForTheme([string]$theme) {
    # One window-level program. Per-pane looks come from OSC-tinted backgrounds.
    return "adaptive"
}

function Get-FoxSwShaderSpec([string]$name) {
    # style: unique rim effect baked into the generated GLSL.
    switch ($name) {
        "orange"  { return @{ Hex = "#DC7A14"; Style = 0  } }
        "blue"    { return @{ Hex = "#5A8CFF"; Style = 1  } }
        "purple"  { return @{ Hex = "#A05AFF"; Style = 2  } }
        "cyan"    { return @{ Hex = "#46DCC8"; Style = 3  } }
        "crimson" { return @{ Hex = "#D14A5A"; Style = 4  } }
        "rose"    { return @{ Hex = "#E05A9A"; Style = 5  } }
        "magenta" { return @{ Hex = "#D44BBD"; Style = 6  } }
        "violet"  { return @{ Hex = "#8356E6"; Style = 7  } }
        "indigo"  { return @{ Hex = "#4E75D8"; Style = 8  } }
        "sky"     { return @{ Hex = "#6FC4F0"; Style = 9  } }
        "teal"    { return @{ Hex = "#36B8B3"; Style = 10 } }
        "mint"    { return @{ Hex = "#6BD3B0"; Style = 11 } }
        "emerald" { return @{ Hex = "#4CB874"; Style = 12 } }
        "lime"    { return @{ Hex = "#9BD94A"; Style = 13 } }
        "gold"    { return @{ Hex = "#E0B148"; Style = 14 } }
        "amber"   { return @{ Hex = "#E5943A"; Style = 15 } }
        "peach"   { return @{ Hex = "#E7A37C"; Style = 16 } }
        "coral"   { return @{ Hex = "#E07D69"; Style = 17 } }
        "ruby"    { return @{ Hex = "#C83B5C"; Style = 18 } }
        "slate"   { return @{ Hex = "#7D93B0"; Style = 19 } }
        "ice"     { return @{ Hex = "#7CC8E8"; Style = 20 } }
        "neon"    { return @{ Hex = "#7EF06B"; Style = 21 } }
        "forest"  { return @{ Hex = "#4E8C66"; Style = 22 } }
        "mocha"   { return @{ Hex = "#A17A5A"; Style = 23 } }
        "black"   { return @{ Hex = "#4F5B6A"; Style = 24 } }
        "white"   { return @{ Hex = "#CDD5E0"; Style = 25 } }
        default   { return @{ Hex = "#DC7A14"; Style = 0  } }
    }
}

function Convert-FoxHexToShaderVec3([string]$hex) {
    $h = $hex.TrimStart("#")
    $r = [Convert]::ToInt32($h.Substring(0, 2), 16) / 255.0
    $g = [Convert]::ToInt32($h.Substring(2, 2), 16) / 255.0
    $b = [Convert]::ToInt32($h.Substring(4, 2), 16) / 255.0
    return [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        "vec3({0:F3}, {1:F3}, {2:F3})",
        $r, $g, $b
    )
}

function Get-FoxSwShaderText([string]$name) {
    $spec = Get-FoxSwShaderSpec $name
    $accent = Convert-FoxHexToShaderVec3 $spec.Hex
    $style = [int]$spec.Style
    return @"
// FoxTerminal - sw $name. Rim effect only; prompt stays clean.
const vec3 ACCENT = $accent;
const int STYLE = $style;

float foxHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 res = iResolution.xy;
    vec2 uv = fragCoord / res;
    vec2 p = uv - 0.5;
    p.x *= res.x / res.y;
    float rim = smoothstep(0.60, 0.98, length(p));
    float top = smoothstep(0.78, 1.0, uv.y);
    float sides = smoothstep(0.38, 0.48, abs(uv.x - 0.5));

    vec4 src = texture(iChannel0, uv);
    vec3 col = src.rgb;
    float amt = rim * 0.11;

    if (STYLE == 1) {
        float wave = 0.5 + 0.5 * sin(uv.x * 7.0 + uv.y * 5.0 + iTime * 0.35);
        amt = top * (0.09 + 0.05 * wave);
    } else if (STYLE == 2) {
        amt = rim * 0.12 + step(0.987, foxHash(floor(uv * 40.0) + iTime * 0.05)) * rim * 0.25;
    } else if (STYLE == 3) {
        float rip = sin((uv.x + uv.y) * 28.0 + iTime * 1.6);
        amt = rim * (0.08 + 0.04 * rip);
    } else if (STYLE == 4) {
        amt = rim * (0.08 + 0.05 * (0.5 + 0.5 * sin(iTime * 2.4)));
    } else if (STYLE == 5) {
        vec2 petal = uv * vec2(14.0, 9.0);
        petal.y += iTime * 0.10;
        amt = rim * 0.08 + step(0.989, foxHash(floor(petal))) * rim * 0.28;
    } else if (STYLE == 6) {
        amt = sides * 0.10 + rim * 0.06;
    } else if (STYLE == 7) {
        float ang = atan(p.y, p.x) + iTime * 0.2;
        amt = rim * (0.08 + 0.05 * step(0.82, fract(ang * 2.5)));
    } else if (STYLE == 8) {
        amt = rim * 0.08 + step(0.993, foxHash(floor(uv * 70.0))) * 0.35;
    } else if (STYLE == 9) {
        float cloud = 0.5 + 0.5 * sin(uv.x * 4.0 + iTime * 0.15) * sin(uv.y * 3.0);
        amt = top * (0.08 + 0.05 * cloud);
    } else if (STYLE == 10) {
        float cau = sin(uv.x * 18.0 + iTime) * sin(uv.y * 14.0 - iTime * 0.7);
        amt = rim * (0.07 + 0.05 * cau);
    } else if (STYLE == 11) {
        amt = rim * 0.08 + step(0.991, foxHash(floor(fragCoord * 0.2) + iTime)) * rim * 0.30;
    } else if (STYLE == 12) {
        float dap = foxHash(floor(uv * vec2(9.0, 6.0)));
        amt = rim * (0.07 + 0.06 * dap);
    } else if (STYLE == 13) {
        float tick = step(0.92, fract(fragCoord.y * 0.08 + iTime * 3.0));
        amt = rim * (0.07 + 0.06 * tick);
    } else if (STYLE == 14) {
        vec2 dust = uv * vec2(16.0, 11.0);
        dust.y += iTime * 0.07;
        amt = rim * 0.08 + step(0.990, foxHash(floor(dust))) * rim * 0.30;
    } else if (STYLE == 15) {
        vec2 c1 = uv - vec2(0.0, 1.0);
        vec2 c2 = uv - vec2(1.0, 1.0);
        float lamps = exp(-dot(c1, c1) * 8.0) + exp(-dot(c2, c2) * 8.0);
        amt = lamps * 0.12 + rim * 0.05;
    } else if (STYLE == 16) {
        amt = top * 0.12;
    } else if (STYLE == 17) {
        float sh = sin(uv.x * 22.0 + iTime * 0.8) * cos(uv.y * 10.0);
        amt = rim * (0.08 + 0.04 * sh);
    } else if (STYLE == 18) {
        amt = rim * 0.09 + step(0.992, foxHash(floor(uv * 55.0 + iTime * 0.2))) * 0.32;
    } else if (STYLE == 19) {
        // Soft slate rain (2 layers) — matches adaptive.glsl without the probe cost.
        float rain = 0.0;
        for (int k = 0; k < 2; k++) {
            float layer = float(k);
            float cols = 72.0 + layer * 48.0;
            float id = floor(uv.x * cols + layer * 5.1);
            float h = foxHash(vec2(id, 3.3 + layer));
            if (h >= 0.32) {
                float speed = 0.18 + h * 0.42;
                float y = fract(uv.y * (0.78 + 0.22 * h) + iTime * speed + h * 0.7);
                float x = abs(fract(uv.x * cols) - 0.5);
                float thin = 1.0 - smoothstep(0.0, 0.38, x * 20.0);
                float body = smoothstep(1.0, 0.12, y) * smoothstep(0.0, 0.10, y + 0.03);
                rain += thin * body * (0.40 + 0.60 * h);
            }
        }
        col += ACCENT * rain * 0.11;
        amt = rim * 0.04;
    } else if (STYLE == 20) {
        amt = rim * 0.10 + step(0.988, foxHash(floor(uv * 30.0))) * rim * 0.22;
    } else if (STYLE == 21) {
        float scan = 0.5 + 0.5 * sin(fragCoord.y * 0.35 + iTime * 6.0);
        amt = rim * (0.08 + 0.05 * scan);
    } else if (STYLE == 22) {
        float shaft = pow(max(0.0, 1.0 - abs(fract(uv.x * 5.0 + iTime * 0.03) - 0.5) * 4.0), 3.0);
        amt = top * shaft * 0.10 + rim * 0.05;
    } else if (STYLE == 23) {
        float steam = 0.5 + 0.5 * sin(uv.x * 10.0 + iTime * 0.5);
        amt = top * (0.07 + 0.04 * steam);
    } else if (STYLE == 24) {
        amt = rim * 0.14;
    } else if (STYLE == 25) {
        amt = rim * 0.08 + (foxHash(floor(fragCoord * 0.5)) - 0.5) * 0.03 * rim;
    }

    col = mix(col, ACCENT, clamp(amt, 0.0, 0.16));

    float prompt = 1.0 - smoothstep(0.14, 0.24, uv.y);
    col = mix(col, src.rgb, prompt);

    vec2 cp = iCurrentCursor.xy + iCurrentCursor.zw * 0.5;
    float glow = exp(-length(fragCoord - cp) * 0.05) * 0.16 * (1.0 - prompt);
    col += ACCENT * glow;

    fragColor = vec4(col, src.a);
}
"@
}

function Export-FoxSwColorShaders([string]$destDir) {
    if ([string]::IsNullOrWhiteSpace($destDir)) { return }
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    foreach ($name in (Get-FoxSwColorIds)) {
        $path = Join-Path $destDir ($name + ".glsl")
        $text = Get-FoxSwShaderText $name
        $prev = $null
        if (Test-Path -LiteralPath $path) {
            $prev = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
        }
        $prevNorm = if ($null -eq $prev) { "" } else { ($prev -replace "`r`n", "`n") }
        $nextNorm = $text -replace "`r`n", "`n"
        if ($prevNorm -ne $nextNorm) {
            [System.IO.File]::WriteAllText($path, $text, $utf8)
        }
    }
}

function Get-FoxShaderSourceDir {
    if (Get-Command Get-FoxGhosttySourceDir -ErrorAction SilentlyContinue) {
        return (Join-Path (Get-FoxGhosttySourceDir) "shaders")
    }
    return (Join-Path $PSScriptRoot "..\FoxTerminal\ghostty\shaders")
}

function Get-FoxShaderOverlayPath {
    $dir = $null
    if (Get-Command Get-GhosttyConfigDir -ErrorAction SilentlyContinue) {
        $dir = Get-GhosttyConfigDir
    }
    if ([string]::IsNullOrWhiteSpace($dir)) { return $null }
    return (Join-Path $dir "foxterminal-shaders.ghostty")
}

function Copy-FoxShadersToConfigDir {
    $srcDir = Get-FoxShaderSourceDir
    $cfgDir = $null
    if (Get-Command Get-GhosttyConfigDir -ErrorAction SilentlyContinue) {
        $cfgDir = Get-GhosttyConfigDir
    }
    if ([string]::IsNullOrWhiteSpace($cfgDir)) { return $null }
    if (-not (Test-Path -LiteralPath $srcDir)) {
        New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
    }

    Export-FoxSwColorShaders $srcDir

    $dstDir = Join-Path $cfgDir "shaders"
    if (-not (Test-Path -LiteralPath $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }

    Get-ChildItem -LiteralPath $srcDir -Filter "*.glsl" -File -ErrorAction SilentlyContinue | ForEach-Object {
        $dest = Join-Path $dstDir $_.Name
        $need = $true
        if (Test-Path -LiteralPath $dest) {
            $need = $_.LastWriteTimeUtc -gt (Get-Item -LiteralPath $dest).LastWriteTimeUtc
        }
        if ($need) {
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
        }
    }
    Export-FoxSwColorShaders $dstDir
    return $dstDir
}

function Get-FoxShaderOverlayText([bool]$enabled, [string]$shaderId) {
    $lines = @(
        "# Generated by FoxTerminal shader sync. Toggle with: shader",
        "# Do not edit by hand. Always adaptive.glsl so splits keep their own glass."
    )
    if ($enabled) {
        if ([string]::IsNullOrWhiteSpace($shaderId)) { $shaderId = "fox" }
        $lines += ""
        $lines += ("custom-shader = shaders/" + $shaderId + ".glsl")
        $lines += "custom-shader-animation = true"
    } else {
        $lines += ""
        $lines += "# Shaders are off. custom-shader is intentionally unset."
    }
    return (($lines -join "`n") + "`n")
}

function Ensure-FoxShaderInclude {
    $includeLine = "config-file = ?foxterminal-shaders.ghostty"
    $paths = New-Object System.Collections.Generic.List[string]
    if (Get-Command Get-GhosttyConfigPath -ErrorAction SilentlyContinue) {
        $main = Get-GhosttyConfigPath
        if ($main) { $paths.Add($main) }
        $dir = Split-Path -Parent $main
        if ($dir) { $paths.Add((Join-Path $dir "foxterminal-local.ghostty")) }
    }

    foreach ($path in $paths) {
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        if (-not (Test-Path -LiteralPath $path)) { continue }
        $raw = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
        if ($null -eq $raw) { $raw = "" }
        if ($raw -match "foxterminal-shaders\.ghostty") { continue }
        $nl = if ($raw -match "`r`n") { "`r`n" } else { "`n" }
        if (-not $raw.EndsWith($nl)) { $raw += $nl }
        $raw += $nl + $includeLine + $nl
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($path, $raw, $utf8)
    }
}

function Write-FoxShaderOverlay {
    param(
        [bool]$Enabled,
        [string]$ShaderId
    )

    $overlay = Get-FoxShaderOverlayPath
    if ([string]::IsNullOrWhiteSpace($overlay)) { return $false }

    if ($Enabled) {
        Copy-FoxShadersToConfigDir | Out-Null
    }

    $text = Get-FoxShaderOverlayText $Enabled $ShaderId
    $prev = $null
    if (Test-Path -LiteralPath $overlay) {
        $prev = Get-Content -LiteralPath $overlay -Raw -ErrorAction SilentlyContinue
    }
    $prevNorm = if ($null -eq $prev) { "" } else { ($prev -replace "`r`n", "`n") }
    $nextNorm = $text -replace "`r`n", "`n"
    if ($prevNorm -eq $nextNorm) { return $false }

    $dir = Split-Path -Parent $overlay
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($overlay, $text, $utf8)
    Ensure-FoxShaderInclude
    return $true
}

function Invoke-GhosttyReloadConfig {
    if (-not (Get-Command Get-GhosttyCommand -ErrorAction SilentlyContinue)) { return $false }
    $ghostty = Get-GhosttyCommand
    if (-not $ghostty) { return $false }
    $cli = Get-GhosttyCliPath $ghostty
    if ([string]::IsNullOrWhiteSpace($cli)) { return $false }

    $place = $null
    if (Get-Command Save-FoxGhosttyWindowPlace -ErrorAction SilentlyContinue) {
        $place = Save-FoxGhosttyWindowPlace
    }
    try {
        $null = & $cli "+perform-action" "reload_config" 2>&1
        $ok = ($LASTEXITCODE -eq 0)
        if (Get-Command Restore-FoxGhosttyWindowPlace -ErrorAction SilentlyContinue) {
            Restore-FoxGhosttyWindowPlace $place
        }
        return $ok
    } catch {
        if (Get-Command Restore-FoxGhosttyWindowPlace -ErrorAction SilentlyContinue) {
            Restore-FoxGhosttyWindowPlace $place
        }
        return $false
    }
}

function Sync-FoxGhosttyShader {
    param([switch]$Reload)

    $enabled = Test-FoxShadersEnabled
    $theme = "orange"
    if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        $theme = Get-ActiveThemeName
    }
    $id = Get-FoxShaderIdForTheme $theme
    $changed = Write-FoxShaderOverlay -Enabled $enabled -ShaderId $id
    if ($changed -or $Reload) {
        Invoke-GhosttyReloadConfig | Out-Null
    }
    return $changed
}

function Get-FoxShaderStatusInfo {
    $enabled = Test-FoxShadersEnabled
    $theme = if (Get-Command Get-ActiveThemeName -ErrorAction SilentlyContinue) {
        Get-ActiveThemeName
    } else {
        "orange"
    }
    $id = Get-FoxShaderIdForTheme $theme
    $src = Join-Path (Get-FoxShaderSourceDir) ($id + ".glsl")
    return @{
        Enabled = $enabled
        Theme   = $theme
        Id      = $id
        Source  = $src
        Overlay = (Get-FoxShaderOverlayPath)
    }
}
