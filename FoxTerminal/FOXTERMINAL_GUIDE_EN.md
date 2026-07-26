# FoxTerminal: Complete Practical Guide

This is a full English documentation guide for FoxTerminal: from installation and first launch to daily workflows, themes, diagnostics, notes, AI commands, hotkeys, snapshots, and packaging.

The guide is written for real Windows usage, with a focus on PowerShell/CMD launch flows, Firefox integration, local sites, media workflows, and personalization tools.

---

## 1) What FoxTerminal Is

FoxTerminal is a command-driven environment built from scripts, profiles, and helper tools. Main goals:

- fast web/media actions (YouTube, YouTube Music, Spotify, Telegram, search);
- system utilities (network, disks, date/time, IP, diagnostics);
- local notes with folder navigation;
- AI commands for one-shot prompts and interactive chat;
- visual modes/themes (`noir`, `pride`, `arthas`, `dnote`, `spider`);
- window layout control and terminal backend switching;
- config snapshots (`build`) and shareable packaging (`foxpack`).

---

## 2) Quick Start (10 Steps)

1. Open PowerShell in the project root.
2. Check dependencies:
   - `foxdeps -Check`
3. Install missing dependencies if needed:
   - `foxdeps -Install`
4. Open full help menu:
   - `foxhelp`
5. Register user:
   - `nuser myname mypass`
6. Login:
   - `l myname mypass`
7. Check active user:
   - `who`
8. Create first note:
   - `nfile hello.txt`
   - `edit hello.txt`
9. Test media command:
   - `yt lofi hip hop`
10. Save current setup:
   - `build first-day`

---

## 3) Project Layout

Main folders:

- `cmd/` - user-facing commands (`.ps1`, `.bat`, `.cmd`);
- `sites/` - local mini-sites and site registry;
- `FoxTerminal/` - install/config/theme files;
- `builds/` - configuration snapshots and installer assets.

Notes:

- Many commands have both `.ps1` and `.bat` wrappers.
- Some scripts are internal helpers and not meant for direct manual use.
- Main entry point for navigation/help is `foxhelp`.

---

## 4) Full Command Catalog by Category

## 4.1 Login and Users

### `l`
- Purpose: login (or register if user does not exist).
- Usage: `l <name> <pass>`
- Example: `l dmytr qwerty123`

### `nuser`
- Purpose: register a new user.
- Usage: `nuser <name> <pass>`
- Example: `nuser fox admin123`

### `passwd`
- Purpose: change password (requires active login).
- Usage: `passwd`

### `users`
- Purpose: list registered users.
- Usage: `users`

### `who`
- Purpose: show active/current user.
- Usage: `who`

### `uexit`
- Purpose: logout.
- Usage: `uexit`

---

## 4.2 AI Commands

### `ask`
- Purpose: one-shot AI request via Ollama.
- Usage: `ask "..." [--image <path>]`
- Examples:
  - `ask "Explain this script"`
  - `ask "What is in this image?" --image C:\img\photo.png`

### `friend`
- Purpose: interactive AI chat mode.
- Usage: `friend`
- Useful in-chat commands:
  - `/help`, `/clear`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`

### `sum`
- Purpose: summarize a file with OpenAI.
- Usage: `sum <file>`
- Example: `sum .\cmd\foxdeps.ps1`

---

## 4.3 Media and Content

### `yt`
- Purpose: YouTube search in Firefox.
- Usage: `yt <query>`
- Example: `yt cyberpunk ambient`

### `ytm`
- Purpose: open/search YouTube Music (supports alias or URL too).
- Usage: `ytm [query|alias|url]`
- Examples:
  - `ytm`
  - `ytm synthwave`

### `ytm-ui`
- Purpose: YouTube Music TUI controls + DJ visualizer.
- Usage: `ytm-ui`

### `ytsplit`
- Purpose: split and place YouTube/YTM windows.
- Usage: `ytsplit [-ReportOnly]`
- Example: `ytsplit`

### `sp`
- Purpose: open/search Spotify.
- Usage: `sp [query|url]`
- Example: `sp dark ambient`

### `sp-ui`
- Purpose: Spotify DJ UI controls (play/next/prev/etc).
- Usage: `sp-ui`

### `dj`
- Purpose: audio-level visualizer.
- Usage: `dj`

### `youtube`
- Purpose: open YouTube in Firefox.
- Usage: `youtube`

---

## 4.4 Firefox, Web, and Alias Management

### `ff`
- Purpose: open URL or alias in Firefox.
- Usage: `ff open [alias-or-url]`
- Examples:
  - `ff open youtube`
  - `ff open https://developer.mozilla.org`

