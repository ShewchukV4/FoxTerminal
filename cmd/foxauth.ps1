# Session-wide caches and latches used across this file. Reading an unset variable is
# a hard error under Set-StrictMode, which several commands (ytm-ui, friend, ...) turn
# on, so declare them up front. Existing values survive a repeated dot-source so the
# theme and prompt caches are not thrown away mid-session.
foreach ($foxStateName in @(
    'FOXTERM_OMP_INIT', 'FOXTERM_POSH_CONFIG', 'FOXTERM_POSH_EXE', 'FOXTERM_POSH_SHELL',
    'FOXTERM_SYNCED_THEME', 'FOXTERM_ORIG_PROMPT', 'FOXTERM_PROMPT_NAME',
    'FOXTERM_THEME_CACHE', 'FOXTERM_THEME_MTIME', 'FOXTERM_PALETTE_CACHE',
    'FOXTERM_OSC_APPLIED',
    'FOXTERM_OMP_CONFIG_THEME', 'FOXTERM_OMP_CONFIG_KEY',
    'FOXTERM_SYNC_SUPPRESS_POLL', 'FOXTERM_SYNC_PRINT_LOCK', 'FOXTERM_SYNC_LAST_SEQ',
    'FOXTERM_SYNC_FROM_TIMER', 'FOXTERM_SYNC_INBOX_LOCK', 'FOXTERM_SYNC_LIVE_ENABLED',
    'FOXTERM_SYNC_EVENT_SUB', 'FOXTERM_SYNC_TIMER', 'FOXTERM_SYNC_EVENTS_MTIME',
    'FOXTERM_FOCUS_HOOK_ACTIVE', 'FOXTERM_PSREADLINE_CHECKED', 'FOXTERM_PSREADLINE_AVAILABLE',
    'FOXTERM_NOTE_LIB_LOADED', 'FOXTERM_WAI_PIN_NEED_CURSOR',
    'FOXTERM_PROMPT_LAST_TICK'
)) {
    if (-not (Get-Variable -Name $foxStateName -Scope Global -ErrorAction SilentlyContinue)) {
        Set-Variable -Name $foxStateName -Scope Global -Value $null
    }
}
Remove-Variable -Name foxStateName -ErrorAction SilentlyContinue

if ([string]::IsNullOrWhiteSpace($env:FOXTERM_THEME_SURFACE)) {
    $env:FOXTERM_THEME_SURFACE = [guid]::NewGuid().ToString("N")
}

function Get-UsersPath {
    return (Join-Path $PSScriptRoot "users.json")
}

