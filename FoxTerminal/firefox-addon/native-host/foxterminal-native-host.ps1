Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$cmdRoot = Join-Path $repoRoot "cmd"
$sharedRoot = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session"
$sharedRequestsDir = Join-Path $sharedRoot "requests"
$sharedResponsesDir = Join-Path $sharedRoot "responses"
$sharedPidPath = Join-Path $sharedRoot "daemon.pid"
$sharedStatePath = Join-Path $sharedRoot "state.json"
$sharedEventsPath = Join-Path $sharedRoot "events.ndjson"
$currentUserPath = Join-Path $cmdRoot "current_user.txt"
$script:TerminalState = @{
    CurrentDirectory = $repoRoot
}

function Write-NativeMessage([hashtable]$Payload) {
    $stdout = [Console]::OpenStandardOutput()
    $json = $Payload | ConvertTo-Json -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $size = [BitConverter]::GetBytes([int]$bytes.Length)
    $stdout.Write($size, 0, $size.Length)
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}

function Read-ExactBytes([System.IO.Stream]$Stream, [int]$Length) {
    $buffer = New-Object byte[] $Length
    $offset = 0
    while ($offset -lt $Length) {
        $read = $Stream.Read($buffer, $offset, $Length - $offset)
        if ($read -le 0) {
            return $null
        }
        $offset += $read
    }
    return $buffer
}

function Read-NativeMessage {
    $stdin = [Console]::OpenStandardInput()
    $lenBytes = Read-ExactBytes -Stream $stdin -Length 4
    if ($null -eq $lenBytes) {
        return $null
    }
    $len = [BitConverter]::ToInt32($lenBytes, 0)
    if ($len -lt 1 -or $len -gt 1048576) {
        throw "Invalid message length: $len"
    }

    $bodyBytes = Read-ExactBytes -Stream $stdin -Length $len
    if ($null -eq $bodyBytes) {
        return $null
    }

    $json = [System.Text.Encoding]::UTF8.GetString($bodyBytes)
    return ($json | ConvertFrom-Json)
}

function Normalize-Args($RawArgs) {
    if ($null -eq $RawArgs) {
        return @()
    }
    if ($RawArgs -is [string]) {
        return @([string]$RawArgs)
    }
    if (-not ($RawArgs -is [System.Collections.IEnumerable])) {
        throw "args must be an array of strings."
    }

    $result = New-Object System.Collections.Generic.List[string]
    foreach ($arg in $RawArgs) {
        if ($null -eq $arg) {
            throw "args cannot contain null values."
        }
        $value = [string]$arg
        if ($value.Length -gt 512) {
            throw "args item is too long."
        }
        $result.Add($value)
    }
    return @($result)
}

function Get-SharedDaemonPid {
    if (-not (Test-Path $sharedPidPath)) {
        return $null
    }

    try {
        $raw = (Get-Content -Path $sharedPidPath -Raw -ErrorAction Stop).Trim()
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        $procId = [int]$raw
        $proc = Get-Process -Id $procId -ErrorAction Stop
        if ($proc.HasExited) {
            return $null
        }
        return $procId
    } catch {
        return $null
    }
}

function Test-SharedDaemonRunning {
    return ($null -ne (Get-SharedDaemonPid))
}

function Get-SessionUserName {
    if (-not (Test-Path $currentUserPath)) {
        $usersPath = Join-Path $cmdRoot "users.json"
        if (Test-Path $usersPath) {
            try {
                $rawUsers = Get-Content -Path $usersPath -Raw -ErrorAction Stop
                if (-not [string]::IsNullOrWhiteSpace($rawUsers)) {
                    $parsed = $rawUsers | ConvertFrom-Json -ErrorAction Stop
                    $keys = @($parsed.PSObject.Properties.Name)
                    if ($keys.Count -gt 0) {
                        if ($keys -contains "test") { return "test" }
                        return [string]$keys[0]
                    }
                }
            } catch {}
        }
        return $null
    }
    try {
        $name = (Get-Content -Path $currentUserPath -Raw -ErrorAction Stop).Trim()
        if ([string]::IsNullOrWhiteSpace($name)) { return $null }
        return $name
    } catch {
        return $null
    }
}

function Apply-SessionUser {
    $name = Get-SessionUserName
    if (-not [string]::IsNullOrWhiteSpace($name)) {
        $env:FOXTERM_USER = $name
    }
}