### `sites`
- Purpose: browse local sites, scaffold a new site, open site folder.
- Usage: `sites [-createn <name>] [-open <name>]`
- Examples:
  - `sites`
  - `sites -createn fox-lab`
  - `sites -open fox-lab`

### `bbind`
- Purpose: create custom `.bat` command or website alias for `ff`.
- Usage: `bbind`

### `blist`
- Purpose: list site aliases.
- Usage: `blist`

### `bdel`
- Purpose: delete site alias.
- Usage: `bdel <alias>`
- Example: `bdel docs`

### `gask`
- Purpose: open ChatGPT in Firefox with prefilled query.
- Usage: `gask <question>`
- Example: `gask how to optimize powershell scripts`

### `ser`
- Purpose: quick Google search in Firefox.
- Usage: `ser <terms>`
- Example: `ser powershell compare object examples`

### `ffbot`
- Purpose: .NET Firefox watcher utility.
- Usage: `ffbot`

### Firefox personal add-on (`FoxTerminal Companion`)
- Purpose: quick Firefox popup that runs selected FoxTerminal web commands through Native Messaging.
- Side terminal trigger from address bar:
  - type `ff`, press Space, press Enter -> opens side terminal panel
  - type `ff`, press Space, then `history -clear` -> clears Firefox history
- Shared terminal session mode (sync terminal <-> sidebar):
  - run `ffsync start`
  - run `ffsync shell`
  - then open sidebar with `ff` + Space + Enter
- Location: `FoxTerminal/firefox-addon/`
- Install host:
  - `powershell -ExecutionPolicy Bypass -File .\FoxTerminal\firefox-addon\native-host\install-host.ps1`
- Load extension temporarily in Firefox:
  - `about:debugging#/runtime/this-firefox`
  - Choose `FoxTerminal/firefox-addon/manifest.json`

---

## 4.5 Telegram

### `tg`
- Purpose: open Telegram Web or jump to user/url.
- Usage: `tg [alias|@username|url|tg://...]`
- Examples:
  - `tg`
  - `tg @foxhelper`

### `tgub`
- Purpose: create Telegram alias by username or phone.
- Usage:
  - `tgub <@user|user|url> <alias>`
  - `tgub phone <num> <alias>`
- Examples:
  - `tgub @myfriend mf`
  - `tgub phone +380XXXXXXXXX myphone`

### `tglist`
- Purpose: list/edit Telegram bindings.
- Usage: `tglist`

---

## 4.6 Notes, Files, Text

### `wai`
- Purpose: show current notes location and files.
- Usage: `wai`

### `go`
- Purpose: move into notes subfolder.
- Usage: `go <path>`
- Example: `go files/important`

### `up`
- Purpose: go one level up in notes tree.
- Usage: `up`

### `nfile`
- Purpose: create file in current notes folder.
- Usage: `nfile <name.ext>`
- Example: `nfile plan.md`

### `nfould`
- Purpose: create folder in current notes path.
- Usage: `nfould <name>`

### `fdel`
- Purpose: delete file in notes (with protection flow).
- Usage: `fdel <name.ext>`

### `edit`
- Purpose: terminal editor for notes or direct file paths.
- Usage: `edit <path-or-name>`
- Examples:
  - `edit todo.txt`
  - `edit C:\temp\notes.md`

### `nano`
- Purpose: Linux-style terminal editing (micro/nano/vim fallback).
- Usage: `nano <file>`

### `view`
- Purpose: read-only file view in terminal pager.
- Usage: `view <file>`

### `hash`
- Purpose: hash text values.
- Usage: `hash [fx1|md5|sha1|sha256|ntlm|b64] <text>`
- Example: `hash sha256 mySecret`

