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
- window layout control and native Ghostty splits;
- config snapshots (`build`) and shareable packaging (`foxpack`).

FoxTerminal targets **Ghostty and only Ghostty**. Upstream Ghostty has no Windows app
yet, so on Windows it runs on [winghostty](https://github.com/amanthanvi/winghostty) —
the same terminal core on a native Win32 runtime, reading the identical config format —
driving PowerShell. On Linux/macOS it is the official Ghostty build driving bash. Every
visual setting lives in `FoxTerminal/ghostty/config`.

---

## 2) Quick Start (10 Steps)

1. Install Ghostty (`winget install AmanThanvi.winghostty` on Windows,
   `brew install --cask ghostty` on macOS, your package manager on Linux).
2. Install the FoxTerminal config:
   - `powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1`
   - or `bash ./FoxTerminal/install.sh`
3. Open Ghostty from the new shortcut and confirm the setup:
   - `chek`
   - `term -Doctor`
   - `foxtest -Group info` to actually run the commands and see them work
4. Check and install remaining dependencies, then open the help menu:
   - `foxdeps -Check`, `foxdeps -Install`
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
- `FoxTerminal/` - install scripts and theme files;
- `FoxTerminal/ghostty/` - the Ghostty config plus the shell bootstrap scripts
  (`config`, `foxterminal-boot.ps1`, `foxterminal-boot.sh`);
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

### `shader`
- Purpose: Ghostty glass shaders for the current theme. On by default.
- Usage: `shader [on|off|status|toggle]`
- Examples:
  - `shader` — show which `.glsl` is active
  - `shader off` — disable glass for every theme
  - `shader on` — turn it back on
  - `ctrl+shift+o` — toggle

### `foxos`
- Purpose: the terminal theme paints the Windows wallpaper and window accent.
- Usage: `foxos [on|off|status|apply]`
- Examples:
  - `foxos on` — enable (current wallpaper is saved)
  - `foxos off` — restore the previous desktop
  - `sw` / `dnote` / `arthas` — while FoxOS is on, the desktop follows the theme

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
- Purpose: verify you are inside Ghostty and report shell, host and env signals.
- Usage: `chek`

### `sixel`
- Purpose: check inline-image support. Ghostty implements the Kitty graphics protocol
  (not SIXEL), so this reports the session state, `image-storage-limit`, and which
  renderers are installed (`chafa`, `timg`, `kitten`).
- Usage: `sixel [-Test]`

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

## 4.9 Ghostty, Splits, Layout

### `interface`
- Purpose: create Ghostty splits and list the split keybinds. Splits are native to
  Ghostty, so no tmux, mintty or bash is involved anymore.
- Usage: `interface [-Split down|right|auto] [-TwoWindows] [-Keys] [-Gui]`
- Examples:
  - `interface` — interactive menu
  - `interface -Split right`
  - `interface -Keys` — print the keybind reference
  - `interface -Gui` — Windows GUI window-arranger fallback

### `term`
- Purpose: manage the FoxTerminal Ghostty config.
- Usage: `term [-Status] [-Apply] [-Edit] [-New] [-Doctor]`
- Examples:
  - `term -Status` — config path, Ghostty version, whether this is a Ghostty session
  - `term -Apply` — reinstall `FoxTerminal/ghostty/config` (backs up the old one)
  - `term -Edit` — open the config in your editor
  - `term -Doctor` — check binary, config, font, shell integration

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
- FoxTerminal: `Shift+Alt+T` show, `Shift+Ctrl+Alt+T` close (Space variants still show/hide).

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

### `foxtest`
- Purpose: smoke-test every FoxTerminal command and report what broke.
- Usage: `foxtest [-List] [-Quiet] [-Only <names>] [-Group all|info|tui|bat] [-Timeout <s>]`
- How it decides what "working" means:
  - commands that should finish on their own are run and must exit cleanly
  - menu-driven commands only have to draw their interface and reach the point where
    they wait for a key
  - commands that would change settings, close the terminal, or need the ffsync daemon
    are skipped on purpose; `foxtest -List` shows the reason for each
- Examples:
  - `foxtest` - full run, roughly 6 minutes
  - `foxtest -Group info` - only the commands that exit on their own
  - `foxtest -Only chek,term,sixel` - just those three
- Notes: adding a command to `cmd\` without listing it makes `foxtest` report it as not
  covered, so the manifest at the top of `cmd\foxtest.ps1` stays in sync.

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

## 7.5) Ghostty Features You Get for Free

Everything below is already configured in `FoxTerminal/ghostty/config`.

| Feature | Keys | What it does |
|---------|------|--------------|
| Quick terminal | `ctrl+backquote` (global) or `ctrl+shift+backquote` | Quake-style drop-down from the top of the screen, 45% height, autohides on blur |
| Splits | `ctrl+shift+enter` / `j` / `l` | Native panes, no tmux; unfocused panes dim to 85% |
| Split zoom | `ctrl+shift+z` | Expand the focused pane to the whole window and back |
| Equalize splits | `ctrl+shift+e` | Reset all panes to equal size |
| Resize split | `ctrl+alt+arrows` | Resize the focused pane by 40 pixels |
| Jump to prompt | `ctrl+shift+up` / `down` | Hop between prompts using OSC 133 shell integration |
| Scrollback search | `ctrl+shift+f` | Search history with FoxNight-colored highlights |
| Scrollback to file | `ctrl+shift+u` | Dump the whole 32 MB buffer to a file and open it |
| Command palette | `ctrl+shift+p` | FoxTerminal commands registered as palette entries |
| Terminal inspector | `ctrl+shift+i` | Live VT debugger: escape sequences, cells, fonts, renderer stats |
| Config reload | `ctrl+shift+comma` | Apply config edits without restarting |
| Fox shortcuts | `ctrl+shift+h/k/s/g` | Run `foxhelp`, `chek`, `sw`, `term` |

Passive features that need no keys: Kitty graphics for inline images (`sixel` reports the
state, `chafa`/`timg` render), desktop notifications when a long command finishes while
unfocused, OSC 9;4 progress bars in the title and taskbar, `background-opacity 0.92` with
a 20px blur, Nerd Font ligatures via `calt`/`liga`, paste protection for suspicious
multi-line text, `ssh-terminfo` installing `xterm-ghostty` on remote hosts, and
`window-save-state always` restoring the session after a restart.

Platform caveats worth knowing:

- The global `ctrl+backquote` works on macOS and on some Linux compositors. On Windows the
  system-wide hotkey comes from the `foxhotkeys` AHK daemon (`Shift+Alt+T` show,
  `Shift+Ctrl+Alt+T` close; Space variants still show/hide), while
  `ctrl+shift+backquote` always works from inside Ghostty.
- On Linux the quick terminal requires Wayland with `wlr-layer-shell-v1`, so it is
  unavailable on GNOME.
- Tabs, the `gtk-*` keys and `window-titlebar-*` are GTK-only. macOS and Windows silently
  ignore them.
- `auto-update` and `quick-terminal-screen` are macOS-only.

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

### Splits or keybinds do nothing
- Confirm you are in Ghostty: `chek`. Splits and keybinds come from Ghostty itself, so
  they are unavailable in any other terminal.
- Confirm the config is installed: `term -Status`, then `term -Apply` if it is missing.
- Reload after edits: `ctrl+shift+,`.
- Diagnose everything at once: `term -Doctor`.

### Glyphs render as boxes
- A Nerd Font is missing. Run `foxdeps -Install` or set `font-family` in the config to a
  font you actually have, then `ctrl+shift+,`.

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

### Ghostty/Terminal
- `term`, `chek`, `interface`, `apps`, `appbind`, `clear`, `texit`

### Themes
- `sw`, `themes`, `noir`, `dnote`, `apple`, `pride`, `arthas`, `spider`, `frederik`

### Service
- `foxscan`, `foxbg`, `foxdeps`, `foxtest`, `foxreset`, `foxhelp`, `build`, `foxpack`, `foxhotkeys`, `foxinfo`

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

