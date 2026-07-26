param(
    [switch]$Git,
    [switch]$NoGit
)

. (Join-Path $PSScriptRoot "foxauth.ps1")

function Write-Status([string]$msg) {
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent $msg)
}

# Handle git segment toggle
if ($Git) {
    $env:FOXTERM_OMP_GIT = "1"
    [System.Environment]::SetEnvironmentVariable("FOXTERM_OMP_GIT", "1", "User")
    Write-Host "Git segment: ON  (setx saved)" -ForegroundColor Green
}
if ($NoGit) {
    $env:FOXTERM_OMP_GIT = $null
    [System.Environment]::SetEnvironmentVariable("FOXTERM_OMP_GIT", $null, "User")
    Write-Host "Git segment: OFF (setx saved)" -ForegroundColor Yellow
}

# Hard reset all in-memory caches
$global:FOXTERM_PALETTE_CACHE      = $null
$global:FOXTERM_THEME_CACHE        = $null
$global:FOXTERM_THEME_MTIME        = $null
$global:FOXTERM_OMP_INIT           = $false
$global:FOXTERM_OMP_CONFIG_THEME   = $null
$global:FOXTERM_SYNCED_THEME       = $null
$global:FOXTERM_POSH_CONFIG        = $null
$global:FOXTERM_POSH_EXE           = $null
$global:FOXTERM_POSH_SHELL         = $null
$global:FOXTERM_PSREADLINE_CHECKED = $false
$global:FOXTERM_PSREADLINE_AVAILABLE = $null

# Rewrite OMP config and re-init prompt
try {
    Ensure-OhMyPoshConfig
    if ($env:FOXTERM_USER) {
        Set-PromptUser $env:FOXTERM_USER
        Set-Title $env:FOXTERM_USER
    } else {
        Apply-ThemeColors
        Set-Title "Not Logged In"
    }
} catch {
    Write-Host ("Reset error: " + $_.Exception.Message) -ForegroundColor Red
}

Clear-FoxHost

$p = Get-ThemePalette
Write-Host (Color-Text $p.accent "FoxTerminal reset complete.") 
Write-Host ""

$gitStatus = if ($env:FOXTERM_OMP_GIT -eq "1") { "ON  (slower prompt)" } else { "OFF (fast prompt)" }
Write-Host ("  Git segment : " + $gitStatus)
Write-Host ("  Theme       : " + (Load-ThemeName))
Write-Host ("  User        : " + (if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { "(not logged in)" }))
Write-Host ""
Write-Host "  foxreset -Git    -> enable git branch in prompt" -ForegroundColor DarkGray
Write-Host "  foxreset -NoGit  -> disable git branch (faster)" -ForegroundColor DarkGray
