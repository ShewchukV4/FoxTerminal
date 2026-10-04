param(
    [Parameter(Position = 0)]
    [string]$Mode,
    [switch]$Once,
    [switch]$Apps,
    [ValidateRange(250, 10000)]
    [int]$Ms = 1000
)

# Live vitals: how the CPU / GPU / RAM / notebook feel right now.
#   pulse              live loop (Ctrl+E / Esc / Q exit, A = apps)
#   pulse -Once        one snapshot
#   pulse apps         close heavy apps (arrows + Enter, Back = vitals)

. "$PSScriptRoot\foxauth.ps1"

if ($Apps) { $Mode = "apps" }
if (-not [string]::IsNullOrWhiteSpace($Mode)) {
    $Mode = $Mode.Trim().TrimStart('-').ToLowerInvariant()
}
if ($Mode -in @("app", "apps", "kill", "close")) { $Apps = $true }

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$script:PulseHistory = New-Object System.Collections.Generic.Queue[int]
$script:PulseHistMax = 28

if (-not ("FoxPulseNative" -as [type])) {
    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FoxPulseNative {
    [DllImport("kernel32.dll")]
    public static extern bool GetSystemTimes(out long idle, out long kernel, out long user);
}
"@ | Out-Null
    } catch {}
}

function Get-CpuLoadPct($prev) {
    $cur = $null
    try {
        $idle = [int64]0; $kernel = [int64]0; $user = [int64]0
        if (("FoxPulseNative" -as [type]) -and [FoxPulseNative]::GetSystemTimes([ref]$idle, [ref]$kernel, [ref]$user)) {
            $cur = @{ Idle = $idle; Kernel = $kernel; User = $user }
        }
    } catch { $cur = $null }

    if ($null -eq $cur) {
        try {
            $lp = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
            return @{ Pct = [int][Math]::Round($lp); Sample = $null }
        } catch {
            return @{ Pct = 0; Sample = $null }
        }
    }
    if ($null -eq $prev) { return @{ Pct = 0; Sample = $cur } }

    $tot = ($cur.Kernel - $prev.Kernel) + ($cur.User - $prev.User)
    $idl = ($cur.Idle - $prev.Idle)
    $pct = 0
    if ($tot -gt 0) {
        $pct = [int](($tot - $idl) * 100 / $tot)
        if ($pct -lt 0) { $pct = 0 }
        if ($pct -gt 100) { $pct = 100 }
    }
    return @{ Pct = $pct; Sample = $cur }
}

function Get-ZoneTempC {
    try {
        $t = Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction Stop |
            Where-Object { $_.Temperature -gt 200 -and $_.Temperature -lt 450 } |
            Select-Object -First 1 -ExpandProperty Temperature
        if ($null -ne $t) { return [int][Math]::Round([double]$t - 273.15) }
    } catch {}
    try {
        $raw = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop |
            Select-Object -First 1 -ExpandProperty CurrentTemperature
        if ($null -ne $raw -and $raw -gt 0) {
            return [int][Math]::Round(($raw / 10.0) - 273.15)
        }
    } catch {}
    return $null
}

