param(
    [switch]$IncludeLow,
    [switch]$NoUi,
    [int]$Top = 25,
    [int]$MinAgeMinutes = 2,
    [int]$MinMemoryMB = 180
)

$ErrorActionPreference = "SilentlyContinue"
$script:FoxBgSessionId = $null
try { $script:FoxBgSessionId = (Get-Process -Id $PID).SessionId } catch {}

function fx([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
    Write-Host $Text -ForegroundColor $Color
}

function Get-CriticalProcessNames {
    return @(
        "system", "system idle process", "registry",
        "smss.exe", "csrss.exe", "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe",
        "svchost.exe", "fontdrvhost.exe", "dwm.exe", "sihost.exe", "taskhostw.exe",
        "explorer.exe", "searchhost.exe", "startmenuexperiencehost.exe", "runtimebroker.exe",
        "ctfmon.exe", "conhost.exe", "msmpeng.exe"
    )
}

function Get-HostNames {
    return @(
        "powershell.exe", "pwsh.exe", "cmd.exe",
        "wscript.exe", "cscript.exe", "mshta.exe",
        "node.exe", "python.exe", "pythonw.exe", "java.exe",
        "bash.exe", "sh.exe"
    )
}

function Get-HeavyAppNames {
    return @(
        "discord.exe", "discordcanary.exe", "discordptb.exe",
        "slack.exe", "teams.exe", "telegram.exe", "spotify.exe",
        "steam.exe", "steamwebhelper.exe", "epicgameslauncher.exe",
        "battle.net.exe", "onedrive.exe", "dropbox.exe",
        "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"
    )
}

function Test-NoiseProcess {
    param(
        [string]$Name,
        [string]$CommandLine
    )

    if ($null -eq $Name) { $Name = "" }
    if ($null -eq $CommandLine) { $CommandLine = "" }
    $n = $Name.ToLowerInvariant()
    $cmd = $CommandLine

    if ($n -eq "cursor.exe") { return $true }
    if ($n -eq "windowsterminal.exe") { return $true }

    if ($n -eq "powershell.exe" -or $n -eq "pwsh.exe") {
        if ($cmd -match '(?i)\\appdata\\local\\temp\\ps-script-[^\\ ]+\.ps1') { return $true }
        if ($cmd -match '(?i)\\appdata\\local\\programs\\cursor\\') { return $true }
        if ($cmd -match '(?i)-noexit' -and $cmd -match '(?i)foxterm') { return $true }
    }

    return $false
}

function Format-Uptime([datetime]$StartTime) {
    if (-not $StartTime) { return "n/a" }
    $span = (Get-Date) - $StartTime
    if ($span.TotalDays -ge 1) { return ("{0}d {1}h" -f [int]$span.TotalDays, $span.Hours) }
    if ($span.TotalHours -ge 1) { return ("{0}h {1}m" -f [int]$span.TotalHours, $span.Minutes) }
    return ("{0}m" -f [int][Math]::Max(0, $span.TotalMinutes))
}

function Truncate([string]$Text, [int]$MaxLen = 90) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    if ($Text.Length -le $MaxLen) { return $Text }
    return $Text.Substring(0, $MaxLen - 3) + "..."
}

