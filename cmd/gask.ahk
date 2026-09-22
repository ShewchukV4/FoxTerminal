#Requires AutoHotkey v2.0
#SingleInstance Force

query := ""
for index, arg in A_Args {
    if (index = 1)
        query := arg
    else
        query .= " " arg
}

if (query = "") {
    MsgBox "Usage: gask your question"
    ExitApp
}

url := "https://chatgpt.com"

zen := "C:\Program Files\Zen Browser\zen.exe"
if !FileExist(zen)
    zen := EnvGet("LOCALAPPDATA") "\Zen Browser\zen.exe"
if FileExist(zen)
    Run '"' zen '" --new-tab "' url '"'
else
    Run 'zen.exe --new-tab "' url '"'
WinWaitActive "ahk_exe zen.exe",, 8
Sleep 1800

; Focus input: click near bottom center, then paste
WinGetPos &x, &y, &w, &h, "ahk_exe zen.exe"
focusX := x + (w * 0.50)
focusY := y + (h * 0.90)
Click focusX, focusY
Sleep 120
Send "{Tab 6}"
Sleep 120
SendText query
Sleep 120

; Send Up then Enter to submit
Send "{Up}"
Sleep 80
Send "{Enter}"

Sleep 200

; Removed URL-encoding path; now we paste directly.