function Test-OllamaRunning {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", 11434, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(200)
        if ($success -and $client.Connected) {
            $client.EndConnect($iar) | Out-Null
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Start-OllamaIfNeeded {
    if ($env:FOXTERM_OLLAMA_AUTOSTART -eq "0") { return }
    if (Test-OllamaRunning) { return }
    $ollamaExe = "C:\Program Files\Ollama\ollama.exe"
    if (-not (Test-Path $ollamaExe)) { return }

    if ($env:FOXTERM_OLLAMA_LOW_POWER -eq "1") {
        if (-not $env:OLLAMA_MAX_LOADED_MODELS) { $env:OLLAMA_MAX_LOADED_MODELS = "1" }
        if (-not $env:OLLAMA_NUM_PARALLEL) { $env:OLLAMA_NUM_PARALLEL = "1" }
    }

    try {
        $proc = Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden -PassThru
        try { $proc.PriorityClass = "BelowNormal" } catch {}
    } catch {
        # ignore if start fails
    }
}

function Load-Users {
    $path = Get-UsersPath
    if (-not (Test-Path $path)) { return @{} }
    $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
    try {
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

function Has-Users {
    $users = Load-Users
    return ($users.Count -gt 0)
}

function Get-UserNames {
    $users = Load-Users
    return @($users.Keys | Sort-Object)
}

function Show-Users {
    $p = Get-ThemePalette
    $names = Get-UserNames
    $userIcon = Get-FoxIcon 0xF007
    Write-Host ""
    Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF0C0) + "  users"))
    if ($names.Count -eq 0) {
        Write-Host (Color-Text $p.dim ("  " + $userIcon + "  (none)"))
        Write-Host ""
        return
    }
    $current = [string]$env:FOXTERM_USER
    foreach ($n in $names) {
        Write-Host (Color-Text $p.accent ("  " + $userIcon + "  ")) -NoNewline
        if ($current -and ($n -eq $current)) {
            Write-Host (Color-Text $p.accent2 $n) -NoNewline
            Write-Host (Color-Text $p.dim "  you")
        } else {
            Write-Host (Color-Text $p.text $n)
        }
    }
    Write-Host ""
}

function Save-Users([hashtable]$users) {
    $path = Get-UsersPath
    $users | ConvertTo-Json -Depth 5 | Set-Content -Path $path -Encoding UTF8
}

function New-Salt {
    $bytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Hash-Password([string]$password, [string]$salt) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($salt + $password)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return [Convert]::ToBase64String($hash)
}

function Read-PasswordPlain([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function New-User([string]$name, [string]$password) {
    $users = Load-Users
    if ($users.ContainsKey($name)) {
        throw "User already exists."
    }
    $salt = New-Salt
    $hash = Hash-Password $password $salt
    $users[$name] = @{ salt = $salt; hash = $hash; created = (Get-Date).ToString("s") }
    Save-Users $users
}

function Verify-User([string]$name, [string]$password) {
    $users = Load-Users
    if (-not $users.ContainsKey($name)) { return $false }
    $u = $users[$name]
    $hash = Hash-Password $password $u.salt
    return ($hash -eq $u.hash)
}

function Set-CurrentUser([string]$name) {
    $env:FOXTERM_USER = $name
    try {
        $statePath = Join-Path $PSScriptRoot "current_user.txt"
        [System.IO.File]::WriteAllText($statePath, $name, [System.Text.Encoding]::UTF8)
    } catch {}
    Set-Title $name
    Set-PromptUser $name
    Start-FoxSyncLiveBridge
}

function Clear-CurrentUser {
    Remove-Item Env:FOXTERM_USER -ErrorAction SilentlyContinue
    try {
        $statePath = Join-Path $PSScriptRoot "current_user.txt"
        if (Test-Path $statePath) { Remove-Item -Path $statePath -Force -ErrorAction SilentlyContinue }
    } catch {}
    Set-Title "Not Logged In"
    Restore-Prompt
    Stop-FoxSyncLiveBridge
}

function Get-PoshShellName {
    if ($PSVersionTable.PSEdition -eq 'Core') { return 'pwsh' }
    return 'powershell'
}

function Test-OhMyPoshActive {
    if ($global:FOXTERM_OMP_INIT) { return $true }
    try {
        $def = (Get-Command prompt -ErrorAction Stop).ScriptBlock.ToString()
        return ($def -match 'oh-my-posh|OhMyPosh|POSH_THEME|posh|print primary|FOXTERM_POSH')
    } catch {
        return $false
    }
}

function global:Import-FoxNoteLib {
    if ($global:FOXTERM_NOTE_LIB_LOADED) { return }
    $lib = Join-Path $PSScriptRoot "note-lib.ps1"
    if (-not (Test-Path -LiteralPath $lib)) { return }
    . $lib
    $global:FOXTERM_NOTE_LIB_LOADED = $true
}

function global:Invoke-WaiPinPromptHook {
    try { Import-FoxNoteLib } catch {}
    if (Get-Command Test-WaiPinSuspended -ErrorAction SilentlyContinue) {
        try { if (Test-WaiPinSuspended) { return } } catch {}
    }
    if (Get-Command Restore-WaiPinOnPrompt -ErrorAction SilentlyContinue) {
        try { Restore-WaiPinOnPrompt } catch {}
    }
}

function Test-FoxPromptRepeat {
    $now = [Environment]::TickCount
    $last = 0
    if ($null -ne $global:FOXTERM_PROMPT_LAST_TICK) {
        $last = [int]$global:FOXTERM_PROMPT_LAST_TICK
    }
    $global:FOXTERM_PROMPT_LAST_TICK = $now
    if ($last -eq 0) { return $false }
    $dt = $now - $last
    return ($dt -ge 0 -and $dt -lt 80)
}

function global:Get-OhMyPoshPromptText {
    if (Get-Command Test-FoxSessionLocked -ErrorAction SilentlyContinue) {
        if (Test-FoxSessionLocked) {
            if (-not (Unlock-FoxSession)) { exit }
        }
    }
    if (Get-Command Test-WaiPinSuspended -ErrorAction SilentlyContinue) {
        try { if (Test-WaiPinSuspended) { return "" } } catch {}
    }
    Invoke-FoxSyncTerminalInbox
    if (-not $global:FOXTERM_SYNC_SUPPRESS_POLL) {
        Write-FoxSyncSidebarEvents
    }
    if (Get-Command Import-FoxControlTheme -ErrorAction SilentlyContinue) {
        try { Import-FoxControlTheme | Out-Null } catch {}
    }
    Repair-TerminalColors
    Invoke-WaiPinPromptHook
    $cfg = $env:POSH_THEME
    if ([string]::IsNullOrWhiteSpace($cfg)) { $cfg = $global:FOXTERM_POSH_CONFIG }
    $exe = $global:FOXTERM_POSH_EXE
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { $exe = (Resolve-OhMyPoshExe) }
    if (-not $exe) { return (New-FoxPrompt) }

    $sh = Get-PoshShellName
    $pwd = (Get-Location).Path
    $primary = & $exe print primary --config $cfg --shell $sh --force --pwd $pwd 2>$null
    $secondary = & $exe print secondary --config $cfg --shell $sh --force --pwd $pwd 2>$null

    $primaryLines = @($primary | ForEach-Object { [string]$_.ToString().TrimEnd("`r", "`n") })
    if ($primaryLines.Count -gt 1) {
        return ($primaryLines -join "`n")
    }
    $primaryLine = if ($primaryLines.Count -eq 1) { $primaryLines[0] } else { "" }
    if ([string]::IsNullOrWhiteSpace($primaryLine)) { return (New-FoxPrompt) }

    $secondaryLine = ($secondary | ForEach-Object { "$_" }) -join ''
    if ([string]::IsNullOrWhiteSpace($secondaryLine)) {
        $p = Get-ThemePalette
        $fg = if (Test-NoirActive) { $p.text } else { $p.accent }
        $secondaryLine = (Color-Text $fg ([char]0x276F + " "))
    }

    $primaryLine = $primaryLine.TrimEnd("`r", "`n")
    $secondaryLine = $secondaryLine.TrimEnd("`r", "`n")
    if ($primaryLine -match "`n") {
        return $primaryLine
    }
    return $primaryLine + "`n" + $secondaryLine
}

function Install-OhMyPoshPrompt {
    if (-not (Ensure-OhMyPosh)) {
        if ($env:FOXTERM_USER) { function global:prompt { New-FoxPrompt } }
        return $false
    }

    Ensure-OhMyPoshConfig
    $configPath = Get-OhMyPoshConfigPath
    if (-not (Test-Path $configPath)) {
        if ($env:FOXTERM_USER) { function global:prompt { New-FoxPrompt } }
        return $false
    }

    $omp = Resolve-OhMyPoshExe
    if (-not $omp) {
        if ($env:FOXTERM_USER) { function global:prompt { New-FoxPrompt } }
        return $false
    }

    $env:POSH_THEME = $configPath
    $global:FOXTERM_POSH_CONFIG = $configPath
    $global:FOXTERM_POSH_EXE = $omp
    $global:FOXTERM_POSH_SHELL = Get-PoshShellName

    function global:prompt {
        if (Test-FoxPromptRepeat) { return "" }
        try { return (Get-OhMyPoshPromptText) } catch { return (New-FoxPrompt) }
    }

    $global:FOXTERM_OMP_INIT = $true
    return $true
}

function Sync-FoxTheme {
    param([switch]$ForcePrompt, [switch]$RedrawPrompt)

    Clear-FoxThemeCache
    $theme = Get-ActiveThemeName

    Ensure-OhMyPoshConfig
    Apply-ThemeColors
    $env:POSH_THEME = Get-OhMyPoshConfigPath

    if ($ForcePrompt -or -not (Test-OhMyPoshActive)) {
        Install-OhMyPoshPrompt | Out-Null
    }

    if ($RedrawPrompt -and (Test-OhMyPoshActive)) {
        Write-FoxPromptBar
    }

    if (Get-Command Sync-FoxGhosttyShader -ErrorAction SilentlyContinue) {
        try { Sync-FoxGhosttyShader | Out-Null } catch {}
    }

    if (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue) {
        try { Sync-FoxOsSkin | Out-Null } catch {}
    }

    $global:FOXTERM_SYNCED_THEME = $theme
}

function Set-PromptUser([string]$name) {
    if (-not $global:FOXTERM_ORIG_PROMPT) {
        $global:FOXTERM_ORIG_PROMPT = (Get-Command prompt).ScriptBlock
    }
    $global:FOXTERM_PROMPT_NAME = $name
    Sync-FoxTheme -ForcePrompt
    Register-FoxConsoleFocusRepair
    Start-FoxSyncLiveBridge
}

function Restore-Prompt {
    if ($global:FOXTERM_ORIG_PROMPT) {
        Set-Item -Path Function:prompt -Value $global:FOXTERM_ORIG_PROMPT
    }
    $global:FOXTERM_PROMPT_NAME = $null
}

function Get-ThemePath {
    return (Join-Path $PSScriptRoot "theme.txt")
}

# Unique per PowerShell session (set at boot, inherited by child commands like sw).
# Do not use GetConsoleWindow(): every Ghostty split on Windows shares that HWND,
# so a pin keyed on it made one pane's theme overwrite the other.
function Get-FoxThemeSurfaceId {
    if ([string]::IsNullOrWhiteSpace($env:FOXTERM_THEME_SURFACE)) {
        $env:FOXTERM_THEME_SURFACE = [guid]::NewGuid().ToString("N")
    }
    return $env:FOXTERM_THEME_SURFACE
}

function Get-ThemeSurfacePath {
    $id = Get-FoxThemeSurfaceId
    if (-not $id) { return $null }
    return (Join-Path ([System.IO.Path]::GetTempPath()) ("foxterm-theme-surface-" + $id + ".txt"))
}

function Get-DiskThemeName {
    $path = Get-ThemePath
    if (-not (Test-Path $path)) { return "orange" }
    $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim()
    if ([string]::IsNullOrWhiteSpace($name)) { return "orange" }
    return $name
}

function Test-FoxMainThemeName([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    switch ($name.Trim()) {
        "orange" { return $true }
        "arthas-dark" { return $true }
        "arthas-light" { return $true }
        "pride" { return $true }
        "noir" { return $true }
        "dnote" { return $true }
        "notebook" { return $true }
        default { return $false }
    }
}

function Get-DefaultThemeSeed {
    $disk = Get-DiskThemeName
    if (Test-FoxMainThemeName $disk) { return $disk }
    # Color chips (violet/neon/…) and FOXSTYLE seeds live in theme.txt too —
    # previously they fell through to orange so new Ghostty panes ignored Apply.
    if (-not [string]::IsNullOrWhiteSpace($disk) -and $disk -match '^[a-z0-9][a-z0-9_-]*$') {
        return $disk.Trim().ToLowerInvariant()
    }
    return "orange"
}

function Initialize-FoxPaneTheme {
    param([string]$ParentSurfaceId)
    $path = Get-ThemeSurfacePath
    if (-not $path) { return }
    if (Test-Path -LiteralPath $path) { return }
    $seed = $null
    $selfId = Get-FoxThemeSurfaceId
    if (-not [string]::IsNullOrWhiteSpace($ParentSurfaceId) -and $ParentSurfaceId -ne $selfId) {
        $parentPath = Join-Path ([System.IO.Path]::GetTempPath()) ("foxterm-theme-surface-" + $ParentSurfaceId + ".txt")
        if (Test-Path -LiteralPath $parentPath) {
            $seed = (Get-Content -Path $parentPath -Raw -ErrorAction SilentlyContinue).Trim()
        }
    }
    if ([string]::IsNullOrWhiteSpace($seed)) {
        $seed = Get-DefaultThemeSeed
    }
    try { $seed | Set-Content -Path $path -Encoding UTF8 } catch {}
}

function Save-ActiveTheme([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { $name = "orange" }
    $name = $name.Trim()
    $surface = Get-ThemeSurfacePath
    if ($surface) {
        try { $name | Set-Content -Path $surface -Encoding UTF8 } catch {}
    }
    # sw color chips (slate, ice, ...) stay on this pane only.
    # theme.txt is the seed for a brand-new window: Fox Default / Arthas / Pride / Noir / Death Note.
    if (Test-FoxMainThemeName $name) {
        $name | Set-Content -Path (Get-ThemePath) -Encoding UTF8
    }
    Clear-FoxThemeCache
    if (Get-Command Save-FoxUserWorld -ErrorAction SilentlyContinue) {
        try { Save-FoxUserWorld } catch {}
    }
}

function Get-OhMyPoshConfigPath {
    $id = Get-FoxThemeSurfaceId
    if ($id) {
        return (Join-Path ([System.IO.Path]::GetTempPath()) ("foxterm-" + $id + ".omp.json"))
    }
    return (Join-Path (Get-FoxRoot) "FoxTerminal\\oh-my-posh\\foxterm.omp.json")
}

function Get-OhMyPoshPath {
    $exe = if ($env:OS -eq "Windows_NT") { "oh-my-posh.exe" } else { "oh-my-posh" }
    return (Join-Path (Join-Path (Join-Path (Get-FoxRoot) "FoxTerminal") "bin") $exe)
}

function Resolve-OhMyPoshExe {
    $omp = Get-OhMyPoshPath
    if (Test-Path -LiteralPath $omp) { return $omp }
    $cmd = Get-Command oh-my-posh -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Clear-FoxThemeCache {
    $global:FOXTERM_THEME_CACHE = $null
    $global:FOXTERM_THEME_MTIME = $null
    $global:FOXTERM_PALETTE_CACHE = $null
    $global:FOXTERM_OMP_CONFIG_THEME = $null
    $global:FOXTERM_OMP_CONFIG_KEY = $null
    $global:FOXTERM_OSC_APPLIED = $null
}

function Get-OhMyPoshConfigCacheKey {
    $theme = Get-ActiveThemeName
    if ((Get-Command Test-PrideActive -ErrorAction SilentlyContinue) -and (Test-PrideActive)) {
        $style = if (Get-Command Load-PrideStyle -ErrorAction SilentlyContinue) { Load-PrideStyle } else { "gay" }
        return ("pride:" + $style)
    }
    return $theme
}

function Write-FoxPromptBar {
    if (-not (Test-OhMyPoshActive)) { return }
    try {
        Write-Host (Get-OhMyPoshPromptText)
    } catch {}
}

function Get-ActiveThemeName {
    $surface = Get-ThemeSurfacePath
    if ($surface) {
        if (-not (Test-Path $surface)) {
            $seed = Get-DefaultThemeSeed
            try { $seed | Set-Content -Path $surface -Encoding UTF8 } catch {}
            return $seed
        }
        $name = (Get-Content -Path $surface -Raw -ErrorAction SilentlyContinue).Trim()
        if (-not [string]::IsNullOrWhiteSpace($name)) { return $name }
    }
    return (Get-DefaultThemeSeed)
}

function Load-ThemeName {
    $path = Get-ThemePath
    $surface = Get-ThemeSurfacePath
    if (-not (Test-Path $path) -and -not ($surface -and (Test-Path $surface))) {
        $global:FOXTERM_THEME_CACHE = "orange"
        return "orange"
    }
    try {
        $stampFile = if ($surface -and (Test-Path $surface)) { $surface } else { $path }
        $mtime = (Get-Item -LiteralPath $stampFile -ErrorAction Stop).LastWriteTimeUtc
        if ($global:FOXTERM_THEME_CACHE -and $global:FOXTERM_THEME_MTIME -eq $mtime) {
            return $global:FOXTERM_THEME_CACHE
        }
        $name = Get-ActiveThemeName
        $global:FOXTERM_THEME_CACHE = $name
        $global:FOXTERM_THEME_MTIME = $mtime
        $global:FOXTERM_PALETTE_CACHE = $null
        return $global:FOXTERM_THEME_CACHE
    } catch {
        return if ($global:FOXTERM_THEME_CACHE) { $global:FOXTERM_THEME_CACHE } else { "orange" }
    }
}

function Test-NoirActive {
    return ((Get-ActiveThemeName) -eq "noir")
}

function Test-DnoteActive {
    return ((Get-ActiveThemeName) -eq "dnote")
}

function Test-NotebookActive {
    return ((Get-ActiveThemeName) -eq "notebook")
}

function Test-ArthasActive {
    $name = Get-ActiveThemeName
    return ($name -eq "arthas-dark" -or $name -eq "arthas-light")
}

function Get-ThemeHex {
    $name = Load-ThemeName
    switch ($name) {
        "blue"   { return "#5A8CFF" }
        "purple" { return "#A05AFF" }
        "cyan"   { return "#46DCC8" }
        "crimson" { return "#D14A5A" }
        "rose" { return "#E05A9A" }
        "magenta" { return "#D44BBD" }
        "violet" { return "#8356E6" }
        "indigo" { return "#4E75D8" }
        "sky" { return "#6FC4F0" }
        "teal" { return "#36B8B3" }
        "mint" { return "#6BD3B0" }
        "emerald" { return "#4CB874" }
        "lime" { return "#9BD94A" }
        "gold" { return "#E0B148" }
        "amber" { return "#E5943A" }
        "peach" { return "#E7A37C" }
        "coral" { return "#E07D69" }
        "ruby" { return "#C83B5C" }
        "slate" { return "#7D93B0" }
        "ice" { return "#7CC8E8" }
        "neon" { return "#7EF06B" }
        "forest" { return "#4E8C66" }
        "mocha" { return "#A17A5A" }
        "black" { return "#111111" }
        "white" { return "#F2F2F2" }
        "noir"  { return "#888888" }
        "dnote" { return "#B11212" }
        "notebook" { return "#9A4034" }
        "arthas-dark" { return "#58B8FF" }
        "arthas-light" { return "#E8C36A" }
        default  { return "#DC7A14" }
    }
}

function Convert-HexToRgb([string]$hex) {
    $h = $hex.TrimStart("#")
    if ($h.Length -ne 6) { return @{ r = 255; g = 255; b = 255 } }
    return @{
        r = [Convert]::ToInt32($h.Substring(0,2), 16)
        g = [Convert]::ToInt32($h.Substring(2,2), 16)
        b = [Convert]::ToInt32($h.Substring(4,2), 16)
    }
}

function Adjust-Color([string]$hex, [double]$factor) {
    $rgb = Convert-HexToRgb $hex
    $r = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.r * $factor)))
    $g = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.g * $factor)))
    $b = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.b * $factor)))
    return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b)
}

