param(
    [string[]]$Path,
    [switch]$Deep,
    [switch]$IncludeLow,
    [switch]$IncludeWorkspace,
    [int]$MaxFileSizeKB = 1024,
    [int]$Top = 50
)

$ErrorActionPreference = 'SilentlyContinue'

function fx([string]$Text, [ConsoleColor]$Color = [ConsoleColor]::Gray) {
    Write-Host $Text -ForegroundColor $Color
}

function Get-DefaultTargets {
    $targets = @(
        (Join-Path $env:USERPROFILE "Downloads"),
        (Join-Path $env:USERPROFILE "Desktop"),
        (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"),
        $env:TEMP
    )

    if ($Deep) {
        $targets += @(
            (Join-Path $env:USERPROFILE "Documents"),
            (Join-Path $env:USERPROFILE "AppData\Roaming"),
            (Join-Path $env:USERPROFILE "AppData\Local\Temp")
        )
    }

    $resolved = @($targets | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_) } | Select-Object -Unique)
    if ($resolved.Count -eq 0) {
        $fallback = @(
            (Get-Location).Path,
            [System.IO.Path]::GetTempPath()
        )
        $resolved = @($fallback | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_) } | Select-Object -Unique)
    }
    return $resolved
}

function Get-Rules {
    return @(
        @{ Name = "Encoded command";       Weight = 30; Regex = '(?im)(-enc(odedcommand)?\s+|FromBase64String\s*\()' },
        @{ Name = "IEX execution";         Weight = 25; Regex = '(?im)\b(iex|invoke-expression)\b' },
        @{ Name = "Remote download";       Weight = 18; Regex = '(?im)(downloadstring|downloadfile|invoke-webrequest|start-bitstransfer|curl\s+https?://|wget\s+https?://)' },
        @{ Name = "Hidden powershell";     Weight = 20; Regex = '(?im)powershell(\.exe)?\s+.*(-w|/w)\s+hidden' },
        @{ Name = "Policy bypass";         Weight = 18; Regex = '(?im)(executionpolicy\s+bypass|set-executionpolicy\s+bypass)' },
        @{ Name = "Persistence";           Weight = 24; Regex = '(?im)(\\run(once)?\b|schtasks(\.exe)?\s+/create|new-scheduledtask)' },
        @{ Name = "Defender tampering";    Weight = 40; Regex = '(?im)(add-mppreference|set-mppreference|disablerealtimemonitoring|exclusionpath|exclusionprocess)' },
        @{ Name = "LOLBin launchers";      Weight = 22; Regex = '(?im)\b(mshta|rundll32|regsvr32|wscript|cscript)\b' },
        @{ Name = "Privilege escalation";  Weight = 24; Regex = '(?im)(net\s+user\s+.+\s+/add|localgroup\s+administrators\s+.+\s+/add)' },
        @{ Name = "System restore damage"; Weight = 35; Regex = '(?im)(vssadmin\s+delete|wbadmin\s+delete|bcdedit\s+/set)' }
    )
}

function Measure-Suspicion {
    param(
        [string]$Text
    )

    $rules = Get-Rules
    $score = 0
    $reasons = New-Object System.Collections.Generic.List[string]

    foreach ($rule in $rules) {
        if ($Text -match $rule.Regex) {
            $score += [int]$rule.Weight
            $reasons.Add($rule.Name) | Out-Null
        }
    }

    # Simple "AI-like" combo heuristics to reduce false negatives.
    $hasDownload = ($Text -match '(?im)(downloadstring|downloadfile|invoke-webrequest|start-bitstransfer|curl\s+https?://|wget\s+https?://)')
    $hasExec = ($Text -match '(?im)\b(iex|invoke-expression|powershell(\.exe)?\s+-)\b')
    $hasEnc = ($Text -match '(?im)(-enc(odedcommand)?\s+|FromBase64String\s*\()')
    $hasHidden = ($Text -match '(?im)powershell(\.exe)?\s+.*(-w|/w)\s+hidden')

    if ($hasDownload -and $hasExec) {
        $score += 25
        $reasons.Add("Download + execute chain") | Out-Null
    }
    if ($hasEnc -and $hasHidden) {
        $score += 20
        $reasons.Add("Encoded + hidden execution") | Out-Null
    }

    $risk = if ($score -ge 75) { "HIGH" } elseif ($score -ge 40) { "MEDIUM" } elseif ($score -ge 20) { "LOW" } else { "SAFE" }
    return [pscustomobject]@{
        Score = $score
        Risk = $risk
        Reasons = @($reasons | Select-Object -Unique)
    }
}

