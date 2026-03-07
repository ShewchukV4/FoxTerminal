param()

. (Join-Path $PSScriptRoot "foxauth.ps1")

function Select-Menu([string]$title, [string[]]$options) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = 0
    while ($true) {
        $p = Get-ThemePalette
        Clear-Host
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
    Clear-Host
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "FoxTerminal commands")
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
        $known["ytm"]      = @{ usage = "ytm [query|alias|url]"; desc = "open YouTube Music (search/alias/url)" }
        $known["ytm-ui"]   = @{ usage = "ytm-ui"; desc = "YouTube Music TUI controls + DJ visualizer" }
        $known["sp"]       = @{ usage = "sp [query|url]"; desc = "open Spotify (app/handler) or search" }
        $known["sp-ui"]    = @{ usage = "sp-ui"; desc = "Spotify DJ UI + controls (Play/Next/Prev/etc.)" }
        $known["dj"]       = @{ usage = "dj"; desc = "audio-level DJ visualizer (system audio peak)" }

        $known["ff"]       = @{ usage = "ff open [alias-or-url]"; desc = "open URL/alias in Firefox (default: youtube)" }
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

        $known["note"]     = @{ usage = "note [open]"; desc = "notes manager (exit/exitt, nfould, nfile, del, open)" }
        $known["clear"]    = @{ usage = "clear"; desc = "clear screen" }
        $known["texit"]    = @{ usage = "texit"; desc = "force-exit current terminal process" }

        $known["wifi"]     = @{ usage = "wifi"; desc = "Wi-Fi status (SSID/signal/channel)" }
        $known["disk"]     = @{ usage = "disk"; desc = "disk usage by drive" }
        $known["netping"]  = @{ usage = "netping [targets...]"; desc = "ping 8.8.8.8/1.1.1.1 or given targets" }
        $known["reconnect"]= @{ usage = "reconnect [ssid]"; desc = "reconnect Wi-Fi (defaults to current/first profile)" }
        $known["weather"]  = @{ usage = "weather [location]"; desc = "weather via wttr.in (auto reconnect fallback)" }
        $known["ip"]       = @{ usage = "ip"; desc = "public + local IPs" }
        $known["ftime"]    = @{ usage = "ftime"; desc = "time + date" }
        $known["fday"]     = @{ usage = "fday [location]"; desc = "daily summary: time + weather + wifi + ip" }
        $known["sw"]       = @{ usage = "sw [live] [color|mono] [imagePath]"; desc = "system info + theme switcher (arrows change theme, Ctrl+E exit)" }

        $known["foxhelp"]  = @{ usage = "foxhelp"; desc = "this menu" }

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
            if ($base -in @("foxauth", "sw-script")) { continue }
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

    function Write-CommandSection([string]$title, [object[]]$rows, [string[]]$names) {
        if ($null -eq $rows -or $rows.Count -eq 0) { return }
        $p = Get-ThemePalette
        $picked = @($rows | Where-Object { $names -contains $_.name })
        if ($picked.Count -eq 0) { return }
        Write-Host (Color-Text $p.accent2 $title)
        foreach ($r in $picked) {
            $u = if ($r.usage) { $r.usage } else { $r.name }
            Write-Host ("  {0,-26} {1}" -f $u, $r.desc)
        }
        Write-Host ""
    }

    $inv = Get-CommandInventory

    Write-CommandSection "Login / Users:" $inv @("l","nuser","uexit","users","who","passwd")
    Write-CommandSection "AI:" $inv @("ask","friend","sum")
    Write-CommandSection "Media:" $inv @("yt","ytm","ytm-ui","sp","sp-ui","dj")
    Write-CommandSection "Firefox / aliases:" $inv @("ff","youtube","bbind","blist","bdel","ser","gask","ffbot")
    Write-CommandSection "Telegram:" $inv @("tg","tgub","tglist")
    Write-CommandSection "Notes:" $inv @("note")
    Write-CommandSection "Network & system:" $inv @("wifi","reconnect","ip","weather","netping","disk","ftime","fday","sw","clear","texit")
    Write-CommandSection "Help:" $inv @("foxhelp")

    # Commands that live outside cmd\ (in FoxTerminal folder).
    Write-Host (Color-Text $p.accent2 "Windows (run from FoxTerminal folder):")
    Write-Host ("  {0,-26} {1}" -f ".\\DisableBloat", "disable heavy services (admin)")
    Write-Host ("  {0,-26} {1}" -f ".\\DisableAds", "disable ads/tips (1-5)")
    Write-Host ("  {0,-26} {1}" -f ".\\Status", "show what is disabled/enabled")
    Write-Host ("  {0,-26} {1}" -f ".\\Enable", "re-enable all (admin)")
    Write-Host ""

    # Everything else (auto-detected but not yet described).
    $extra = @($inv | Where-Object { $_.known -eq $false })
    if ($extra.Count -gt 0) {
        Write-Host (Color-Text $p.accent2 ("Other commands detected in cmd\ (" + $extra.Count + "):"))
        foreach ($r in $extra) {
            Write-Host ("  {0,-26} {1}" -f $r.usage, $r.desc)
        }
        Write-Host ""
    }

    Write-Host (Color-Text $p.dim "Tip: in PowerShell you can also run the .ps1 directly: .\cmd\<name>.ps1")
    Wait-Back
}