function Get-NvidiaGpus {
    $smi = $null
    foreach ($c in @(
        (Get-Command nvidia-smi -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
        "$env:SystemRoot\System32\nvidia-smi.exe",
        "${env:ProgramFiles}\NVIDIA Corporation\NVSMI\nvidia-smi.exe"
    )) {
        if ($c -and (Test-Path -LiteralPath $c)) { $smi = $c; break }
    }
    if (-not $smi) { return @() }

    $q = "name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw,clocks.current.graphics"
    $raw = & $smi "--query-gpu=$q" --format=csv,noheader,nounits 2>$null
    if (-not $raw) { return @() }

    $list = @()
    foreach ($line in @($raw)) {
        $parts = @(($line -split ",") | ForEach-Object { $_.Trim() })
        if ($parts.Count -lt 6) { continue }
        $list += [pscustomobject]@{
            Name    = $parts[0]
            TempC   = if ($parts[1] -match '^\d') { [int]$parts[1] } else { $null }
            Load    = if ($parts[2] -match '^\d') { [int]$parts[2] } else { 0 }
            MemLoad = if ($parts[3] -match '^\d') { [int]$parts[3] } else { 0 }
            MemUsed = if ($parts[4] -match '^\d') { [int]$parts[4] } else { 0 }
            MemTot  = if ($parts[5] -match '^\d') { [int]$parts[5] } else { 0 }
            PowerW  = if ($parts.Count -gt 6 -and $parts[6] -match '^\d') { [double]$parts[6] } else { $null }
            Clock   = if ($parts.Count -gt 7 -and $parts[7] -match '^\d') { [int]$parts[7] } else { $null }
        }
    }
    return $list
}

function Get-OtherGpus([object[]]$nvidia) {
    $list = @()
    try {
        Get-CimInstance Win32_VideoController | ForEach-Object {
            $n = ("$($_.Name)").Trim()
            if ($n.Length -eq 0) { return }
            if ($n -match '(?i)basic|remote|microsoft') { return }
            $low = $n.ToLowerInvariant()
            foreach ($g in @($nvidia)) {
                $ng = ("$($g.Name)").ToLowerInvariant()
                if ($ng.Length -eq 0) { continue }
                if ($low.Contains($ng) -or $ng.Contains($low)) { return }
                if ($low -match 'rtx|geforce|nvidia' -and $ng -match 'rtx|geforce|nvidia') { return }
            }
            $clean = ($n -replace '\((R|TM|C)\)', '' -replace '\s+', ' ').Trim()
            $list += [pscustomobject]@{
                Name = $clean
                TempC = $null; Load = $null; MemLoad = $null
                MemUsed = $null; MemTot = $null; PowerW = $null; Clock = $null
            }
        }
    } catch {}
    return $list
}

function Get-BatteryInfo {
    try {
        $ps = [System.Windows.Forms.SystemInformation]::PowerStatus
    } catch {
        try {
            Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue | Out-Null
            $ps = [System.Windows.Forms.SystemInformation]::PowerStatus
        } catch { return $null }
    }
    try {
        $noBat = ([int]$ps.BatteryChargeStatus -band [int][System.Windows.Forms.BatteryChargeStatus]::NoSystemBattery) -ne 0
        if ($noBat) { return $null }
        $pct = [int][Math]::Round([double]$ps.BatteryLifePercent * 100)
        if ($pct -lt 0) { $pct = 0 }
        if ($pct -gt 100) { $pct = 100 }
        $onAc = $ps.PowerLineStatus -eq [System.Windows.Forms.PowerLineStatus]::Online
        $charging = ([int]$ps.BatteryChargeStatus -band [int][System.Windows.Forms.BatteryChargeStatus]::Charging) -ne 0
        return @{ Pct = $pct; OnAc = $onAc; Charging = $charging }
    } catch { return $null }
}

function Get-Feel([int]$cpuLoad, $cpuTemp, $gpuLoad, $gpuTemp) {
    $stress = 0
    $stress += [Math]::Min(40, [int]($cpuLoad * 0.35))
    if ($null -ne $cpuTemp) {
        if ($cpuTemp -ge 90) { $stress += 35 }
        elseif ($cpuTemp -ge 80) { $stress += 28 }
        elseif ($cpuTemp -ge 70) { $stress += 18 }
        elseif ($cpuTemp -ge 60) { $stress += 8 }
    }
    if ($null -ne $gpuLoad) { $stress += [Math]::Min(30, [int]($gpuLoad * 0.30)) }
    if ($null -ne $gpuTemp) {
        if ($gpuTemp -ge 85) { $stress += 30 }
        elseif ($gpuTemp -ge 75) { $stress += 22 }
        elseif ($gpuTemp -ge 65) { $stress += 12 }
        elseif ($gpuTemp -ge 55) { $stress += 5 }
    }
    if ($stress -ge 75) { return @{ Word = "melting"; Tip = "heavy load - maybe ease off"; Stress = $stress } }
    if ($stress -ge 55) { return @{ Word = "spicy";   Tip = "working hard"; Stress = $stress } }
    if ($stress -ge 35) { return @{ Word = "warm";    Tip = "comfortable under load"; Stress = $stress } }
    if ($stress -ge 18) { return @{ Word = "cozy";    Tip = "light activity"; Stress = $stress } }
    return @{ Word = "chill"; Tip = "barely breaking a sweat"; Stress = $stress }
}

function Get-NotebookScore([int]$cpuLoad, $cpuTemp, $gpuLoad, $gpuTemp, [int]$ramPct, $bat) {
    # 100 = healthy / cool / roomy. Drops with heat, load, packed RAM, low battery.
    $score = 100.0
    $score -= [Math]::Min(28, $cpuLoad * 0.28)
    $score -= [Math]::Min(22, [Math]::Max(0, $ramPct - 55) * 0.55)
    if ($null -ne $gpuLoad) { $score -= [Math]::Min(20, $gpuLoad * 0.20) }

    if ($null -ne $cpuTemp) {
        if ($cpuTemp -ge 95) { $score -= 30 }
        elseif ($cpuTemp -ge 85) { $score -= 22 }
        elseif ($cpuTemp -ge 75) { $score -= 14 }
        elseif ($cpuTemp -ge 65) { $score -= 7 }
        elseif ($cpuTemp -ge 55) { $score -= 2 }
    }
    if ($null -ne $gpuTemp) {
        if ($gpuTemp -ge 90) { $score -= 26 }
        elseif ($gpuTemp -ge 80) { $score -= 18 }
        elseif ($gpuTemp -ge 70) { $score -= 10 }
        elseif ($gpuTemp -ge 60) { $score -= 4 }
    }
    if ($null -ne $bat -and -not $bat.OnAc) {
        if ($bat.Pct -le 10) { $score -= 18 }
        elseif ($bat.Pct -le 20) { $score -= 12 }
        elseif ($bat.Pct -le 35) { $score -= 6 }
    }

    $n = [int][Math]::Round($score)
    if ($n -lt 0) { $n = 0 }
    if ($n -gt 100) { $n = 100 }

    $grade = "F"
    $label = "critical"
    $tip = "hot or packed - give it a break"
    if ($n -ge 90) { $grade = "A";  $label = "excellent"; $tip = "notebook is breathing easy" }
    elseif ($n -ge 80) { $grade = "B+"; $label = "great";     $tip = "cool head, plenty of room" }
    elseif ($n -ge 70) { $grade = "B";  $label = "good";      $tip = "holding up fine" }
    elseif ($n -ge 60) { $grade = "C+"; $label = "ok";        $tip = "a bit busy, still fine" }
    elseif ($n -ge 50) { $grade = "C";  $label = "strained";  $tip = "warm and loaded" }
    elseif ($n -ge 35) { $grade = "D";  $label = "rough";     $tip = "heat or RAM is biting" }

    return @{ Score = $n; Grade = $grade; Label = $label; Tip = $tip }
}

function Mix-PulseHex([string]$a, [string]$b, [double]$t) {
    if ($t -lt 0) { $t = 0 }
    if ($t -gt 1) { $t = 1 }
    if (Get-Command Mix-Hex -ErrorAction SilentlyContinue) {
        try { return (Mix-Hex $a $b $t) } catch {}
    }
    return $b
}

function Color-ForLevel($p, $pct, $temp) {
    if ($null -ne $temp) {
        if ($temp -ge 85) { return "#FF6B6B" }
        if ($temp -ge 75) { return "#FFB020" }
        if ($temp -ge 60) { return $p.accent2 }
    }
    if ($pct -ge 85) { return "#FF6B6B" }
    if ($pct -ge 60) { return "#FFB020" }
    return $p.accent2
}

function Color-ForScore($p, [int]$score) {
    if ($score -ge 80) { return "#5DDEA0" }
    if ($score -ge 65) { return $p.accent2 }
    if ($score -ge 50) { return "#FFB020" }
    return "#FF6B6B"
}

function Format-GiB([double]$bytes) {
    return ("{0:N1}G" -f ($bytes / 1GB))
}

function Clip-Text([string]$s, [int]$max) {
    if ([string]::IsNullOrEmpty($s)) { return "" }
    if ($s.Length -le $max) { return $s }
    if ($max -le 3) { return $s.Substring(0, $max) }
    return $s.Substring(0, $max - 3) + "..."
}

function Write-GradientBar([double]$pct, [int]$width, [string]$hotHex, [string]$coolHex, [string]$emptyHex) {
    if ($pct -lt 0) { $pct = 0 }
    if ($pct -gt 100) { $pct = 100 }
    $fill = [int][Math]::Round(($pct / 100.0) * $width)
    if ($fill -gt $width) { $fill = $width }
    $block = [string][char]0x2588
    $empty = [string][char]0x2591
    $parts = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $fill; $i++) {
        $t = if ($width -le 1) { 1.0 } else { $i / [double]($width - 1) }
        # cool at left, hotter toward the tip of the fill
        $c = Mix-PulseHex $coolHex $hotHex ($t * ($pct / 100.0))
        $parts.Add((Color-Text $c $block)) | Out-Null
    }
    if ($fill -lt $width) {
        $parts.Add((Color-Text $emptyHex ($empty * ($width - $fill)))) | Out-Null
    }
    return ($parts -join "")
}

