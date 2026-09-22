# FoxTerminal: Complete System Guide

Full English documentation: from the Ghostty terminal to FoxOS on the Windows desktop, commands, local sites, AI, hotkeys, and day-to-day workflows.

> Українська версія: [`FOXTERMINAL_GUIDE_UA.md`](FOXTERMINAL_GUIDE_UA.md)  
> Short README: [`README.md`](README.md)  
> Interactive presentation: `sites/fox-terminal/` (open via `sites`)

---

## Contents

1. [What this system is](#1-what-this-system-is)
2. [Quick start](#2-quick-start)
3. [Where things live](#3-where-things-live)
4. [System layers](#4-system-layers)
5. [FoxOS and foxlook](#5-foxos-and-foxlook)
6. [home · lock · settings · foxsetup](#6-home--lock--settings--foxsetup)
7. [Command catalog](#7-command-catalog)
8. [Workflows and guides](#8-workflows-and-guides)
9. [Local sites](#9-local-sites)
10. [Themes and visuals](#10-themes-and-visuals)
11. [Ghostty features and keys](#11-ghostty-features-and-keys)
12. [Zen / Firefox Companion](#12-zen--firefox-companion)
13. [AI (FRIEND / ask)](#13-ai-friend--ask)
14. [Security](#14-security)
15. [Troubleshooting](#15-troubleshooting)
16. [Cheat sheets](#16-cheat-sheets)
17. [Ready-made command packs](#17-ready-made-command-packs)

---

## 1) What this system is

**FoxTerminal** is not just PowerShell aliases. It is a local ecosystem:

| Layer | Role |
|-------|------|
| **Ghostty** | Terminal: themes, splits, keybinds, shaders, command palette |
| **cmd/** | 85+ commands: media, notes, network, themes, AI, packaging |
| **FoxOS (`foxos`)** | Animated ASCII wallpaper + Windows accent + desk prompt |
| **Fox look (`foxlook`)** | Windows “wears” FoxOS: dark mode, cursors, dock, Win keys, shell |
| **System shell** | `home`, `lock`, `settings`, `foxsetup` — mini-OS after login |
| **Apps** | `foxlife` (notes/finance), `sites` (local web apps), Zen Companion |
| **builds / foxpack** | Config snapshots and zip packs for another PC |

Targets **Ghostty only**. On Windows use [winghostty](https://github.com/amanthanvi/winghostty) (`winget install AmanThanvi.winghostty`). On Linux/macOS use official Ghostty. All terminal visuals live in `FoxTerminal/ghostty/config`.

---

## 2) Quick start

### Install once

```powershell
winget install AmanThanvi.winghostty
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
```

Linux/macOS: `bash ./FoxTerminal/install.sh`

The installer copies the Ghostty config, creates a shortcut, and optionally starts Ghostty at Windows sign-in.

### First day in the terminal

```powershell
chek                  # are we really in Ghostty?
term -Doctor          # config / font / shell diagnostics
foxdeps -Install      # Firefox, Nerd Font, Oh My Posh, AHK, .NET…
foxsetup              # wizard: user, theme, FoxOS, hotkeys, idle lock
```

Or manually:

```powershell
nuser myname mypass
l myname mypass
who
foxhelp
fday Kyiv
nfile hello.txt
edit hello.txt
ytm lofi
build first-day
```

### Full FoxOS on Windows

```powershell
l myname mypass
foxos on              # ASCII rain wallpaper + accent
foxlook on            # dark Windows, cursors, dock, Win keys
home                  # system home after login
settings              # settings TUI (or settings -Gui)
```

---

## 3) Where things live

```
FireFoxBot/
├── cmd/                    ← all commands (.ps1 + .bat wrappers)
├── sites/                  ← local mini-sites + hub
│   └── fox-terminal/       ← interactive presentation / docs UI
├── FoxTerminal/
│   ├── ghostty/config      ← single terminal visual file
│   ├── ghostty/shaders/    ← per-theme GLSL
│   ├── install.ps1 / .sh
│   ├── FOXTERMINAL_GUIDE_UA.md
│   └── FOXTERMINAL_GUIDE_EN.md   ← this file
├── builds/                 ← snapshots from `build`
└── CHANGELOG.md            ← history (read via `changelog`)
```

Notes:

- Many commands ship as `.ps1` + `.bat` with the same name — in Ghostty type `ytm`, `foxos`, `home`.
- Library scripts (`foxauth.ps1`, `foxos-lib.ps1`, `shader-lib.ps1`…) are **not** for direct use.
- In-terminal help entry point: **`foxhelp`** (arrows + Enter).

---

## 4) System layers

Think of FoxTerminal as layers:

```
┌─────────────────────────────────────────────┐
│  Windows desktop (foxlook: dark, dock…)     │
│  ┌───────────────────────────────────────┐  │
│  │  FoxOS wallpaper (foxos: rain + fox)  │  │
│  │  desk prompt: sw slate, ytm, help…    │  │
│  └───────────────────────────────────────┘  │
│  Ghostty (terminal + shaders + splits)      │
│    └── PowerShell + Oh My Posh + cmd\       │
│         home / settings / notes / media / AI│
└─────────────────────────────────────────────┘
```

| Command | Layer | Short |
|---------|-------|-------|
| `term`, `chek`, `shader` | Terminal | Ghostty config, diagnostics, glass shaders |
| `sw`, `themes`, `noir`… | Session visuals | Palette and mood modes |
| `foxos` | Desktop skin | Wallpaper + accent + live rain |
| `foxlook` | Windows shell | Dark/cursors/dock/Win keys/shell |
| `home` | Post-login UX | Day digest + quick actions |
| `lock` | Session security | Hides terminal; needs Fox password |
| `settings` | Control | TUI or browser Control UI |
| `foxlife` | Separate app | Notes, finance, tables, AI |

---

## 5) FoxOS and foxlook

### 5.1 `foxos` — wallpaper and accent

```powershell
foxos                 # status
foxos on              # ASCII rain + Windows accent from theme
foxos off             # restore previous wallpaper/accent
foxos apply           # repaint now (theme already changed via sw)
foxos toggle
```

What `foxos on` does:

- animated ASCII rain with the fox (same art language as `sw`);
- Windows accent color follows the current theme;
- taskbar search / Copilot / weather stay hidden while FoxOS is on;
- under the fox, a **desk prompt** accepts clicks and short commands like `sw slate`, `ytm`, `help`, `home`.

Skip the skin for this session only: `$env:FOXTERM_FOXOS = "0"`.

### 5.2 `foxlook` — Windows wears FoxOS

```powershell
foxlook               # status of every part
foxlook on            # enable full look
foxlook off           # restore Windows from snapshot
```

Parts (toggle individually):

| Part | Example | Effect |
|------|---------|--------|
| `dark` | `foxlook dark on` | Dark Windows apps/shell |
| `icons` | `foxlook icons on` | Hide desktop icons |
| `taskbar` | `foxlook taskbar on` | Auto-hide taskbar |
| `sounds` | `foxlook sounds on` | Mute system sounds |
| `cursors` | `foxlook cursors on` | Theme-colored pixel cursors |
| `lockscreen` | `foxlook lockscreen on` | Lock screen = FoxOS, no Spotlight |
| `winkeys` | `foxlook winkeys on` | Win → FoxTerminal, Win+I → settings… |
| `oem` | `foxlook oem on` | Settings → About: FoxOS (admin once) |
| `winlock` | `foxlook winlock on` | Win+L → Fox `lock` (Windows lock off) |
| `shell` | `foxlook shell on` | **Next** sign-in of this user = FoxOS instead of Explorer |

#### Cursors

```powershell
foxlook cursor pixel
foxlook cursor chunky 2
foxlook cursor neon 3
foxlook cursor fox
foxlook cursor inverted
foxlook cursor preview     # PNG preview of every style
```

Styles: `pixel` | `chunky` | `neon` | `fox` | `inverted`. Size: `1` | `2` | `3`.

#### Wallpaper: overlay vs behind

```powershell
foxlook wall overlay   # rain as a window (desk prompt works) — default
foxlook wall behind    # rain under icons (Win+D safe; desk prompt off)
```

#### Dock

```powershell
foxlook dock style pill      # rail | pill | glass | slim
foxlook dock place bottom    # top | bottom
foxlook dock size normal     # compact | normal | large
foxlook dock hide on
foxlook dock apps titles     # titles | dots | off
foxlook dock tray clock      # full | clock | off
foxlook dock widgets on
foxlook dock home on
```

#### Export / import look profile

```powershell
foxlook export
foxlook export D:\looks\work.json
foxlook import D:\looks\work.json
```

#### Warning: `foxlook shell on`

On the **next** sign-in of **this** Windows user, FoxOS starts instead of Explorer. Other Windows accounts are unchanged.

**Rescue path:**

1. Ctrl+Alt+Del → Task Manager → File → Run  
2. `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd`  
   or repo `cmd\fox-restore-windows.bat`  
3. Or run `foxlook shell off` / `foxlook off` from a working terminal

If the dock is silent for ~30s after login, Explorer comes back on its own (safety).

### 5.3 Recommended full FoxOS order

```powershell
l myname mypass
themes                 # or sw slate
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style glass
home
settings -Status
```

Back to classic Windows:

```powershell
foxlook off
foxos off
```

---

## 6) home · lock · settings · foxsetup

### `foxsetup` — first boot

Wizard: user, theme, FoxOS, logon autostart, hotkeys, idle lock. Runs on a fresh machine or manually: `foxsetup`.

### `home` — system home

After login: day digest, notes, last site, quick actions (Prompt / YTM / Sites / Help / Settings / Lock).

```powershell
l myname mypass
home
```

### `lock` — Fox session lock

```powershell
lock                  # hide Ghostty + wallpaper lock; Windows stays signed in
lock -Status
lock -Unlock          # or Shift+Alt+T and Fox password
```

Global: **Shift+Alt+L** (via `foxhotkeys`).  
With `foxlook winlock on`, **Win+L** also goes to Fox lock.

### `settings` — system settings

```powershell
settings              # interactive TUI (after login)
settings -Status      # short report: theme, foxos, look, dock, shell, idle…
settings -Gui         # Control UI in browser (http://127.0.0.1:17321/settings.html)
settings -StopGui     # stop host
```

### `changelog`

```powershell
changelog             # history of additions/removals (same viewer as notes)
```

---

## 7) Command catalog

User-facing commands below. Live inventory is always in `foxhelp`.

### 7.1 Users

| Command | Usage | Example |
|---------|-------|---------|
| `l` | `l <name> <pass>` | `l dmytr secret` |
| `nuser` | `nuser <name> <pass>` | `nuser fox admin123` |
| `passwd` | `passwd` | (login required) |
| `users` | `users` | list |
| `who` | `who` | current user |
| `uexit` | `uexit` | log out of Fox user |

### 7.2 System shell

| Command | Usage | Purpose |
|---------|-------|---------|
| `home` | `home` | post-login home |
| `lock` | `lock [-Status\|-Unlock]` | session lock |
| `settings` | `settings [-Status\|-Gui\|-StopGui]` | settings |
| `foxsetup` | `foxsetup` | first-boot wizard |
| `changelog` | `changelog` | change history |
| `off` / `shutdown` | `off` | shut down PC (Yes/No, default No) |

### 7.3 AI

| Command | Usage | Purpose |
|---------|-------|---------|
| `ask` | `ask "…" [--image path]` | one-shot (Ollama) |
| `friend` | `friend` | FRIEND chat; exit with `exitt` |
| `sum` | `sum <file>` | summarize file (needs `OPENAI_API_KEY`) |

In `friend`: `/clear`, `/help`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`. Phrases like “open youtube” or “notes” exit chat and run that command.

### 7.4 Media

| Command | Example | Purpose |
|---------|---------|---------|
| `yt` | `yt lofi hip hop` | YouTube in Firefox/Zen |
| `ytm` | `ytm`, `ytm chill` | YouTube Music |
| `ytm-ui` | `ytm-ui` | TUI + DJ visualizer |
| `ytsplit` | `ytsplit` | YouTube \| YTM left/right |
| `sp` | `sp radiohead` | Spotify |
| `sp-ui` | `sp-ui` | Spotify DJ UI |
| `dj` | `dj` | system audio visualizer |
| `youtube` | `youtube` | open YouTube |
| `foximg` | `foximg photo.jpg` | photo in terminal |
| `foxmirror` | `foxmirror` | iPhone screen (USB / Wi‑Fi) |

`foxmirror` quick path:

```powershell
foxmirror -Check
foxmirror -Setup
foxmirror                 # USB
foxmirror -Wifi           # after one cable session
foxmirror -Video -Fps 30
```

### 7.5 Web, aliases, sites

| Command | Example |
|---------|---------|
| `ff` | `ff open github` |
| `sites` | `sites`, `sites -createn my-tool`, `sites -open my-tool` |
| `bbind` | create .bat or site alias |
| `blist` / `bdel` | list / delete alias |
| `gask` | `gask how does OSC 133 work` |
| `ser` | `ser powershell hash` |
| `ffbot` | .NET Firefox watcher |
| `ffsync` | `ffsync start\|stop\|status\|shell` — sidebar ↔ terminal bridge |

### 7.6 Telegram

| Command | Example |
|---------|---------|
| `tg` | `tg @friend`, `tg work` |
| `tgub` | `tgub @user work` or `tgub phone 380… mom` |
| `tglist` | list/edit binds |

### 7.7 Notes and files

| Command | Example |
|---------|---------|
| `wai` | `wai`, `wai -pin` |
| `go` / `up` | `go files/work` |
| `nfile` / `nfould` | `nfile plan.md` |
| `fdel` | `fdel old.txt` (password) |
| `edit` / `nano` / `view` | `edit plan.md` |
| `hash` / `unhash` | `hash sha256 hello` |

### 7.8 Themes and visual modes

| Command | Purpose |
|---------|---------|
| `sw [theme]` | system info + arrows change theme; Ctrl+E exits |
| `themes` | main picker (Fox, Arthas, Pride, Noir, Death Note…) |
| `noir` | B/W mode (toggle) |
| `dnote` | Death Note style + intro |
| `apple` | Death Note scene as large ASCII |
| `pride` | rainbow styles; arrows in `sw` |
| `arthas` | Arthas dark/light panel |
| `spider` | Spider-Noir panel (in noir) |
| `shader` | `shader on\|off\|status` — per-theme GLSL glass |
| `frederik` | mic/system waveform |
| `foxos` | desktop skin |
| `foxlook` | Windows look |

### 7.9 System, network, diagnostics

| Command | Example |
|---------|---------|
| `wifi` / `reconnect` | status / reconnect |
| `ip` / `netping` | `netping 1.1.1.1 github.com` |
| `weather` / `ftime` / `fday` | `fday Kyiv` |
| `disk` | drive usage |
| `chek` / `sixel` | Ghostty? / inline images? |
| `foxscan` | `foxscan -Deep` |
| `foxbg` | interactive background cleaner |
| `clear` / `texit` | clear / kill terminal |

### 7.10 Window layout

| Command | Example |
|---------|---------|
| `interface` | `interface -Split`, `-Keys`, `-Gui` |
| `term` | `term -Status\|-Apply\|-Edit\|-New\|-Doctor` |
| `apps` | `apps firefox / telegram / spotify` |
| `appbind` | `appbind add code "C:\…\Code.exe"` |

### 7.11 FoxOS Life and Companion

| Command | Purpose |
|---------|---------|
| `foxlife` | native window: notes, finance, tables, AI (`-Status`, `-Rebuild`) |
| `foxaddon` | `foxaddon -Install\|-Pack\|-OpenFolder` |
| `foxzen` | `foxzen status\|default\|theme\|host\|addon` — Zen as primary browser |

### 7.12 Hotkeys, snapshots, packaging

| Command | Example |
|---------|---------|
| `foxhotkeys` | `foxhotkeys -Status\|-Restart\|-Stop` |
| `foxinfo` | hotkey binding manager |
| `build` | `build demo`, `build -list`, `build -restore demo` |
| `foxpack` | `foxpack`, `foxpack -Full -Open` |
| `foxreset` | hard reset caches / prompt |
| `foxdeps` | `foxdeps -Check\|-Install` |
| `foxtest` | `foxtest -Group info`, `foxtest -Only chek,term` |
| `foxhelp` | interactive help |

---

## 8) Workflows and guides

### A) Morning work

```powershell
l myname mypass
home
fday Kyiv
ytm lofi coding
wai
nfile standup.md
edit standup.md
```

### B) Full FoxOS desktop

```powershell
foxsetup                 # if not done yet
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style pill
home
```

### C) Demo / stream

```powershell
themes
apps firefox / telegram / spotify
ytm-ui
build demo-ready
```

### D) Network diagnostics

```powershell
wifi
ip
netping 8.8.8.8 1.1.1.1 github.com
reconnect
netping github.com
```

### E) Hand environment to a teammate

```powershell
build transfer-base
foxpack                  # clean zip, no personal data
# or:
foxpack -Full -OutPath C:\Exports -Open
```

Teammate: unzip → `FoxTerminal\install.ps1` → `foxsetup`.

### F) Safe theme / look experiment

```powershell
build before-look
foxlook on
foxlook cursor neon 3
# ...experiments...
# if bad:
build -restore before-look
foxlook off
```

### G) iPhone on the PC

```powershell
foxmirror -Setup
foxmirror                # cable
# later wireless:
foxmirror -Wifi
```

---

## 9) Local sites

`sites` manages the `sites/` folder. Examples: `fox-terminal`, `hub`, `fox-utils`, `web-ui-guide`, games, forge tools, etc.

```powershell
sites
sites -createn my-dashboard
sites -open my-dashboard
```

Suggested layout:

```
sites/my-dashboard/
  index.html
  assets/css/style.css
  assets/js/main.js
```

System presentation: `sites/fox-terminal/` — themes, commands, Ghostty, AI, media, hotkeys, ecosystem, settings.

---

## 10) Themes and visuals

- Daily work: calm themes via `themes` / `sw slate` (or another palette entry).
- Demo / stream: `noir`, `pride`, `arthas`, `dnote`.
- Glass overlay: `shader on` (GLSL under `FoxTerminal/ghostty/shaders/`).
- Desktop follows theme: `foxos on` — rain and accent track `sw`.

Before `foxpack -Full`, decide whether to share your theme and look profile.

Edit terminal visuals only in `FoxTerminal/ghostty/config`, then `ctrl+shift+,`.

---

## 11) Ghostty features and keys

Already wired in `ghostty/config`:

| Feature | Keys | Effect |
|---------|------|--------|
| Quick terminal | `ctrl+`` ` or `ctrl+shift+`` ` | Quake dropdown from top |
| Splits | `ctrl+shift+enter` / `j` / `l` | Native panes |
| Zoom split | `ctrl+shift+z` | Pane full window |
| Equalize | `ctrl+shift+e` | Equal pane sizes |
| Resize | `ctrl+alt+arrows` | ±40 px |
| Jump prompt | `ctrl+shift+↑/↓` | OSC 133 |
| Search | `ctrl+shift+f` | Scrollback search |
| Scrollback → file | `ctrl+shift+u` | Dump buffer |
| Palette | `ctrl+shift+p` | FoxTerminal commands |
| Inspector | `ctrl+shift+i` | VT / fonts / render |
| Reload config | `ctrl+shift+,` | No restart |
| Fox shortcuts | `ctrl+shift+h/k/s/g/o` | help / chek / sw / term / shader |

**Global (Windows, AHK `foxhotkeys`):**

| Keys | Action |
|------|--------|
| `Shift+Alt+T` | Show FoxTerminal |
| `Shift+Ctrl+Alt+T` | Close |
| `Shift+Alt+Space` / `Shift+Ctrl+Space` | Show / hide |
| `Shift+Alt+L` | Fox `lock` |

Passive: Kitty graphics, long-command notifications, OSC 9;4 progress, opacity 0.92 + blur, Nerd Font ligatures, paste protection, `window-save-state always`.

---

## 12) Zen / Firefox Companion

```powershell
foxaddon -Install
foxaddon -Pack
foxzen status
foxzen default
foxzen theme
foxzen host
foxzen addon
ffsync start
```

Companion provides sidebar, themes, and a bridge to the terminal. Files: `FoxTerminal/firefox-addon/`, `FoxTerminal/zen/`.

---

## 13) AI (FRIEND / ask)

```powershell
ollama serve
ollama pull qwen3-vl

ask "Explain this file"
ask "What is in this image?" --image C:\path\img.png
friend
```

Optional env vars (new terminal after `setx`):

```
OLLAMA_URL=http://localhost:11434
FOXTERM_OLLAMA_MODEL=qwen3-vl
FOXTERM_OLLAMA_SYSTEM=...
FOXTERM_OLLAMA_AUTOSTART=1
FOXTERM_OLLAMA_LOW_POWER=1
FOXTERM_FRIEND_MAX_TURNS=25
```

`foxlife` also embeds an AI assistant in its own window.

---

## 14) Security

1. Do not store passwords/tokens in plain notes.
2. Default `foxpack` is clean; inspect any `-Full` pack before sharing.
3. `build` before experimenting with `foxlook shell` / themes.
4. `foxscan -Deep` for suspicious scripts; `foxbg` for odd processes.
5. Use `foxlook shell on` only if you know the rescue path.
6. Change password with `passwd`.

Optional from the FoxTerminal folder (admin):

```powershell
.\DisableBloat
.\DisableAds
.\Status
.\Enable
```

---

## 15) Troubleshooting

| Symptom | What to do |
|---------|------------|
| Command not found | Check PATH / open Ghostty from the installer shortcut; or `powershell -File .\cmd\foxhelp.ps1` |
| Not Ghostty | `chek`, `term -Doctor`, `term -Apply` |
| Boxes instead of icons | `foxdeps -Install` (Nerd Font), then `ctrl+shift+,` |
| AI silent | `ollama serve`, `ollama pull qwen3-vl` |
| Splits missing | Ghostty only; `term -Status` |
| FoxOS not painting | Windows only; `foxos status`; check `FOXTERM_FOXOS` |
| No Explorer after `shell on` | Ctrl+Alt+Del → Task Manager → Run → `restore-windows.cmd` |
| Wrong `foxpack` | Default is clean; personal state needs `-Full` |
| Firefox/Zen won’t open | `foxzen status`, `ff open youtube`, `blist` |

---

## 16) Cheat sheets

### Auth and home
`nuser` · `l` · `who` · `uexit` · `home` · `lock` · `settings` · `foxsetup`

### FoxOS
`foxos on/off` · `foxlook on/off` · `foxlook cursor …` · `foxlook dock …` · `foxlook shell off`

### AI / media
`ask` · `friend` · `yt` · `ytm` · `ytm-ui` · `sp` · `sp-ui` · `dj` · `foxmirror`

### Notes
`wai` · `go` · `up` · `nfile` · `edit` · `view` · `changelog`

### System
`fday` · `wifi` · `ip` · `netping` · `chek` · `term` · `foxhelp` · `foxtest`

### Snapshots
`build` · `foxpack` · `foxreset` · `foxdeps`

---

## 17) Ready-made command packs

### Focus coding

```powershell
themes
ytm focus electronic
wai
nfile sprint.md
edit sprint.md
```

### Full FoxOS morning

```powershell
l myname mypass
foxos on
foxlook on
home
fday
ytm lofi
```

### Network debug

```powershell
wifi
ip
netping 1.1.1.1 8.8.8.8 github.com
reconnect
```

### Content + messenger

```powershell
ytm chillwave
tg @teamlead
sp-ui
```

### Backup + share

```powershell
build before-share
foxpack
foxpack -Full -OutPath C:\Exports -Open
```

### Safe look experiment

```powershell
build before-look
foxlook export
foxlook on
foxlook cursor preview
# rollback:
foxlook off
build -restore before-look
```

---

## Summary

FoxTerminal = **terminal + commands + FoxOS desktop + system shell + sites + AI + companion**.

Stable daily flow:

1. `foxsetup` once → then `l` → `home`
2. Work via `sites` + notes + `ytm` / `friend`
3. Desktop optionally via `foxos` + `foxlook`
4. Snapshot before experiments: `build`
5. Share with `foxpack`

Live help anytime: **`foxhelp`**.
