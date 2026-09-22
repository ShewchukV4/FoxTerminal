param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Line
)

$ErrorActionPreference = "Stop"
$cmdDir = $PSScriptRoot
. (Join-Path $cmdDir "foxauth.ps1")
. (Join-Path $cmdDir "fox-browser.ps1")
. (Join-Path $cmdDir "foxos-lib.ps1")

function Write-DeskLog([string]$msg) {
    try {
        $p = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos\deskcmd.log"
        Add-Content -LiteralPath $p -Value (("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg)) -Encoding UTF8
    } catch { }
}

function Get-DeskColors {
    return @(
        "orange","blue","purple","cyan",
        "crimson","rose","magenta","violet","indigo",
        "sky","teal","mint","emerald","lime",
        "gold","amber","peach","coral","ruby",
        "slate","ice","neon","forest","mocha",
        "black","white","noir","dnote","pride",
        "arthas","arthas-dark","arthas-light"
    )
}

function Open-DeskUrl([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { throw "empty url" }
    $info = Get-FoxBrowserInfo
    if ($info -and $info.Path -and (Test-Path -LiteralPath $info.Path)) {
        Start-Process -FilePath $info.Path -ArgumentList @("-new-tab", $url) | Out-Null
        Write-DeskLog ("browser " + $info.Path + " " + $url)
        return
    }
    if (Get-Command Open-FoxBrowserUrl -ErrorAction SilentlyContinue) {
        Open-FoxBrowserUrl -Url $url -Mode tab | Out-Null
    } else {
        $zen = "C:\Program Files\Zen Browser\zen.exe"
        if (Test-Path -LiteralPath $zen) {
            Start-Process -FilePath $zen -ArgumentList @("-new-tab", $url) | Out-Null
        }
    }
    Write-DeskLog ("shell " + $url)
}

function Start-DeskApp([string]$name, [string[]]$extra) {
    $ps1 = Join-Path $cmdDir ($name + ".ps1")
    if (-not (Test-Path -LiteralPath $ps1)) { throw "missing $name" }
    $arg = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ps1)
    if ($extra -and $extra.Count -gt 0) { $arg += $extra }
    Start-Process -FilePath "powershell.exe" -ArgumentList $arg -WorkingDirectory $cmdDir -WindowStyle Hidden | Out-Null
    Write-DeskLog ("ps1 " + $name)
}

$raw = ([string]$Line).Trim()
if ($raw.Length -eq 0) { exit 0 }
$parts = @($raw.Split(@(" "), [System.StringSplitOptions]::RemoveEmptyEntries))
$verb = $parts[0].ToLowerInvariant()
$rest = @()
if ($parts.Length -gt 1) { $rest = $parts[1..($parts.Length - 1)] }
$query = if ($rest.Count -gt 0) { ($rest -join " ").Trim() } else { "" }

Write-DeskLog ("run " + $raw)

switch ($verb) {
    "sw" {
        if ($rest.Count -lt 1) { throw "sw needs a color" }
        $name = $rest[0].Trim().ToLowerInvariant()
        if ($name -eq "default" -or $name -eq "orig" -or $name -eq "original") { $name = "orange" }
        if ((Get-DeskColors) -notcontains $name) { throw "unknown color" }
        Save-ActiveTheme $name
        $name | Set-Content -LiteralPath (Get-ThemePath) -Encoding UTF8
        Clear-FoxThemeCache
        Sync-FoxTheme
    }
    { $_ -in @("noir","dnote","pride","arthas") } {
        $target = if ($verb -eq "arthas") { "arthas-dark" } else { $verb }
        $disk = if (Get-Command Get-FoxOsThemeName -ErrorAction SilentlyContinue) {
            Get-FoxOsThemeName
        } else {
            Get-DiskThemeName
        }
        if ($disk -ne $target) {
            if (Get-Command Save-MainThemeToggleState -ErrorAction SilentlyContinue) {
                Save-MainThemeToggleState $target $disk
            }
            if (Get-Command Save-ActiveTheme -ErrorAction SilentlyContinue) {
                Save-ActiveTheme $target
            } else {
                $target | Set-Content -LiteralPath (Get-ThemePath) -Encoding UTF8
            }
        }
        if (Get-Command Get-FoxControlThemePath -ErrorAction SilentlyContinue) {
            $target | Set-Content -LiteralPath (Get-FoxControlThemePath) -Encoding UTF8
        }
        if (Get-Command Clear-FoxThemeCache -ErrorAction SilentlyContinue) { Clear-FoxThemeCache }
        if (Get-Command Sync-FoxTheme -ErrorAction SilentlyContinue) {
            Sync-FoxTheme
        } elseif (Get-Command Sync-FoxOsSkin -ErrorAction SilentlyContinue) {
            Sync-FoxOsSkin -Force
        }
        Write-DeskLog ("theme " + $target)
    }
    "shader" {
        $act = if ($rest.Count -gt 0) { $rest[0] } else { "toggle" }
        if ($act -notin @("on","off","toggle","status")) { throw "shader on|off|toggle" }
        & (Join-Path $cmdDir "shader.ps1") $act | Out-Null
    }
    "foxos" {
        $act = if ($rest.Count -gt 0) { $rest[0] } else { "status" }
        if ($act -notin @("on","off","toggle","status","apply")) { throw "foxos on|off" }
        & (Join-Path $cmdDir "foxos.ps1") $act | Out-Null
    }
    "foxlook" {
        $act = if ($rest.Count -gt 0) { $rest[0].ToLowerInvariant() } else { "status" }
        if ($act -eq "shell") {
            $sv = if ($rest.Count -gt 1) { $rest[1].ToLowerInvariant() } else { "" }
            if ($sv -notin @("on","off")) { throw "foxlook shell on|off" }
            & (Join-Path $cmdDir "foxlook.ps1") "shell" $sv | Out-Null
            return
        }
        if ($act -eq "dock") {
            $dk = if ($rest.Count -gt 1) { $rest[1].ToLowerInvariant() } else { "status" }
            $dv = if ($rest.Count -gt 2) { $rest[2].ToLowerInvariant() } else { "" }
            if ($dv) { & (Join-Path $cmdDir "foxlook.ps1") "dock" $dk $dv | Out-Null }
            else { & (Join-Path $cmdDir "foxlook.ps1") "dock" $dk | Out-Null }
            return
        }
        if ($act -eq "cursor") {
            $cs = if ($rest.Count -gt 1) { $rest[1].ToLowerInvariant() } else { "" }
            $sc = if ($rest.Count -gt 2) { $rest[2] } else { "" }
            if ($sc) { & (Join-Path $cmdDir "foxlook.ps1") "cursor" $cs $sc | Out-Null }
            else { & (Join-Path $cmdDir "foxlook.ps1") "cursor" $cs | Out-Null }
            return
        }
        if ($act -notin @("on","off","status")) { throw "foxlook on|off" }
        & (Join-Path $cmdDir "foxlook.ps1") $act | Out-Null
    }
    "ytm" {
        if ([string]::IsNullOrWhiteSpace($query)) {
            Open-DeskUrl "https://music.youtube.com/"
        } else {
            Open-DeskUrl ("https://music.youtube.com/search?q=" + [uri]::EscapeDataString($query))
        }
    }
    { $_ -in @("yt","youtube") } {
        if ([string]::IsNullOrWhiteSpace($query)) {
            Open-DeskUrl "https://www.youtube.com/"
        } else {
            Open-DeskUrl ("https://www.youtube.com/results?search_query=" + [uri]::EscapeDataString($query))
        }
    }
    "ff" {
        $target = if ([string]::IsNullOrWhiteSpace($query)) { "https://www.youtube.com/" } else { $query }
        if ($target -notmatch '^https?://') { $target = "https://www.youtube.com/results?search_query=" + [uri]::EscapeDataString($target) }
        Open-DeskUrl $target
    }
    "ser" {
        if ([string]::IsNullOrWhiteSpace($query)) { throw "ser <terms>" }
        Open-DeskUrl ("https://www.google.com/search?q=" + [uri]::EscapeDataString($query))
    }
    "foxhelp" {
        $req = Join-Path (Get-FoxOsDir) "help.req"
        "1" | Set-Content -LiteralPath $req -Encoding UTF8
        Write-DeskLog "foxhelp"
    }
    "sp" {
        $exe = @(
            (Join-Path $env:APPDATA "Spotify\Spotify.exe"),
            (Join-Path $env:LOCALAPPDATA "Spotify\Spotify.exe")
        ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
        if ($exe) {
            Start-Process -FilePath $exe | Out-Null
        } elseif ([string]::IsNullOrWhiteSpace($query)) {
            Start-Process "spotify:" | Out-Null
        } else {
            Open-DeskUrl "https://open.spotify.com/"
        }
        Write-DeskLog "sp"
    }
    "term" {
        . (Join-Path $cmdDir "ghostty-lib.ps1")
        if (-not (Start-FoxGhosttyWindow -Command $query)) { throw "ghostty missing" }
        Write-DeskLog ("term " + $query)
    }
    "sites" {
        $hub = Join-Path (Split-Path $cmdDir -Parent) "sites\hub\index.html"
        if (-not (Test-Path -LiteralPath $hub)) { throw "hub missing" }
        Open-DeskUrl (([Uri]$hub).AbsoluteUri)
    }
    "dj" {
        Start-DeskApp "ytm-ui" @()
    }
    "rig" {
        $cur = Get-FoxOsRigStyle
        $next = $query.ToLowerInvariant()
        if ($next -eq "" -or $next -eq "toggle") {
            if ($cur -eq "1") { $next = "2" }
            elseif ($cur -eq "2") { $next = "3" }
            elseif ($cur -eq "3") { $next = "4" }
            elseif ($cur -eq "4") { $next = "5" }
            else { $next = "1" }
        } elseif ($next -in @("1", "card", "a")) {
            $next = "1"
        } elseif ($next -in @("2", "ascii", "b", "term")) {
            $next = "2"
        } elseif ($next -in @("3", "split", "c", "column")) {
            $next = "3"
        } elseif ($next -in @("4", "grid", "d", "spread")) {
            $next = "4"
        } elseif ($next -in @("5", "rail", "e", "dock")) {
            $next = "5"
        } else {
            throw "rig 1|2|3|4|5"
        }
        Save-FoxOsRigStyle $next
        Write-DeskLog ("rig " + $next)
    }
    "lock" {
        Start-DeskApp "lock" @()
    }
    "foxlife" {
        Start-DeskApp "foxlife" @()
    }
    "mirror" {
        Start-DeskApp "foxmirror" @()
    }
    "wifi" {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "wifi.req") -Value "1" -Encoding ASCII
        Write-DeskLog "wifi"
    }
    "bt" {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "bt.req") -Value "1" -Encoding ASCII
        Write-DeskLog "bt"
    }
    "bright" {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "bright.req") -Value "1" -Encoding ASCII
        Write-DeskLog "bright"
    }
    "vol" {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "vol.req") -Value "1" -Encoding ASCII
        Write-DeskLog "vol"
    }
    "bat" {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "bat.req") -Value "1" -Encoding ASCII
        Write-DeskLog "bat"
    }
    { $_ -in @("cal","calendar","reminders") } {
        $foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
        New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
        Set-Content -LiteralPath (Join-Path $foxDir "cal.req") -Value "1" -Encoding ASCII
        Write-DeskLog "cal"
    }
    { $_ -in @("off","shutdown") } {
        Add-Type -AssemblyName System.Windows.Forms | Out-Null
        $r = [System.Windows.Forms.MessageBox]::Show(
            "Shut down this PC?`n`nWindows will close apps safely.`nNothing is forced.",
            "FoxOS · power off",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning,
            [System.Windows.Forms.MessageBoxDefaultButton]::Button2)
        if ($r -eq [System.Windows.Forms.DialogResult]::Yes) {
            Start-Process -FilePath "shutdown.exe" -ArgumentList @("/s","/t","0") -WindowStyle Hidden | Out-Null
            Write-DeskLog "shutdown"
        } else {
            Write-DeskLog "shutdown cancelled"
        }
    }
    { $_ -in @("home","settings") } {
        $pending = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos\pending-term.txt"
        [System.IO.File]::WriteAllText($pending, $verb, (New-Object System.Text.UTF8Encoding $false))
        if (-not (Get-Command Start-FoxGhosttyWindow -ErrorAction SilentlyContinue)) {
            . (Join-Path $cmdDir "ghostty-lib.ps1")
        }
        Start-FoxGhosttyWindow | Out-Null
        Write-DeskLog $verb
    }
    "note" {
        $path = Get-FoxOsDeskPath
        $dir = Split-Path $path -Parent
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        if ($query -eq "clear" -or $query -eq "-") {
            [System.IO.File]::WriteAllText($path, "", (New-Object System.Text.UTF8Encoding $false))
            Write-DeskLog "note clear"
        } elseif ($query -eq "") {
            throw "note <text>"
        } else {
            Add-Content -LiteralPath $path -Value $query -Encoding UTF8
            try {
                $noteOut = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos\widget-note.txt"
                [System.IO.File]::WriteAllText($noteOut, $query, (New-Object System.Text.UTF8Encoding $false))
            } catch {}
            Write-DeskLog ("note " + $query)
        }
    }
    default { throw "not allowed" }
}