function Write-Sparkline([int[]]$vals, [string]$color) {
    if ($null -eq $vals -or $vals.Count -eq 0) { return (Color-Text $color ("-" * 8)) }
    $glyphs = @(
        [string][char]0x2581, [string][char]0x2582, [string][char]0x2583, [string][char]0x2584,
        [string][char]0x2585, [string][char]0x2586, [string][char]0x2587, [string][char]0x2588
    )
    $sb = New-Object System.Text.StringBuilder
    foreach ($v in $vals) {
        $n = $v
        if ($n -lt 0) { $n = 0 }
        if ($n -gt 100) { $n = 100 }
        $idx = [int][Math]::Floor(($n / 100.0) * ($glyphs.Count - 1))
        [void]$sb.Append($glyphs[$idx])
    }
    return (Color-Text $color $sb.ToString())
}

function Push-PulseHistory([int]$score) {
    $script:PulseHistory.Enqueue($score)
    while ($script:PulseHistory.Count -gt $script:PulseHistMax) {
        [void]$script:PulseHistory.Dequeue()
    }
}

function Get-WinWidth {
    try {
        $w = $host.UI.RawUI.WindowSize.Width
        if ($w -gt 20) { return [int]$w }
    } catch {}
    return 72
}

function Write-BoxLine([string]$inner, [int]$innerW, $p, [string]$left, [string]$right) {
    $plain = ($inner -replace "$([char]27)\[[0-9;]*m", "")
    $pad = $innerW - $plain.Length
    if ($pad -lt 0) { $pad = 0 }
    Write-Host (Color-Text $p.dim ("  " + $left + " ")) -NoNewline
    Write-Host ($inner + (" " * $pad)) -NoNewline
    Write-Host (Color-Text $p.dim (" " + $right))
}