function Ensure-SharedDaemon {
    if (Test-SharedDaemonRunning) {
        return $true
    }

    $ffsync = Join-Path $cmdRoot "ffsync.ps1"
    if (-not (Test-Path $ffsync)) {
        return $false
    }

    try {
        Apply-SessionUser
        & powershell -NoProfile -ExecutionPolicy Bypass -File $ffsync start | Out-Null
    } catch {}

    $deadline = [DateTime]::UtcNow.AddMilliseconds(2200)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-SharedDaemonRunning) {
            return $true
        }
        Start-Sleep -Milliseconds 120
    }
    return $false
}

function Write-JsonNoBom([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 12
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function ConvertFrom-HexRgb([string]$Hex) {
    $h = ([string]$Hex).Trim().TrimStart("#")
    if ($h.Length -ne 6) { return @(11, 15, 26) }
    return @(
        [Convert]::ToInt32($h.Substring(0, 2), 16),
        [Convert]::ToInt32($h.Substring(2, 2), 16),
        [Convert]::ToInt32($h.Substring(4, 2), 16)
    )
}

function ConvertTo-HexRgb([int]$R, [int]$G, [int]$B) {
    $clamp = { param($n) [Math]::Max(0, [Math]::Min(255, [int][Math]::Round($n))) }
    return "#{0:X2}{1:X2}{2:X2}" -f (& $clamp $R), (& $clamp $G), (& $clamp $B)
}

function Mix-HexColor([string]$From, [string]$To, [double]$AmountTo) {
    $a = ConvertFrom-HexRgb $From
    $b = ConvertFrom-HexRgb $To
    $t = [Math]::Max(0.0, [Math]::Min(1.0, $AmountTo))
    return ConvertTo-HexRgb `
        (($a[0] * (1 - $t)) + ($b[0] * $t)) `
        (($a[1] * (1 - $t)) + ($b[1] * $t)) `
        (($a[2] * (1 - $t)) + ($b[2] * $t))
}

function Set-UserPrefLine([string]$PrefsPath, [string]$Name, [string]$ValueLiteral) {
    if ([string]::IsNullOrWhiteSpace($PrefsPath) -or -not (Test-Path -LiteralPath $PrefsPath)) {
        return $false
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $content = [System.IO.File]::ReadAllText($PrefsPath)
    $line = 'user_pref("{0}", {1});' -f $Name, $ValueLiteral
    $pattern = 'user_pref\(\s*"' + [regex]::Escape($Name) + '"\s*,\s*[^)]*\)\s*;'
    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, $line)
    } else {
        if (-not $content.EndsWith("`n")) { $content += "`n" }
        $content += $line + "`n"
    }
    [System.IO.File]::WriteAllText($PrefsPath, $content, $utf8NoBom)
    return $true
}

function Get-ZenExePath {
    foreach ($candidate in @(
            (Join-Path ${env:ProgramFiles} "Zen Browser\zen.exe"),
            (Join-Path $env:LOCALAPPDATA "Zen Browser\zen.exe"),
            (Join-Path $env:LOCALAPPDATA "Programs\Zen Browser\zen.exe")
        )) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    $cmd = Get-Command zen -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }
    return $null
}

function Start-ZenThemeApplyRestart(
    [string[]]$ProfilePaths,
    [string]$Accent,
    [string]$Accent2,
    [string]$Bg,
    [string]$UserChromeCss
) {
    # Native host is a child of Zen — kill/restart must be detached or this process dies mid-reply.
    $zenExe = Get-ZenExePath
    if (-not $zenExe) { return $false }

    $pyScript = Join-Path $PSScriptRoot "apply-zen-workspace-theme.py"
    $runnerScript = Join-Path $PSScriptRoot "apply-zen-theme-restart.ps1"
    $payload = @{
        zenExe = $zenExe
        accent = $Accent
        accent2 = $Accent2
        bg = $Bg
        profiles = @($ProfilePaths)
        pyScript = $pyScript
        userChromeCss = $UserChromeCss
    }
    $tmp = Join-Path $env:TEMP ("foxterm-zen-theme-" + [Guid]::NewGuid().ToString("N") + ".json")
    Write-JsonNoBom -Path $tmp -Object $payload

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $runnerScript, "-PayloadPath", $tmp
    ) -WindowStyle Hidden | Out-Null
    return $true
}