function Get-SuspicionScore {
    param(
        [string]$Name,
        [string]$CommandLine,
        [datetime]$StartTime,
        [int]$MinAgeMinutes,
        [double]$MemoryMB,
        [bool]$IsBackground,
        [int]$MinMemoryMB
    )

    $score = 0
    $reasons = New-Object System.Collections.Generic.List[string]
    if ($null -eq $Name) { $Name = "" }
    if ($null -eq $CommandLine) { $CommandLine = "" }
    $lname = $Name.ToLowerInvariant()
    $cmd = $CommandLine
    $hostNames = Get-HostNames

    if ($hostNames -contains $lname) {
        $score += 35
        $reasons.Add("script host") | Out-Null
    }

    $heavyApps = Get-HeavyAppNames
    if ($heavyApps -contains $lname) {
        $score += 16
        $reasons.Add("known background app") | Out-Null
    }

    if ($IsBackground) {
        if ($MemoryMB -ge 800) {
            $score += 55
            $reasons.Add("very high RAM usage") | Out-Null
        } elseif ($MemoryMB -ge 500) {
            $score += 42
            $reasons.Add("high RAM usage") | Out-Null
        } elseif ($MemoryMB -ge $MinMemoryMB) {
            $score += 24
            $reasons.Add("background RAM usage") | Out-Null
        }
    }

    if ($cmd -match '(?i)(\.ps1|\.bat|\.cmd|\.vbs|\.js|\.jse|\.py|\.hta|\.wsf)\b') {
        $score += 25
        $reasons.Add("runs script file") | Out-Null
    }

    if ($cmd -match '(?i)(-enc(odedcommand)?\s+|frombase64string\s*\(|invoke-expression|\biex\b|executionpolicy\s+bypass)') {
        $score += 25
        $reasons.Add("obfuscated/bypass pattern") | Out-Null
    }

    if ($cmd -match '(?i)(downloadstring|downloadfile|invoke-webrequest|start-bitstransfer|curl\s+https?://|wget\s+https?://)') {
        $score += 18
        $reasons.Add("downloads from internet") | Out-Null
    }

    if ($cmd -match '(?i)(\\downloads\\|\\appdata\\local\\temp\\|\\temp\\)') {
        $score += 12
        $reasons.Add("runs from temp/downloads") | Out-Null
    }

    if ($StartTime) {
        $ageMin = ((Get-Date) - $StartTime).TotalMinutes
        if ($ageMin -ge $MinAgeMinutes) {
            $score += 8
            $reasons.Add("running in background") | Out-Null
        }
    }

    # Ignore known local helpers by default.
    if ($cmd -match '(?i)(foxhotkeys\.ps1|ollama(\.exe)?\s+serve)') {
        $score -= 30
        $reasons.Add("known local helper") | Out-Null
    }

    $level = if ($score -ge 65) { "HIGH" } elseif ($score -ge 40) { "MEDIUM" } elseif ($score -ge 20) { "LOW" } else { "SAFE" }
    return [pscustomobject]@{
        Score = $score
        Level = $level
        Reasons = @($reasons | Select-Object -Unique)
    }
}