function Get-Snapshot($cpuSample) {
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $cpuName = if ($cpu) {
        (($cpu.Name `
            -replace '\((R|TM|C)\)', '' `
            -replace '(?i)\s*(with|w/)\s+Radeon(\s+\w+)?(\s+Graphics)?', '' `
            -replace '(?i)\s+Graphics$', '' `
            -replace '\s+', ' ').Trim())
    } else { "CPU" }

    $load = Get-CpuLoadPct $cpuSample
    $zone = Get-ZoneTempC
    $nv = @(Get-NvidiaGpus)
    $other = @(Get-OtherGpus $nv)
    $gpus = @($nv + $other)

    $os = Get-CimInstance Win32_OperatingSystem
    $ramTot = [double]$os.TotalVisibleMemorySize * 1024
    $ramFree = [double]$os.FreePhysicalMemory * 1024
    $ramUsed = $ramTot - $ramFree
    $ramPct = if ($ramTot -gt 0) { [int][Math]::Round(($ramUsed / $ramTot) * 100) } else { 0 }

    $topGpu = $gpus | Where-Object { $null -ne $_.Load } | Select-Object -First 1
    if ($null -eq $topGpu) { $topGpu = $gpus | Select-Object -First 1 }

    $gpuLoad = if ($null -ne $topGpu -and $null -ne $topGpu.Load) { [int]$topGpu.Load } else { $null }
    $gpuTemp = if ($null -ne $topGpu) { $topGpu.TempC } else { $null }
    $feel = Get-Feel $load.Pct $zone $gpuLoad $gpuTemp
    $bat = Get-BatteryInfo
    $nb = Get-NotebookScore $load.Pct $zone $gpuLoad $gpuTemp $ramPct $bat

    return [pscustomobject]@{
        CpuName   = $cpuName
        CpuLoad   = $load.Pct
        CpuSample = $load.Sample
        CpuTemp   = $zone
        Gpus      = $gpus
        RamUsed   = $ramUsed
        RamTot    = $ramTot
        RamPct    = $ramPct
        Feel      = $feel
        Notebook  = $nb
        Battery   = $bat
        At        = Get-Date
    }
}