function Build-FoxZenChromeCss(
    [string]$Accent,
    [string]$Accent2,
    [string]$ChromeBg,
    [string]$ChromePanel,
    [string]$ChromePanel2,
    [string]$ChromeBorder,
    [string]$Text,
    [string]$Dim,
    [string]$AccentHover,
    [string]$AccentGlow
) {
    $grad = "linear-gradient(-45deg, $Accent 0%, $Accent2 45%, $ChromeBg 100%)"
    $gradToolbar = "linear-gradient(130deg, $ChromePanel 0%, $Accent 140%)"
    return @"
/* FoxTerminal dynamic Zen theme */
:root, html, #main-window, #browser, #tabbrowser-tabbox {
  --zen-primary-color: $Accent !important;
  --zen-primary-color-fg: #ffffff !important;
  --zen-colors-primary: $Accent !important;
  --zen-colors-secondary: $Accent2 !important;
  --zen-colors-tertiary: $ChromePanel !important;
  --zen-colors-border: $ChromeBorder !important;
  --zen-main-browser-background: $grad !important;
  --zen-main-browser-background-toolbar: $gradToolbar !important;
  --zen-dialog-background: $ChromePanel !important;
  --zen-branding-bg: $ChromeBg !important;
  --zen-themed-toolbar-bg: $ChromeBg !important;
  --zen-themed-toolbar-bg-transparent: $ChromeBg !important;
  --zen-toolbar-element-bg: $ChromePanel2 !important;
  --lwt-accent-color: $ChromeBg !important;
  --lwt-text-color: $Text !important;
  --toolbar-bgcolor: $ChromeBg !important;
  --toolbar-color: $Text !important;
  --tab-selected-bgcolor: $Accent !important;
  --focus-outline-color: $Accent !important;
  --toolbox-textcolor: $Text !important;
}

/* Zen paints these two nodes with inline CSS variables — override both var + paint */
#zen-browser-background,
#zen-toolbar-background {
  --zen-main-browser-background: $grad !important;
  --zen-main-browser-background-toolbar: $gradToolbar !important;
  --zen-background-opacity: 1 !important;
  background: $grad !important;
  background-color: $ChromeBg !important;
  background-image: $grad !important;
  opacity: 1 !important;
}
#zen-toolbar-background {
  background: $gradToolbar !important;
  background-image: $gradToolbar !important;
}

#main-window, #browser, #tabbrowser-tabbox, #tabbrowser-tabpanels,
#navigator-toolbox, #nav-bar, #PersonalToolbar, #TabsToolbar, #titlebar,
#zen-appcontent-navbar-wrapper, #zen-sidebar-panels-wrapper, #zen-tabbox-wrapper,
#zen-main-app-wrapper, #sidebar-box, #sidebar-header,
#zen-essentials, #zen-sidebar-icons-wrapper, #zen-tabs-wrapper,
#zen-current-workspace-indicator, .browserSidebarContainer,
#zen-sidebar-foot-buttons, #statuspanel, #statuspanel-label,
.zen-workspace-tabs-section, #tabbrowser-tabs, #TabsToolbar-customization-target {
  background-color: $ChromeBg !important;
  background-image: none !important;
  color: $Text !important;
  border-color: $ChromeBorder !important;
}

#zen-tabbox-wrapper,
#tabbrowser-tabpanels,
.browserSidebarContainer,
#browser {
  background: $ChromeBg !important;
}

#nav-bar { border-bottom: 1px solid $ChromeBorder !important; }
#urlbar-background, #searchbar {
  background-color: $ChromePanel2 !important;
  border: 1px solid $ChromeBorder !important;
  border-radius: 10px !important;
  box-shadow: none !important;
}
#urlbar[focused="true"] > #urlbar-background, #urlbar[open] > #urlbar-background {
  border-color: $Accent !important;
  box-shadow: 0 0 0 1px $AccentGlow !important;
}
.tabbrowser-tab .tab-background { border-radius: 10px !important; }
.tabbrowser-tab:hover .tab-background { background-color: $AccentHover !important; }
.tabbrowser-tab[selected="true"] .tab-background,
.tabbrowser-tab[visuallyselected="true"] .tab-background {
  background: linear-gradient(130deg, $Accent, $Accent2) !important;
}
.tab-label, .tab-text { color: $Dim !important; }
.tabbrowser-tab[selected="true"] .tab-label,
.tabbrowser-tab[visuallyselected="true"] .tab-label {
  color: #ffffff !important;
  font-weight: 700 !important;
}
toolbarbutton, .toolbarbutton-1 { fill: $Dim !important; color: $Dim !important; }
toolbarbutton:hover, .toolbarbutton-1:hover {
  background-color: $AccentHover !important;
  fill: $Text !important;
  color: $Text !important;
}
"@
}

