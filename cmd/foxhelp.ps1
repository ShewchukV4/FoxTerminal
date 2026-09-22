param()

. (Join-Path $PSScriptRoot "foxauth.ps1")

function Select-Menu([string]$title, [string[]]$options) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = 0
    while ($true) {
        $p = Get-ThemePalette
        Clear-FoxHost
        Write-Host (Color-Text $p.accent ("=== " + $title + " ==="))
        Write-Host ""
        for ($i = 0; $i -lt $options.Count; $i++) {
            if ($i -eq $index) {
                $label = "  " + $options[$i] + "  "
                Write-Host (Color-TextBg (Get-ContrastText $p.accent2) $p.accent2 $label)
            } else {
                Write-Host (Color-Text $p.text ("  " + $options[$i]))
            }
        }
        Write-Host ""

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            'UpArrow' { if ($index -gt 0) { $index-- } }
            'DownArrow' { if ($index -lt ($options.Count - 1)) { $index++ } }
            'Enter' { return $index }
            'Escape' { return -1 }
        }
    }
}

function Wait-Back {
    Write-Host ""
    Write-Host "Press any key to go back..."
    [Console]::ReadKey($true) | Out-Null
}

function Show-Commands {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent ((Get-FoxIcon 0xF120) + "  FoxTerminal commands"))
    Write-Host ""

    function Get-CommandInventory {
        $cmdRoot = $PSScriptRoot

        # Known / documented commands (source of truth for descriptions & usage).
        $known = @{}
        $known["l"]        = @{ usage = "l <name> <pass>"; desc = "login (or register if new)" }
        $known["nuser"]    = @{ usage = "nuser <name> <pass>"; desc = "register new user" }
        $known["uexit"]    = @{ usage = "uexit"; desc = "logout" }
        $known["users"]    = @{ usage = "users"; desc = "list registered users" }
        $known["who"]      = @{ usage = "who"; desc = "show current user" }
        $known["passwd"]   = @{ usage = "passwd"; desc = "change password (requires login)" }

        $known["ask"]      = @{ usage = "ask ""..."" [--image <path>]"; desc = "one-shot AI via Ollama" }
        $known["friend"]   = @{ usage = "friend"; desc = "FRIEND chat; exitt to exit, /clear /help /model (+ /cmds /repo /explain)" }
        $known["sum"]      = @{ usage = "sum <file>"; desc = "summarize a file via OpenAI (needs OPENAI_API_KEY)" }

        $known["yt"]       = @{ usage = "yt <query>"; desc = "YouTube search in Firefox" }
        $known["ytm"]      = @{ usage = "ytm [query|alias|url]"; desc = "empty: open YouTube Music; text: search in YouTube Music; alias/url also supported" }
        $known["ytm-ui"]   = @{ usage = "ytm-ui"; desc = "YouTube Music TUI controls + DJ visualizer" }
        $known["ytsplit"]  = @{ usage = "ytsplit [-ReportOnly]"; desc = "active-title mode: detect current YouTube/YTM windows, auto-open missing, place left/right" }
        $known["apps"]     = @{ usage = "apps <app1> / <app2> [/ <app3> [/ <app4>]]"; desc = "arrange up to 4 app windows; 3-app mode: app3 left half, app1/app2 right stack" }
        $known["appbind"]  = @{ usage = "appbind [add|del|list] ..."; desc = "bind app alias to exe path (+ optional args/title match) for apps layout command" }
        $known["sp"]       = @{ usage = "sp [query|url]"; desc = "open Spotify (app/handler) or search" }
        $known["sp-ui"]    = @{ usage = "sp-ui"; desc = "Spotify DJ UI + controls (Play/Next/Prev/etc.)" }
        $known["dj"]       = @{ usage = "dj"; desc = "audio-level DJ visualizer (system audio peak)" }

        $known["ff"]       = @{ usage = "ff open [alias-or-url]"; desc = "open URL/alias in Firefox (default: youtube)" }
        $known["sites"]    = @{ usage = "sites [-createn <name>] [-open <name>]"; desc = "browse saved sites; -createn: scaffold new site folder; -open: open site folder in VS Code" }
        $known["bbind"]    = @{ usage = "bbind"; desc = "create custom .bat command OR bind site alias for ff" }
        $known["blist"]    = @{ usage = "blist"; desc = "list site aliases (bindings.json)" }
        $known["bdel"]     = @{ usage = "bdel <alias>"; desc = "delete a site alias (bindings.json)" }
        $known["youtube"]  = @{ usage = "youtube"; desc = "open YouTube in Firefox" }
        $known["ffbot"]    = @{ usage = "ffbot"; desc = ".NET Firefox watcher (opens urls.txt when Firefox window appears)" }
        $known["gask"]     = @{ usage = "gask <question>"; desc = "open ChatGPT in Firefox with prefilled query" }
        $known["ser"]      = @{ usage = "ser <terms>"; desc = "google search in Firefox (quick)" }

        $known["tg"]       = @{ usage = "tg [alias|@username|url|tg://...]"; desc = "open Telegram Web (optionally jump to user)" }
        $known["tgub"]     = @{ usage = "tgub <@user|user|url> <alias> | tgub phone <num> <alias>"; desc = "bind telegram alias to username/phone" }
        $known["tglist"]   = @{ usage = "tglist"; desc = "list/edit telegram binds (tg_bindings.json)" }

        $known["wai"]      = @{ usage = "wai [-pin|-unpin]"; desc = "where you are in notes + list files; -pin keeps it at the top across clear/go/up" }
        $known["go"]       = @{ usage = "go <path>"; desc = "change notes folder (e.g. go files/important)" }
        $known["up"]        = @{ usage = "up"; desc = "go up one folder inside notes" }
        $known["nfile"]     = @{ usage = "nfile <name.ext>"; desc = "create file in current notes folder" }
        $known["nfould"]    = @{ usage = "nfould <name>"; desc = "create folder in current notes location" }
        $known["fdel"]      = @{ usage = "fdel <name.ext>"; desc = "delete file in notes (password)" }
        $known["edit"]      = @{ usage = "edit <path-or-name>"; desc = "terminal editor (notes by name, or any file path)" }
        $known["nano"]      = @{ usage = "nano <file>"; desc = "Linux-style terminal editing (micro/nano/vim, fallback to edit)" }
        $known["view"]      = @{ usage = "view <file>"; desc = "open file in terminal pager (read-only)" }
        $known["hash"]     = @{ usage = "hash [fx1|md5|sha1|sha256|ntlm|b64] <text>"; desc = "hash text (digests print raw hex)" }
        $known["unhash"]   = @{ usage = "unhash [-offline] [hash]"; desc = "crack: wordlist+rules, nitrxgen MD5 DB, brute; FX1 needs password" }
        $known["build"]    = @{ usage = "build <name>|-list|-restore <n>|-delete <n>"; desc = "save/restore/list config snapshots (builds\ folder)" }
        $known["clear"]    = @{ usage = "clear"; desc = "clear screen (keeps pinned wai if wai -pin is on)" }
        $known["texit"]    = @{ usage = "texit"; desc = "force-exit current terminal process" }

        $known["wifi"]     = @{ usage = "wifi"; desc = "Wi-Fi status (SSID/signal/channel)" }
        $known["disk"]     = @{ usage = "disk"; desc = "disk usage by drive" }
        $known["netping"]  = @{ usage = "netping [targets...]"; desc = "ping 8.8.8.8/1.1.1.1 or given targets" }
        $known["reconnect"]= @{ usage = "reconnect [ssid]"; desc = "reconnect Wi-Fi (defaults to current/first profile)" }
        $known["weather"]  = @{ usage = "weather [location]"; desc = "weather via wttr.in (auto reconnect fallback)" }
        $known["ip"]       = @{ usage = "ip"; desc = "public + local IPs" }
        $known["ftime"]    = @{ usage = "ftime"; desc = "time + date" }
        $known["fday"]     = @{ usage = "fday [location]"; desc = "daily summary: time + weather + wifi + ip" }
        $known["sw"]       = @{ usage = "sw [themeName] [live] [color|mono] [imagePath]"; desc = "system info + theme switcher (arrows change theme, Ctrl+E exit); example: sw slate" }
        $known["shader"]   = @{ usage = "shader [on|off|status]"; desc = "toggle Ghostty glass shaders (per-theme GLSL); off disables them for every theme" }
        $known["foxos"]    = @{ usage = "foxos [on|off|status|apply]"; desc = "animated ASCII rain wallpaper (same fox as sw) + Windows accent; off restores the previous desktop" }
        $known["foxlook"]  = @{ usage = "foxlook [on|off|status|<part> on|off|wall overlay|behind|cursor <style>|shell on|off|dock style|place|size|hide|apps|tray]"; desc = "Windows wears FoxOS: dark chrome, pixel cursors, lock screen, Win keys, styled dock; foxlook shell on = this user next login is FoxOS instead of Explorer; foxlook dock style pill|rail|glass|slim" }
        $known["themes"]   = @{ usage = "themes"; desc = "main themes picker: arrows + Enter (Fox default, Arthas, Pride, Noir, Death Note)" }
        $known["noir"]     = @{ usage = "noir"; desc = "toggle noir mode: full black & white, locks sw theme picker; run again to restore" }
        $known["dnote"]    = @{ usage = "dnote"; desc = "toggle Death Note mode: crimson noir-like style, login user selection with strike-through, apple intro + '<user> died'" }
        $known["apple"]    = @{ usage = "apple [imagePath]"; desc = "show the Death Note scene as extra-large centered ASCII image; press Esc to exit" }
        $known["pride"]    = @{ usage = "pride"; desc = "toggle pride mode: rainbow flag styles; sw arrows pick gay/bi/lesbian/trans/femboy; run again to restore" }
        $known["arthas"]   = @{ usage = "arthas"; desc = "toggle Arthas mode: top-centered panel, Left/Right or A/D swaps dark/light Arthas, Ctrl+E closes panel, run again to restore theme" }
        $known["spider"]   = @{ usage = "spider"; desc = "noir-only: centered Spider-Noir panel + system info (like sw, Ctrl+E exit)" }
        $known["frederik"] = @{ usage = "frederik [-ListMics] [-Source Auto|Mic|System] [-Mic <idx|name>] [-SetMainMic] [-Bars <n>] [-Height <n>]"; desc = "voice-reactive waveform visualizer, Esc to exit" }
        $known["chek"]     = @{ usage = "chek"; desc = "show whether this session is Ghostty and dump the detection signals" }
        $known["sixel"]    = @{ usage = "sixel [-Image <path>]"; desc = "check inline-image support (Ghostty uses the Kitty graphics protocol, not SIXEL)" }
        $known["foximg"]   = @{ usage = "foximg [path]"; desc = "show a photo in the terminal" }
        $known["foxmirror"] = @{ usage = "foxmirror [-Video|-Photo] [-Wifi|-Usb] [-PairWifi] [-NoAudio] [-Check] [-Setup] [-Fps <n>] [-Width <px>]"; desc = "live iPhone screen over USB, or Wi-Fi after one run with the cable: ~30 fps HEVC video on iOS 27+, screenshot mode otherwise (auto-installs deps)" }
        $known["foxscan"]  = @{ usage = "foxscan [-Deep] [-IncludeLow] [-IncludeWorkspace] [-Top <n>] [-Path <dir1,dir2,...>]"; desc = "heuristic suspicious-script scanner (names + risk score + reasons)" }
        $known["foxbg"]    = @{ usage = "foxbg [-IncludeLow] [-Top <n>] [-MinMemoryMB <n>]"; desc = "interactive background cleaner: arrows select, Enter close app, Esc exit" }
        $known["interface"]= @{ usage = "interface [-Split] [-TwoWindows] [-Keys] [-Gui]"; desc = "Ghostty split layout: -Split splits from the CLI, -TwoWindows opens a second window, -Keys lists the keybinds, -Gui Windows GUI split" }
        $known["term"]     = @{ usage = "term [-Status] [-Apply] [-Edit] [-New] [-Doctor] [-Path]"; desc = "manage the Ghostty config: status, reinstall, edit, new window, diagnostics" }
        $known["ghostty-lib"] = @{ usage = "ghostty-lib"; desc = "Ghostty detection + config-path library (internal)" }
        $known["ffsync"]   = @{ usage = "ffsync start|stop|status|shell|exec <cmd>"; desc = "shared terminal bridge for Firefox sidebar + terminal session sync" }

        $known["foxreset"]   = @{ usage = "foxreset [-Git] [-NoGit]"; desc = "hard reset caches + re-init prompt; -Git/-NoGit toggle git branch segment" }
        $known["foxhelp"]    = @{ usage = "foxhelp"; desc = "this menu; on the FoxOS wallpaper opens the command picker" }
        $known["foxhotkeys"] = @{ usage = "foxhotkeys [-Stop] [-Restart] [-Status]"; desc = "global hotkey daemon (Shift+Alt+T show FoxTerminal, Shift+Ctrl+Alt+T close, plus YouTube/Firefox)" }
        $known["foxinfo"]    = @{ usage = "foxinfo"; desc = "hotkey binding manager: add open/close bindings, configure FoxTerminal path" }
        $known["foxdeps"]    = @{ usage = "foxdeps [-Check] [-Install]"; desc = "check + auto-install all FoxTerminal dependencies (Firefox, OhMyPosh, AHK, .NET 9, FoxTerminalApp)" }
        $known["foxtest"]    = @{ usage = "foxtest [-List] [-Quiet] [-Only <names>] [-Group all|info|tui|bat] [-Timeout <s>]"; desc = "smoke-test every command: runs the ones that finish, checks the menus still draw, reports what broke" }
        $known["foxpack"]    = @{ usage = "foxpack [-Full] [-Open] [-OutPath <path>]"; desc = "pack FoxTerminal into shareable zip (clean by default, -Full keeps your binds/notes/theme)" }
        $known["foxlife"]    = @{ usage = "foxlife [-Status|-Rebuild]"; desc = "FOXOS Life: notes, finance, tables, AI assistant (native window)" }
        $known["home"]       = @{ usage = "home"; desc = "system home after login: day, notes, last site, Prompt / YTM / Sites / Help / Settings / Lock" }
        $known["lock"]       = @{ usage = "lock [-Status] [-Unlock]"; desc = "lock FoxTerminal (wallpaper + hide Ghostty); Shift+Alt+L; unlock with Fox password" }
        $known["off"]        = @{ usage = "off"; desc = "shut down the PC safely (asks Yes/No first; default is No)" }
        $known["shutdown"]   = @{ usage = "shutdown"; desc = "same as off — graceful Windows shutdown after confirm" }
        $known["settings"]   = @{ usage = "settings [-Status] [-Gui] [-StopGui]"; desc = "system settings TUI, or Control UI in the browser (never blocks the pane)" }
        $known["foxsetup"]   = @{ usage = "foxsetup"; desc = "first-boot wizard: user, theme, FoxOS, logon, hotkeys, idle lock" }
        $known["changelog"]  = @{ usage = "changelog"; desc = "read-only history of what was added and removed (same viewer as notes)" }

        # Auto-detect commands present in cmd\ (include .ps1 and .bat).
        # We de-duplicate by base name, prefer commands people can type (bat/ps1 wrappers).
        $files = @()
        try {
            $files = Get-ChildItem -LiteralPath $cmdRoot -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -in @(".ps1", ".bat", ".cmd") }
        } catch { $files = @() }

        $names = New-Object System.Collections.Generic.HashSet[string]([StringComparer]::OrdinalIgnoreCase)
        foreach ($f in $files) {
            $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            if ([string]::IsNullOrWhiteSpace($base)) { continue }
            # Not meant to be executed directly by users:
            if ($base -in @("foxauth", "foxcodec", "foxhash-lookup", "note-lib", "sw-script", "spider-script", "hk_parse", "hk_lib", "pride-lib", "shader-lib", "foxos-lib", "foxlook-lib", "foxcursor-lib", "foxsys-lib", "foxos-deskcmd", "foxos-shell", "foxos-watch", "interface-gui", "foxterm-cmd-init")) { continue }
            $null = $names.Add($base)
        }

        $rows = @()
        foreach ($n in ($names | Sort-Object)) {
            if ($known.ContainsKey($n)) {
                $rows += [pscustomobject]@{ name = $n; usage = $known[$n].usage; desc = $known[$n].desc; known = $true }
            } else {
                # Keep this ASCII-only to avoid encoding issues in some consoles/editors.
                $rows += [pscustomobject]@{ name = $n; usage = $n; desc = "(script exists in cmd\\ - description not added yet)"; known = $false }
            }
        }

        # Also include known commands that may not exist as files (e.g. if moved); keep it visible.
        foreach ($k in ($known.Keys | Sort-Object)) {
            if (-not $names.Contains($k)) {
                $rows += [pscustomobject]@{ name = $k; usage = $known[$k].usage; desc = $known[$k].desc; known = $true }
            }
        }

        return $rows
    }

    function Write-CommandSection([string]$title, [object[]]$rows, [string[]]$names, [int]$iconCode = 0) {
        if ($null -eq $rows -or $rows.Count -eq 0) { return }
        $p = Get-ThemePalette
        $picked = @($rows | Where-Object { $names -contains $_.name } | Sort-Object name)
        if ($picked.Count -eq 0) { return }
        $head = if ($iconCode -gt 0) { ((Get-FoxIcon $iconCode) + "  " + $title) } else { $title }
        Write-Host (Color-Text $p.accent2 $head)
        foreach ($r in $picked) {
            $u = if ($r.usage) { $r.usage } else { $r.name }
            Write-Host (Color-Text $p.text ("  {0,-26} {1}" -f $u, $r.desc))
        }
        Write-Host ""
    }

    $inv = Get-CommandInventory

    Write-CommandSection "Login / Users:" $inv @("l","nuser","passwd","uexit","users","who") 0xF007
    Write-CommandSection "AI:" $inv @("ask","friend","sum") 0xF0EB
    Write-CommandSection "Media:" $inv @("dj","sp","sp-ui","yt","ytm","ytm-ui","ytsplit") 0xF001
    Write-CommandSection "Apps / layout:" $inv @("appbind","apps","foxlife") 0xF108
    Write-CommandSection "Firefox / web aliases:" $inv @("bbind","bdel","blist","ff","ffbot","gask","ser","sites","youtube") 0xF0AC
    Write-CommandSection "Telegram:" $inv @("tg","tglist","tgub") 0xF1D8
    Write-CommandSection "Notes / files:" $inv @("changelog","edit","fdel","go","hash","nano","nfile","nfould","unhash","up","view","wai") 0xF07B
    Write-CommandSection "Builds / packaging:" $inv @("build","foxpack") 0xF187
    Write-CommandSection "Themes / visual modes:" $inv @("apple","arthas","dnote","foxlook","foxos","frederik","noir","pride","shader","spider","sw","themes") 0xF1FC
    Write-CommandSection "Network / diagnostics:" $inv @("chek","disk","fday","ftime","foximg","ip","netping","reconnect","sixel","weather","wifi") 0xF1EB
    Write-CommandSection "System tools:" $inv @("changelog","clear","ffsync","foxbg","foxscan","home","interface","lock","settings","term","texit") 0xF013
    Write-CommandSection "Hotkeys / bindings:" $inv @("foxhotkeys","foxinfo") 0xF11C
    Write-CommandSection "Setup / reset / help:" $inv @("foxdeps","foxhelp","foxreset","foxsetup","foxtest") 0xF0AD
    Write-CommandSection "Wallpaper prompt (FoxOS desk):" $inv @("arthas","bright","bt","dnote","dj","ff","foxhelp","foxlife","foxlook","foxos","home","lock","mirror","noir","note","off","pride","rig","ser","settings","shader","shutdown","sites","sp","sw","term","wifi","yt","ytm","youtube") 0xF1FC

    # Commands that live outside cmd\ (in FoxTerminal folder).
    Write-Host (Color-Text $p.accent2 ((Get-FoxIcon 0xF17A) + "  Windows (run from FoxTerminal folder):"))
    Write-Host ("  {0,-26} {1}" -f ".\\DisableBloat", "disable heavy services (admin)")
    Write-Host ("  {0,-26} {1}" -f ".\\DisableAds", "disable ads/tips (1-5)")
    Write-Host ("  {0,-26} {1}" -f ".\\Status", "show what is disabled/enabled")
    Write-Host ("  {0,-26} {1}" -f ".\\Enable", "re-enable all (admin)")
    Write-Host ""

    # Everything else (auto-detected but not yet described).
    $extra = @($inv | Where-Object { $_.known -eq $false })
    if ($extra.Count -gt 0) {
        Write-Host (Color-Text $p.accent2 ((Get-FoxIcon 0xF0C9) + "  Other commands detected in cmd\ (" + $extra.Count + "):"))
        foreach ($r in $extra) {
            Write-Host (Color-Text $p.text ("  {0,-26} {1}" -f $r.usage, $r.desc))
        }
        Write-Host ""
    }

    Write-Host (Color-Text $p.dim "Tip: in PowerShell you can also run the .ps1 directly: .\cmd\<name>.ps1")
    Wait-Back
}