function Render-MetricBlock($p, [string]$title, [string]$valueLine, [double]$pct, $temp, [string]$sub, [int]$barW) {
    $hot = Color-ForLevel $p $pct $temp
    $cool = $p.accent
    $empty = Mix-PulseHex $p.base $p.dim 0.55
    Write-Host (Color-Text $p.accent2 ("  " + $title)) -NoNewline
    Write-Host (Color-Text $p.dim "  ") -NoNewline
    Write-Host (Color-Text $p.text $valueLine)
    Write-Host "  " -NoNewline
    Write-Host (Write-GradientBar $pct $barW $hot $cool $empty)
    if (-not [string]::IsNullOrWhiteSpace($sub)) {
        Write-Host (Color-Text $p.dim ("  " + $sub))
    }
    Write-Host ""
}

function Render-Pulse($snap, $p) {
    Clear-Host
    $winW = Get-WinWidth
    $boxW = [Math]::Min(66, [Math]::Max(50, $winW - 6))
    $innerW = $boxW - 4
    $barW = [Math]::Min(44, [Math]::Max(26, $boxW - 8))

    $tl = [string][char]0x256D
    $tr = [string][char]0x256E
    $bl = [string][char]0x2570
    $br = [string][char]0x256F
    $hz = [string][char]0x2500
    $vt = [string][char]0x2502

    $score = [int]$snap.Notebook.Score
    $scoreCol = Color-ForScore $p $score
    $heart = Get-FoxIcon 0xF21E
    $clock = $snap.At.ToString("HH:mm:ss")

    Push-PulseHistory $score
    $hist = @($script:PulseHistory)

    Write-Host ""
    # title row: ╭─ pulse ──── clock ─╮
    $leftTitle = (" " + $heart + "  pulse ")
    # approximate visible width without nerd icon quirks
    $leftVis = 10
    $rightVis = $clock.Length + 2
    $mid = $innerW - $leftVis - $rightVis
    if ($mid -lt 2) { $mid = 2 }
    Write-Host (Color-Text $p.dim ("  " + $tl + $hz)) -NoNewline
    Write-Host (Color-Text $p.accent $leftTitle) -NoNewline
    Write-Host (Color-Text $p.dim (($hz * $mid))) -NoNewline
    Write-Host (Color-Text $p.dim (" " + $clock + " ")) -NoNewline
    Write-Host (Color-Text $p.dim ($hz + $tr))

    Write-BoxLine "" $innerW $p $vt $vt

    $badge = (" " + $snap.Notebook.Grade + " ")
    $scoreLine =
        (Color-Text $p.dim "notebook  ") +
        (Color-Text $scoreCol ("{0,3}" -f $score)) +
        (Color-Text $p.dim "/100  ") +
        (Color-TextBg "#0B0F1A" $scoreCol $badge) +
        (Color-Text $p.accent2 ("  " + $snap.Notebook.Label))
    Write-BoxLine $scoreLine $innerW $p $vt $vt

    # score bar inside the card
    $scoreBar =
        (Color-Text $p.dim "          ") +
        (Write-GradientBar $score ($barW - 8) $scoreCol (Mix-PulseHex $p.accent $scoreCol 0.35) (Mix-PulseHex $p.base $p.dim 0.55))
    Write-BoxLine $scoreBar $innerW $p $vt $vt

    $feelLine =
        (Color-Text $p.dim "feeling   ") +
        (Color-Text $p.accent2 $snap.Feel.Word) +
        (Color-Text $p.dim ("  -  " + $snap.Feel.Tip))
    Write-BoxLine $feelLine $innerW $p $vt $vt

    $tipLine = (Color-Text $p.dim ("tip       " + $snap.Notebook.Tip))
    Write-BoxLine $tipLine $innerW $p $vt $vt

    $spark = Write-Sparkline $hist $scoreCol
    $sparkLine = (Color-Text $p.dim "trend     ") + $spark
    Write-BoxLine $sparkLine $innerW $p $vt $vt

    if ($null -ne $snap.Battery) {
        $b = $snap.Battery
        $bTag = if ($b.Charging) { "charging" } elseif ($b.OnAc) { "plugged" } else { "battery" }
        $bCol = if ($b.Pct -le 15 -and -not $b.OnAc) { "#FF6B6B" } elseif ($b.Pct -le 30 -and -not $b.OnAc) { "#FFB020" } else { $p.accent2 }
        $batLine =
            (Color-Text $p.dim "power     ") +
            (Color-Text $bCol ("{0,3}%" -f $b.Pct)) +
            (Color-Text $p.dim ("  " + $bTag))
        Write-BoxLine $batLine $innerW $p $vt $vt
    }

    Write-BoxLine "" $innerW $p $vt $vt
    $foot = if ($Once) { "snapshot" } else { ("live  Ctrl+E / Q  " + $Ms + "ms") }
    $footPad = $innerW - $foot.Length
    if ($footPad -lt 1) { $footPad = 1 }
    Write-Host (Color-Text $p.dim ("  " + $bl + $hz + " ")) -NoNewline
    Write-Host (Color-Text $p.dim $foot) -NoNewline
    Write-Host (Color-Text $p.dim ((" " + ($hz * $footPad) + $br)))

    Write-Host ""
    Write-Host (Color-Text $p.accent ("  vitals")) -NoNewline
    Write-Host (Color-Text $p.dim ("  " + ($hz * [Math]::Min(24, $barW))))
    Write-Host ""

    $cpuVal = ("{0,3}%  " -f $snap.CpuLoad)
    if ($null -ne $snap.CpuTemp) { $cpuVal += ("{0}C" -f $snap.CpuTemp) }
    Render-MetricBlock $p "CPU" $cpuVal $snap.CpuLoad $snap.CpuTemp (Clip-Text $snap.CpuName 52) $barW

    if ($snap.Gpus.Count -eq 0) {
        Render-MetricBlock $p "GPU" "n/a" 0 $null "no adapter sensors" $barW
    } else {
        $i = 0
        foreach ($g in $snap.Gpus) {
            $title = if ($i -eq 0) { "GPU" } else { "GPU$i" }
            $i++
            if ($null -ne $g.Load) {
                $val = ("{0,3}%  " -f $g.Load)
                if ($null -ne $g.TempC) { $val += ("{0}C  " -f $g.TempC) }
                if ($g.MemTot -gt 0) { $val += ("{0}/{1} MB  " -f $g.MemUsed, $g.MemTot) }
                if ($null -ne $g.PowerW) { $val += ("{0:N0}W" -f $g.PowerW) }
                Render-MetricBlock $p $title $val.Trim() ([double]$g.Load) $g.TempC (Clip-Text $g.Name 52) $barW
            } else {
                Render-MetricBlock $p $title "idle / no sensors" 0 $null (Clip-Text $g.Name 52) $barW
            }
        }
    }

    $ramVal = ("{0,3}%   {1} / {2}" -f $snap.RamPct, (Format-GiB $snap.RamUsed), (Format-GiB $snap.RamTot))
    Render-MetricBlock $p "RAM" $ramVal $snap.RamPct $null "" $barW

    if (-not $Once) {
        Write-Host (Color-Text $p.dim "  A apps  |  Ctrl+E exit")
        Write-Host ""
    }
}

