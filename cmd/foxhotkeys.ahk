#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; ── Tray (no taskbar entry, system-tray only) ────────────────────────────────
A_TrayMenu.Delete()
A_TrayMenu.Add("FoxTerminal Hotkeys", ShowInfoMsg)
A_TrayMenu.Add()
A_TrayMenu.Add("Reload", (*) => Reload())
A_TrayMenu.Add("Exit", (*) => ExitApp())
A_IconTip := "FoxTerminal Hotkeys"

; ── Startup: load config, register custom bindings, pre-launch FoxTerminal ───
global g_ScriptDir := A_ScriptDir
global g_Config    := LoadConfig()
global g_FoxExe    := ResolveFoxExe(g_Config.foxterm_exe)

if g_Config.start_hidden
    LaunchFoxTermHidden(g_FoxExe)

RegisterCustomHotkeys(g_Config.bindings)

; ── Built-in hotkeys ─────────────────────────────────────────────────────────

; Shift+Alt+Y  → open YouTube
+!y:: OpenInFirefox("https://www.youtube.com")

; Shift+Ctrl+Y → close the Firefox tab whose title contains "YouTube"
;               (works regardless of which tab is currently active)
+^y:: CloseFirefoxTabWith("YouTube")

; Shift+Alt+F  → open Firefox / bring it to front
+!f:: OpenOrFocusFirefox()

; Shift+Alt+M  → open YouTube Music in Firefox
+!m:: OpenInFirefox("https://music.youtube.com")

; Shift+Alt+Space  → show / launch FoxTerminal
+!Space:: ShowFoxTerm()

; Shift+Ctrl+Space → hide FoxTerminal (keeps process running in background)
+^Space:: HideFoxTerm()

; ── Core helpers ─────────────────────────────────────────────────────────────

OpenInFirefox(url) {
    Run 'firefox.exe "' url '"',, "Hide"
}

OpenOrFocusFirefox() {
    if WinExist("ahk_exe firefox.exe")
        WinActivate "ahk_exe firefox.exe"
    else
        Run "firefox.exe"
}

; Find a Firefox window whose title contains titlePart, close that tab,
; then restore focus to whatever was active before.
CloseFirefoxTabWith(titlePart) {
    prevHwnd := WinGetID("A")

    hwnd := 0
    for w in WinGetList("ahk_exe firefox.exe") {
        if InStr(WinGetTitle("ahk_id " w), titlePart) {
            hwnd := w
            break
        }
    }
    if !hwnd
        return

    WinActivate "ahk_id " hwnd
    WinWaitActive "ahk_id " hwnd,, 1
    Send "^w"
    Sleep 100
    try {
        if prevHwnd && WinExist("ahk_id " prevHwnd)
            WinActivate "ahk_id " prevHwnd
    }
}

LaunchFoxTermHidden(exePath) {
    if WinExist("ahk_exe FoxTerminal.UI.exe")
        return
    if !exePath || !FileExist(exePath)
        return
    Run exePath
    if WinWait("ahk_exe FoxTerminal.UI.exe",, 6)
        WinHide "ahk_exe FoxTerminal.UI.exe"
}

ShowFoxTerm() {
    global g_FoxExe
    if WinExist("ahk_exe FoxTerminal.UI.exe") {
        WinShow    "ahk_exe FoxTerminal.UI.exe"
        WinActivate "ahk_exe FoxTerminal.UI.exe"
        WinRestore  "ahk_exe FoxTerminal.UI.exe"
    } else if g_FoxExe && FileExist(g_FoxExe) {
        Run g_FoxExe
    } else {
        TrayTip "FoxTerminal not found",
            "Build the app or set foxterm_exe in hk_bindings.json"
    }
}

HideFoxTerm() {
    if WinExist("ahk_exe FoxTerminal.UI.exe")
        WinHide "ahk_exe FoxTerminal.UI.exe"
}

; ── Config ───────────────────────────────────────────────────────────────────

LoadConfig() {
    cfg := { foxterm_exe: "", start_hidden: true, bindings: [] }

    cfgJson  := g_ScriptDir "\hk_bindings.json"
    psHelper := g_ScriptDir "\hk_parse.ps1"
    tmpOut   := A_Temp "\foxhk_parsed_" A_TickCount ".txt"

    if !FileExist(cfgJson) || !FileExist(psHelper)
        return cfg

    RunWait(
        'powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'
        psHelper '" "' cfgJson '" "' tmpOut '"',,
        "Hide"
    )

    if !FileExist(tmpOut)
        return cfg

    txt := FileRead(tmpOut)
    FileDelete(tmpOut)

    for line in StrSplit(txt, "`n", "`r") {
        line := Trim(line)
        if line = ""
            continue
        if SubStr(line, 1, 4) = "EXE|" {
            cfg.foxterm_exe := SubStr(line, 5)
        } else if SubStr(line, 1, 13) = "START_HIDDEN|" {
            cfg.start_hidden := SubStr(line, 14) = "1"
        } else if SubStr(line, 1, 8) = "BINDING|" {
            parts := StrSplit(SubStr(line, 9), "|")
            if parts.Length >= 6 {
                cfg.bindings.Push({
                    name:        parts[1],
                    open_key:    parts[2],
                    open_target: parts[3],
                    open_action: parts[4],
                    close_key:   parts[5],
                    close_match: (parts.Length >= 6 ? parts[6] : "")
                })
            }
        }
    }
    return cfg
}

ResolveFoxExe(configured) {
    if configured != "" && FileExist(configured)
        return configured
    candidates := [
        g_ScriptDir "\..\FoxTerminalApp\FoxTerminal.UI\bin\Debug\net9.0\FoxTerminal.UI.exe",
        g_ScriptDir "\..\FoxTerminalApp\FoxTerminal.UI\bin\Release\net9.0\FoxTerminal.UI.exe"
    ]
    for c in candidates
        if FileExist(c)
            return c
    return ""
}

; ── Custom binding registration ───────────────────────────────────────────────

; Factory functions capture values by-value, avoiding loop-variable aliasing.
MakeOpenFn(target, action) {
    return (*) => CustomOpen(target, action)
}
MakeCloseFn(match) {
    return (*) => CloseFirefoxTabWith(match)
}

RegisterCustomHotkeys(bindings) {
    for b in bindings {
        try {
            if b.open_key != ""
                HotKey b.open_key, MakeOpenFn(b.open_target, b.open_action)
        }
        ; Silently skip if key is invalid or already bound
        try {
            if b.close_key != "" && b.close_match != ""
                HotKey b.close_key, MakeCloseFn(b.close_match)
        }
    }
}

CustomOpen(target, action) {
    if action = "app" {
        if WinExist("ahk_exe " target)
            WinActivate "ahk_exe " target
        else
            Run target
    } else {
        OpenInFirefox(target)
    }
}

; ── Tray info popup ───────────────────────────────────────────────────────────
ShowInfoMsg(*) {
    MsgBox(
        "FoxTerminal Hotkeys`n`n"
        "  Shift+Alt+Y      → YouTube`n"
        "  Shift+Ctrl+Y     → Close YouTube tab`n"
        "  Shift+Alt+F      → Firefox`n"
        "  Shift+Alt+M      → YouTube Music`n"
        "  Shift+Alt+Space  → Show FoxTerminal`n"
        "  Shift+Ctrl+Space → Hide FoxTerminal`n`n"
        "Custom bindings: edit hk_bindings.json`n"
        "Or run  foxinfo  in the terminal.",
        "FoxTerminal Hotkeys"
    )
}