function Show-OllamaAI {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Ollama & AI (FoxTerminal)")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "1) Start Ollama (once):")
    Write-Host "   ollama serve"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "2) Pull model (once):")
    Write-Host "   ollama pull qwen3-vl"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "3) Commands:")
    Write-Host "   ask ""Explain this file"""
    Write-Host "   ask ""What is in this image?"" --image C:\path\img.png"
    Write-Host "   friend   -> FRIEND chat; type exitt to exit"
    Write-Host "   In-chat: /clear  /help  /model  /cmds  /repo  /read <path>  /explain <path>"
    Write-Host "   Say: open youtube/spotify/ytm/telegram/notes/... -> runs that and closes chat"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "4) Optional env (setx, then new terminal):")
    Write-Host "   OLLAMA_URL, FOXTERM_OLLAMA_MODEL, FOXTERM_OLLAMA_SYSTEM"
    Write-Host "   FOXTERM_OLLAMA_AUTOSTART, FOXTERM_OLLAMA_LOW_POWER"
    Wait-Back
}

function Show-WindowsBloatAds {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Windows: bloat & ads (FoxTerminal folder)")
    Write-Host ""
    $foxPath = Join-Path (Split-Path $PSScriptRoot -Parent) "FoxTerminal"
    if (-not (Test-Path $foxPath)) { $foxPath = "C:\...\FireFoxBot\FoxTerminal" }
    Write-Host "  cd `"$foxPath`""
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Commands (use .\ in PowerShell):")
    Write-Host ("  {0,-18} {1}" -f ".\DisableBloat", "disable heavy services (need admin)")
    Write-Host ("  {0,-18} {1}" -f ".\DisableAds", "disable ads/tips 1-5 (current user)")
    Write-Host ("  {0,-18} {1}" -f ".\Status", "show what is off/on")
    Write-Host ("  {0,-18} {1}" -f ".\Enable", "re-enable all (need admin)")
    Write-Host ""
    Write-Host "DisableBloat/Enable: run PowerShell as Administrator."
    Write-Host "DisableAds as admin: also applies to new user accounts."
    Write-Host "Scripts blocked? Use .\DisableBloat.cmd or Set-ExecutionPolicy Bypass -Scope Process"
    Wait-Back
}

function Show-InstallConfig {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "FoxTerminal: install & config")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Terminal:")
    Write-Host "  Ghostty is the only supported terminal."
    Write-Host "  Windows: winghostty (Ghostty core + native Win32 runtime)"
    Write-Host "           winget install AmanThanvi.winghostty"
    Write-Host "  Linux / macOS: https://ghostty.org/download"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Folder:")
    Write-Host "  FireFoxBot\FoxTerminal\          install.ps1, install.sh, DisableBloat, ..."
    Write-Host "  FireFoxBot\FoxTerminal\ghostty\  config + shell bootstrap"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Install (Windows):")
    Write-Host "  cd FoxTerminal"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1"
    Write-Host "  -> installs ghostty\config as your Ghostty config"
    Write-Host "  -> generates foxterminal-local.ghostty (shell command + repo path)"
    Write-Host "  -> creates a desktop shortcut"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Install (Linux / macOS):")
    Write-Host "  bash FoxTerminal/install.sh"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Manage it afterwards:")
    Write-Host "  term            status + menu"
    Write-Host "  term -Apply     reinstall the config"
    Write-Host "  term -Edit      open the installed config"
    Write-Host "  term -Doctor    full diagnostics"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Theme / prompt:")
    Write-Host "  Oh My Posh: FoxTerminal\bin\oh-my-posh.exe, oh-my-posh\foxterm.omp.json"
    Write-Host "  Colors are also switched live by sw / themes via OSC 10/11/12."
    Write-Host "  Glass shaders follow the theme (shader off to disable, ctrl+shift+o to toggle)."
    Wait-Back
}

function Show-Troubles {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Why FoxTerminal may not work")
    Write-Host ""
    Write-Host "1) Not running in Ghostty"
    Write-Host "   Run 'chek'. FoxTerminal supports Ghostty only."
    Write-Host ""
    Write-Host "2) Config not installed"
    Write-Host "   Run 'term -Doctor', then 'term -Apply'."
    Write-Host ""
    Write-Host "3) Shell starts without foxauth"
    Write-Host "   foxterminal-local.ghostty is missing or stale -> 'term -Apply'."
    Write-Host ""
    Write-Host "4) Boxes instead of prompt icons"
    Write-Host "   No Nerd Font installed -> 'foxdeps', then set font-family in the config."
    Write-Host ""
    Write-Host "5) Ghostty reports config errors"
    Write-Host "   Run: ghostty +show-config   (winghostty.com +show-config on Windows, not the .exe)"
    Write-Host ""
    Write-Host "6) users.json empty"
    Write-Host "   Register a user with nuser or l."
    Wait-Back
}

function Show-GhosttyConfig {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Ghostty config")
    Write-Host ""

    $lib = Join-Path $PSScriptRoot "ghostty-lib.ps1"
    if (Test-Path $lib) {
        . $lib
        $cfg = Get-GhosttyConfigPath
        if ($cfg) {
            Write-Host (Color-Text $p.accent2 "Installed at:")
            Write-Host ("  " + $cfg)
            Write-Host ("  " + (Join-Path (Split-Path -Parent $cfg) "foxterminal-local.ghostty"))
            Write-Host ""
        }
    }

    Write-Host (Color-Text $p.accent2 "Source of truth in the repo:")
    Write-Host "  FoxTerminal\ghostty\config"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Things you will want to change:")
    Write-Host ("  {0,-24} {1}" -f "font-family", "Nerd Font name")
    Write-Host ("  {0,-24} {1}" -f "font-size", "13 by default")
    Write-Host ("  {0,-24} {1}" -f "background-opacity", "0.92 - transparency")
    Write-Host ("  {0,-24} {1}" -f "background-blur", "20 - macOS and KDE only")
    Write-Host ("  {0,-24} {1}" -f "window-padding-x / -y", "12 / 10")
    Write-Host ("  {0,-24} {1}" -f "palette = N=#RRGGBB", "FoxNight ANSI colors 0-15")
    Write-Host ("  {0,-24} {1}" -f "keybind", "trigger=action")
    Write-Host ("  {0,-24} {1}" -f "command-palette-entry", "extra ctrl+shift+p items")
    Write-Host ""
    Write-Host (Color-Text $p.dim "Full reference: https://ghostty.org/docs/config/reference")
    Write-Host (Color-Text $p.dim "Reload without restart: ctrl+shift+comma")
    Wait-Back
}

function Show-GhosttyKeys {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Ghostty keybinds (from the FoxTerminal config)")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Splits and tabs")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+enter", "split along the larger side")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+l", "split right")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+j", "split down")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+z", "zoom / unzoom split")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+e", "equalize splits")
    Write-Host ("  {0,-22} {1}" -f "ctrl+alt+arrows", "resize split by 40px")
    Write-Host ("  {0,-22} {1}" -f "alt+arrows", "move focus between splits")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+t", "new tab")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+w", "close split / tab")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Per split")
    Write-Host "  sw / themes in one pane recolor only that pane."
    Write-Host "  A new split copies this pane. sw colors (slate, ice, ...) stay here;"
    Write-Host "  a new window starts from Fox Default / the last main theme."
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Scrollback and search")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+f", "search the scrollback")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+up / down", "jump between prompts")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+u", "dump scrollback to a file and open it")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+x", "clear screen (keeps pinned wai)")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "FoxTerminal")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+backquote", "quick terminal (drop-down)")
    Write-Host ("  {0,-22} {1}" -f "ctrl+backquote", "same, system-wide (macOS / Linux)")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+p", "command palette with Fox commands")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+h", "foxhelp")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+k", "chek")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+s", "sw")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+g", "term")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Config")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+comma", "reload config")
    Write-Host ("  {0,-22} {1}" -f "ctrl+shift+i", "terminal inspector")
    Write-Host ""
    Write-Host (Color-Text $p.dim "Edit any of these: term -Edit")
    Wait-Back
}

function Show-SitesInfo {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Sites / FoxType Master")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Command:")
    Write-Host "  sites"
    Write-Host ""
    Write-Host "Opens the local sites list from the sites\ folder."
    Write-Host "Current bundled site: FoxType Master (local typing trainer)."
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "FoxType Master features:")
    Write-Host "  - Practice modes: free, time, words, punct, numbers, quote, code"
    Write-Host "  - Persistent wrong-letter markers over the expected character"
    Write-Host "  - Keyboard hint panel with target key and finger hint"
    Write-Host "  - Theme switcher with visual styles (Cyber, Neon, Ocean, Forest, Lava)"
    Write-Host "  - Extra tabs: Survival, Lessons, Stats, Achievements"
    Write-Host "  - Local progress, XP, weak-key tracking, recent sessions"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Files:")
    Write-Host "  sites\sites.json"
    Write-Host "  sites\typewriter\index.html"
    Write-Host "  sites\typewriter\assets\css\style.css"
    Write-Host "  sites\typewriter\assets\js\main.js"
    Write-Host ""
    Write-Host (Color-Text $p.dim "Tip: edit sites\sites.json to add more local or web sites.")
    Wait-Back
}

function Show-BuildsInfo {
    Clear-FoxHost
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Builds / Config snapshots")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "What are builds?")
    Write-Host "  Builds let you snapshot your current FoxTerminal configuration"
    Write-Host "  (binds, notes, theme, users) and restore them any time."
    Write-Host "  All builds are saved in:  builds\  (next to cmd\)"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Commands:")
    Write-Host ("  {0,-40} {1}" -f "build <name>", "save current config as builds\<name>\")
    Write-Host ("  {0,-40} {1}" -f "build -list", "list all saved builds")
    Write-Host ("  {0,-40} {1}" -f "build -restore <name>", "overwrite current config with saved build")
    Write-Host ("  {0,-40} {1}" -f "build -delete <name>", "delete a saved build")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "What gets saved:")
    Write-Host "  bindings.json       site aliases (ff / bbind)"
    Write-Host "  sp_bindings.json    Spotify aliases"
    Write-Host "  tg_bindings.json    Telegram aliases"
    Write-Host "  ytm_bindings.json   YouTube Music aliases"
    Write-Host "  theme.txt           current color theme"
    Write-Host "  notes\              all notes and folders"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Special build:")
    Write-Host "  builds\1firstbuild\install.ps1"
    Write-Host "  Full FoxTerminal installer -- copies the whole base to any"
    Write-Host "  folder you choose, with clean default settings (no users,"
    Write-Host "  empty notes, no binds, orange theme)."
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Run the installer:")
    $installPath = Join-Path (Split-Path $PSScriptRoot -Parent) "builds\1firstbuild\install.ps1"
    $q = [char]34
    Write-Host "  powershell -File $q$installPath$q"
    Write-Host ""
    $noteMsg = 'Note: the name 1firstbuild is reserved and cannot be used with build command.'
    Write-Host (Color-Text $p.dim $noteMsg)
    Wait-Back
}

while ($true) {
    $options = @(
        'Commands (all)',
        'Sites / FoxType Master',
        'Builds / snapshots',
        'AI: Ollama  ask, friend',
        'Ghostty keybinds',
        'Windows: bloat / ads',
        'Install + config',
        'Troubleshooting',
        'Ghostty config',
        'Exit'
    )
    $choice = Select-Menu 'FoxTerminal Help' $options
    if ($choice -lt 0) { exit }

    switch ($choice) {
        0 { Show-Commands }
        1 { Show-SitesInfo }
        2 { Show-BuildsInfo }
        3 { Show-OllamaAI }
        4 { Show-GhosttyKeys }
        5 { Show-WindowsBloatAds }
        6 { Show-InstallConfig }
        7 { Show-Troubles }
        8 { Show-GhosttyConfig }
        9 { exit }
    }
}