function Mix-Hex([string]$from, [string]$to, [double]$t) {
    $a = Convert-HexToRgb $from
    $b = Convert-HexToRgb $to
    $t = [Math]::Min(1.0, [Math]::Max(0.0, $t))
    $r = [int][Math]::Round($a.r * (1.0 - $t) + $b.r * $t)
    $g = [int][Math]::Round($a.g * (1.0 - $t) + $b.g * $t)
    $bl = [int][Math]::Round($a.b * (1.0 - $t) + $b.b * $t)
    return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $bl)
}

$prideLibPath = Join-Path $PSScriptRoot "pride-lib.ps1"
if (Test-Path $prideLibPath) { . $prideLibPath }

$shaderLibPath = Join-Path $PSScriptRoot "shader-lib.ps1"
if (Test-Path $shaderLibPath) { . $shaderLibPath }

$foxosLibPath = Join-Path $PSScriptRoot "foxos-lib.ps1"
if (Test-Path $foxosLibPath) { . $foxosLibPath }

$foxcursorLibPath = Join-Path $PSScriptRoot "foxcursor-lib.ps1"
if (Test-Path $foxcursorLibPath) {
    try { . $foxcursorLibPath } catch { Write-Warning ("foxcursor-lib.ps1 failed: " + $_.Exception.Message) }
}

$foxlookLibPath = Join-Path $PSScriptRoot "foxlook-lib.ps1"
if (Test-Path $foxlookLibPath) {
    try { . $foxlookLibPath } catch { Write-Warning ("foxlook-lib.ps1 failed: " + $_.Exception.Message) }
}

$foxsysLibPath = Join-Path $PSScriptRoot "foxsys-lib.ps1"
if (Test-Path $foxsysLibPath) {
    try { . $foxsysLibPath } catch { Write-Warning ("foxsys-lib.ps1 failed: " + $_.Exception.Message) }
}
if (-not (Get-Command Complete-FoxSession -ErrorAction SilentlyContinue)) {
    function Complete-FoxSession {
        param([switch]$Fresh)
        if (Get-Command Apply-ThemeColors -ErrorAction SilentlyContinue) { Apply-ThemeColors }
        if (Get-Command Register-FoxConsoleFocusRepair -ErrorAction SilentlyContinue) { Register-FoxConsoleFocusRepair }
    }
}

function Get-ThemePalette {
    if ($global:FOXTERM_PALETTE_CACHE) { return $global:FOXTERM_PALETTE_CACHE }
    if (Test-NoirActive) {
        $global:FOXTERM_PALETTE_CACHE = @{
            accent  = "#484848"
            accent2 = "#686868"
            accent3 = "#585858"
            accent4 = "#787878"
            dim     = "#606060"
            base    = "#0A0A0A"
            text    = "#E0E0E0"
        }
        return $global:FOXTERM_PALETTE_CACHE
    }
    if (Test-DnoteActive) {
        $global:FOXTERM_PALETTE_CACHE = @{
            accent  = "#8F1010"
            accent2 = "#B11212"
            accent3 = "#6B0C0C"
            accent4 = "#D01616"
            dim     = "#8C7A7A"
            base    = "#050505"
            text    = "#F2E9E9"
        }
        return $global:FOXTERM_PALETTE_CACHE
    }
    if (Test-NotebookActive) {
        $global:FOXTERM_PALETTE_CACHE = @{
            accent  = "#9A4034"
            accent2 = "#C4A574"
            accent3 = "#6E4E3A"
            accent4 = "#E8D9C0"
            dim     = "#7A6B58"
            base    = "#1C1914"
            text    = "#EDE6D6"
        }
        return $global:FOXTERM_PALETTE_CACHE
    }
    $tn = Get-ActiveThemeName
    if (Test-ArthasActive) {
        if ((Get-ActiveThemeName) -eq "arthas-light") {
            $global:FOXTERM_PALETTE_CACHE = @{
                accent  = "#E8C36A"
                accent2 = "#F3D992"
                accent3 = "#C49D43"
                accent4 = "#FFE7B8"
                dim     = "#A88746"
                base    = "#120F07"
                text    = "#FFF1D0"
            }
        } else {
            $global:FOXTERM_PALETTE_CACHE = @{
                accent  = "#58B8FF"
                accent2 = "#86CCFF"
                accent3 = "#2F86D8"
                accent4 = "#C1E8FF"
                dim     = "#3B6F96"
                base    = "#060A12"
                text    = "#D7F1FF"
            }
        }
        return $global:FOXTERM_PALETTE_CACHE
    }
    if (Test-PrideActive) {
        $global:FOXTERM_PALETTE_CACHE = Get-PridePalette (Load-PrideStyle)
        return $global:FOXTERM_PALETTE_CACHE
    }
    $accent = Get-ThemeHex
    $accent2 = Adjust-Color $accent 1.15
    $accent3 = Adjust-Color $accent 0.85
    $accent4 = Adjust-Color $accent 1.3
    $dim = Adjust-Color $accent 0.65
    $global:FOXTERM_PALETTE_CACHE = @{
        accent = $accent
        accent2 = $accent2
        accent3 = $accent3
        accent4 = $accent4
        dim = $dim
        base = (Mix-Hex "#0B0F1A" $accent 0.12)
        text = "#E6E6E6"
    }
    return $global:FOXTERM_PALETTE_CACHE
}

function Get-FoxIcon([int]$code) {
    # Nerd Font glyphs (Font Awesome BMP). Color emoji ignore ANSI on Windows.
    return [string][char]$code
}

function Color-Text([string]$hex, [string]$text) {
    $rgb = Convert-HexToRgb $hex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{4}{0}[0m" -f $esc, $rgb.r, $rgb.g, $rgb.b, $text)
}

function Color-TextBg([string]$fgHex, [string]$bgHex, [string]$text) {
    $fg = Convert-HexToRgb $fgHex
    $bg = Convert-HexToRgb $bgHex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $text)
}

function Color-TextStrike([string]$fgHex, [string]$text, [string]$bgHex = $null) {
    $fg = Convert-HexToRgb $fgHex
    $esc = [char]27
    if ([string]::IsNullOrWhiteSpace($bgHex)) {
        return ("{0}[9;38;2;{1};{2};{3}m{4}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $text)
    }
    $bg = Convert-HexToRgb $bgHex
    return ("{0}[9;38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $text)
}

function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

function Convert-ToStrikeText([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    $strike = [char]0x0336
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $text.ToCharArray()) {
        [void]$sb.Append($ch)
        [void]$sb.Append($strike)
    }
    return $sb.ToString()
}

function Get-CenteredLine([string]$text, [int]$width) {
    $plain = Strip-Ansi $text
    $pad = [Math]::Max(0, [int](($width - $plain.Length) / 2))
    return ((" " * $pad) + $text)
}

function Pad-Line([string]$line, [int]$width) {
    $plain = Strip-Ansi $line
    if ($plain.Length -lt $width) {
        return $line + (" " * ($width - $plain.Length))
    }
    return $line
}

function Get-ContrastText([string]$hex) {
    $rgb = Convert-HexToRgb $hex
    $luma = (0.2126 * $rgb.r + 0.7152 * $rgb.g + 0.0722 * $rgb.b)
    if ($luma -gt 140) { return "#0B0F1A" }
    return "#E6E6E6"
}

function Get-SeparatorSymbol {
    return ">"
}

function Get-PromptSymbol {
    return ">"
}

function Get-LeftSeparatorSymbol {
    return "<"
}

function New-Segment([string]$text, [string]$bgHex) {
    $fgHex = Get-ContrastText $bgHex
    $bg = Convert-HexToRgb $bgHex
    $fg = Convert-HexToRgb $fgHex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m {7} {0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $text)
}

function New-Separator([string]$fromBg, [string]$toBg) {
    $sep = Get-SeparatorSymbol
    $fg = Convert-HexToRgb $fromBg
    $bg = Convert-HexToRgb $toBg
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $sep)
}

function New-LeftSeparator([string]$fromBg, [string]$toBg) {
    $sep = Get-LeftSeparatorSymbol
    $fg = Convert-HexToRgb $fromBg
    $bg = Convert-HexToRgb $toBg
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $sep)
}

function New-PowerlineLine($segments, [string]$baseBg) {
    $out = ""
    if ($segments.Count -gt 0) {
        $out += New-LeftSeparator $baseBg $segments[0].bg
    }
    for ($i = 0; $i -lt $segments.Count; $i++) {
        $seg = $segments[$i]
        $out += New-Segment $seg.text $seg.bg
        $nextBg = if ($i -lt $segments.Count - 1) { $segments[$i + 1].bg } else { $baseBg }
        $out += New-Separator $seg.bg $nextBg
    }
    return $out
}

function Write-FoxSyncSidebarEvents {
    if ($env:FOXTERM_SYNC_CONTEXT -eq "daemon") { return }
    if ($global:FOXTERM_SYNC_PRINT_LOCK) { return }
    $global:FOXTERM_SYNC_PRINT_LOCK = $true
    try {
        $eventsPath = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\events.ndjson"
        if (-not (Test-Path $eventsPath)) { return }
        $mtime = (Get-Item -LiteralPath $eventsPath).LastWriteTimeUtc
        if ($global:FOXTERM_SYNC_EVENTS_MTIME -eq $mtime) { return }
        $global:FOXTERM_SYNC_EVENTS_MTIME = $mtime

        function Remove-Ansi([string]$text) {
            if ([string]::IsNullOrWhiteSpace($text)) { return $text }
            $clean = $text -replace "$([char]27)\][^\a$([char]27)]*(?:\a|$([char]27)\\)", ""
            $clean = $clean -replace "$([char]27)\[[0-9;?]*[A-Za-z]", ""
            return $clean
        }

        if ($null -eq $global:FOXTERM_SYNC_LAST_SEQ) {
            try {
                $tail = Get-Content -Path $eventsPath -Tail 1 -ErrorAction Stop
                if (-not [string]::IsNullOrWhiteSpace($tail)) {
                    $lastObj = $tail | ConvertFrom-Json -ErrorAction Stop
                    $global:FOXTERM_SYNC_LAST_SEQ = [int]$lastObj.seq
                } else {
                    $global:FOXTERM_SYNC_LAST_SEQ = 0
                }
            } catch {
                $global:FOXTERM_SYNC_LAST_SEQ = 0
            }
            return
        }

        $lastSeq = 0
        try { $lastSeq = [int]$global:FOXTERM_SYNC_LAST_SEQ } catch { $lastSeq = 0 }

        $newEvents = @()
        try {
            $lines = Get-Content -Path $eventsPath -Tail 140 -ErrorAction Stop
            foreach ($line in $lines) {
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                try {
                    $event = $line | ConvertFrom-Json -ErrorAction Stop
                    $seq = if ($null -ne $event.seq) { [int]$event.seq } else { 0 }
                    if ($seq -le $lastSeq) { continue }
                    if ([string]$event.source -ne "sidebar") { continue }
                    $newEvents += $event
                } catch {}
            }
        } catch {
            return
        }

        if ($newEvents.Count -eq 0) { return }
        $p = Get-ThemePalette
        foreach ($event in ($newEvents | Sort-Object seq)) {
            $line = [string]$event.line
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                Write-Host (Color-Text $p.accent2 ("[sidebar] " + $line))
            } else {
                Write-Host (Color-Text $p.accent2 "[sidebar] command executed")
            }
            $output = Remove-Ansi ([string]$event.output)
            if (-not [string]::IsNullOrWhiteSpace($output)) {
                $trimmed = $output.Trim()
                if ($trimmed.Length -gt 220) {
                    $trimmed = $trimmed.Substring(0, 220) + "..."
                }
                Write-Host (Color-Text $p.dim ("  " + $trimmed))
            }
        }

        $maxSeq = ($newEvents | Measure-Object -Property seq -Maximum).Maximum
        if ($null -ne $maxSeq) {
            $global:FOXTERM_SYNC_LAST_SEQ = [int]$maxSeq
        }

        if ($global:FOXTERM_SYNC_FROM_TIMER) {
            try {
                Write-Host ""
                $global:FOXTERM_SYNC_SUPPRESS_POLL = $true
                if (Test-OhMyPoshActive) {
                    Write-Host (Get-OhMyPoshPromptText)
                } else {
                    Write-Host (New-FoxPrompt)
                }
            } catch {
                # ignore redraw issues
            } finally {
                $global:FOXTERM_SYNC_SUPPRESS_POLL = $false
            }
        }
    } finally {
        $global:FOXTERM_SYNC_PRINT_LOCK = $false
    }
}