function Get-ProcessCandidates {
    param(
        [switch]$IncludeLow,
        [int]$Top,
        [int]$MinAgeMinutes,
        [int]$MinMemoryMB
    )

    $critical = Get-CriticalProcessNames
    $thisPid = $PID
    $thisSession = $script:FoxBgSessionId

    $pMap = @{}
    foreach ($p in (Get-Process)) {
        $pMap[[int]$p.Id] = $p
    }

    $list = New-Object System.Collections.Generic.List[object]
    $wmi = Get-CimInstance Win32_Process

    foreach ($w in $wmi) {
        $procId = [int]$w.ProcessId
        if ($procId -eq $thisPid) { continue }
        if (-not $pMap.ContainsKey($procId)) { continue }

        $p = $pMap[$procId]
        if ($p.SessionId -ne $thisSession) { continue }

        $name = ($p.ProcessName + ".exe")
        $lname = $name.ToLowerInvariant()
        if ($critical -contains $lname) { continue }

        $start = $null
        try { $start = $p.StartTime } catch {}
        $uptime = Format-Uptime $start
        $memMb = [math]::Round(($p.WorkingSet64 / 1MB), 1)
        $cmd = [string]$w.CommandLine
        if ([string]::IsNullOrWhiteSpace($cmd)) { $cmd = [string]$w.ExecutablePath }

        $isHeavyApp = ((Get-HeavyAppNames) -contains $lname)

        # Keep background/script-heavy apps.
        $isBackground = ($p.MainWindowHandle -eq 0)
        $isHost = ((Get-HostNames) -contains $lname)
        if (-not $isBackground -and -not $isHost -and -not $isHeavyApp) { continue }
        if (Test-NoiseProcess -Name $name -CommandLine $cmd) { continue }

        $scoreData = Get-SuspicionScore `
            -Name $name `
            -CommandLine $cmd `
            -StartTime $start `
            -MinAgeMinutes $MinAgeMinutes `
            -MemoryMB $memMb `
            -IsBackground:$isBackground `
            -MinMemoryMB $MinMemoryMB
        if ($scoreData.Level -eq "SAFE") { continue }
        if (-not $IncludeLow -and $scoreData.Level -eq "LOW") { continue }

        $list.Add([pscustomobject]@{
            Id = $procId
            Name = $name
            Level = $scoreData.Level
            Score = $scoreData.Score
            Uptime = $uptime
            MemoryMB = $memMb
            Reasons = ($scoreData.Reasons -join ", ")
            CommandLine = $cmd
        }) | Out-Null
    }

    $ordered = @(
        $list | Sort-Object -Property @(
            @{ Expression = "Score"; Descending = $true },
            @{ Expression = "MemoryMB"; Descending = $true }
        )
    )
    if ($Top -gt 0 -and $ordered.Count -gt $Top) {
        return @($ordered | Select-Object -First $Top)
    }
    return $ordered
}

function Show-List {
    param(
        [object[]]$Items,
        [int]$Index
    )

    Clear-Host
    fx "=== foxbg : background cleaner ===" Cyan
    fx "Up/Down: select | Enter: close app | R: refresh | Esc: exit" DarkGray
    fx ""

    if (-not $Items -or $Items.Count -eq 0) {
        fx "No closable suspicious background scripts found." Green
        fx ""
        fx "Try: foxbg -IncludeLow" DarkGray
        return
    }

    $winHeight = 28
    try { $winHeight = [Math]::Max(16, $Host.UI.RawUI.WindowSize.Height) } catch {}
    $pageSize = [Math]::Max(6, $winHeight - 8)

    $start = [Math]::Max(0, $Index - [Math]::Floor($pageSize / 2))
    if ($start + $pageSize -gt $Items.Count) { $start = [Math]::Max(0, $Items.Count - $pageSize) }
    $end = [Math]::Min($Items.Count - 1, $start + $pageSize - 1)

    for ($i = $start; $i -le $end; $i++) {
        $it = $Items[$i]
        $prefix = if ($i -eq $Index) { ">" } else { " " }
        $color = if ($i -eq $Index) { "Cyan" } elseif ($it.Level -eq "HIGH") { "Red" } elseif ($it.Level -eq "MEDIUM") { "Yellow" } else { "DarkYellow" }
        $line = ("{0} [{1}] {2}  pid:{3}  mem:{4}MB  up:{5}" -f $prefix, $it.Level, $it.Name, $it.Id, $it.MemoryMB, $it.Uptime)
        fx $line $color

        $cmd = Truncate $it.CommandLine 100
        if (-not [string]::IsNullOrWhiteSpace($cmd)) {
            fx ("    " + $cmd) DarkGray
        }
    }

    fx ""
    $selected = $Items[$Index]
    fx ("Selected reasons: " + $selected.Reasons) DarkGray
}

function Show-NonInteractive {
    param([object[]]$Items)
    fx "=== foxbg : report mode ===" Cyan
    if (-not $Items -or $Items.Count -eq 0) {
        fx "No candidates found." Green
        return
    }
    foreach ($it in $Items) {
        $color = if ($it.Level -eq "HIGH") { "Red" } elseif ($it.Level -eq "MEDIUM") { "Yellow" } else { "DarkYellow" }
        fx ("[{0}] {1} pid:{2} mem:{3}MB up:{4}" -f $it.Level, $it.Name, $it.Id, $it.MemoryMB, $it.Uptime) $color
        fx ("  why: " + $it.Reasons) DarkGray
        fx ("  cmd: " + (Truncate $it.CommandLine 140)) DarkGray
    }
}

function Stop-AppGroup {
    param([object]$Item)

    $closed = 0
    $errors = New-Object System.Collections.Generic.List[string]
    $shortName = [System.IO.Path]::GetFileNameWithoutExtension([string]$Item.Name)

    $targets = @()
    try {
        $targets = @(Get-Process -Name $shortName -ErrorAction SilentlyContinue |
            Where-Object { $_.Id -ne $PID -and ($script:FoxBgSessionId -eq $null -or $_.SessionId -eq $script:FoxBgSessionId) })
    } catch {
        $targets = @()
    }

    if ($targets.Count -eq 0) {
        try {
            Stop-Process -Id $Item.Id -Force -ErrorAction Stop
            $closed++
        } catch {
            $errors.Add("Stop-Process failed for PID $($Item.Id)") | Out-Null
            try {
                & taskkill /PID $Item.Id /T /F | Out-Null
                $closed++
            } catch {
                $errors.Add("taskkill failed for PID $($Item.Id)") | Out-Null
            }
        }
    } else {
        foreach ($tp in $targets) {
            try {
                Stop-Process -Id $tp.Id -Force -ErrorAction Stop
                $closed++
            } catch {
                try {
                    & taskkill /PID $tp.Id /T /F | Out-Null
                    $closed++
                } catch {
                    $errors.Add("failed PID $($tp.Id)") | Out-Null
                }
            }
        }
    }

    return [pscustomobject]@{
        Closed = $closed
        ErrorText = ($errors -join ", ")
    }
}

$items = Get-ProcessCandidates -IncludeLow:$IncludeLow -Top $Top -MinAgeMinutes $MinAgeMinutes -MinMemoryMB $MinMemoryMB

if ($NoUi -or [Console]::IsInputRedirected -or -not [Environment]::UserInteractive) {
    Show-NonInteractive -Items $items
    exit 0
}

$idx = 0
while ($true) {
    if ($items.Count -gt 0) {
        if ($idx -ge $items.Count) { $idx = $items.Count - 1 }
        if ($idx -lt 0) { $idx = 0 }
    } else {
        $idx = 0
    }

    Show-List -Items $items -Index $idx
    $k = [Console]::ReadKey($true)
    switch ($k.Key) {
        "UpArrow" {
            if ($items.Count -gt 0 -and $idx -gt 0) { $idx-- }
        }
        "DownArrow" {
            if ($items.Count -gt 0 -and $idx -lt ($items.Count - 1)) { $idx++ }
        }
        "R" {
            $items = Get-ProcessCandidates -IncludeLow:$IncludeLow -Top $Top -MinAgeMinutes $MinAgeMinutes -MinMemoryMB $MinMemoryMB
        }
        "Escape" {
            Clear-Host
            fx "foxbg closed." DarkGray
            break
        }
        "Enter" {
            if ($items.Count -eq 0) { continue }
            $target = $items[$idx]
            Clear-Host
            fx "=== foxbg : close app ===" Cyan
            fx ("Name : " + $target.Name) Yellow
            fx ("PID  : " + $target.Id) Yellow
            fx ("Risk : " + $target.Level + " (score " + $target.Score + ")") Yellow
            fx ("Why  : " + $target.Reasons) DarkGray
            fx ("Cmd  : " + (Truncate $target.CommandLine 160)) DarkGray
            fx ""
            $result = Stop-AppGroup -Item $target
            if ($result.Closed -gt 0) {
                fx ("Closed " + $result.Closed + " process(es) for " + $target.Name + ".") Green
            } else {
                fx ("Cannot close " + $target.Name + ". Try running terminal as Administrator.") Red
                if (-not [string]::IsNullOrWhiteSpace($result.ErrorText)) {
                    fx ("Details: " + $result.ErrorText) DarkGray
                }
            }
            Start-Sleep -Milliseconds 900
            $items = Get-ProcessCandidates -IncludeLow:$IncludeLow -Top $Top -MinAgeMinutes $MinAgeMinutes -MinMemoryMB $MinMemoryMB
        }
    }
}
