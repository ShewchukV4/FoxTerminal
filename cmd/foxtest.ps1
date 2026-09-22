param(
    [switch]$List,              # Показати, що саме буде запущено, і вийти
    [switch]$Quiet,             # Тільки підсумок, без рядка на кожну команду
    [string[]]$Only,            # Прогнати лише ці команди: foxtest -Only chek,term
    [ValidateSet("all", "info", "tui", "bat")]
    [string]$Group = "all",     # Обмежити прогін однією групою
    [int]$Timeout = 40          # Скільки секунд чекати на команду, що має завершитись
)

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "ghostty-lib.ps1")

# ── manifest ────────────────────────────────────────────────
#
# Interactivity cannot be detected from the outside, so each command is listed with
# the way it can be exercised without taking over the desktop:
#
#   info  must run to completion on its own
#   tui   draws an interface and then blocks on a key; reaching that point is a pass
#   bat   .bat wrapper with no .ps1 of its own
#   skip  would mutate settings, close the terminal, or is a shared library
#
# Anything in cmd\ that is missing from all four lists is reported as "not covered",
# so this manifest cannot silently fall behind as commands are added.

$infoCommands = [ordered]@{
    "chek"          = @()
    "term"          = @("-Status")
    "sixel"         = @()
    "interface"     = @("-Keys")
    "foxdeps"       = @("-Check")
    "build"         = @("-list")
    "sites"         = @("-list")
    "foxaddon"      = @("-Status")
    "foxzen"        = @("-Status")
    "ffsync"        = @("-Status")
    "foxhotkeys"    = @("-Status")
    "foxbg"         = @("-Top", "3")
    "foxscan"       = @("-Top", "3")
    "ftime"         = @()
    "disk"          = @()
    "ip"            = @()
    "wifi"          = @()
    "who"           = @()
    "users"         = @()
    "blist"         = @()
    "apps"          = @()
    "appbind"       = @("menu")
    "hash"          = @("foxterminal")
    "netping"       = @()
    "weather"       = @()
    "fday"          = @()
    "ytsplit"       = @()
    "spider-script" = @()
    "yt"            = @()
    "tg"            = @()
    "tgub"          = @()
    "ask"           = @()
    "sum"           = @()
    "nano"          = @()
    "view"          = @()
    "apple"         = @()
    "arthas"        = @()
    "frederik"      = @()
    "shader"        = @("status")
    "foxos"         = @("status")
    "lock"          = @("-Status")
    "settings"      = @("-Status")
    "foxlife"       = @("-Status")
}

# Filesystem scans and network sweeps are legitimately slow, so they get a longer
# allowance than -Timeout instead of looking like a hang on a busy machine.
$slowCommands = @{
    "foxscan" = 180
    "netping" = 90
    "foxbg"   = 90
    "foxdeps" = 90
}

$tuiCommands = @(
    "foxhelp", "themes", "sw-script", "sites", "ytm-ui", "sp-ui", "friend",
    "interface", "term", "tglist", "foxinfo", "unhash", "nfile", "nfould",
    "fdel", "go", "up", "edit", "changelog", "passwd", "nuser", "l", "bbind", "bdel",
    "foxpack", "dnote", "ytm", "sp", "dj", "home", "foxsetup"
)

$batCommands = @("gask", "ser")

$skipCommands = [ordered]@{
    "foxauth"        = "shared library, dot-sourced by other commands"
    "ghostty-lib"    = "shared library"
    "fox-browser"    = "shared library"
    "foxcodec"       = "shared library"
    "note-lib"       = "shared library"
    "pride-lib"      = "shared library"
    "shader-lib"     = "shared library"
    "foxos-lib"      = "shared library"
    "foxsys-lib"     = "shared library"
    "foxos-deskcmd"  = "desktop overlay runner"
    "hk_lib"         = "shared library"
    "hk_parse"       = "shared library"
    "foxhash-lookup" = "shared helper for hash / unhash"
    "noir"           = "changes the active theme"
    "pride"          = "changes the active theme"
    "foxreset"       = "resets configuration"
    "foxmirror"      = "needs a USB iPhone; may download/install Apple Mobile Device Support"
    "texit"          = "closes the terminal"
    "uexit"          = "logs the user out"
    "clear"          = "clears the screen, nothing to assert"
    "reconnect"      = "restarts the sync daemon"
    "interface-gui"  = "opens a GUI window"
    "ff"             = "needs the ffsync daemon running"
    "wai"            = "needs the ffsync daemon running"
}