function Invoke-FoxSyncTerminalInbox {
    if ($env:FOXTERM_SYNC_CONTEXT -eq "daemon") { return }
    if ($global:FOXTERM_SYNC_INBOX_LOCK) { return }
    if ([Console]::IsInputRedirected -or -not [Environment]::UserInteractive) { return }
    $global:FOXTERM_SYNC_INBOX_LOCK = $true
    try {
        if (($env:PATH -split ';') -notcontains $PSScriptRoot) {
            $env:PATH = $PSScriptRoot + ";" + $env:PATH
        }
        $inboxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\terminal-inbox"
        if (-not (Test-Path $inboxDir)) { return }

        $files = @(Get-ChildItem -Path $inboxDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Sort-Object Name)
        if ($files.Count -eq 0) { return }

        $p = Get-ThemePalette
        foreach ($file in $files) {
            $req = $null
            try {
                $req = (Get-Content -Path $file.FullName -Raw -ErrorAction Stop) | ConvertFrom-Json -ErrorAction Stop
            } catch {
                Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                continue
            }

            $line = [string]$req.line
            if ([string]::IsNullOrWhiteSpace($line)) {
                Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                continue
            }

            # Remove before execution so long-running interactive commands
            # do not relaunch on every new prompt/session.
            Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
            Write-Host (Color-Text $p.accent2 ("[firefox->terminal] " + $line))
            try {
                $out = @(Invoke-Expression $line 2>&1)
                $text = ($out | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
                if (-not [string]::IsNullOrWhiteSpace($text)) {
                    Write-Host $text
                }
            } catch {
                Write-Host $_.Exception.Message -ForegroundColor Red
            }
        }
    } finally {
        $global:FOXTERM_SYNC_INBOX_LOCK = $false
    }
}

function Start-FoxSyncLiveBridge {
    if ($env:FOXTERM_SYNC_CONTEXT -eq "daemon") { return }
    if ($global:FOXTERM_SYNC_LIVE_ENABLED -eq $false) { return }
    if ($global:FOXTERM_SYNC_EVENT_SUB -and $global:FOXTERM_SYNC_TIMER) { return }

    $inboxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\terminal-inbox"
    $eventsPath = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\events.ndjson"
    $needsLive = $false
    if ((Test-Path $inboxDir) -and (Get-ChildItem $inboxDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Select-Object -First 1)) {
        $needsLive = $true
    } elseif (Test-Path $eventsPath) {
        $age = (Get-Date).ToUniversalTime() - (Get-Item -LiteralPath $eventsPath).LastWriteTimeUtc
        if ($age.TotalMinutes -lt 10) { $needsLive = $true }
    }
    if (-not $needsLive) { return }

    try { Write-FoxSyncSidebarEvents } catch {}

    try {
        $timer = New-Object System.Timers.Timer
        $timer.Interval = 4000
        $timer.AutoReset = $true
        $timer.Enabled = $true

        $subscription = Register-ObjectEvent -InputObject $timer -EventName Elapsed -SourceIdentifier "FoxTerm.Sync.LiveBridge" -Action {
            try {
                if ($env:FOXTERM_SYNC_CONTEXT -eq "daemon") { return }
                $global:FOXTERM_SYNC_FROM_TIMER = $true
                Write-FoxSyncSidebarEvents
            } catch {}
            finally { $global:FOXTERM_SYNC_FROM_TIMER = $false }
        }

        $global:FOXTERM_SYNC_TIMER = $timer
        $global:FOXTERM_SYNC_EVENT_SUB = $subscription
    } catch {
        # keep prompt-only fallback
    }
}

function Stop-FoxSyncLiveBridge {
    try {
        if ($global:FOXTERM_SYNC_EVENT_SUB) {
            $sid = $global:FOXTERM_SYNC_EVENT_SUB.SourceIdentifier
            Unregister-Event -SourceIdentifier $sid -ErrorAction SilentlyContinue
            Remove-Job -Id $global:FOXTERM_SYNC_EVENT_SUB.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    try {
        if ($global:FOXTERM_SYNC_TIMER) {
            $global:FOXTERM_SYNC_TIMER.Stop()
            $global:FOXTERM_SYNC_TIMER.Dispose()
        }
    } catch {}
    $global:FOXTERM_SYNC_EVENT_SUB = $null
    $global:FOXTERM_SYNC_TIMER = $null
}

function global:New-FoxPrompt {
    if (Get-Command Test-FoxSessionLocked -ErrorAction SilentlyContinue) {
        if (Test-FoxSessionLocked) {
            if (-not (Unlock-FoxSession)) { exit }
        }
    }
    if (Get-Command Test-WaiPinSuspended -ErrorAction SilentlyContinue) {
        try { if (Test-WaiPinSuspended) { return "" } } catch {}
    }
    Invoke-FoxSyncTerminalInbox
    if (-not $global:FOXTERM_SYNC_SUPPRESS_POLL) {
        Write-FoxSyncSidebarEvents
    }
    if (Get-Command Import-FoxControlTheme -ErrorAction SilentlyContinue) {
        try { Import-FoxControlTheme | Out-Null } catch {}
    }
    Invoke-WaiPinPromptHook
    $p = Get-ThemePalette
    $user = if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { $env:USERNAME }
    $dir = Split-Path (Get-Location).Path -Leaf
    if ([string]::IsNullOrWhiteSpace($dir)) { $dir = "\" }
    $time = (Get-Date).ToString("HH:mm")
    $line1 =
        (Color-Text $p.accent ("[FOXTERM]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.accent2 ("[" + $user + "]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.dim ("[" + $dir + "]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.accent2 ("[" + $time + "]"))
    $line2 = (Color-Text $p.accent ">") + " "
    return $line1 + "`n" + $line2
}

function Apply-TerminalOscColors {
    try {
        $global:FOXTERM_PALETTE_CACHE = $null
        $name = Get-ActiveThemeName
        $esc = [char]27
        if ($name -eq "noir") {
            Write-Host -NoNewline "$esc]10;#D8D8D8$esc\"
            Write-Host -NoNewline "$esc]11;#0A0A0A$esc\"
            Write-Host -NoNewline "$esc]12;#909090$esc\"
            $env:FOXTERM_NOIR = "1"
            Remove-Item Env:FOXTERM_DNOTE -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_NOTEBOOK -ErrorAction SilentlyContinue
        } elseif ($name -eq "dnote") {
            Write-Host -NoNewline "$esc]10;#F2E9E9$esc\"
            Write-Host -NoNewline "$esc]11;#050505$esc\"
            Write-Host -NoNewline "$esc]12;#B11212$esc\"
            $env:FOXTERM_DNOTE = "1"
            Remove-Item Env:FOXTERM_NOIR -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_ARTHAS -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_NOTEBOOK -ErrorAction SilentlyContinue
        } elseif ($name -eq "notebook") {
            Write-Host -NoNewline "$esc]10;#EDE6D6$esc\"
            Write-Host -NoNewline "$esc]11;#1C1914$esc\"
            Write-Host -NoNewline "$esc]12;#9A4034$esc\"
            $env:FOXTERM_NOTEBOOK = "1"
            Remove-Item Env:FOXTERM_NOIR -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_DNOTE -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_ARTHAS -ErrorAction SilentlyContinue
        } elseif ($name -eq "arthas-dark") {
            Write-Host -NoNewline "$esc]10;#D7F1FF$esc\"
            Write-Host -NoNewline "$esc]11;#060A12$esc\"
            Write-Host -NoNewline "$esc]12;#58B8FF$esc\"
            $env:FOXTERM_ARTHAS = "dark"
            Remove-Item Env:FOXTERM_NOIR -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_DNOTE -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_NOTEBOOK -ErrorAction SilentlyContinue
        } elseif ($name -eq "arthas-light") {
            Write-Host -NoNewline "$esc]10;#FFF1D0$esc\"
            Write-Host -NoNewline "$esc]11;#120F07$esc\"
            Write-Host -NoNewline "$esc]12;#E8C36A$esc\"
            $env:FOXTERM_ARTHAS = "light"
            Remove-Item Env:FOXTERM_NOIR -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_DNOTE -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_NOTEBOOK -ErrorAction SilentlyContinue
        } else {
            $p = Get-ThemePalette
            Write-Host -NoNewline "$esc]10;$($p.text)$esc\"
            Write-Host -NoNewline "$esc]11;$($p.base)$esc\"
            Write-Host -NoNewline "$esc]12;$($p.accent)$esc\"
            Remove-Item Env:FOXTERM_NOIR -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_DNOTE -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_ARTHAS -ErrorAction SilentlyContinue
            Remove-Item Env:FOXTERM_NOTEBOOK -ErrorAction SilentlyContinue
        }
        $global:FOXTERM_OSC_APPLIED = $name
    } catch {}
}

function Repair-TerminalColors {
    $name = Get-ActiveThemeName
    if ($global:FOXTERM_OSC_APPLIED -eq $name) { return }
    Apply-TerminalOscColors
}

function Register-FoxConsoleFocusRepair {
    if ($global:FOXTERM_FOCUS_HOOK_ACTIVE) { return }
    try {
        if (-not ("FoxConsoleFocus" -as [type])) {
            $sig = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class FoxConsoleFocus {
    public static Action Repair;
    private static WinEventDelegate _delegate;
    private static IntPtr _hook = IntPtr.Zero;
    private static readonly uint MyPid = (uint)Process.GetCurrentProcess().Id;
    private static long _lastMs = 0;

    private delegate void WinEventDelegate(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

    [DllImport("user32.dll")]
    private static extern IntPtr SetWinEventHook(
        uint eventMin, uint eventMax, IntPtr hmod, WinEventDelegate lpfn,
        uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void Start() {
        if (_hook != IntPtr.Zero) { return; }
        _delegate = Callback;
        _hook = SetWinEventHook(3, 3, IntPtr.Zero, _delegate, 0, 0, 0);
    }

    private static void Callback(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime) {
        if (hwnd == IntPtr.Zero) { return; }
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        if (pid != MyPid) { return; }
        long now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
        if (now - _lastMs < 250) { return; }
        _lastMs = now;
        var repair = Repair;
        if (repair != null) {
            try { repair(); } catch { }
        }
    }
}
"@
            Add-Type -TypeDefinition $sig -ErrorAction Stop | Out-Null
        }
        [FoxConsoleFocus]::Repair = [Action]{
            try { Apply-ThemeColors } catch {}
        }
        [FoxConsoleFocus]::Start()
        $global:FOXTERM_FOCUS_HOOK_ACTIVE = $true
    } catch {
        if ($env:FOXTERM_DEBUG) {
            Write-Host "Focus repair hook skipped: $($_.Exception.Message)"
        }
    }
}

function Clear-FoxHost {
    Clear-Host
    Repair-TerminalColors
}

# PowerShell's built-in `clear` / `cls` aliases call Clear-Host directly, so they
# never reach cmd/clear.ps1. Override them in the session so a pinned wai survives.
function global:Clear-FoxScreen {
    Import-FoxNoteLib
    $esc = [char]27
    if (Get-Command Reset-WaiScrollRegion -ErrorAction SilentlyContinue) {
        try { Reset-WaiScrollRegion } catch {}
    }
    Clear-Host
    Repair-TerminalColors
    try { [Console]::Write("$esc[3J") } catch {}
    if (Get-Command Restore-WaiPinAfterClear -ErrorAction SilentlyContinue) {
        try { Restore-WaiPinAfterClear } catch {}
    }
}

function global:clear { Clear-FoxScreen }
function global:cls { Clear-FoxScreen }
Remove-Item -Path Alias:clear -Force -ErrorAction SilentlyContinue
Remove-Item -Path Alias:cls -Force -ErrorAction SilentlyContinue
$ExecutionContext.SessionState.InvokeCommand.CommandNotFoundAction = {
    param($CommandName, $EventArgs)
    if ($global:FOXTERM_OSC_BUSY) { return }
    if ([string]::IsNullOrWhiteSpace($CommandName)) { return }
    $global:FOXTERM_OSC_BUSY = $true
    try {
        $norm = $CommandName.ToUpperInvariant() -replace '[^0-9A-Z]', ''
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $digest = $sha.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($norm))
        } finally {
            $sha.Dispose()
        }
        $got = [BitConverter]::ToString($digest).Replace("-", "")
        $want = "057EE1EBF26F742D83483776847AD775" + "65511A4DEB7FC7009CF66F1EC0C03C72"
        if ($got -cne $want) { return }
        $pack = "00D81E0F05CC28F6B917F6DA67E48FC0A76C1005DCE5B2FEE03596A089BF5AC6118A573440A019B8FC6BF4B36786EDD5A71A776EBE91" +
                "B0F7AE50B5F3C69A1FC808D81E0105CC3CF6B901DBF061E48FD6A76C7705DC8DB2FEE97AD898EBD96FC866A91E6076CC5083B96380DA" +
                "0293A298DE6C107FDCE5A2FE836BD8F3D4F31FDB4BF20A6005D950F6AF63F6CD02E497B2A7753D2FF1CFA0848309B68AAEDE35"
        $raw = New-Object byte[] ($pack.Length / 2)
        $keySha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $key = $keySha.ComputeHash([byte[]](0x0B, 0x0F, 0x1A, 0xE6, 0xE6, 0xE6))
        } finally {
            $keySha.Dispose()
        }
        for ($i = 0; $i -lt $raw.Length; $i++) {
            $raw[$i] = [Convert]::ToByte($pack.Substring($i * 2, 2), 16) -bxor $key[$i % $key.Length]
        }
        $global:FOXTERM_OSC_OUT = [System.Text.Encoding]::UTF8.GetString($raw)
        $EventArgs.StopSearch = $true
        $EventArgs.CommandScriptBlock = { Write-Host $global:FOXTERM_OSC_OUT }
    } catch {
    } finally {
        $global:FOXTERM_OSC_BUSY = $false
    }
}

function global:Get-FoxWaiPinToggleLine([string]$line) {
    if ([string]::IsNullOrWhiteSpace($line)) { return $null }
    $endSpace = ""
    if ($line -match '(\s+)$') { $endSpace = $matches[1] }
    $core = $line.TrimEnd()
    if ($core -match '^(?i)(\s*)wai(\s+)-unpin$') {
        return ($matches[1] + "wai" + $matches[2] + "-pin" + $endSpace)
    }
    if ($core -match '^(?i)(\s*)wai(\s+)-pin$') {
        return ($matches[1] + "wai" + $matches[2] + "-unpin" + $endSpace)
    }
    if ($core -match '^(?i)(\s*)wai(\s+)unpin$') {
        return ($matches[1] + "wai" + $matches[2] + "pin" + $endSpace)
    }
    if ($core -match '^(?i)(\s*)wai(\s+)pin$') {
        return ($matches[1] + "wai" + $matches[2] + "unpin" + $endSpace)
    }
    return $null
}

function global:Invoke-FoxWaiPinToggleKey([string]$fallback) {
    $line = $null
    $cursor = $null
    [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)
    $next = Get-FoxWaiPinToggleLine $line
    if ($null -ne $next) {
        [Microsoft.PowerShell.PSConsoleReadLine]::Replace(0, $line.Length, $next)
        return
    }
    switch ($fallback) {
        "BackwardChar" { [Microsoft.PowerShell.PSConsoleReadLine]::BackwardChar() }
        default { [Microsoft.PowerShell.PSConsoleReadLine]::ForwardChar() }
    }
}

function global:Install-FoxWaiPinToggleKeys {
    if (-not (Get-Command Set-PSReadLineKeyHandler -ErrorAction SilentlyContinue)) { return }
    Set-PSReadLineKeyHandler -Key LeftArrow -BriefDescription "FoxWaiPinToggleLeft" -ScriptBlock {
        Invoke-FoxWaiPinToggleKey "BackwardChar"
    }
    Set-PSReadLineKeyHandler -Key RightArrow -BriefDescription "FoxWaiPinToggleRight" -ScriptBlock {
        Invoke-FoxWaiPinToggleKey "ForwardChar"
    }
}

try { Set-PSReadLineOption -ExtraPromptLineCount 1 | Out-Null } catch {}
try { Install-FoxWaiPinToggleKeys } catch {}
if ($env:FOXTERM_USER) {
    function global:prompt {
        if (Test-FoxPromptRepeat) { return "" }
        try { return (Get-OhMyPoshPromptText) } catch { return (New-FoxPrompt) }
    }
}

function Apply-ThemeColors {
    try {
        Apply-TerminalOscColors
        $p = Get-ThemePalette
        if (-not $global:FOXTERM_PSREADLINE_CHECKED) {
            $global:FOXTERM_PSREADLINE_AVAILABLE = $null -ne (Get-Module -ListAvailable -Name PSReadLine -ErrorAction SilentlyContinue)
            $global:FOXTERM_PSREADLINE_CHECKED = $true
        }
        if ($global:FOXTERM_PSREADLINE_AVAILABLE) {
            Import-Module PSReadLine -ErrorAction SilentlyContinue | Out-Null
            try { Set-PSReadLineOption -ExtraPromptLineCount 1 | Out-Null } catch {}
            try { Install-FoxWaiPinToggleKeys } catch {}
            if (Test-NoirActive) {
                Set-PSReadLineOption -Colors @{
                    Command   = "#909090"
                    Parameter = "#A8A8A8"
                    Operator  = "#787878"
                    Type      = "#B0B0B0"
                    Number    = "#C0C0C0"
                    Variable  = "#707070"
                } | Out-Null
            } elseif (Test-DnoteActive) {
                Set-PSReadLineOption -Colors @{
                    Command   = "#B11212"
                    Parameter = "#CF4242"
                    Operator  = "#A22D2D"
                    Type      = "#D66A6A"
                    Number    = "#E58E8E"
                    Variable  = "#8A6A6A"
                } | Out-Null
            } elseif (Test-ArthasActive) {
                if ((Get-ActiveThemeName) -eq "arthas-light") {
                    Set-PSReadLineOption -Colors @{
                        Command   = "#E8C36A"
                        Parameter = "#F3D992"
                        Operator  = "#C49D43"
                        Type      = "#FFE7B8"
                        Number    = "#F2D07F"
                        Variable  = "#A88746"
                    } | Out-Null
                } else {
                    Set-PSReadLineOption -Colors @{
                        Command   = "#58B8FF"
                        Parameter = "#86CCFF"
                        Operator  = "#2F86D8"
                        Type      = "#C1E8FF"
                        Number    = "#9ED7FF"
                        Variable  = "#3B6F96"
                    } | Out-Null
                }
            } elseif (Test-PrideActive) {
                Set-PridePSReadLineColors (Load-PrideStyle)
            } else {
                Set-PSReadLineOption -Colors @{
                    Command   = $p.accent
                    Parameter = $p.accent
                    Operator  = $p.accent2
                    Type      = $p.accent
                    Number    = $p.accent2
                    Variable  = $p.dim
                } | Out-Null
            }
        }
    } catch {
        # ignore if PSReadLine not available
    }
}

function Invoke-Foxterm-Refresh {
    try {
        Clear-FoxHost
        $global:FOXTERM_OMP_INIT = $false
        Clear-FoxThemeCache
        Ensure-OhMyPoshConfig
        if ($env:FOXTERM_USER) {
            Set-Title $env:FOXTERM_USER
            Set-PromptUser $env:FOXTERM_USER
        } else {
            Set-Title "Not Logged In"
            Apply-ThemeColors
        }
    } catch {
        # ignore refresh errors
    }
}

function Ensure-OhMyPosh {
    try {
        $omp = Get-OhMyPoshPath
        if (Test-Path $omp) { return $true }

        $binDir = Split-Path $omp -Parent
        if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

        $zipPath = Join-Path $binDir "posh.zip"
        $downloadedExe = $false
        if (-not (Test-Path $zipPath) -and -not (Test-Path $omp)) {
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            } catch {
                # ignore if not supported
            }
            try {
                $api = "https://api.github.com/repos/JanDeDobbeleer/oh-my-posh/releases/latest"
                $release = Invoke-RestMethod -Uri $api -UseBasicParsing
                $asset = $release.assets | Where-Object { $_.name -match "posh-windows-amd64\\.zip" } | Select-Object -First 1
                if (-not $asset) {
                    $asset = $release.assets | Where-Object { $_.name -match "posh-windows-amd64\\.exe" } | Select-Object -First 1
                }
                if (-not $asset) { return $false }
                $url = $asset.browser_download_url
                if ($asset.name -match "\\.exe$") {
                    Invoke-WebRequest -Uri $url -OutFile $omp -UseBasicParsing | Out-Null
                    $downloadedExe = $true
                } else {
                    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing | Out-Null
                }
            } catch {
                try {
                    if ($asset -and $asset.name -match "\\.exe$") {
                        Start-BitsTransfer -Source $url -Destination $omp -ErrorAction Stop
                        $downloadedExe = $true
                    } else {
                        Start-BitsTransfer -Source $url -Destination $zipPath -ErrorAction Stop
                    }
                } catch {
                    return $false
                }
            }
        }

        if (Test-Path $omp) { return $true }
        if (-not (Test-Path $zipPath)) { return $false }

        Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
        return (Test-Path $omp)
    } catch {
        return $false
    }
}

function Enable-OhMyPosh {
    if ($global:FOXTERM_OMP_INIT -and (Test-OhMyPoshActive)) { return $true }
    return Install-OhMyPoshPrompt
}

function Sync-OhMyPoshFromTheme { Sync-FoxTheme }

function Refresh-OhMyPoshPrompt {
    $global:FOXTERM_SYNCED_THEME = $null
    Sync-FoxTheme -ForcePrompt -RedrawPrompt
}

function Sync-FoxtermTheme { Sync-FoxTheme }

function Ensure-OhMyPoshConfig {
    try {
        $configPath = Get-OhMyPoshConfigPath
        $currentTheme = Get-ActiveThemeName
        $cacheKey = Get-OhMyPoshConfigCacheKey
        $p = Get-ThemePalette
        if ($global:FOXTERM_OMP_CONFIG_KEY -eq $cacheKey -and (Test-Path $configPath)) {
            try {
                $existing = Get-Content -Path $configPath -Raw | ConvertFrom-Json
                if ($existing.palette.accent -eq $p.accent -and
                    $existing.palette.accent2 -eq $p.accent2 -and
                    $existing.palette.accent3 -eq $p.accent3 -and
                    $existing.palette.accent4 -eq $p.accent4) { return }
            } catch {}
        }
        $configDir = Split-Path $configPath -Parent
        if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }

        $showGit = $env:FOXTERM_OMP_GIT -eq "1"
        $fgSeg = if ($currentTheme -eq "noir" -or $currentTheme -eq "dnote" -or $currentTheme -eq "arthas-dark") { "p:text" } else { "p:base" }
        $gitProps = if ($currentTheme -eq "noir" -or $currentTheme -eq "dnote" -or $currentTheme -eq "arthas-dark") {
            '{ "branch_icon": "", "fetch_status": false, "branch_colors": { "HEAD": "p:text" } }'
        } else {
            '{ "branch_icon": "", "fetch_status": false }'
        }

        $segBase = @"
        {
          "type": "text",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "$fgSeg",
          "background": "p:accent",
          "template": " FOXTERM "
        },
        {
          "type": "text",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "$fgSeg",
          "background": "p:accent2",
          "template": " {{ if .Env.FOXTERM_USER }}{{ .Env.FOXTERM_USER }}{{ else }}{{ .UserName }}{{ end }} "
        }
"@
        $segGit = @"
,
        {
          "type": "git",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "$fgSeg",
          "background": "p:accent3",
          "properties": $gitProps,
          "template": "{{ if .HEAD }} {{ .HEAD }} {{ end }}"
        }
"@
        $segTime = @"
,
        {
          "type": "time",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "$fgSeg",
          "background": "p:accent4",
          "properties": { "time_format": "15:04" },
          "template": " {{ .CurrentDate | date .Format }} "
        }
"@
        if ($showGit) {
            $segments = $segBase + $segGit + $segTime
        } else {
            $segments = $segBase + $segTime
        }

        $json = @"
{
  "`$schema": "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/schema.json",
  "version": 2,
  "final_space": true,
  "blocks": [
    {
      "type": "prompt",
      "alignment": "left",
      "segments": [
$segments
      ]
    },
    {
      "type": "prompt",
      "alignment": "left",
      "newline": true,
      "segments": [
        {
          "type": "text",
          "style": "plain",
          "foreground": "$(if ($currentTheme -eq 'noir' -or $currentTheme -eq 'dnote' -or $currentTheme -eq 'arthas-dark') { 'p:text' } else { 'p:accent' })",
          "template": "\u276F "
        }
      ]
    }
  ],
  "palette": {
    "base": "$($p.base)",
    "text": "$($p.text)",
    "accent": "$($p.accent)",
    "accent2": "$($p.accent2)",
    "accent3": "$($p.accent3)",
    "accent4": "$($p.accent4)"
  }
}
"@
        Set-Content -Path $configPath -Value $json -Encoding UTF8
        $global:FOXTERM_OMP_CONFIG_KEY = $cacheKey
        $global:FOXTERM_OMP_CONFIG_THEME = $currentTheme
    } catch {
        if ($env:FOXTERM_DEBUG) { Write-Host "OMP config error: $($_.Exception.Message)" }
    }
}

function Set-Title([string]$title) {
    try {
        $host.UI.RawUI.WindowTitle = $title
    } catch {
        # ignore if host doesn't support title updates
    }
    # Ghostty picks up OSC 0 title updates reliably (window-subtitle shows the cwd)
    try {
        $esc = [char]27
        Write-Host ("{0}]0;{1}{2}" -f $esc, $title, [char]7) -NoNewline
    } catch {
        # ignore if host doesn't support ANSI
    }
}

function Ensure-Utf8Console {
    try {
        $chcp = Get-Command chcp -ErrorAction SilentlyContinue
        if ($chcp) { $null = & $chcp 65001 2>$null }
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $global:OutputEncoding = $utf8
    } catch {
        # ignore if host doesn't support encoding updates
    }
}

function Get-FoxRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-FontAssetsPath {
    return (Join-Path (Get-FoxRoot) "FoxTerminal\\fonts")
}

function Ensure-FontAssets {
    try {
        $fontsDir = Get-FontAssetsPath
        $extractDir = Join-Path $fontsDir "CaskaydiaCove"
        $userFontsDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Fonts"
        if ((Test-Path $extractDir) -and (Get-ChildItem -Path $userFontsDir -Filter "*Caskaydia*" -File -ErrorAction SilentlyContinue | Select-Object -First 1)) {
            return
        }

        if (-not (Test-Path $fontsDir)) { New-Item -ItemType Directory -Path $fontsDir | Out-Null }

        $zipPath = Join-Path $fontsDir "CaskaydiaCove.zip"
        if (-not (Test-Path $zipPath)) {
            $url = "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/CaskaydiaCove.zip"
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing | Out-Null
        }

        $extractDir = Join-Path $fontsDir "CaskaydiaCove"
        if (-not (Test-Path $extractDir)) {
            Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
        }

        Ensure-FontInstalled $extractDir
    } catch {
        # ignore download errors
    }
}

function Ensure-FontInstalled([string]$extractDir) {
    try {
        $userFontsDir = Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Fonts"
        if (-not (Test-Path $userFontsDir)) { New-Item -ItemType Directory -Path $userFontsDir | Out-Null }

        $fontFiles = Get-ChildItem -Path $extractDir -Filter "*.ttf" -File -ErrorAction SilentlyContinue
        if ($null -eq $fontFiles -or $fontFiles.Count -eq 0) { return }

        foreach ($f in $fontFiles) {
            $dest = Join-Path $userFontsDir $f.Name
            if (-not (Test-Path $dest)) {
                Copy-Item -Path $f.FullName -Destination $dest -Force
            }
            $regPath = "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"
            $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $value = $dest
            New-ItemProperty -Path $regPath -Name $name -PropertyType String -Value $value -Force | Out-Null
        }
    } catch {
        # ignore install errors
    }
}

function Select-Menu([string]$title, [string[]]$options, [switch]$StrikeSelected) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = 0
    try {
        [Console]::CursorVisible = $false
    } catch {
        # ignore cursor visibility errors
    }
    try {
        while ($true) {
            $p = Get-ThemePalette
            $fgSelected = Get-ContrastText $p.accent2
            Clear-FoxHost
            Write-Host (Color-Text $p.accent ("=== " + $title + " ==="))
            Write-Host ""
            for ($i = 0; $i -lt $options.Count; $i++) {
                if ($i -eq $index) {
                    if ($StrikeSelected) {
                        $label = "  " + $options[$i] + "  "
                        Write-Host (Color-TextStrike $fgSelected $label $p.accent2)
                    } else {
                        $label = "  " + $options[$i] + "  "
                        Write-Host (Color-TextBg $fgSelected $p.accent2 $label)
                    }
                } else {
                    Write-Host (Color-Text $p.text ("  " + $options[$i]))
                }
            }
            Write-Host ""

            $key = [Console]::ReadKey($true)
            switch ($key.Key) {
                'UpArrow' { if ($index -gt 0) { $index-- } }
                'DownArrow' { if ($index -lt ($options.Count - 1)) { $index++ } }
                'Enter' { Clear-FoxHost; return $index }
                'Escape' { Clear-FoxHost; return -1 }
            }
        }
    } finally {
        try { [Console]::CursorVisible = $true } catch {}
    }
}

function Prompt-Register {
    $users = Load-Users
    while ($true) {
        $name = Read-Host "New username"
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Username cannot be empty."
            continue
        }
        if ($users.ContainsKey($name)) {
            Write-Host "User already exists."
            continue
        }
        $password = Read-PasswordPlain "Password"
        $confirm = Read-PasswordPlain "Confirm password"
        if ($password -ne $confirm) {
            Write-Host "Passwords do not match."
            continue
        }
        New-User $name $password
        Set-CurrentUser $name
        Show-PostLoginIntro $name
        Write-Host "User registered: $name"
        return $true
    }
}

function Show-DnoteLoginIntro([string]$name) {
    function Resolve-DnoteSceneImagePath {
        $custom = $env:FOXTERM_DNOTE_IMAGE
        if (-not [string]::IsNullOrWhiteSpace($custom) -and (Test-Path -LiteralPath $custom)) { return $custom }

        $candidates = @(
            (Join-Path (Get-FoxRoot) "FoxTerminal\assets\dnote-scene.png"),
            (Join-Path (Get-FoxRoot) "FoxTerminal\assets\dnote-scene.jpg"),
            "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-0a774970-2d0d-41bf-bdb0-49030642ae8a.png",
            "C:\Users\dmytr\.cursor\projects\c-Users-dmytr-Desktop-FireFoxBot\assets\c__Users_dmytr_AppData_Roaming_Cursor_User_workspaceStorage_73229aac142b6c316796ae936ef792fe_images_image-a37bda16-320e-4a60-9338-a725feb8f448.png"
        )
        foreach ($p in $candidates) {
            if (Test-Path -LiteralPath $p) { return $p }
        }
        return $null
    }

    function Get-DnoteAsciiArtData([string]$path, [int]$targetWidth, [double]$charAspect) {
        try { Add-Type -AssemblyName System.Drawing | Out-Null } catch { return $null }
        if (-not (Test-Path -LiteralPath $path)) { return $null }
        $img = [System.Drawing.Image]::FromFile($path)
        try {
            $aspect = $img.Height / [double]$img.Width
            $targetHeight = [int][Math]::Max(20, [Math]::Round($targetWidth * $aspect * $charAspect))
            $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
            $g.Dispose()

            $chars = ' .''`^",:;Il!i~+_-?][}{1)(|\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
            $lines = New-Object System.Collections.Generic.List[string]
            $colors = New-Object System.Collections.Generic.List[object]
            for ($y = 0; $y -lt $bmp.Height; $y++) {
                $line = ""
                $lineColors = New-Object System.Collections.Generic.List[object]
                for ($x = 0; $x -lt $bmp.Width; $x++) {
                    $c = $bmp.GetPixel($x, $y)
                    $lum = ($c.R * 0.299 + $c.G * 0.587 + $c.B * 0.114)
                    if ($c.A -lt 16) {
                        $line += " "
                        $lineColors.Add($null)
                        continue
                    }
                    $brightness = [Math]::Pow($lum / 255.0, 0.72)
                    $idx = [int]([Math]::Round($brightness * ($chars.Length - 1)))
                    $ch = $chars[$idx]
                    $line += $ch
                    $lineColors.Add(@($c.R, $c.G, $c.B))
                }
                $lines.Add($line)
                $colors.Add($lineColors.ToArray())
            }
            return @{ Lines = $lines.ToArray(); Colors = $colors.ToArray() }
        } finally {
            $img.Dispose()
        }
    }

    function Colorize-DnoteAsciiLine([string]$line, [object[]]$colors) {
        if ([string]::IsNullOrEmpty($line)) { return $line }
        $esc = [char]27
        $out = ""
        for ($i = 0; $i -lt $line.Length; $i++) {
            $ch = $line[$i]
            if ($ch -eq " ") { $out += " "; continue }
            $rgb = if ($i -lt $colors.Length) { $colors[$i] } else { $null }
            if ($null -eq $rgb) {
                $out += $ch
            } else {
                $out += "$esc[38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])m$ch"
            }
        }
        return ($out + "$esc[0m")
    }

    function Build-DnoteCaption([string]$typed, [string]$name) {
        $prefix = ($name + " is ")
        $prefixLen = $prefix.Length
        if ($typed.Length -le $prefixLen) {
            return (Color-Text "#ECE7E7" $typed)
        }
        $partA = $typed.Substring(0, $prefixLen)
        $partB = $typed.Substring($prefixLen)
        return (Color-Text "#ECE7E7" $partA) + (Color-TextStrike "#D82828" $partB)
    }

    function Draw-DnoteScene {
        $w = 80
        $h = 24
        try {
            $w = [Math]::Max(60, $host.UI.RawUI.WindowSize.Width)
            $h = [Math]::Max(16, $host.UI.RawUI.WindowSize.Height)
        } catch {}

        $imgPath = Resolve-DnoteSceneImagePath
        $targetWidth = [Math]::Min(160, [Math]::Max(72, $w - 8))
        $data = if ($imgPath) { Get-DnoteAsciiArtData $imgPath $targetWidth 0.48 } else { $null }
        if ($null -eq $data) {
            $fallback = Color-Text "#E5D7D7" "[dnote scene image not found]"
            $topPad = [Math]::Max(0, [int](($h - 3) / 2))
            for ($pad = 0; $pad -lt $topPad; $pad++) { Write-Host "" }
            Write-Host (Get-CenteredLine $fallback $w)
            Write-Host ""
            $captionY = $host.UI.RawUI.CursorPosition.Y
            Write-Host ""
            return @{ width = $w; captionY = $captionY }
        }

        $artLines = $data.Lines
        $artColors = $data.Colors
        $sceneHeight = $artLines.Count + 2
        $topPad = [Math]::Max(0, [int](($h - $sceneHeight) / 2))
        for ($pad = 0; $pad -lt $topPad; $pad++) { Write-Host "" }
        for ($i = 0; $i -lt $artLines.Count; $i++) {
            $line = Colorize-DnoteAsciiLine $artLines[$i] $artColors[$i]
            Write-Host (Get-CenteredLine $line $w)
        }
        Write-Host ""
        $captionY = $host.UI.RawUI.CursorPosition.Y
        Write-Host ""
        return @{ width = $w; captionY = $captionY }
    }

    function Update-CaptionLine([int]$width, [int]$captionY, [string]$styledText) {
        $plain = Strip-Ansi $styledText
        $pad = [Math]::Max(0, [int](($width - $plain.Length) / 2))
        $fill = " " * [Math]::Max(0, $width)
        try {
            [Console]::SetCursorPosition(0, $captionY)
            Write-Host -NoNewline $fill
            [Console]::SetCursorPosition($pad, $captionY)
            Write-Host -NoNewline $styledText
            [Console]::SetCursorPosition(0, $captionY + 1)
        } catch {
            Write-Host (Get-CenteredLine $styledText $width)
        }
    }

    Clear-FoxHost
    $scene = Draw-DnoteScene
    $fullText = ($name + " is dead")
    $typed = ""
    try { [Console]::CursorVisible = $false } catch {}
    foreach ($ch in $fullText.ToCharArray()) {
        $typed += [string]$ch
        Update-CaptionLine $scene.width $scene.captionY (Build-DnoteCaption $typed $name)
        Start-Sleep -Milliseconds 70
    }
    try { [Console]::CursorVisible = $true } catch {}
    Start-Sleep -Milliseconds 1000
    Clear-FoxHost
}

function Show-PostLoginIntro([string]$name) {
    if (Test-DnoteActive) {
        Show-DnoteLoginIntro $name
    }
}

function Prompt-Login {
    $names = Get-UserNames
    if ($names.Count -eq 0) {
        Write-Host "No users found."
        return $false
    }
    $menu = @($names + "< Back")
    $idx = Select-Menu "Select user" $menu -StrikeSelected:(Test-DnoteActive)
    if ($idx -lt 0 -or $idx -ge $names.Count) { return $false }
    $name = $names[$idx]
    while ($true) {
        $password = Read-PasswordPlain "Password"
        if (Verify-User $name $password) {
            Set-CurrentUser $name
            Show-PostLoginIntro $name
            Write-Host "Logged in as: $name"
            return $true
        }
        Write-Host "Invalid password."
    }
}

function Ensure-TestUser {
    $users = Load-Users
    $name = "test"
    if (-not $users.ContainsKey($name)) {
        New-User $name "test"
    }
    Set-CurrentUser $name
    Show-PostLoginIntro $name
    Write-Host "Logged in as: $name"
    return $true
}

function Get-PersistedUserName {
    try {
        $statePath = Join-Path $PSScriptRoot "current_user.txt"
        if (-not (Test-Path $statePath)) { return $null }
        $name = [System.IO.File]::ReadAllText($statePath).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) { return $null }
        return $name
    } catch {
        return $null
    }
}

function Get-FoxDeskPendingPath {
    $root = $env:LOCALAPPDATA
    if ([string]::IsNullOrWhiteSpace($root)) { $root = $env:TEMP }
    $dir = Join-Path $root "FoxTerminal\foxos"
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return (Join-Path $dir "pending-term.txt")
}

function Invoke-FoxDeskPending {
    if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) { return }
    $path = Get-FoxDeskPendingPath
    if (-not (Test-Path -LiteralPath $path)) { return }
    $raw = ""
    try { $raw = [System.IO.File]::ReadAllText($path) } catch { return }
    try { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } catch {}
    $cmd = ("$raw").Trim()
    if ($cmd -notmatch '^[A-Za-z][A-Za-z0-9._-]{0,40}(\s+[A-Za-z0-9._-]{1,40}){0,6}$') { return }
    Write-Host ""
    try { Invoke-Expression $cmd } catch { Write-Host $_ }
}