function Invoke-SharedCommand([string]$Line, [string]$Source, [int]$TimeoutMs = 30000) {
    if (-not (Test-SharedDaemonRunning)) {
        return $null
    }

    if (-not (Test-Path $sharedRequestsDir) -or -not (Test-Path $sharedResponsesDir)) {
        return $null
    }

    $id = [Guid]::NewGuid().ToString("N")
    $requestPath = Join-Path $sharedRequestsDir ($id + ".json")
    $responsePath = Join-Path $sharedResponsesDir ($id + ".json")

    $payload = @{
        id = $id
        line = $Line
        source = $Source
        requestedAt = (Get-Date).ToString("o")
    }
    Write-JsonNoBom -Path $requestPath -Object $payload

    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path $responsePath) {
            try {
                $raw = Get-Content -Path $responsePath -Raw -ErrorAction Stop
                Remove-Item -Path $responsePath -Force -ErrorAction SilentlyContinue
                return ($raw | ConvertFrom-Json -ErrorAction Stop)
            } catch {
                Remove-Item -Path $responsePath -Force -ErrorAction SilentlyContinue
                throw "Shared response parse failed."
            }
        }
        Start-Sleep -Milliseconds 120
    }

    throw "Shared terminal timed out."
}

function Read-SharedEvents([int]$AfterSeq, [int]$Limit = 60) {
    if (-not (Test-SharedDaemonRunning)) {
        return @()
    }
    if (-not (Test-Path $sharedEventsPath)) {
        return @()
    }

    $rows = @()
    try {
        $lines = Get-Content -Path $sharedEventsPath -Tail 300 -ErrorAction Stop
        foreach ($line in $lines) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            try {
                $obj = $line | ConvertFrom-Json -ErrorAction Stop
                if ([int]$obj.seq -gt $AfterSeq) {
                    $rows += $obj
                }
            } catch {
                continue
            }
        }
    } catch {
        return @()
    }

    return @($rows | Sort-Object seq | Select-Object -First $Limit)
}

function Get-SharedCurrentDirectory {
    if (-not (Test-Path $sharedStatePath)) {
        return $null
    }
    try {
        $raw = Get-Content -Path $sharedStatePath -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        $obj = $raw | ConvertFrom-Json -ErrorAction Stop
        if ($obj.currentDirectory) {
            return [string]$obj.currentDirectory
        }
        return $null
    } catch {
        return $null
    }
}

function Resolve-CmdCommandScript([string]$CommandName) {
    if ([string]::IsNullOrWhiteSpace($CommandName)) {
        return $null
    }
    $candidates = @(
        (Join-Path $cmdRoot ($CommandName + ".bat")),
        (Join-Path $cmdRoot ($CommandName + ".cmd")),
        (Join-Path $cmdRoot ($CommandName + ".ps1"))
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }
    return $null
}

function Quote-CommandArgument([string]$Value) {
    if ($null -eq $Value) { return "''" }
    if ($Value -match '^[A-Za-z0-9_./:\\-]+$') { return $Value }
    $escaped = $Value.Replace("'", "''")
    return "'$escaped'"
}

function Build-CommandLine([string]$CommandName, [string[]]$CommandArgs) {
    $parts = New-Object System.Collections.Generic.List[string]
    $parts.Add((Quote-CommandArgument -Value $CommandName))
    foreach ($arg in $CommandArgs) {
        $parts.Add((Quote-CommandArgument -Value $arg))
    }
    return ($parts -join " ")
}