# ---- apps closer (arrow list) ----------------------------------------------

function Get-PulseProtectedNames {
    return @(
        "idle", "system", "smss", "csrss", "wininit", "winlogon", "services", "lsass",
        "svchost", "fontdrvhost", "dwm", "sihost", "taskhostw", "explorer",
        "searchhost", "startmenuexperiencehost", "runtimebroker", "ctfmon", "conhost",
        "msmpeng", "securityhealthservice", "nissrv", "memory compression",
        "cursor", "winghostty", "ghostty", "foxos-live", "powershell", "pwsh",
        "windows terminal", "windowsterminal", "textinputhost", "shellexperiencehost",
        "applicationframehost", "systemsettings", "searchindexer", "dllhost"
    )
}

function Get-PulseAppGroups {
    $protected = Get-PulseProtectedNames
    $self = $PID
    $groups = @{}

    foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
        if ($p.Id -eq $self) { continue }
        $name = ""
        if ($null -ne $p.ProcessName) { $name = ([string]$p.ProcessName).Trim() }
        if ($name.Length -eq 0) { continue }
        $key = $name.ToLowerInvariant()
        if ($protected -contains $key) { continue }
        # skip tiny noise
        $ws = [double]$p.WorkingSet64
        if ($ws -lt 25MB -and $p.MainWindowHandle -eq [IntPtr]::Zero) { continue }

        if (-not $groups.ContainsKey($key)) {
            $groups[$key] = [pscustomobject]@{
                Key      = $key
                Name     = $name
                Count    = 0
                WsBytes  = [int64]0
                Pids     = New-Object System.Collections.Generic.List[int]
                HasWindow= $false
            }
        }
        $g = $groups[$key]
        $g.Count++
        $g.WsBytes += [int64]$ws
        $g.Pids.Add([int]$p.Id) | Out-Null
        if ($p.MainWindowHandle -ne [IntPtr]::Zero) { $g.HasWindow = $true }
    }

    return @(
        $groups.Values |
            Sort-Object -Property @{ Expression = "WsBytes"; Descending = $true }, @{ Expression = "Name"; Descending = $false }
    )
}