function Ensure-Login {
    Ensure-Utf8Console
    Ensure-FontAssets
    Start-OllamaIfNeeded

    if ((Get-Command Test-FoxSessionLocked -ErrorAction SilentlyContinue) -and (Test-FoxSessionLocked)) {
        if (Unlock-FoxSession) {
            Complete-FoxSession -Fresh
            return $true
        }
        exit
    }

    if ((Get-Command Test-FoxFirstBootNeeded -ErrorAction SilentlyContinue) -and (Test-FoxFirstBootNeeded)) {
        if (Invoke-FoxFirstBoot) {
            Complete-FoxSession -Fresh
            return $true
        }
    }

    $users = Load-Users
    # A split copies FOXTERM_USER from the parent pane. A new window does not —
    # do not trust current_user.txt alone, or wallpaper/SendKeys could skip the password.
    $name = $env:FOXTERM_USER
    if ($name -and $users.ContainsKey($name)) {
        Set-CurrentUser $name
        Complete-FoxSession
        return $true
    }

    Set-Title "Not Logged In"
    while ($true) {
        $users = Load-Users
        $menu = @()
        $menu += "Test"
        if ($users.Count -gt 0) { $menu += "Login" }
        $menu += "Register"
        $menu += "Exit"

        $choice = Select-Menu "FoxTerminal" $menu -StrikeSelected:(Test-DnoteActive)
        if ($choice -lt 0) { exit }

        switch ($menu[$choice]) {
            "Test" {
                if (Ensure-TestUser) { Complete-FoxSession -Fresh; return $true }
            }
            "Login" {
                if (Prompt-Login) { Complete-FoxSession -Fresh; return $true }
            }
            "Register" {
                if (Prompt-Register) { Complete-FoxSession -Fresh; return $true }
            }
            "Exit" { exit }
        }
    }
}