function Invoke-FoxCommand([string]$CommandName, [string[]]$CommandArgs) {
    $scriptPath = Resolve-CmdCommandScript -CommandName $CommandName
    if ([string]::IsNullOrWhiteSpace($scriptPath) -or -not (Test-Path -LiteralPath $scriptPath)) {
        throw "Command not found in cmd/: $CommandName"
    }

    if (Ensure-SharedDaemon) {
        try {
            $line = Build-CommandLine -CommandName $CommandName -CommandArgs $CommandArgs
            $sharedResult = Invoke-SharedCommand -Line $line -Source "sidebar" -TimeoutMs 30000
            if ($null -ne $sharedResult) {
                return @{
                    ok       = [bool]$sharedResult.ok
                    exitCode = [int]$sharedResult.exitCode
                    output   = [string]$sharedResult.output
                }
            }
        } catch {}
    }

    Push-Location $repoRoot
    try {
        Apply-SessionUser
        if (($env:PATH -split ';') -notcontains $cmdRoot) {
            $env:PATH = $cmdRoot + ";" + $env:PATH
        }
        $lines = & $scriptPath @CommandArgs 2>&1 | ForEach-Object { $_.ToString() }
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
        return @{
            ok       = ($exitCode -eq 0)
            exitCode = $exitCode
            output   = (($lines -join [Environment]::NewLine).Trim())
        }
    } finally {
        Pop-Location
    }
}

function Resolve-TerminalPath([string]$RawPath) {
    if ([string]::IsNullOrWhiteSpace($RawPath)) {
        return [Environment]::GetFolderPath("UserProfile")
    }

    $trimmed = $RawPath.Trim()
    $trimmed = $trimmed.Trim('"')
    $expanded = [Environment]::ExpandEnvironmentVariables($trimmed)

    $candidate = $expanded
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
        $candidate = Join-Path $script:TerminalState.CurrentDirectory $candidate
    }

    try {
        return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
    } catch {
        throw "Path not found: $RawPath"
    }
}

function Invoke-TerminalExec([string]$Line) {
    $rawLine = if ($null -eq $Line) { "" } else { [string]$Line }
    $commandLine = $rawLine.Trim()
    while ($commandLine.StartsWith("^") -or $commandLine.StartsWith(">")) {
        $commandLine = $commandLine.Substring(1).TrimStart()
    }
    $sharedReady = Ensure-SharedDaemon

    if ($sharedReady -and (Test-SharedDaemonRunning)) {
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            $sharedCwd = Get-SharedCurrentDirectory
            if (-not [string]::IsNullOrWhiteSpace($sharedCwd)) {
                return @{
                    ok       = $true
                    exitCode = 0
                    cwd      = $sharedCwd
                    output   = ""
                    mode     = "shared"
                }
            }
        } else {
            $sharedResult = Invoke-SharedCommand -Line $commandLine -Source "sidebar"
            if ($null -ne $sharedResult) {
                return @{
                    ok       = [bool]$sharedResult.ok
                    exitCode = [int]$sharedResult.exitCode
                    cwd      = [string]$sharedResult.cwd
                    output   = [string]$sharedResult.output
                    clear    = [bool]$sharedResult.clear
                    mode     = "shared"
                    seq      = if ($null -ne $sharedResult.seq) { [int]$sharedResult.seq } else { 0 }
                }
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return @{
            ok       = $true
            exitCode = 0
            cwd      = $script:TerminalState.CurrentDirectory
            output   = ""
            mode     = "local"
        }
    }

    if ($commandLine -ieq "clear") {
        return @{
            ok       = $true
            exitCode = 0
            cwd      = $script:TerminalState.CurrentDirectory
            clear    = $true
            output   = ""
            mode     = "local"
        }
    }

    if ($commandLine -match '^(?i:cd)(?:\s+(.+))?$') {
        $targetRaw = $Matches[1]
        $targetPath = Resolve-TerminalPath -RawPath $targetRaw
        $script:TerminalState.CurrentDirectory = $targetPath
        return @{
            ok       = $true
            exitCode = 0
            cwd      = $script:TerminalState.CurrentDirectory
            output   = "Changed directory to $targetPath"
            mode     = "local"
        }
    }

    if ($commandLine -ieq "pwd") {
        return @{
            ok       = $true
            exitCode = 0
            cwd      = $script:TerminalState.CurrentDirectory
            output   = $script:TerminalState.CurrentDirectory
            mode     = "local"
        }
    }

    Apply-SessionUser
    $safeCmdRoot = $cmdRoot -replace "'", "''"
    $safeCwd = $script:TerminalState.CurrentDirectory -replace "'", "''"
    $safeUser = if ($env:FOXTERM_USER) { $env:FOXTERM_USER -replace "'", "''" } else { "" }
    $sessionAssign = ""
    if (-not [string]::IsNullOrWhiteSpace($safeUser)) {
        $sessionAssign = "`$env:FOXTERM_USER = '$safeUser'; "
    }
    $scriptText = "`$env:PATH = '$safeCmdRoot;' + `$env:PATH; $sessionAssign" +
        "Set-Location -LiteralPath '$safeCwd'; $commandLine"

    $lines = & powershell -NoProfile -ExecutionPolicy Bypass -Command $scriptText 2>&1 | ForEach-Object { $_.ToString() }
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) {
        $exitCode = 0
    }

    return @{
        ok       = ($exitCode -eq 0)
        exitCode = $exitCode
        cwd      = $script:TerminalState.CurrentDirectory
        output   = (($lines -join [Environment]::NewLine).Trim())
        mode     = "local"
    }
}