function Format-PulseMb([int64]$bytes) {
    $mb = $bytes / 1MB
    if ($mb -ge 1024) { return ("{0:N1}G" -f ($mb / 1024.0)) }
    return ("{0:N0}M" -f $mb)
}

function Close-PulseAppGroup($group) {
    if ($null -eq $group) { return @{ Ok = 0; Fail = 0; Name = "?" } }
    $ok = 0; $fail = 0
    # Prefer CloseMainWindow first for the "main" looking processes
    foreach ($proc in (Get-Process -Name $group.Name -ErrorAction SilentlyContinue)) {
        try {
            if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
                $proc.CloseMainWindow() | Out-Null
            }
        } catch {}
    }
    Start-Sleep -Milliseconds 400
    foreach ($id in @($group.Pids)) {
        try {
            $alive = Get-Process -Id $id -ErrorAction SilentlyContinue
            if ($null -eq $alive) { $ok++; continue }
            Stop-Process -Id $id -Force -ErrorAction Stop
            $ok++
        } catch {
            try {
                & taskkill.exe /F /PID $id 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) { $ok++ } else { $fail++ }
            } catch { $fail++ }
        }
    }
    # catch relaunched helpers with same name
    Start-Sleep -Milliseconds 250
    Get-Process -Name $group.Name -ErrorAction SilentlyContinue | ForEach-Object {
        try { Stop-Process -Id $_.Id -Force -ErrorAction Stop; $ok++ } catch { $fail++ }
    }
    return @{ Ok = $ok; Fail = $fail; Name = $group.Name }
}

function Render-PulseApps([object[]]$items, [int]$index, $p, [string]$status) {
    Clear-Host
    $tl = [string][char]0x256D; $tr = [string][char]0x256E
    $bl = [string][char]0x2570; $br = [string][char]0x256F
    $hz = [string][char]0x2500
    $winW = Get-WinWidth
    $inner = [Math]::Min(62, [Math]::Max(46, $winW - 8))

    Write-Host ""
    Write-Host (Color-Text $p.dim ("  " + $tl + $hz + " ")) -NoNewline
    Write-Host (Color-Text $p.accent "pulse apps") -NoNewline
    Write-Host (Color-Text $p.dim (" " + ($hz * [Math]::Max(2, $inner - 14)) + " " + $tr))
    Write-Host (Color-Text $p.dim "  close heavy apps to free RAM")
    Write-Host (Color-Text $p.dim "  Up/Down  Enter close  Back/Esc vitals  R refresh")
    Write-Host ""

    # row 0 = Back
    $rows = @([pscustomobject]@{ Kind = "back"; Name = "Back"; Count = 0; WsBytes = 0 })
    foreach ($it in @($items)) { $rows += $it }
    if ($index -lt 0) { $index = 0 }
    if ($index -ge $rows.Count) { $index = $rows.Count - 1 }

    $viewH = 16
    try { $viewH = [Math]::Max(10, $Host.UI.RawUI.WindowSize.Height - 12) } catch {}
    $top = 0
    if ($index -ge $viewH) { $top = $index - $viewH + 1 }

    for ($i = $top; $i -lt [Math]::Min($rows.Count, $top + $viewH); $i++) {
        $r = $rows[$i]
        $sel = ($i -eq $index)
        if ($r.Kind -eq "back") {
            $label = "<  Back to vitals"
            if ($sel) {
                Write-Host (Color-TextBg "#0B0F1A" $p.accent ("  > " + $label + " "))
            } else {
                Write-Host (Color-Text $p.accent2 ("    " + $label))
            }
            Write-Host ""
            continue
        }
        $mem = Format-PulseMb ([int64]$r.WsBytes)
        $mark = if ($sel) { ">" } else { " " }
        $line = ("{0} {1,-22}  {2,4}  x{3}" -f $mark, (Clip-Text $r.Name 22), $mem, $r.Count)
        if ($sel) {
            Write-Host (Color-TextBg "#0B0F1A" $p.accent2 (" " + $line + " "))
        } else {
            Write-Host (Color-Text $p.text (" " + $line))
        }
    }

    if (@($items).Count -eq 0) {
        Write-Host (Color-Text $p.dim "  (no closable heavy apps right now)")
    }

    Write-Host ""
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        Write-Host (Color-Text $p.accent2 ("  " + $status))
    }
    $os = Get-CimInstance Win32_OperatingSystem
    $freeG = [Math]::Round(($os.FreePhysicalMemory / 1MB), 2)
    $totG = [Math]::Round(($os.TotalVisibleMemorySize / 1MB), 2)
    Write-Host (Color-Text $p.dim ("  RAM free  " + $freeG + "G / " + $totG + "G"))
    Write-Host (Color-Text $p.dim ("  " + $bl + ($hz * ($inner - 2)) + $br))
    Write-Host ""

    return $index
}

