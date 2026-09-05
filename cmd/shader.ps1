param(
    [Parameter(Position = 0)]
    [string]$Action
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "shader-lib.ps1")

function Show-ShaderUsage {
    Write-Host "Usage: shader [on|off|status|toggle]"
    Write-Host "  no args / status  show the active shader and whether it is on"
    Write-Host "  on | off          enable or disable glass for every theme"
    Write-Host "  toggle            flip the current state"
    Write-Host "Env: FOXTERM_SHADERS=0 forces shaders off for this session."
}

function Write-ShaderStatus {
    $p = Get-ThemePalette
    $info = Get-FoxShaderStatusInfo
    $state = if ($info.Enabled) { "ON" } else { "OFF" }
    $stateColor = if ($info.Enabled) { $p.accent2 } else { $p.dim }

    Write-Host ""
    Write-Host (Color-Text $p.accent "=== FoxTerminal shaders ===")
    Write-Host (Color-Text $p.dim "  glass  ") -NoNewline
    Write-Host (Color-Text $stateColor $state)
    Write-Host (Color-Text $p.dim "  theme  ") -NoNewline
    Write-Host (Color-Text $p.text $info.Theme)
    Write-Host (Color-Text $p.dim "  file   ") -NoNewline
    Write-Host (Color-Text $p.text ($info.Id + ".glsl  (per pane, not per window)"))
    if ($info.Overlay) {
        Write-Host (Color-Text $p.dim "  overlay") -NoNewline
        Write-Host (Color-Text $p.text ("  " + $info.Overlay))
    }
    Write-Host ""
    Write-Host (Color-Text $p.dim "  shader off / on   disable or enable for every theme")
    Write-Host (Color-Text $p.dim "  shader toggle     flip, also ctrl+shift+o")
    Write-Host (Color-Text $p.dim "  ctrl+shift+,      reload Ghostty if the glass did not change")
    Write-Host ""
}

$raw = if ($null -eq $Action) { "" } else { $Action.Trim() }
if ($raw -eq "-Status") { $raw = "status" }
$key = $raw.ToLowerInvariant()

if ($key -in @("-h", "--help", "help")) {
    Show-ShaderUsage
    return
}

$target = $null
switch ($key) {
    { $_ -in @("", "status") } { }
    "toggle" { $target = -not (Test-FoxShadersEnabled) }
    { $_ -in @("on", "1", "true", "enable") } { $target = $true }
    { $_ -in @("off", "0", "false", "disable") } { $target = $false }
    default {
        Write-Host ("Unknown action: " + $Action)
        Show-ShaderUsage
        exit 1
    }
}

if ($null -ne $target) {
    Save-FoxShaderState $target
}

Sync-FoxGhosttyShader -Reload | Out-Null
if (Get-Command Apply-ThemeColors -ErrorAction SilentlyContinue) {
    try { Apply-ThemeColors } catch {}
}
Write-ShaderStatus

$p = Get-ThemePalette
if (Test-FoxShadersEnabled) {
    Write-Host (Color-Text $p.accent2 "  Glass is on. Each split keeps its own look.")
} else {
    Write-Host (Color-Text $p.text "  Glass is off. The framebuffer is clean.")
}
Write-Host (Color-Text $p.dim "  If nothing changed, press ctrl+shift+, inside Ghostty.")
Write-Host ""