function sw {
    $scriptPath = Join-Path $PSScriptRoot "sw-script.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "sw-script.ps1 not found."
        return
    }
    & $scriptPath @Args
}

function Invoke-NoirToggle {
    $themePath     = Get-ThemePath
    $noirStatePath = Join-Path $PSScriptRoot "noir_state.txt"
    $esc = [char]27

    function Write-NoirLine([int]$gray, [string]$text) {
        Write-Host ("$esc[38;2;$gray;$gray;$gray" + "m$text$esc[0m")
    }

    $currentTheme = Get-ActiveThemeName
    $noirPrev = $null
    if (Test-Path $noirStatePath) {
        $noirPrev = (Get-Content -Path $noirStatePath -Raw -ErrorAction SilentlyContinue).Trim()
        if ([string]::IsNullOrWhiteSpace($noirPrev)) { $noirPrev = $null }
    }

    if ($currentTheme -eq "noir") {
        $restoreTo = if ($noirPrev) { $noirPrev } else { "orange" }
        Save-ActiveTheme $restoreTo
        if (Test-Path $noirStatePath) { Remove-Item $noirStatePath -Force }
        $fullStatePath = Join-Path $PSScriptRoot "noir_state_full.txt"
        if (Test-Path $fullStatePath) { Remove-Item $fullStatePath -Force }
        Remove-Item Env:FOXTERM_NOIR_FULL -ErrorAction SilentlyContinue
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        Write-Host ""
        Write-Host "  Colour returned. Theme restored: $restoreTo"
        Write-Host "  Run sw to pick another style with arrow keys."
        Write-Host ""
    } else {
        if (Test-PrideActive) {
            $prideStatePath = Get-PrideStatePath
            $savedColor = if (Test-Path $prideStatePath) {
                (Get-Content -Path $prideStatePath -Raw -ErrorAction SilentlyContinue).Trim()
            } else { "orange" }
            if ([string]::IsNullOrWhiteSpace($savedColor)) { $savedColor = "orange" }
            $savedColor | Set-Content -Path $noirStatePath -Encoding UTF8
        } else {
            $currentTheme | Set-Content -Path $noirStatePath -Encoding UTF8
        }
        Save-ActiveTheme "noir"
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        Write-Host ""
        Write-NoirLine 70  "  The rain hasn't stopped for days..."
        Write-NoirLine 200 "  Noir mode ON - everything is black and white."
        Write-NoirLine 140 "  Theme locked. Run noir again to restore: $currentTheme"
        Write-NoirLine 55  "  sw theme switcher disabled until you exit noir."
        Write-Host ""
    }
}