function Test-OllamaReady {
    try {
        $null = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

function Ensure-OllamaRunning {
    if (Test-OllamaReady) {
        return @{
            ok = $true
            ready = $true
            started = $false
            output = "Ollama already running."
        }
    }

    $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    if ($null -eq $ollamaCmd) {
        $candidates = @(
            "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
            "$env:ProgramFiles\Ollama\ollama.exe",
            "${env:ProgramFiles(x86)}\Ollama\ollama.exe"
        )
        foreach ($path in $candidates) {
            if (Test-Path -LiteralPath $path) {
                $ollamaCmd = @{ Source = $path }
                break
            }
        }
    }

    if ($null -eq $ollamaCmd) {
        return @{
            ok = $false
            ready = $false
            started = $false
            error = "Ollama is not installed. Install from https://ollama.com and keep it in PATH."
        }
    }

    $exe = if ($ollamaCmd.Source) { [string]$ollamaCmd.Source } else { "ollama" }
    $env:OLLAMA_ORIGINS = "*"
    try {
        Start-Process -FilePath $exe -ArgumentList @("serve") -WindowStyle Hidden | Out-Null
    } catch {
        # Maybe already starting as app service; keep waiting below.
    }

    $deadline = (Get-Date).AddSeconds(25)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 700
        if (Test-OllamaReady) {
            return @{
                ok = $true
                ready = $true
                started = $true
                output = "Ollama started automatically."
            }
        }
    }

    return @{
        ok = $false
        ready = $false
        started = $true
        error = "Ollama did not become ready on http://127.0.0.1:11434 within 25s."
    }
}

try {
    while ($true) {
        $message = Read-NativeMessage
        if ($null -eq $message) {
            break
        }

        try {
            $type = [string]$message.type
            if ($type -eq "ping") {
                Write-NativeMessage @{
                    ok = $true
                    host = "foxterminal-native-host"
                    version = "0.3.0"
                }
                continue
            }

            if ($type -eq "terminalHello") {
                Apply-SessionUser
                $sharedOnline = Ensure-SharedDaemon
                $helloCwd = if ($sharedOnline) {
                    $candidate = Get-SharedCurrentDirectory
                    if ([string]::IsNullOrWhiteSpace($candidate)) { $script:TerminalState.CurrentDirectory } else { $candidate }
                } else {
                    $script:TerminalState.CurrentDirectory
                }

                Write-NativeMessage @{
                    ok       = $true
                    host     = "foxterminal-native-host"
                    version  = "0.3.0"
                    cwd      = $helloCwd
                    shared   = $sharedOnline
                    mode     = if ($sharedOnline) { "shared" } else { "local" }
                    output   = if ($sharedOnline) { "FoxTerminal side terminal connected (shared session)." } else { "FoxTerminal side terminal connected." }
                    exitCode = 0
                }
                continue
            }

            if ($type -eq "terminalPoll") {
                $afterSeq = 0
                try {
                    if ($null -ne $message.afterSeq) {
                        $afterSeq = [int]$message.afterSeq
                    }
                } catch {
                    $afterSeq = 0
                }

                $events = Read-SharedEvents -AfterSeq $afterSeq -Limit 60
                Write-NativeMessage @{
                    ok = $true
                    events = @($events)
                    shared = (Ensure-SharedDaemon)
                }
                continue
            }

            if ($type -eq "terminalExec") {
                $result = Invoke-TerminalExec -Line ([string]$message.line)
                Write-NativeMessage $result
                continue
            }

            if ($type -eq "runCommand") {
                $commandName = [string]$message.command
                if ([string]::IsNullOrWhiteSpace($commandName) -or $commandName -notmatch '^[a-z][a-z0-9-]{1,31}$') {
                    throw "Invalid command name."
                }

                $commandArgs = Normalize-Args -RawArgs $message.args
                $result = Invoke-FoxCommand -CommandName $commandName -CommandArgs $commandArgs
                Write-NativeMessage $result
                continue
            }

            if ($type -eq "applyZenTheme") {
                $themeObj = $message.theme
                if ($null -eq $themeObj) {
                    throw "applyZenTheme requires theme object."
                }

                $accent = [string]$themeObj.accent
                $accent2 = [string]$themeObj.accent2
                $bg = [string]$themeObj.bg
                if ([string]::IsNullOrWhiteSpace($bg)) { $bg = [string]$themeObj.base }
                $panel = [string]$themeObj.panel
                $panel2 = [string]$themeObj.panel2
                $border = [string]$themeObj.border
                $text = [string]$themeObj.text
                $dim = [string]$themeObj.dim
                if ([string]::IsNullOrWhiteSpace($accent)) { $accent = "#6c8dff" }
                if ([string]::IsNullOrWhiteSpace($accent2)) { $accent2 = $accent }
                if ([string]::IsNullOrWhiteSpace($bg)) { $bg = "#080d17" }
                if ([string]::IsNullOrWhiteSpace($panel)) { $panel = "#0a1222" }
                if ([string]::IsNullOrWhiteSpace($panel2)) { $panel2 = "#111a31" }
                if ([string]::IsNullOrWhiteSpace($border)) { $border = "#1d2a47" }
                if ([string]::IsNullOrWhiteSpace($text)) { $text = "#e7edff" }
                if ([string]::IsNullOrWhiteSpace($dim)) { $dim = "#89a3ff" }

                # Tint chrome surfaces toward accent so Zen's blue gradient shell actually changes hue.
                $chromeBg = Mix-HexColor $bg $accent 0.28
                $chromePanel = Mix-HexColor $panel $accent 0.22
                $chromePanel2 = Mix-HexColor $panel2 $accent 0.18
                $chromeBorder = Mix-HexColor $border $accent 0.35
                $accentRgb = ConvertFrom-HexRgb $accent
                $accentHover = "rgba($($accentRgb[0]), $($accentRgb[1]), $($accentRgb[2]), 0.20)"
                $accentGlow = "rgba($($accentRgb[0]), $($accentRgb[1]), $($accentRgb[2]), 0.35)"

                $css = Build-FoxZenChromeCss -Accent $accent -Accent2 $accent2 `
                    -ChromeBg $chromeBg -ChromePanel $chromePanel -ChromePanel2 $chromePanel2 `
                    -ChromeBorder $chromeBorder -Text $text -Dim $dim `
                    -AccentHover $accentHover -AccentGlow $accentGlow

                $profilesRoot = Join-Path $env:APPDATA "zen\Profiles"
                $updated = New-Object System.Collections.Generic.List[string]
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                if (Test-Path $profilesRoot) {
                    Get-ChildItem -Path $profilesRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                        $chromeDir = Join-Path $_.FullName "chrome"
                        New-Item -ItemType Directory -Force -Path $chromeDir | Out-Null
                        [System.IO.File]::WriteAllText((Join-Path $chromeDir "userChrome.css"), $css, $utf8NoBom)
                        $modsCss = "/* Zen Mods - FoxTerminal bridge */`n$css`n/* End of Zen Mods */`n"
                        [System.IO.File]::WriteAllText((Join-Path $chromeDir "zen-themes.css"), $modsCss, $utf8NoBom)

                        $userJsPath = Join-Path $_.FullName "user.js"
                        $lines = @(
                            'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
                            ('user_pref("zen.theme.accent-color", "{0}");' -f $accent)
                            'user_pref("zen.theme.gradient-show-custom-colors", true);'
                            'user_pref("zen.theme.disable-lightweight", false);'
                            'user_pref("xpinstall.signatures.required", false);'
                        )
                        [System.IO.File]::WriteAllText($userJsPath, ($lines -join "`n") + "`n", $utf8NoBom)

                        $prefsPath = Join-Path $_.FullName "prefs.js"
                        Set-UserPrefLine -PrefsPath $prefsPath -Name "toolkit.legacyUserProfileCustomizations.stylesheets" -ValueLiteral "true" | Out-Null
                        Set-UserPrefLine -PrefsPath $prefsPath -Name "zen.theme.accent-color" -ValueLiteral ('"{0}"' -f $accent) | Out-Null
                        Set-UserPrefLine -PrefsPath $prefsPath -Name "zen.theme.disable-lightweight" -ValueLiteral "false" | Out-Null
                        Set-UserPrefLine -PrefsPath $prefsPath -Name "xpinstall.signatures.required" -ValueLiteral "false" | Out-Null

                        $updated.Add($_.FullName) | Out-Null
                    }
                }

                $restart = $true
                if ($null -ne $message.restart) { $restart = [bool]$message.restart }
                $restartScheduled = $false
                if ($restart -and $updated.Count -gt 0) {
                    $restartScheduled = Start-ZenThemeApplyRestart `
                        -ProfilePaths @($updated.ToArray()) `
                        -Accent $accent `
                        -Accent2 $accent2 `
                        -Bg $bg `
                        -UserChromeCss $css
                }

                Write-NativeMessage @{
                    ok = $true
                    updatedProfiles = @($updated.ToArray())
                    accent = $accent
                    chromeBg = $chromeBg
                    restartScheduled = $restartScheduled
                    note = if ($restartScheduled) {
                        "Zen will restart to apply chrome theme."
                    } else {
                        "Zen chrome CSS written. Restart Zen to apply."
                    }
                }
                continue
            }

            if ($type -eq "ensureOllama") {
                $result = Ensure-OllamaRunning
                Write-NativeMessage $result
                continue
            }

            if ($type -eq "ollamaChat") {
                $ensure = Ensure-OllamaRunning
                if ($ensure.ok -ne $true) {
                    Write-NativeMessage $ensure
                    continue
                }

                $model = if ([string]::IsNullOrWhiteSpace([string]$message.model)) { "gemma3:4b" } else { [string]$message.model }
                $systemPrompt = [string]$message.system
                $userPrompt = [string]$message.user
                if ([string]::IsNullOrWhiteSpace($userPrompt)) {
                    throw "ollamaChat requires user prompt."
                }

                $format = if ($null -ne $message.format -and [string]$message.format -ne "") { [string]$message.format } else { "json" }
                $temperature = 0
                if ($null -ne $message.temperature) {
                    try { $temperature = [double]$message.temperature } catch { $temperature = 0 }
                }
                $numPredict = 260
                if ($null -ne $message.numPredict) {
                    try { $numPredict = [int]$message.numPredict } catch { $numPredict = 260 }
                }
                if ($numPredict -lt 64) { $numPredict = 64 }
                if ($numPredict -gt 4096) { $numPredict = 4096 }

                $payload = @{
                    model = $model
                    stream = $false
                    keep_alive = "60m"
                    options = @{
                        temperature = $temperature
                        num_predict = $numPredict
                    }
                    messages = @(
                        @{ role = "system"; content = $systemPrompt }
                        @{ role = "user"; content = $userPrompt }
                    )
                }
                if ($format -ne "none" -and $format -ne "text") {
                    $payload.format = $format
                }

                $timeoutSec = 90
                if ($null -ne $message.timeoutSec) {
                    try { $timeoutSec = [int]$message.timeoutSec } catch { $timeoutSec = 90 }
                }
                if ($timeoutSec -lt 30) { $timeoutSec = 30 }
                if ($timeoutSec -gt 300) { $timeoutSec = 300 }

                $jsonBody = $payload | ConvertTo-Json -Depth 10 -Compress
                $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/chat" -Method Post -Body $jsonBody -ContentType "application/json; charset=utf-8" -TimeoutSec $timeoutSec
                $content = ""
                if ($null -ne $response.message -and $null -ne $response.message.content) {
                    $content = [string]$response.message.content
                }

                Write-NativeMessage @{
                    ok = $true
                    content = $content
                    model = $model
                    ensured = $ensure
                }
                continue
            }

            throw "Unsupported message type: $type"
        } catch {
            Write-NativeMessage @{
                ok = $false
                error = $_.Exception.Message
            }
        }
    }
} catch {
    Write-NativeMessage @{
        ok = $false
        error = "Host crashed: $($_.Exception.Message)"
    }
}