### `unhash`
- Purpose: attempt hash recovery (offline/rules/bruteforce modes).
- Usage: `unhash [-offline] [hash]`
- Example: `unhash -offline 5f4dcc3b5aa765d61d8327deb882cf99`

---

## 4.7 Themes and Visual Modes

### `sw`
- Purpose: system info view + theme switcher.
- Usage: `sw [themeName] [live] [color|mono] [imagePath]`
- Examples:
  - `sw`
  - `sw slate`

### `themes`
- Purpose: main theme picker menu (arrows + Enter).
- Usage: `themes`

### `noir`
- Purpose: toggle noir mode.
- Usage: `noir`

### `dnote`
- Purpose: toggle Death Note style mode.
- Usage: `dnote`

### `apple`
- Purpose: show Death Note scene as large centered ASCII art.
- Usage: `apple [imagePath]`

### `pride`
- Purpose: toggle pride mode with multiple style variants.
- Usage: `pride`

### `arthas`
- Purpose: toggle Arthas panel mode.
- Usage: `arthas`

### `spider`
- Purpose: show Spider-Noir panel mode (noir context).
- Usage: `spider`

### `frederik`
- Purpose: voice/audio reactive waveform visualizer.
- Usage:
  - `frederik [-ListMics] [-Source Auto|Mic|System] [-Mic <idx|name>] [-SetMainMic] [-Bars <n>] [-Height <n>]`

---

## 4.8 System, Network, Diagnostics

### `wifi`
- Purpose: Wi-Fi status (SSID/signal/channel).
- Usage: `wifi`

### `reconnect`
- Purpose: reconnect current or specified Wi-Fi profile.
- Usage: `reconnect [ssid]`

### `ip`
- Purpose: show public and local IP addresses.
- Usage: `ip`

### `weather`
- Purpose: weather via wttr.in.
- Usage: `weather [location]`
- Example: `weather Kyiv`

### `netping`
- Purpose: ping default or custom targets.
- Usage: `netping [targets...]`
- Example: `netping 8.8.8.8 1.1.1.1 github.com`

### `disk`
- Purpose: disk usage by drive.
- Usage: `disk`

### `ftime`
- Purpose: current date/time output.
- Usage: `ftime`

### `fday`
- Purpose: daily summary (time + weather + wifi + ip).
- Usage: `fday [location]`

### `chek`
- Purpose: detect current terminal backend environment.
- Usage: `chek`

### `sixel`
- Purpose: check SIXEL readiness in mintty.
- Usage: `sixel`

### `foxscan`
- Purpose: heuristic suspicious script scanner.
- Usage: `foxscan [-Deep] [-IncludeLow] [-IncludeWorkspace] [-Top <n>] [-Path <dir1,dir2,...>]`
- Example: `foxscan -Deep -Top 30`

### `foxbg`
- Purpose: interactive background process cleaner.
- Usage: `foxbg [-IncludeLow] [-Top <n>] [-MinMemoryMB <n>]`

### `clear`
- Purpose: clear terminal screen.
- Usage: `clear`

### `texit`
- Purpose: force-exit current terminal process.
- Usage: `texit`

---

## 4.9 Interface, Backend, Layout

### `interface-deps`
- Purpose: install/check dependencies for interface mode.
- Usage: `interface-deps [-Install|-Check]`

### `interface`
- Purpose: launch split UI mode (tmux/mintty/gui options).
- Usage: `interface [-TwoWindows] [-Terminal] [-Gui]`
- Examples:
  - `interface`
  - `interface -TwoWindows`
  - `interface -Gui`

### `term`
- Purpose: set terminal backend (auto/windows/mintty/cygwin).
- Usage: `term [-Set auto|windows|mintty|cygwin] [-Now] [-App mintty]`
- Example: `term -Set mintty -Now`

### `apps`
- Purpose: arrange up to 4 app windows.
- Usage: `apps <app1> / <app2> [/ <app3> [/ <app4>]]`
- Example: `apps firefox / spotify / telegram`

