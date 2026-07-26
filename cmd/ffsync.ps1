param(
    [ValidateSet("start", "stop", "status", "shell", "exec", "help")]
    [string]$Action = "status",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args,
    [switch]$RunDaemon
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$syncRoot = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session"
$requestsDir = Join-Path $syncRoot "requests"
$responsesDir = Join-Path $syncRoot "responses"
$pidPath = Join-Path $syncRoot "daemon.pid"
$stopPath = Join-Path $syncRoot "stop.flag"
$statePath = Join-Path $syncRoot "state.json"
$eventsPath = Join-Path $syncRoot "events.ndjson"
$terminalInboxDir = Join-Path $syncRoot "terminal-inbox"
$currentUserPath = Join-Path $PSScriptRoot "current_user.txt"

function Ensure-SyncLayout {
    foreach ($path in @($syncRoot, $requestsDir, $responsesDir, $terminalInboxDir)) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
}

function Write-JsonNoBom([string]$Path, $Object) {
    $json = $Object | ConvertTo-Json -Depth 12
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Write-NdjsonLine([string]$Path, $Object) {
    $line = ($Object | ConvertTo-Json -Depth 12 -Compress) + [Environment]::NewLine
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($Path, $line, $utf8NoBom)
}

function Read-State {
    if (-not (Test-Path $statePath)) {
        return @{
            currentDirectory = $repoRoot
            seq = 0
        }
    }

    try {
        $raw = Get-Content -Path $statePath -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return @{
                currentDirectory = $repoRoot
                seq = 0
            }
        }
        $obj = $raw | ConvertFrom-Json -ErrorAction Stop
        $cwd = [string]$obj.currentDirectory
        if ([string]::IsNullOrWhiteSpace($cwd) -or -not (Test-Path $cwd)) {
            $cwd = $repoRoot
        }
        $seqValue = 0
        if ($null -ne $obj.seq) {
            $seqValue = [int]$obj.seq
        }
        return @{
            currentDirectory = $cwd
            seq = $seqValue
        }
    } catch {
        return @{
            currentDirectory = $repoRoot
            seq = 0
        }
    }
}

function Save-State([hashtable]$State) {
    Write-JsonNoBom -Path $statePath -Object @{
        currentDirectory = $State.currentDirectory
        seq = $State.seq
        updatedAt = (Get-Date).ToString("o")
    }
}

function Get-RunningDaemonPid {
    if (-not (Test-Path $pidPath)) {
        return $null
    }

    try {
        $raw = (Get-Content -Path $pidPath -Raw -ErrorAction Stop).Trim()
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

function Test-DaemonRunning {
    return ($null -ne (Get-RunningDaemonPid))
}

function Write-Response([string]$Id, [hashtable]$Payload) {
    $responsePath = Join-Path $responsesDir ($Id + ".json")
    Write-JsonNoBom -Path $responsePath -Object $Payload
}

function Get-SessionUserName {
    if (-not (Test-Path $currentUserPath)) {
        $usersPath = Join-Path $PSScriptRoot "users.json"
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
    $sessionUser = Get-SessionUserName
    if ([string]::IsNullOrWhiteSpace($sessionUser)) {
        return
    }
    $env:FOXTERM_USER = $sessionUser
}

function Normalize-DispatchLine([string]$Line) {
    if ($null -eq $Line) { return "" }
    $s = $Line.Trim()
    while ($s.StartsWith("^") -or $s.StartsWith(">")) {
        $s = $s.Substring(1).TrimStart()
    }
    return $s
}

function Get-CommandToken([string]$Line) {
    $normalized = Normalize-DispatchLine $Line
    if ([string]::IsNullOrWhiteSpace($normalized)) { return $null }
    $parts = $normalized -split '\s+', 2
    if ($parts.Count -eq 0) { return $null }
    return ($parts[0].Trim().Trim('"').Trim("'"))
}

function Resolve-CmdCommandScript([string]$CommandName) {
    if ([string]::IsNullOrWhiteSpace($CommandName)) { return $null }
    $candidates = @(
        (Join-Path $PSScriptRoot ($CommandName + ".bat")),
        (Join-Path $PSScriptRoot ($CommandName + ".cmd")),
        (Join-Path $PSScriptRoot ($CommandName + ".ps1"))
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }
    return $null
}

function Get-BatchLinkedScriptPaths([string]$BatchPath) {
    if ([string]::IsNullOrWhiteSpace($BatchPath) -or -not (Test-Path -LiteralPath $BatchPath)) {
        return @()
    }

    $result = New-Object System.Collections.Generic.List[string]
    try {
        $raw = Get-Content -Path $BatchPath -Raw -ErrorAction Stop
    } catch {
        return @()
    }

    $patterns = @(
        '(?im)-File\s+"%~dp0[\\/]*(?<name>[^"]+\.ps1)"',
        "(?im)-File\s+'%~dp0[\\/]*(?<name>[^']+\.ps1)'",
        '(?im)-File\s+%~dp0[\\/]*(?<name>[^\s]+\.ps1)'
    )

    $batchDir = Split-Path -Path $BatchPath -Parent
    foreach ($pattern in $patterns) {
        $matches = [regex]::Matches($raw, $pattern)
        foreach ($match in $matches) {
            $name = [string]$match.Groups["name"].Value
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            $candidate = Join-Path $batchDir ($name -replace '/', '\')
            if (Test-Path -LiteralPath $candidate) {
                $result.Add($candidate)
            }
        }
    }

    return @($result | Sort-Object -Unique)
}

function Test-CommandIsInteractive([string]$ScriptPath) {
    if ([string]::IsNullOrWhiteSpace($ScriptPath)) { return $false }
    $inspectPaths = @($ScriptPath)
    $ext = [System.IO.Path]::GetExtension($ScriptPath).ToLowerInvariant()
    if ($ext -eq ".bat" -or $ext -eq ".cmd") {
        $ps1Path = [System.IO.Path]::ChangeExtension($ScriptPath, ".ps1")
        if (Test-Path -LiteralPath $ps1Path) {
            $inspectPaths += $ps1Path
        }
        $linked = @(Get-BatchLinkedScriptPaths -BatchPath $ScriptPath)
        if ($linked.Count -gt 0) {
            $inspectPaths += $linked
        }
    }

    foreach ($path in @($inspectPaths | Sort-Object -Unique)) {
        try {
            $raw = Get-Content -Path $path -Raw -ErrorAction Stop
            if ($raw -match '\[Console\]::ReadKey|Read-Host|KeyAvailable|Select-Menu|Invoke-[A-Za-z0-9_-]*Menu|Invoke-[A-Za-z0-9_-]*Hotkeys|Press any key|Ctrl\+E to exit|tmux\s+attach-session|dialog\s+--|mintty|--noprofile\s+--rcfile\s+.+\s+-i') {
                return $true
            }
        } catch {}
    }
    return $false
}

function Test-TerminalOnlyCommand([string]$Line) {
    $token = Get-CommandToken $Line
    if ([string]::IsNullOrWhiteSpace($token)) { return $false }
    $scriptPath = Resolve-CmdCommandScript -CommandName $token
    if ([string]::IsNullOrWhiteSpace($scriptPath)) { return $false }
    return (Test-CommandIsInteractive -ScriptPath $scriptPath)
}

function Queue-TerminalOnlyCommand([string]$Id, [string]$Line) {
    Ensure-SyncLayout
    $normalizedLine = Normalize-DispatchLine $Line
    $inboxPath = Join-Path $terminalInboxDir ($Id + ".json")
    Write-JsonNoBom -Path $inboxPath -Object @{
        id = $Id
        line = $normalizedLine
        source = "sidebar"
        queuedAt = (Get-Date).ToString("o")
    }
}

function Invoke-DaemonCommand([hashtable]$State, [string]$Line) {
    $commandLine = Normalize-DispatchLine $Line
    if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return @{
            ok = $true
            exitCode = 0
            cwd = $State.currentDirectory
            output = ""
            clear = $false
        }
    }

    if ($commandLine -ieq "clear") {
        return @{
            ok = $true
            exitCode = 0
            cwd = $State.currentDirectory
            output = ""
            clear = $true
        }
    }

    if ($commandLine -match '^(?i:cd)(?:\s+(.+))?$') {
        $targetRaw = $Matches[1]
        $nextPath = $null
        if ([string]::IsNullOrWhiteSpace($targetRaw)) {
            $nextPath = [Environment]::GetFolderPath("UserProfile")
        } else {
            $targetTrim = $targetRaw.Trim().Trim('"')
            $expanded = [Environment]::ExpandEnvironmentVariables($targetTrim)
            if ([System.IO.Path]::IsPathRooted($expanded)) {
                $nextPath = $expanded
            } else {
                $nextPath = Join-Path $State.currentDirectory $expanded
            }
        }
        try {
            $resolved = (Resolve-Path -LiteralPath $nextPath -ErrorAction Stop).Path
            $State.currentDirectory = $resolved
            return @{
                ok = $true
                exitCode = 0
                cwd = $State.currentDirectory
                output = ""
                clear = $false
            }
        } catch {
            return @{
                ok = $false
                exitCode = 1
                cwd = $State.currentDirectory
                output = "Path not found: $targetRaw"
                clear = $false
            }
        }
    }

    if ($commandLine -ieq "pwd") {
        return @{
            ok = $true
            exitCode = 0
            cwd = $State.currentDirectory
            output = $State.currentDirectory
            clear = $false
        }
    }

    try {
        Apply-SessionUser
        Set-Location -LiteralPath $State.currentDirectory
    } catch {
        Set-Location -LiteralPath $repoRoot
        $State.currentDirectory = (Get-Location).Path
    }

    $safeCmdRoot = $PSScriptRoot -replace "'", "''"
    $safeCwd = $State.currentDirectory -replace "'", "''"
    $safeUser = if ($env:FOXTERM_USER) { $env:FOXTERM_USER -replace "'", "''" } else { "" }
    $sessionAssign = ""
    if (-not [string]::IsNullOrWhiteSpace($safeUser)) {
        $sessionAssign = "`$env:FOXTERM_USER = '$safeUser'; "
    }
    $scriptText = "`$env:PATH = '$safeCmdRoot;' + `$env:PATH; $sessionAssign" +
        "Set-Location -LiteralPath '$safeCwd'; $commandLine"

    $records = @()
    $exitCode = 1
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $records = @(& powershell -NoProfile -ExecutionPolicy Bypass -Command $scriptText 2>&1)
        $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
    } catch {
        $records = @($_.Exception.Message)
        $exitCode = 1
    } finally {
        $ErrorActionPreference = $prevEap
    }
    $output = ($records | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine

    return @{
        ok = ($exitCode -eq 0)
        exitCode = $exitCode
        cwd = $State.currentDirectory
        output = $output.Trim()
        clear = $false
    }
}

function Run-Daemon {
    Ensure-SyncLayout
    $env:FOXTERM_SYNC_CONTEXT = "daemon"
    if (($env:PATH -split ';') -notcontains $PSScriptRoot) {
        $env:PATH = $PSScriptRoot + ";" + $env:PATH
    }
    Apply-SessionUser
    if (Test-Path $stopPath) {
        Remove-Item -Path $stopPath -Force -ErrorAction SilentlyContinue
    }

    $existingPid = Get-RunningDaemonPid
    if ($null -ne $existingPid -and $existingPid -ne $PID) {
        Write-Host "ffsync daemon already running (PID: $existingPid)."
        return
    }

    Set-Content -Path $pidPath -Value $PID -Encoding ASCII
    $state = Read-State
    Save-State -State $state

    try {
        while ($true) {
            if (Test-Path $stopPath) {
                Remove-Item -Path $stopPath -Force -ErrorAction SilentlyContinue
                break
            }

            $files = @(Get-ChildItem -Path $requestsDir -Filter "*.json" -File -ErrorAction SilentlyContinue | Sort-Object Name)
            if ($null -eq $files -or $files.Count -eq 0) {
                Start-Sleep -Milliseconds 130
                continue
            }

            foreach ($file in $files) {
                $id = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $request = $null
                try {
                    $request = (Get-Content -Path $file.FullName -Raw -ErrorAction Stop) | ConvertFrom-Json -ErrorAction Stop
                } catch {
                    Write-Response -Id $id -Payload @{
                        id = $id
                        ok = $false
                        exitCode = 1
                        cwd = $state.currentDirectory
                        output = "Bad request payload."
                        clear = $false
                        source = "daemon"
                    }
                    Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                    continue
                }

                $line = [string]$request.line
                $source = if ($request.source) { [string]$request.source } else { "unknown" }
                if ($source -eq "sidebar" -and (Test-TerminalOnlyCommand $line)) {
                    Queue-TerminalOnlyCommand -Id $id -Line $line
                    $result = @{
                        ok = $true
                        exitCode = 0
                        cwd = $state.currentDirectory
                        output = "[forwarded] command queued for right terminal: $line"
                        clear = $false
                    }
                } else {
                    try {
                        $result = Invoke-DaemonCommand -State $state -Line $line
                    } catch {
                        $result = @{
                            ok = $false
                            exitCode = 1
                            cwd = $state.currentDirectory
                            output = $_.Exception.Message
                            clear = $false
                        }
                    }
                }
                $state.seq = [int]$state.seq + 1
                Save-State -State $state

                $payload = @{
                    id = $id
                    seq = [int]$state.seq
                    line = $line
                    ok = [bool]$result.ok
                    exitCode = [int]$result.exitCode
                    cwd = [string]$result.cwd
                    output = [string]$result.output
                    clear = [bool]$result.clear
                    source = $source
                    timestamp = (Get-Date).ToString("o")
                }

                Write-Response -Id $id -Payload $payload
                Write-NdjsonLine -Path $eventsPath -Object $payload
                Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
            }
        }
    } finally {
        if (Test-Path $pidPath) {
            $pidRaw = (Get-Content -Path $pidPath -Raw -ErrorAction SilentlyContinue).Trim()
            if ($pidRaw -eq [string]$PID) {
                Remove-Item -Path $pidPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Start-Daemon {
    Ensure-SyncLayout
    $running = Get-RunningDaemonPid
    if ($null -ne $running) {
        Write-Host "ffsync daemon is already running (PID: $running)."
        return
    }

    $self = $PSCommandPath
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $self,
        "-RunDaemon"
    ) -WindowStyle Hidden | Out-Null

    $started = $null
    $deadline = [DateTime]::UtcNow.AddMilliseconds(3500)
    while ([DateTime]::UtcNow -lt $deadline) {
        $started = Get-RunningDaemonPid
        if ($null -ne $started) { break }
        Start-Sleep -Milliseconds 150
    }
    if ($null -eq $started) {
        throw "Failed to start ffsync daemon."
    }
    Write-Host "ffsync daemon started (PID: $started)."
}

function Stop-Daemon {
    $daemonPid = Get-RunningDaemonPid
    if ($null -eq $daemonPid) {
        Write-Host "ffsync daemon is not running."
        return
    }
    Ensure-SyncLayout
    Set-Content -Path $stopPath -Value "stop" -Encoding ASCII
    Start-Sleep -Milliseconds 550
    if (Test-DaemonRunning) {
        Write-Host "Stop signal sent. Daemon will stop shortly."
    } else {
        Write-Host "ffsync daemon stopped."
    }
}

function Get-DaemonStatus {
    $daemonPid = Get-RunningDaemonPid
    if ($null -eq $daemonPid) {
        Write-Host "ffsync daemon: OFFLINE"
        return
    }
    $state = Read-State
    Write-Host "ffsync daemon: ONLINE (PID: $daemonPid)"
    Write-Host ("cwd: " + $state.currentDirectory)
    Write-Host ("seq: " + [int]$state.seq)
}

function Send-CommandRequest([string]$Line, [string]$Source = "terminal-client", [int]$TimeoutMs = 30000) {
    if (-not (Test-DaemonRunning)) {
        throw "ffsync daemon is offline. Run: ffsync start"
    }
    Ensure-SyncLayout

    $id = [Guid]::NewGuid().ToString("N")
    $requestPath = Join-Path $requestsDir ($id + ".json")
    $responsePath = Join-Path $responsesDir ($id + ".json")

    $request = @{
        id = $id
        line = $Line
        source = $Source
        requestedAt = (Get-Date).ToString("o")
    }

    Write-JsonNoBom -Path $requestPath -Object $request

    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-Path $responsePath) {
            $raw = Get-Content -Path $responsePath -Raw -ErrorAction Stop
            Remove-Item -Path $responsePath -Force -ErrorAction SilentlyContinue
            return ($raw | ConvertFrom-Json -ErrorAction Stop)
        }
        Start-Sleep -Milliseconds 120
    }

    throw "Timed out waiting for daemon response."
}

function Run-SharedShell {
    if (-not (Test-DaemonRunning)) {
        Start-Daemon
    }

    Write-Host "Connected to ffsync shared shell."
    Write-Host "Type commands. Use 'exit' to close."

    while ($true) {
        $state = Read-State
        $promptPath = $state.currentDirectory
        $line = Read-Host ("FFSYNC " + $promptPath + ">")
        if ($null -eq $line) { continue }
        $trimmed = $line.Trim()
        if ($trimmed -ieq "exit") { break }
        if ($trimmed -ieq "help") {
            Write-Host "Special: exit, help"
            continue
        }

        try {
            $response = Send-CommandRequest -Line $line -Source "terminal-client"
            if ($response.clear -eq $true) {
                Clear-Host
                continue
            }
            if (-not [string]::IsNullOrWhiteSpace([string]$response.output)) {
                if ($response.ok -eq $true) {
                    Write-Host ([string]$response.output)
                } else {
                    Write-Host ([string]$response.output) -ForegroundColor Red
                }
            }
        } catch {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
}

function Show-Help {
    Write-Host "ffsync usage:"
    Write-Host "  ffsync start"
    Write-Host "  ffsync stop"
    Write-Host "  ffsync status"
    Write-Host "  ffsync shell"
    Write-Host "  ffsync exec <command line>"
}

if ($RunDaemon) {
    Run-Daemon
    exit 0
}

$selected = $Action.ToLowerInvariant()
switch ($selected) {
    "start" { Start-Daemon; break }
    "stop" { Stop-Daemon; break }
    "status" { Get-DaemonStatus; break }
    "shell" { Run-SharedShell; break }
    "exec" {
        if ($null -eq $Args -or $Args.Count -eq 0) {
            throw "Usage: ffsync exec <command line>"
        }
        $line = ($Args -join " ").Trim()
        $response = Send-CommandRequest -Line $line -Source "terminal-client"
        if ($response.clear -eq $true) {
            Clear-Host
        } elseif (-not [string]::IsNullOrWhiteSpace([string]$response.output)) {
            if ($response.ok -eq $true) {
                Write-Host ([string]$response.output)
            } else {
                Write-Host ([string]$response.output) -ForegroundColor Red
            }
        }
        if ($response.ok -ne $true) { exit 1 }
        break
    }
    "help" { Show-Help; break }
    default { Show-Help; break }
}