function Invoke-PulseAppsLoop($p) {
    $items = @(Get-PulseAppGroups)
    $index = 0
    $status = ""
    while ($true) {
        $p = Get-ThemePalette
        $index = Render-PulseApps $items $index $p $status
        $k = [Console]::ReadKey($true)

        if ($k.Key -eq "UpArrow" -or $k.Key -eq "K") {
            if ($index -gt 0) { $index-- }
            continue
        }
        if ($k.Key -eq "DownArrow" -or $k.Key -eq "J") {
            $max = @($items).Count   # + Back row
            if ($index -lt $max) { $index++ }
            continue
        }
        if ($k.Key -eq "R" -or $k.Key -eq "F5") {
            $items = @(Get-PulseAppGroups)
            if ($index -gt @($items).Count) { $index = @($items).Count }
            $status = "refreshed"
            continue
        }
        if ($k.Key -eq "Escape" -or $k.Key -eq "Backspace" -or $k.Key -eq "LeftArrow" -or $k.Key -eq "BrowserBack") {
            return "back"
        }
        if ($k.Key -eq "Q" -or (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E")) {
            return "quit"
        }
        if ($k.Key -eq "Enter" -or $k.Key -eq "Spacebar") {
            if ($index -le 0) { return "back" }
            $target = $items[$index - 1]
            if ($null -eq $target) { continue }
            $status = ("closing " + $target.Name + " ...")
            $null = Render-PulseApps $items $index $p $status
            $res = Close-PulseAppGroup $target
            if ($res.Fail -gt 0 -and $res.Ok -eq 0) {
                $status = ($res.Name + " - access denied (try run terminal as admin)")
            } elseif ($res.Fail -gt 0) {
                $status = ("{0} - closed {1}, failed {2}" -f $res.Name, $res.Ok, $res.Fail)
            } else {
                $status = ("{0} - closed ({1})" -f $res.Name, $res.Ok)
            }
            $items = @(Get-PulseAppGroups)
            if ($index -gt @($items).Count) { $index = @($items).Count }
            continue
        }
    }
}

function Start-PulseVitalsLoop([ref]$cpuSample) {
    $p = Get-ThemePalette
    while ($true) {
        if ([Console]::KeyAvailable) {
            $k = [Console]::ReadKey($true)
            if (($k.Modifiers -band [ConsoleModifiers]::Control) -and $k.Key -eq "E") { return "quit" }
            if ($k.Key -eq "Escape" -or $k.Key -eq "Q") { return "quit" }
            if ($k.Key -eq "A") { return "apps" }
        }
        $snap = Get-Snapshot $cpuSample.Value
        $cpuSample.Value = $snap.CpuSample
        $p = Get-ThemePalette
        Render-Pulse $snap $p
        Start-Sleep -Milliseconds $Ms
    }
}

$p = Get-ThemePalette
$warm = Get-CpuLoadPct $null
$cpuSample = $warm.Sample
Start-Sleep -Milliseconds 250

if ($Once -and -not $Apps) {
    Render-Pulse (Get-Snapshot $cpuSample) $p
    exit 0
}

# Main: vitals <-> apps
$screen = if ($Apps) { "apps" } else { "vitals" }
while ($true) {
    if ($screen -eq "apps") {
        $nav = Invoke-PulseAppsLoop $p
        if ($nav -eq "quit") { break }
        $screen = "vitals"
        continue
    }
    $cpuRef = [ref]$cpuSample
    $nav = Start-PulseVitalsLoop $cpuRef
    $cpuSample = $cpuRef.Value
    if ($nav -eq "quit") { break }
    if ($nav -eq "apps") { $screen = "apps" }
}
