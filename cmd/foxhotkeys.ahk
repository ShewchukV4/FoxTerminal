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
+!y:: OpenInBrowser("https://www.youtube.com")

; Shift+Ctrl+Y → close the browser tab whose title contains "YouTube"
;               (works regardless of which tab is currently active)
+^y:: CloseBrowserTabWith("YouTube")

; Shift+Alt+F  → open Zen/Firefox / bring it to front
+!f:: OpenOrFocusBrowser()

; Shift+Alt+M  → open YouTube Music
+!m:: OpenInBrowser("https://music.youtube.com")

; Shift+Alt+Space  → show / launch FoxTerminal
+!Space:: ShowFoxTerm()

; Shift+Ctrl+Space → hide FoxTerminal (keeps process running in background)
+^Space:: HideFoxTerm()

; Shift+Alt+T      → show / launch FoxTerminal
+!t:: ShowFoxTerm()

; Shift+Ctrl+Alt+T → close FoxTerminal (exit the Ghostty window)
+^!t:: CloseFoxTerm()

; ── Core helpers ─────────────────────────────────────────────────────────────

ResolveBrowserExe() {
    zen := "C:\Program Files\Zen Browser\zen.exe"
    if FileExist(zen)
        return zen
    zenLocal := EnvGet("LOCALAPPDATA") "\Zen Browser\zen.exe"
    if FileExist(zenLocal)
        return zenLocal
    custom := EnvGet("FOXTERM_BROWSER")
    if (custom != "" && FileExist(custom))
        return custom
    customFf := EnvGet("FIREFOX_PATH")
    if (customFf != "" && FileExist(customFf))
        return customFf
    return "zen.exe"
}

BrowserExeName() {
    full := ResolveBrowserExe()
    SplitPath full, &name
    return name
}

OpenInBrowser(url) {
    exe := ResolveBrowserExe()
    Run '"' exe '" -new-tab "' url '"',, "Hide"
}

OpenOrFocusBrowser() {
    exeName := BrowserExeName()
    if WinExist("ahk_exe " exeName)
        WinActivate "ahk_exe " exeName
    else if WinExist("ahk_exe zen.exe")
        WinActivate "ahk_exe zen.exe"
    else if WinExist("ahk_exe firefox.exe")
        WinActivate "ahk_exe firefox.exe"
    else
        Run ResolveBrowserExe()
}

; Find a browser window whose title contains titlePart, close that tab,
; then restore focus to whatever was active before.
CloseBrowserTabWith(titlePart) {
    prevHwnd := WinGetID("A")

    hwnd := 0
    for exeName in ["zen.exe", "firefox.exe"] {
        for w in WinGetList("ahk_exe " exeName) {
            if InStr(WinGetTitle("ahk_id " w), titlePart) {
                hwnd := w
                break
            }
        }
        if hwnd
            break
    }
    if !hwnd
        return

    WinActivate "ahk_id " hwnd
    WinWaitActive "ahk_id " hwnd,, 1
    Send "^w"
    Sleep 100
    try {
        if prevHwnd && WinExist("ahk_id " prevHwnd) {
            WinActivate "ahk_id " prevHwnd
            Sleep 80
        }
    }
}

; FoxTerminal runs in Ghostty, so these helpers drive the Ghostty window.
; Ghostty also has a native drop-down surface on ctrl+backquote
; (toggle_quick_terminal); these hotkeys act on the normal window instead.
FoxTermExeName() {
    global g_FoxExe
    if !g_FoxExe
        return "ghostty.exe"
    SplitPath g_FoxExe, &name
    return name
}

LaunchFoxTermHidden(exePath) {
    exeName := FoxTermExeName()
    if WinExist("ahk_exe " exeName)
        return
    if !exePath || !FileExist(exePath)
        return
    Run exePath
    if WinWait("ahk_exe " exeName,, 6)
        WinHide "ahk_exe " exeName
}

ShowFoxTerm() {
    global g_FoxExe
    exeName := FoxTermExeName()
    if WinExist("ahk_exe " exeName) {
        WinShow     "ahk_exe " exeName
        WinActivate "ahk_exe " exeName
        WinRestore  "ahk_exe " exeName
        Sleep 80
    } else if g_FoxExe && FileExist(g_FoxExe) {
        Run g_FoxExe
    } else {
        TrayTip "Ghostty not found",
            "Install winghostty, or set foxterm_exe in hk_bindings.json"
    }
}

HideFoxTerm() {
    exeName := FoxTermExeName()
    if WinExist("ahk_exe " exeName)
        WinHide "ahk_exe " exeName
}

CloseFoxTerm() {
    closed := false
    for exeName in ["winghostty.exe", "ghostty.exe"] {
        while WinExist("ahk_exe " exeName) {
            WinClose "ahk_exe " exeName
            closed := true
            if !WinWaitClose("ahk_exe " exeName,, 2)
                WinKill "ahk_exe " exeName
        }
    }
    if !closed
        TrayTip "FoxTerminal", "No Ghostty window to close"
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

    for exeName in ["ghostty.exe", "winghostty.exe"] {
        try {
            full := ""
            if RegExMatch(exeName, "i)^winghostty") {
                localAppData := EnvGet("LOCALAPPDATA")
                candidates := [
                    localAppData "\Programs\winghostty\winghostty.exe",
                    localAppData "\winghostty\bin\winghostty.exe",
                    localAppData "\Microsoft\WinGet\Links\winghostty.exe",
                    EnvGet("ProgramFiles") "\winghostty\winghostty.exe",
                    EnvGet("USERPROFILE") "\scoop\apps\winghostty\current\winghostty.exe"
                ]
                for c in candidates
                    if FileExist(c)
                        return c
            }
            ; Fall back to PATH lookup.
            RunWait A_ComSpec ' /c where ' exeName ' > "' A_Temp '\foxhk_where.txt" 2>nul',, "Hide"
            if FileExist(A_Temp "\foxhk_where.txt") {
                found := Trim(StrSplit(FileRead(A_Temp "\foxhk_where.txt"), "`n", "`r")[1])
                FileDelete(A_Temp "\foxhk_where.txt")
                if found != "" && FileExist(found)
                    return found
            }
        }
    }
    return ""
}

; ── Custom binding registration ───────────────────────────────────────────────

; Factory functions capture values by-value, avoiding loop-variable aliasing.
MakeOpenFn(target, action) {
    return (*) => CustomOpen(target, action)
}
MakeCloseFn(match) {
    return (*) => CloseBrowserTabWith(match)
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
        OpenInBrowser(target)
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
        "  Shift+Alt+Space  → Show FoxTerminal (Ghostty)`n"
        "  Shift+Ctrl+Space → Hide FoxTerminal (Ghostty)`n"
        "  Shift+Alt+T      → Show FoxTerminal (Ghostty)`n"
        "  Shift+Ctrl+Alt+T → Close FoxTerminal (Ghostty)`n`n"
        "Ghostty's own drop-down terminal: Ctrl+``  (system-wide)`n`n"
        "Custom bindings: edit hk_bindings.json`n"
        "Or run  foxinfo  in the terminal.",
        "FoxTerminal Hotkeys"
    )
}