### `appbind`
- Purpose: bind app alias to exe path and optional args/title match.
- Usage: `appbind [add|del|list] ...`

---

## 4.10 Hotkeys and Binding Tools

### `foxhotkeys`
- Purpose: global hotkey daemon.
- Usage: `foxhotkeys [-Stop] [-Restart] [-Status]`

### `foxinfo`
- Purpose: manage hotkey mappings and FoxTerminal path config.
- Usage: `foxinfo`

---

## 4.11 Snapshots, Reset, Packaging

### `build`
- Purpose: save/list/restore/delete configuration snapshots.
- Usage: `build <name> | -list | -restore <name> | -delete <name>`
- Examples:
  - `build mysetup`
  - `build -list`
  - `build -restore mysetup`

### `foxpack`
- Purpose: package FoxTerminal as shareable zip.
- Usage: `foxpack [-Full] [-Open] [-OutPath <path>]`
- Modes:
  - default: clean package (no personal data);
  - `-Full`: includes current binds/notes/theme (`users.json` is still cleared for safety).
- Examples:
  - `foxpack`
  - `foxpack -Full -Open`
  - `foxpack -OutPath C:\Exports`

### `foxreset`
- Purpose: hard reset caches and shell initialization state.
- Usage: `foxreset [-Git] [-NoGit]`

### `foxdeps`
- Purpose: check/install FoxTerminal dependencies.
- Usage: `foxdeps [-Check] [-Install]`

### `foxhelp`
- Purpose: interactive help menu.
- Usage: `foxhelp`

---

## 5) Practical Workflows (Step-by-Step)

### Workflow A: Morning Setup

1. `who` - confirm active user.
2. `fday Kyiv` - quick context summary.
3. `sites` - open local tools.
4. `ytm lofi coding` - background music.
5. `wai` - verify notes location.
6. `nfile standup.md`
7. `edit standup.md` - write today plan.

### Workflow B: Demo Preparation

1. `themes` - pick visual style.
2. `apps firefox / telegram / spotify` - arrange windows.
3. `sp-ui` or `ytm-ui` - keyboard media controls.
4. `ser demo checklist` - quick lookup.
5. `build demo-ready` - snapshot state before presentation.

### Workflow C: Share Environment with Teammate

1. `build transfer-base`
2. `foxpack` (clean package)
3. Optional: `foxpack -Full` (personal setup)
4. Share zip, receiver runs `install.ps1`.

### Workflow D: Network Diagnostics

1. `wifi`
2. `ip`
3. `netping 8.8.8.8 1.1.1.1 github.com`
4. If unstable: `reconnect`
5. Run `netping` again.

---

## 6) Working with `sites` and Local Web Apps

`sites` is ideal for lightweight local tools:

- typing trainers;
- personal dashboards;
- static utilities without backend setup.

Typical flow:

1. Create: `sites -createn my-tool`
2. Open folder: `sites -open my-tool`
3. Add `index.html`, `assets/css`, `assets/js`
4. Return to launcher: `sites`

Tip: keep a consistent structure (`index.html`, `assets/css/style.css`, `assets/js/main.js`) for easier maintenance.

---

## 7) Theme and Style Strategy

FoxTerminal supports fast style switching:

- neutral daily themes (`themes`, `sw`);
- dark cinematic style (`noir`, `spider`);
- thematic visual mode (`dnote`, `apple`);
- palette-driven styles (`pride`, `arthas`).

Recommended:

- use calm themes for long sessions;
- use high-contrast themes for demos/streams;
- before `foxpack -Full`, decide if you want to share current visual state.

---

## 8) Security and Data Hygiene

1. Do not store plaintext secrets in notes.
2. Do not share `-Full` packages without reviewing content.
3. Use `build` snapshots before major config changes.
4. Run `foxscan -Deep` if you suspect risky scripts.
5. Use `foxbg` if background process behavior looks suspicious.
6. Rotate passwords through `passwd`.

---

## 9) Troubleshooting

### Command not found
- Ensure `cmd` is in `PATH`.
- Run direct script if needed:
  - `powershell -ExecutionPolicy Bypass -File .\cmd\foxhelp.ps1`