function Show-OllamaAI {
    Clear-Host
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
    Clear-Host
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
    Clear-Host
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "FoxTerminal: install & config")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Folder:")
    Write-Host "  FireFoxBot\FoxTerminal\  (wezterm.lua, install.ps1, DisableBloat, ...)"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Install (Windows):")
    Write-Host "  cd FoxTerminal"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1"
    Write-Host "  -> copies wezterm.lua to %USERPROFILE%\.wezterm.lua, creates desktop shortcut"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Windows Terminal profile:")
    Write-Host "  FoxTerminal\windows-terminal\apply-foxterminal.ps1"
    Write-Host "  -> merges foxterminal.json into WT settings.json"
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "Theme / prompt:")
    Write-Host "  Oh My Posh: FoxTerminal\bin\oh-my-posh.exe, oh-my-posh\foxterm.omp.json"
    Wait-Back
}

function Show-Troubles {
    Clear-Host
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Why FoxTerminal may not work")
    Write-Host ""
    Write-Host "1) Wrong settings.json edited"
    Write-Host "   Use the Windows Terminal settings path."
    Write-Host ""
    Write-Host "2) Tab title blocked"
    Write-Host "   Remove tabTitle and set suppressApplicationTitle: false"
    Write-Host ""
    Write-Host "3) commandline missing foxauth"
    Write-Host "   Ensure foxauth.ps1 is loaded in commandline."
    Write-Host ""
    Write-Host "4) users.json empty"
    Write-Host "   Register a user with nuser or l."
    Write-Host ""
    Write-Host "5) Not using Windows Terminal"
    Write-Host "   Arrows menu needs Windows Terminal or modern console."
    Wait-Back
}

function Show-Settings {
    Clear-Host
    $p = Get-ThemePalette
    Write-Host (Color-Text $p.accent "Correct settings.json path")
    Write-Host "C:\Users\<YOUR_USER>\AppData\Local\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
    Write-Host ""
    Write-Host "FoxTerminal profile (example):"
    Write-Host "  {"
    Write-Host "    ""guid"": ""{b3f9b1c7-8f5a-4b83-9f6f-1a0c6e9c7e21}"","
    Write-Host "    ""name"": ""FoxTerminal"","
    Write-Host "    ""commandline"": ""%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoLogo -NoProfile -NoExit -Command `"$env:FOXTERM='1'; chcp 65001 > $null; $env:PATH='C:\\Users\\dmytr\\Desktop\\FireFoxBot\\cmd;' + $env:PATH; . 'C:\\Users\\dmytr\\Desktop\\FireFoxBot\\cmd\\foxauth.ps1'; Ensure-Login | Out-Null`"","
    Write-Host "    ""startingDirectory"": ""C:\\Users\\dmytr\\Desktop\\FireFoxBot"","
    Write-Host "    ""tabColor"": ""#7AA2F7"","
    Write-Host "    ""suppressApplicationTitle"": false"
    Write-Host "  }"
    Wait-Back
}

while ($true) {
    $options = @(
        "Commands (all)",
        "Ollama & AI (ask, friend)",
        "Windows (bloat / ads)",
        "Install & config",
        "Troubleshooting",
        "Settings.json (WT)",
        "Exit"
    )
    $choice = Select-Menu "FoxTerminal Help" $options
    if ($choice -lt 0) { exit }

    switch ($options[$choice]) {
        "Commands (all)" { Show-Commands }
        "Ollama & AI (ask, friend)" { Show-OllamaAI }
        "Windows (bloat / ads)" { Show-WindowsBloatAds }
        "Install & config" { Show-InstallConfig }
        "Troubleshooting" { Show-Troubles }
        "Settings.json (WT)" { Show-Settings }
        "Exit" { exit }
    }
}