function Get-ScriptCandidates {
    param(
        [string[]]$Targets,
        [int]$MaxFileBytes,
        [string[]]$ExcludePrefixes
    )

    $extSet = @(".ps1", ".psm1", ".bat", ".cmd", ".vbs", ".js", ".jse", ".wsf", ".hta")
    $skipPath = '(?i)\\(\.git|node_modules|bin|obj|dist|coverage|vendor)\\'
    $selfNames = @("foxscan.ps1", "foxscan.bat")
    $all = New-Object System.Collections.Generic.List[System.IO.FileInfo]

    foreach ($target in $Targets) {
        try {
            $files = Get-ChildItem -LiteralPath $target -Recurse -File
            foreach ($f in $files) {
                if ($f.FullName -match $skipPath) { continue }
                if ($selfNames -contains $f.Name.ToLowerInvariant()) { continue }
                $skipByPrefix = $false
                foreach ($prefix in $ExcludePrefixes) {
                    if ([string]::IsNullOrWhiteSpace($prefix)) { continue }
                    if ($f.FullName.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                        $skipByPrefix = $true
                        break
                    }
                }
                if ($skipByPrefix) { continue }
                if (-not ($extSet -contains $f.Extension.ToLowerInvariant())) { continue }
                if ($f.Length -gt $MaxFileBytes) { continue }
                $all.Add($f) | Out-Null
            }
        } catch {}
    }

    return @($all | Sort-Object -Property FullName -Unique)
}

fx ""
fx "=== foxscan : suspicious script scanner ===" Cyan
fx "Heuristic mode only. This is NOT a full antivirus." DarkGray
fx ""

$isCustomPath = ($Path -and $Path.Count -gt 0)
$targets = if ($isCustomPath) {
    @($Path | Where-Object { Test-Path $_ } | Select-Object -Unique)
} else {
    Get-DefaultTargets
}

if (-not $targets -or $targets.Count -eq 0) {
    fx "No valid target paths found." Yellow
    exit 1
}

fx ("Targets: " + ($targets -join " | ")) DarkGray
if ($Deep) { fx "Mode: deep" DarkGray } else { fx "Mode: quick" DarkGray }
fx ""

$workspaceRoot = Split-Path $PSScriptRoot -Parent
$excludePrefixes = @()
if (-not $IncludeWorkspace -and -not $isCustomPath -and (Test-Path $workspaceRoot)) {
    $excludePrefixes += $workspaceRoot
}

$maxBytes = [Math]::Max(16, $MaxFileSizeKB) * 1024
$candidates = Get-ScriptCandidates -Targets $targets -MaxFileBytes $maxBytes -ExcludePrefixes $excludePrefixes

if (-not $candidates -or $candidates.Count -eq 0) {
    fx "No script files found in targets." Green
    exit 0
}

fx ("Files to inspect: " + $candidates.Count) DarkGray

$findings = New-Object System.Collections.Generic.List[object]
foreach ($file in $candidates) {
    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($content)) { continue }

        $m = Measure-Suspicion -Text $content
        if ($m.Risk -eq "SAFE") { continue }
        if (-not $IncludeLow -and $m.Risk -eq "LOW") { continue }

        $findings.Add([pscustomobject]@{
            Name = $file.Name
            Risk = $m.Risk
            Score = $m.Score
            Path = $file.FullName
            Reasons = ($m.Reasons -join ", ")
        }) | Out-Null
    } catch {}
}

if ($findings.Count -eq 0) {
    fx ""
    fx "No suspicious scripts detected by current heuristics." Green
    $recent = @($candidates | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 8)
    if ($recent.Count -gt 0) {
        fx "Recent script files scanned:" DarkGray
        foreach ($r in $recent) {
            $ts = $r.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            fx (" - " + $r.Name + "  [" + $ts + "]") DarkGray
        }
    }
    fx "Tip: run foxscan -Deep -IncludeLow for broader results." DarkGray
    if (-not $IncludeWorkspace -and -not $isCustomPath) {
        fx "Tip: add -IncludeWorkspace if you want to scan this project folder too." DarkGray
    }
    exit 0
}

$ordered = @($findings | Sort-Object -Property Score -Descending)
if ($Top -gt 0 -and $ordered.Count -gt $Top) {
    $ordered = @($ordered | Select-Object -First $Top)
}

fx ""
fx "Suspicious script names:" Yellow
foreach ($item in $ordered) {
    $color = if ($item.Risk -eq "HIGH") { "Red" } elseif ($item.Risk -eq "MEDIUM") { "Yellow" } else { "DarkYellow" }
    fx (" - [{0}] {1} (score: {2})" -f $item.Risk, $item.Name, $item.Score) $color
    fx ("     path: " + $item.Path) DarkGray
    fx ("     why : " + $item.Reasons) DarkGray
}

fx ""
fx ("Total findings: " + $ordered.Count) Cyan
fx "Recommendation: upload HIGH files to VirusTotal and run Microsoft Defender full scan." DarkGray