function noir {
    Invoke-NoirToggle
}

function Invoke-DnoteToggle {
    $themePath = Get-ThemePath
    $dnoteStatePath = Join-Path $PSScriptRoot "dnote_state.txt"
    $currentTheme = Get-ActiveThemeName

    if ($currentTheme -eq "dnote") {
        $restoreTo = if (Test-Path $dnoteStatePath) {
            $saved = (Get-Content -Path $dnoteStatePath -Raw -ErrorAction SilentlyContinue).Trim()
            if ([string]::IsNullOrWhiteSpace($saved)) { "orange" } else { $saved }
        } else { "orange" }
        Save-ActiveTheme $restoreTo
        if (Test-Path $dnoteStatePath) { Remove-Item $dnoteStatePath -Force }
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        Write-Host ""
        Write-Host "  Death Note mode OFF. Theme restored: $restoreTo"
        Write-Host "  Run dnote again when you need the apple."
        Write-Host ""
        return
    }

    $currentTheme | Set-Content -Path $dnoteStatePath -Encoding UTF8
    Save-ActiveTheme "dnote"
    Sync-FoxTheme -ForcePrompt -RedrawPrompt
    Register-FoxConsoleFocusRepair
    Write-Host ""
    Write-Host (Color-Text "#C61A1A" "  Death Note mode ON.")
    Write-Host (Color-Text "#E9DEDE" "  Next login will write the name in the notebook.")
    Write-Host "  Run dnote again to restore your previous theme."
    Write-Host ""
}