### AI commands not responding
- Check Ollama service and model:
  - `ollama serve`
  - `ollama pull qwen3-vl`

### `interface` mode fails
- Run: `interface-deps -Check`
- If `tmux` is missing, try:
  - `interface -TwoWindows`
  - or `interface -Gui`

### Firefox integration mismatch
- Test basic open:
  - `ff open youtube`
- Check aliases:
  - `blist`
- Recreate binding via `bbind` if needed.

### `foxpack` package not expected
- Default mode is clean package.
- Use `-Full` for personal notes/binds/theme.

---

## 10) Clean Daily Operating Pattern

### Daily cycle

1. Login: `l <name> <pass>`
2. Context: `who`, `fday`
3. Work: `sites`, media tools, notes commands
4. Diagnostics if needed: `wifi`, `ip`, `netping`
5. End-of-session:
   - `build daily-YYYYMMDD`
   - `uexit` (optional)

### Configuration change cycle

1. `build before-theme-change`
2. Apply changes with `themes` / `sw` / visual commands
3. Verify with `foxhelp`
4. Save stable point: `build after-theme-change`
5. Rollback if needed: `build -restore before-theme-change`

---

## 11) Quick Command Cheat Sheet

### Auth
- `nuser`, `l`, `who`, `users`, `passwd`, `uexit`

### AI
- `ask`, `friend`, `sum`

### Media
- `yt`, `ytm`, `ytm-ui`, `ytsplit`, `sp`, `sp-ui`, `dj`, `youtube`

### Web/Alias
- `ff`, `sites`, `bbind`, `blist`, `bdel`, `gask`, `ser`, `ffbot`

### Telegram
- `tg`, `tgub`, `tglist`

### Notes
- `wai`, `go`, `up`, `nfile`, `nfould`, `fdel`, `edit`, `nano`, `view`

### Hash
- `hash`, `unhash`

### System/Network
- `wifi`, `reconnect`, `ip`, `weather`, `netping`, `disk`, `ftime`, `fday`, `chek`, `sixel`

### Interface/Terminal
- `term`, `interface`, `interface-deps`, `apps`, `appbind`, `clear`, `texit`

### Themes
- `sw`, `themes`, `noir`, `dnote`, `apple`, `pride`, `arthas`, `spider`, `frederik`

### Service
- `foxscan`, `foxbg`, `foxdeps`, `foxreset`, `foxhelp`, `build`, `foxpack`, `foxhotkeys`, `foxinfo`

---

## 12) Ready-to-Use Command Sets

### Focus Coding

```powershell
themes
ytm focus electronic
wai
nfile sprint.md
edit sprint.md
```

### Network Debug

```powershell
wifi
ip
netping 1.1.1.1 8.8.8.8 github.com
reconnect
netping github.com
```

### Content + Messenger

```powershell
ytm chillwave
tg @teamlead
sp-ui
```

### Backup + Share

```powershell
build before-share
foxpack
foxpack -Full -OutPath C:\Exports -Open
```

---

## 13) Naming Conventions

To keep workspace clean and predictable:

- files: prefer `kebab-case` or `snake_case`;
- build names: `YYYYMMDD-purpose`;
- notes folders: short and clear names;
- aliases: short but explicit (`gh`, `yt`, `docs`, `teamtg`).

---

## 14) Productivity Tips

1. Starting with `fday` gives instant environment context.
2. `apps` + `appbind` creates a repeatable workspace layout.
3. `build` before experiments prevents painful recovery.
4. Use `friend` for sessions, `ask` for one-shot requests.
5. `foxpack` is useful both for sharing and deployment snapshots.

---

## 15) Final Summary

FoxTerminal is a full shell ecosystem, not just aliases:

- user identity and local state;
- notes and file tooling;
- web/media launch workflow;
- AI and helper tools;
- visual modes and themes;
- diagnostics and backend control;
- snapshots and packaging for repeatability.

If you want a stable and efficient routine:

1. start with `fday`;
2. work through `sites` + notes commands;
3. snapshot often with `build`;
4. package with `foxpack` when sharing setup.

That workflow keeps daily usage consistent and avoids scattered, fragile manual setup.