# ── output helpers ──────────────────────────────────────────

function Get-FoxTestWarn {
    $p = Get-ThemePalette
    if (Test-NoirActive) { return $p.accent4 }
    return "#FBD38D"
}

function Write-Result([string]$status, [string]$name, [string]$detail) {
    if ($Quiet) { return }
    $p = Get-ThemePalette
    $color = switch ($status) {
        "OK"       { $p.accent2 }
        "SILENT"   { $p.dim }
        "RENDERED" { $p.accent }
        default    { Get-FoxTestWarn }
    }
    Write-Host (Color-Text $color ("  [" + $status.PadRight(8) + "] ")) -NoNewline
    Write-Host (Color-Text $p.text $name.PadRight(22)) -NoNewline
    Write-Host (Color-Text $p.dim $detail)
}

# ── runner ──────────────────────────────────────────────────

$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$name, [string]$group, [string]$status, [string]$detail) {
    $results.Add([pscustomobject]@{ Command = $name; Group = $group; Status = $status; Detail = $detail })
    Write-Result $status $name $detail
}

function Invoke-Probe([string]$exe, [string[]]$argv, [int]$waitSec) {
    $so = [System.IO.Path]::GetTempFileName()
    $se = [System.IO.Path]::GetTempFileName()
    try {
        $proc = Start-Process -FilePath $exe -ArgumentList $argv -NoNewWindow -PassThru `
            -RedirectStandardOutput $so -RedirectStandardError $se

        # Poll rather than WaitForExit: a command that leaves a grandchild holding the
        # inherited stdout handle can keep WaitForExit from ever returning.
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        while (-not $proc.HasExited -and $sw.Elapsed.TotalSeconds -lt $waitSec) {
            Start-Sleep -Milliseconds 200
        }
        $exited = $proc.HasExited
        if (-not $exited) {
            try { & taskkill.exe /T /F /PID $proc.Id 2>&1 | Out-Null } catch {}
            Start-Sleep -Milliseconds 400
        }

        $out = Get-Content $so -Raw -ErrorAction SilentlyContinue
        $err = Get-Content $se -Raw -ErrorAction SilentlyContinue
        if ($null -eq $out) { $out = "" }
        if ($null -eq $err) { $err = "" }
        return [pscustomobject]@{ Exited = $exited; Out = $out; Err = $err }
    } finally {
        Remove-Item $so, $se -Force -ErrorAction SilentlyContinue
    }
}

function Get-ErrSummary([string]$err) {
    $line = $err -split "`r?`n" | Where-Object { $_ -match '\S' } | Select-Object -First 1
    if (-not $line) { return "unknown error" }
    $line = $line.Trim()
    if ($line.Length -gt 90) { $line = $line.Substring(0, 90) + "..." }
    return $line
}

# A missing console is the expected outcome for menu-driven commands, so it must not
# be confused with the command itself being broken.
$consolePattern = "Cannot read keys|does not have a console|input has been redirected"

function Measure-Lines([string]$text) {
    return ($text -split "`r?`n" | Where-Object { $_ -match '\S' }).Count
}

function Test-InfoCommand([string]$name, [string[]]$argv) {
    $script = Join-Path $PSScriptRoot ($name + ".ps1")
    $label = if ($argv.Count) { $name + " " + ($argv -join " ") } else { $name }
    if (-not (Test-Path $script)) {
        Add-Result $label "info" "MISSING" ("cmd\" + $name + ".ps1 not found"); return
    }

    $wait = $Timeout
    if ($slowCommands.ContainsKey($name)) { $wait = [Math]::Max($Timeout, $slowCommands[$name]) }

    $r = Invoke-Probe "powershell.exe" (@("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $script) + $argv) $wait
    if (-not $r.Exited) {
        Add-Result $label "info" "HANG" ("did not exit within " + $wait + "s"); return
    }
    if ($r.Err.Trim() -and $r.Err -notmatch $consolePattern) {
        Add-Result $label "info" "ERROR" (Get-ErrSummary $r.Err); return
    }
    $lines = Measure-Lines $r.Out
    if ($lines -eq 0) {
        Add-Result $label "info" "SILENT" "exited cleanly with no output"
    } else {
        Add-Result $label "info" "OK" ($lines.ToString() + " lines of output")
    }
}

function Test-TuiCommand([string]$name) {
    $script = Join-Path $PSScriptRoot ($name + ".ps1")
    if (-not (Test-Path $script)) {
        Add-Result $name "tui" "MISSING" ("cmd\" + $name + ".ps1 not found"); return
    }

    # Long enough to paint an interface, short enough to keep the whole run bearable.
    $r = Invoke-Probe "powershell.exe" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $script) 8
    $broken = $r.Err -match "is not recognized|CommandNotFound|ParameterBindingException|ParserError|Unexpected token|MethodNotFound|PropertyNotFound"
    if ($broken -or ($r.Err.Trim() -and $r.Err -notmatch $consolePattern)) {
        Add-Result $name "tui" "ERROR" (Get-ErrSummary $r.Err); return
    }
    Add-Result $name "tui" "RENDERED" ("drew " + (Measure-Lines $r.Out) + " lines, then waited for a key")
}

function Test-BatCommand([string]$name) {
    $bat = Join-Path $PSScriptRoot ($name + ".bat")
    if (-not (Test-Path $bat)) {
        Add-Result $name "bat" "MISSING" ("cmd\" + $name + ".bat not found"); return
    }
    $r = Invoke-Probe "cmd.exe" @("/c", $bat) $Timeout
    if (-not $r.Exited) { Add-Result $name "bat" "HANG" "did not exit"; return }
    if ($r.Err.Trim()) { Add-Result $name "bat" "ERROR" (Get-ErrSummary $r.Err); return }
    Add-Result $name "bat" "OK" (Get-ErrSummary $r.Out)
}

# ── selection ───────────────────────────────────────────────

# The .bat wrapper calls this through "powershell -File", where "-Only a,b" arrives as
# the single string "a,b", so split on commas as well as accepting a real array.
$onlyFilters = @()
foreach ($o in $Only) {
    if ($o) {
        $onlyFilters += ($o -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
}

function Test-Wanted([string]$name) {
    if ($onlyFilters.Count -eq 0) { return $true }
    foreach ($o in $onlyFilters) { if ($name -like $o) { return $true } }
    return $false
}

$runInfo = ($Group -eq "all" -or $Group -eq "info")
$runTui  = ($Group -eq "all" -or $Group -eq "tui")
$runBat  = ($Group -eq "all" -or $Group -eq "bat")

$p = Get-ThemePalette

if ($List) {
    Write-Host ""
    Write-Host (Color-Text $p.accent "=== foxtest: planned run ===")
    Write-Host ""
    if ($runInfo) {
        Write-Host (Color-Text $p.accent2 "  runs to completion:")
        foreach ($k in $infoCommands.Keys) {
            $a = $infoCommands[$k]
            Write-Host (Color-Text $p.text ("    " + $k + $(if ($a.Count) { " " + ($a -join " ") } else { "" })))
        }
        Write-Host ""
    }
    if ($runTui) {
        Write-Host (Color-Text $p.accent2 "  draws a UI, then waits for a key:")
        Write-Host (Color-Text $p.text ("    " + ($tuiCommands -join ", ")))
        Write-Host ""
    }
    if ($runBat) {
        Write-Host (Color-Text $p.accent2 "  .bat wrappers:")
        Write-Host (Color-Text $p.text ("    " + ($batCommands -join ", ")))
        Write-Host ""
    }
    Write-Host (Color-Text $p.accent2 "  deliberately skipped:")
    foreach ($k in $skipCommands.Keys) {
        Write-Host (Color-Text $p.dim ("    " + $k.PadRight(16) + $skipCommands[$k]))
    }
    Write-Host ""
    return
}

Write-Host ""
Write-Host (Color-Text $p.accent "=== foxtest ===")
if (-not (Test-InGhostty)) {
    Write-Host (Color-Text (Get-FoxTestWarn) "  not running inside Ghostty - results still valid, but run it from Ghostty for a real check")
}
Write-Host ""

$clock = [System.Diagnostics.Stopwatch]::StartNew()

if ($runInfo) {
    foreach ($k in $infoCommands.Keys) {
        if (Test-Wanted $k) { Test-InfoCommand $k $infoCommands[$k] }
    }
}
if ($runTui) {
    foreach ($n in $tuiCommands) {
        if (Test-Wanted $n) { Test-TuiCommand $n }
    }
}
if ($runBat) {
    foreach ($n in $batCommands) {
        if (Test-Wanted $n) { Test-BatCommand $n }
    }
}

$clock.Stop()

# ── summary ─────────────────────────────────────────────────

if ($results.Count -eq 0) {
    Write-Host (Color-Text (Get-FoxTestWarn) ("  Nothing matched -Only " + ($onlyFilters -join ", ")))
    Write-Host (Color-Text $p.dim "  Run 'foxtest -List' to see the command names.")
    Write-Host ""
    return
}

# The @() wrappers matter: a single-item pipeline result is unwrapped to a scalar,
# whose .Count is empty in PowerShell 5.1.
$ok       = @($results | Where-Object { $_.Status -in @("OK", "SILENT") }).Count
$rendered = @($results | Where-Object { $_.Status -eq "RENDERED" }).Count
$bad      = @($results | Where-Object { $_.Status -in @("ERROR", "HANG", "MISSING") })

Write-Host ""
Write-Host (Color-Text $p.dim ("  " + $ok + " ran clean, " + $rendered + " drew their UI, " + $bad.Count + " need attention" +
    "   (" + [int]$clock.Elapsed.TotalSeconds + "s)"))

if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host (Color-Text (Get-FoxTestWarn) "  Needs attention:")
    foreach ($b in $bad) {
        Write-Host (Color-Text $p.text ("    " + $b.Command.PadRight(22))) -NoNewline
        Write-Host (Color-Text (Get-FoxTestWarn) ($b.Status + " - " + $b.Detail))
    }
}

# Keep the manifest honest: flag any command in cmd\ that no list mentions.
if (-not $Only -and $Group -eq "all") {
    $known = @()
    $known += $infoCommands.Keys
    $known += $tuiCommands
    $known += $batCommands
    $known += $skipCommands.Keys
    $uncovered = Get-ChildItem $PSScriptRoot -Filter *.ps1 -File |
                 ForEach-Object { $_.BaseName } |
                 Where-Object { $known -notcontains $_ -and $_ -ne "foxtest" } |
                 Sort-Object
    if ($uncovered) {
        Write-Host ""
        Write-Host (Color-Text (Get-FoxTestWarn) "  Not covered by foxtest yet:")
        Write-Host (Color-Text $p.dim ("    " + ($uncovered -join ", ")))
        Write-Host (Color-Text $p.dim "    add them to the manifest at the top of cmd\foxtest.ps1")
    }
}

Write-Host ""
if ($bad.Count -gt 0) { exit 1 }