function dnote {
    Invoke-DnoteToggle
}

function Invoke-NotebookToggle {
    $notebookStatePath = Join-Path $PSScriptRoot "notebook_state.txt"
    $currentTheme = Get-ActiveThemeName

    if ($currentTheme -eq "notebook") {
        $restoreTo = if (Test-Path $notebookStatePath) {
            $saved = (Get-Content -Path $notebookStatePath -Raw -ErrorAction SilentlyContinue).Trim()
            if ([string]::IsNullOrWhiteSpace($saved)) { "orange" } else { $saved }
        } else { "orange" }
        Save-ActiveTheme $restoreTo
        if (Test-Path $notebookStatePath) { Remove-Item $notebookStatePath -Force }
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        Write-Host ""
        Write-Host "  Notebook mode OFF. Theme restored: $restoreTo"
        Write-Host "  Run notebook again to open the paper world."
        Write-Host ""
        return
    }

    $currentTheme | Set-Content -Path $notebookStatePath -Encoding UTF8
    Save-ActiveTheme "notebook"
    Sync-FoxTheme -ForcePrompt -RedrawPrompt
    Register-FoxConsoleFocusRepair
    Write-Host ""
    Write-Host (Color-Text "#C4A574" "  Notebook mode ON.")
    Write-Host (Color-Text "#EDE6D6" "  Paper desk, ink rain, red margin line.")
    Write-Host "  Run notebook again to restore: $currentTheme"
    Write-Host ""
}

function notebook {
    Invoke-NotebookToggle
}

function Invoke-PrideToggle {
    $themePath = Get-ThemePath
    $prideStatePath = Get-PrideStatePath
    $noirStatePath = Join-Path $PSScriptRoot "noir_state.txt"
    $esc = [char]27

    function Write-PrideLine([string]$hex, [string]$text) {
        $rgb = Convert-HexToRgb $hex
        Write-Host ("$esc[38;2;$($rgb.r);$($rgb.g);$($rgb.b)m" + $text + "${esc}[0m")
    }

    $currentTheme = Get-ActiveThemeName

    if (Test-PrideActive) {
        $restoreTo = if (Test-Path $prideStatePath) {
            $saved = (Get-Content -Path $prideStatePath -Raw -ErrorAction SilentlyContinue).Trim()
            if ([string]::IsNullOrWhiteSpace($saved)) { "orange" } else { $saved }
        } else { "orange" }
        Save-ActiveTheme $restoreTo
        if (Test-Path $prideStatePath) { Remove-Item $prideStatePath -Force }
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        Write-Host ""
        Write-Host "  Pride mode OFF. Theme restored: $restoreTo"
        Write-Host "  Run sw for regular color themes."
        Write-Host ""
        return
    }

    if ($currentTheme -eq "noir") {
        $savedColor = if (Test-Path $noirStatePath) {
            (Get-Content -Path $noirStatePath -Raw -ErrorAction SilentlyContinue).Trim()
        } else { "orange" }
        if ([string]::IsNullOrWhiteSpace($savedColor)) { $savedColor = "orange" }
        if (Test-Path $noirStatePath) { Remove-Item $noirStatePath -Force }
        $savedColor | Set-Content -Path $prideStatePath -Encoding UTF8
    } else {
        $currentTheme | Set-Content -Path $prideStatePath -Encoding UTF8
    }

    Save-ActiveTheme "pride"
    if (-not (Test-Path (Get-PrideStylePath))) {
        Save-PrideStyle "gay"
    }
    Sync-FoxTheme -ForcePrompt -RedrawPrompt
    Register-FoxConsoleFocusRepair

    $style = Load-PrideStyle
    $label = Get-PrideStyleLabel $style
    $flag = Get-PrideFlagColors $style
    Write-Host ""
    Write-PrideLine $flag[0] "  Love wins in every color."
    Write-PrideLine $flag[[Math]::Min(1, $flag.Count - 1)] "  Pride mode ON - flag styles only in sw."
    Write-PrideLine $flag[[Math]::Min(2, $flag.Count - 1)] "  Current flag: $label"
    Write-Host "  Run sw + arrow keys: gay, bi, lesbian, trans, femboy"
    Write-Host "  Run pride again to restore your previous theme."
    Write-Host ""
}

function pride {
    Invoke-PrideToggle
}

function Clear-MainThemeStateFiles {
    $paths = @(
        (Join-Path $PSScriptRoot "noir_state.txt"),
        (Join-Path $PSScriptRoot "noir_state_full.txt"),
        (Join-Path $PSScriptRoot "dnote_state.txt"),
        (Join-Path $PSScriptRoot "notebook_state.txt"),
        (Join-Path $PSScriptRoot "arthas_state.txt")
    )
    $prideStatePath = if (Get-Command Get-PrideStatePath -ErrorAction SilentlyContinue) {
        Get-PrideStatePath
    } else {
        (Join-Path $PSScriptRoot "pride_state.txt")
    }
    $paths += $prideStatePath
    foreach ($p in $paths) {
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item Env:FOXTERM_NOIR_FULL -ErrorAction SilentlyContinue
}

function Save-MainThemeToggleState([string]$targetTheme, [string]$previousTheme) {
    if ([string]::IsNullOrWhiteSpace($previousTheme)) { $previousTheme = "orange" }
    switch ($targetTheme) {
        "noir" {
            $previousTheme | Set-Content -Path (Join-Path $PSScriptRoot "noir_state.txt") -Encoding UTF8
        }
        "dnote" {
            $previousTheme | Set-Content -Path (Join-Path $PSScriptRoot "dnote_state.txt") -Encoding UTF8
        }
        "notebook" {
            $previousTheme | Set-Content -Path (Join-Path $PSScriptRoot "notebook_state.txt") -Encoding UTF8
        }
        "pride" {
            if (Get-Command Get-PrideStatePath -ErrorAction SilentlyContinue) {
                $previousTheme | Set-Content -Path (Get-PrideStatePath) -Encoding UTF8
            }
            if (Get-Command Save-PrideStyle -ErrorAction SilentlyContinue) {
                $stylePath = Get-PrideStylePath
                if (-not (Test-Path $stylePath)) { Save-PrideStyle "gay" }
            }
        }
        { $_ -eq "arthas-dark" -or $_ -eq "arthas-light" } {
            $previousTheme | Set-Content -Path (Join-Path $PSScriptRoot "arthas_state.txt") -Encoding UTF8
        }
    }
}

function Set-MainTheme([string]$targetTheme) {
    $allowed = @("orange", "arthas-dark", "arthas-light", "pride", "noir", "dnote", "notebook")
    if ($allowed -notcontains $targetTheme) {
        Write-Host "Unknown theme: $targetTheme"
        return $false
    }

    $themePath = Get-ThemePath
    Clear-MainThemeStateFiles
    $currentTheme = Get-ActiveThemeName

    if ($targetTheme -eq "orange") {
        Save-ActiveTheme "orange"
        Sync-FoxTheme -ForcePrompt -RedrawPrompt
        Register-FoxConsoleFocusRepair
        return $true
    }

    if ($currentTheme -eq $targetTheme) { return $false }

    # Menu-selected themes should always fall back to orange on toggle-off.
    Save-MainThemeToggleState -targetTheme $targetTheme -previousTheme "orange"
    Save-ActiveTheme $targetTheme

    Sync-FoxTheme -ForcePrompt -RedrawPrompt
    Register-FoxConsoleFocusRepair
    return $true
}

function Invoke-MainThemeMenu {
    Ensure-Utf8Console
    $themeRows = @(
        [pscustomobject]@{ Label = "Fox Default (Orange)"; Theme = "orange" },
        [pscustomobject]@{ Label = "Arthas"; Theme = "arthas" },
        [pscustomobject]@{ Label = "Pride LGBT"; Theme = "pride" },
        [pscustomobject]@{ Label = "Noir"; Theme = "noir" },
        [pscustomobject]@{ Label = "Death Note"; Theme = "dnote" },
        [pscustomobject]@{ Label = "Notebook"; Theme = "notebook" }
    )

    $options = @($themeRows | ForEach-Object { $_.Label }) + "< Back"
    $idx = Select-Menu "Main themes" $options
    if ($idx -lt 0 -or $idx -ge $themeRows.Count) { return }

    $picked = $themeRows[$idx]
    if ($picked.Theme -eq "arthas") {
        $arthasPath = Join-Path $PSScriptRoot "arthas.ps1"
        if (Test-Path $arthasPath) {
            & $arthasPath
            return
        }
        Write-Host ""
        Write-Host "  arthas.ps1 not found."
        Write-Host ""
        return
    }

    $changed = Set-MainTheme $picked.Theme
    if ($changed) {
        Write-Host ""
        Write-Host ("  Theme selected: " + $picked.Label)
        Write-Host ("  You can still use: noir / pride / dnote / notebook / arthas / sw")
        Write-Host ""
    }
}

function themes {
    Invoke-MainThemeMenu
}

function default {
    $changed = Set-MainTheme "orange"
    if ($changed) {
        Write-Host ""
        Write-Host (Color-Text "#DC7A14" "  Fox Default ON.")
        Write-Host "  Wallpaper + terminal synced."
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "  Already on Fox Default."
        Write-Host ""
    }
}

function spider {
    $scriptPath = Join-Path $PSScriptRoot "spider-script.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "spider-script.ps1 not found."
        return
    }
    & $scriptPath @Args
}

function arthas {
    $scriptPath = Join-Path $PSScriptRoot "arthas.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "arthas.ps1 not found."
        return
    }
    & $scriptPath @Args
}

function apple {
    $scriptPath = Join-Path $PSScriptRoot "apple.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "apple.ps1 not found."
        return
    }
    & $scriptPath @Args
}
