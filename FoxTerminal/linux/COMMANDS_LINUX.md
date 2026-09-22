# Шпаргалка: команда Windows → Linux

Коротко: **що набрати на Kali**, коли звик до Fox-команди з Windows.

Легенда:  
✅ працює так само (через PATH / `.sh` / `pwsh`) ·  
⚠️ через `pwsh -File ./cmd/NAME.ps1` ·  
❌ Windows-only → використай Linux-заміну

`FOX` = `$HOME/FoxTerminal` (підстав свій шлях).

```bash
export FOX="$HOME/FoxTerminal"
fox() { pwsh -NoProfile -File "$FOX/cmd/$1.ps1" "${@:2}"; }
```

---

## Система / діагностика

| Windows | Linux краще так |
|---------|-----------------|
| `chek` | `chek` якщо є `cmd/chek.sh`; інакше перевір `echo $TERM_PROGRAM` / `ghostty` |
| `term -Doctor` | ⚠️ `fox term` або `ghostty +show-config` |
| `wifi` | `nmcli device wifi` / `iwconfig` |
| `reconnect` | `nmcli device disconnect wlan0; nmcli device wifi connect "SSID"` |
| `ip` | `ip -br a` + `curl -s ifconfig.me` |
| `netping 1.1.1.1` | `ping -c 4 1.1.1.1` або ⚠️ `fox netping 1.1.1.1` |
| `disk` | `df -h` / `lsblk` / `ncdu` |
| `ftime` / `fday` | `date` + `curl wttr.in/Kyiv` або ⚠️ `fox fday` |
| `weather Kyiv` | `curl wttr.in/Kyiv` або ⚠️ `fox weather Kyiv` |
| `foxscan -Deep` | ⚠️ `fox foxscan -Deep` |
| `foxbg` | `btop` / `htop` / `killall …` |
| `clear` | `clear` / `ctrl+l` |
| `texit` | `exit` або закрити вікно Ghostty |

---

## Користувач / оболонка Fox

| Windows | Linux |
|---------|-------|
| `nuser` / `l` / `who` / `uexit` | ⚠️ `fox nuser` … (потрібен pwsh + дані юзера) |
| `home` | ⚠️ `fox home` — або просто відкрий Ghostty + `curl wttr.in` |
| `lock` | `loginctl lock-session` / Super+L у DE |
| `settings` | ⚠️ частково; для стільця — Settings DE |
| `foxsetup` | ⚠️; на Linux ручний install.sh + §4 LINUX_GUIDE |
| `changelog` | ⚠️ `fox changelog` або `less CHANGELOG.md` |

---

## Теми / візуал

| Windows | Linux |
|---------|-------|
| `sw` / `themes` | ⚠️ `fox sw` / `fox themes` у Ghostty |
| `shader on\|off` | ⚠️ або правки в `~/.config/ghostty/config` |
| `noir` / `pride` / `arthas` / `dnote` | ⚠️ якщо pwsh тягне скрипти |
| `foxos on` | ❌ → wallpaper: `feh` / `gsettings` / `swww` (LINUX_GUIDE §4) |
| `foxlook on` | ❌ → dark theme DE + dock + hide icons |
| `foxlook cursor fox` | ❌ → тема курсорів DE (Bibata, etc.) |
| `foxlook dock style pill` | ❌ → Dash to Dock / Plank / Waybar |
| `foxlook shell on` | ❌ ніколи на Linux (і обережно на Windows) |

---

## Медіа / веб

| Windows | Linux |
|---------|-------|
| `yt query` | `firefox "https://www.youtube.com/results?search_query=query"` або ⚠️ `fox yt …` |
| `ytm` | `firefox https://music.youtube.com` |
| `youtube` | `xdg-open https://www.youtube.com` |
| `sp` | `xdg-open spotify:` або веб |
| `ff open alias` | `firefox URL` / ⚠️ `fox ff open …` |
| `ser terms` | `firefox "https://www.google.com/search?q=terms"` |
| `gask q` | `firefox "https://chatgpt.com/?q=…"` |
| `sites` | ⚠️ `fox sites` → відкриє локальні html |
| `tg` | `firefox https://web.telegram.org` |

---

## Нотатки / файли

| Windows | Linux |
|---------|-------|
| `wai` / `go` / `up` | ⚠️ або `cd $FOX/cmd/notes && ls` |
| `nfile a.md` | `touch notes/a.md` (у правильній папці notes) |
| `edit a.md` | `micro a.md` / `nano` / `cursor a.md` |
| `nano a.md` | `nano a.md` ✅ |
| `view a.md` | `less a.md` / `bat a.md` |
| `hash sha256 text` | `printf text \| sha256sum` або ⚠️ `fox hash …` |

---

## AI

| Windows | Linux |
|---------|-------|
| `ask "…"` | ⚠️ `fox ask "…"` (потрібні ollama + pwsh) |
| `friend` | ⚠️ `fox friend` |
| `sum file` | ⚠️ або локальний LLM |

```bash
ollama serve
ollama run qwen3-vl
```

---

## Layout / вікна

| Windows | Linux |
|---------|-------|
| `interface -Split` | у Ghostty: `ctrl+shift+enter` |
| `apps a / b` | Super+стрілки / `wmctrl` / Hyprland binds |
| `appbind` | `.desktop` файли в `~/.local/share/applications` |
| `foxhotkeys` | ❌ → DE Keyboard Shortcuts + Ghostty keybinds |

---

## Знімки / пакування

| Windows | Linux |
|---------|-------|
| `build name` | ⚠️ `fox build name` |
| `foxpack` | ⚠️ або `git archive` / `zip -r` |
| `foxdeps -Install` | §2 LINUX_GUIDE (apt + font + ghostty) |
| `foxtest` | ⚠️ обмежено на Linux |
| `foxreset` | ⚠️ |

---

## Буфер обміну / скрін

```bash
# Wayland
echo hello | wl-copy
wl-paste

# X11
echo hello | xclip -selection clipboard
xclip -selection clipboard -o

# screenshot
gnome-screenshot   # або
flameshot gui
grim -g "$(slurp)" shot.png   # Wayland
```

---

## Одна стрічка «ранок Linux»

```bash
cd "$HOME/FoxTerminal" && git pull
curl -s "wttr.in/Kyiv?format=3"
ping -c 2 1.1.1.1
ghostty &
```
