# CURSOR MEGAGUIDE — інший ПК (Kali / Linux)

> **Це головний файл для Cursor на другому комп’ютері.**  
> Відкрий репо → новий чат → напиши агенту рівно це:

```
Прочитай повністю FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md
і працюй за ним. Відповідай українською.
```

Створено для переносу контексту з Windows-розробки FoxTerminal / FireFoxBot.  
Репо: `https://github.com/ShewchukV4/FoxTerminal` (дзеркало `shew4uk/FoxTerminal`).

Суміжні (коротші) файли в цій папці:

- `AGENTS.md` — коротка пам’ять  
- `LINUX_GUIDE_UA.md` — стіл / DPI / оптимізація  
- `COMMANDS_LINUX.md` — таблиця Windows→Linux  
- `../FOXTERMINAL_GUIDE_UA.md` — повний системний гайд  
- `../../CHANGELOG.md` — історія змін  

---

## Зміст (мега)

0. [Інструкція для агента Cursor (обов’язково)](#0-інструкція-для-агента-cursor-обовязково)
1. [Хто користувач і що він хоче](#1-хто-користувач-і-що-він-хоче)
2. [Що таке цей проєкт](#2-що-таке-цей-проєкт)
3. [Карта репозиторію](#3-карта-репозиторію)
4. [Git, акаунти, як тягнути код](#4-git-акаунти-як-тягнути-код)
5. [Як працювати в Cursor на цьому ПК](#5-як-працювати-в-cursor-на-цьому-пк)
6. [Шари системи FoxTerminal](#6-шари-системи-foxterminal)
7. [Повний каталог команд (з Linux-нотатками)](#7-повний-каталог-команд-з-linux-нотатками)
8. [Ghostty: конфіг, клавіші, фішки](#8-ghostty-конфіг-клавіші-фішки)
9. [Робочий стіл Linux (замість foxos/foxlook)](#9-робочий-стіл-linux-замість-foxosfoxlook)
10. [Пропорції екрана, DPI, layout до оптимізації](#10-пропорції-екрана-dpi-layout-до-оптимізації)
11. [Оптимізація Kali / Linux під Fox](#11-оптимізація-kali--linux-під-fox)
12. [AI: Ollama, friend, ask](#12-ai-ollama-friend-ask)
13. [Сайти sites/ і презентація](#13-сайти-sites--і-презентація)
14. [Zen / Firefox Companion](#14-zen--firefox-companion)
15. [Що Windows-only і чого не робити](#15-що-windows-only-і-чого-не-робити)
16. [Сценарії роботи (копіюй як чеклісти)](#16-сценарії-роботи-копіюй-як-чеклісти)
17. [Стиль коду і правила змін](#17-стиль-коду-і-правила-змін)
18. [Troubleshooting мега-таблиця](#18-troubleshooting-мега-таблиця)
19. [Пам’ять розмов (що вже було зроблено)](#19-память-розмов-що-вже-було-зроблено)
20. [Готові промпти для цього Cursor](#20-готові-промпти-для-цього-cursor)
21. [Шпаргалка одним екраном](#21-шпаргалка-одним-екраном)

---

## 0) Інструкція для агента Cursor (обов’язково)

Ти — агент у репозиторії **FoxTerminal** на **Linux/Kali** (інший ПК користувача).

**Завжди:**

1. Мова відповідей — **українська**, якщо юзер не попросив інше.  
2. Спочатку спирайся на **цей файл**, потім на код.  
3. Не вигадуй, що `foxos` / `foxlook` / `foxlife` / AHK `foxhotkeys` працюють на Linux — вони **Windows-only**. Давай Linux-еквіваленти з розділів 9–11.  
4. Не коміть і не пуш без явного «закоміть / запуш».  
5. Не проси і не вигадуй паролі GitHub; для clone — PAT або SSH.  
6. Не вмикай і не радь `foxlook shell on` без явного «так» і rescue-шляху (і лише про Windows).  
7. Шляхи тільки POSIX: `/home/...`, ніколи `C:\`.  
8. Для `.ps1` на Linux: `pwsh -NoProfile -File ./cmd/NAME.ps1 …` або поясни native-заміну.  
9. Якщо задача про стіл / масштаб / «щоб гарно» — спочатку спитай (або визнач) **DE + роздільність + Wayland/X11**.  
10. Великі доки не дублюй без потреби — лінкуй розділи цього файлу.

**Перший хід у новому чаті (зроби сам):**

```text
1) Підтверди: прочитав CURSOR_MEGAGUIDE_UA.md
2) git status / яка гілка / чи є remote
3) Коротко: що можеш зробити на Linux у цьому репо зараз
```

---

## 1) Хто користувач і що він хоче

- Розробляє **FoxTerminal** — персональну екосистему терміналу + (на Windows) FoxOS-стіл.  
- Основна машина розробки була **Windows**; цей ПК — **Kali Linux** з Cursor.  
- Хоче, щоб агент на Kali **знав усю систему**, а не починав з нуля.  
- Локальні чати Cursor **не синхроняться** між ПК → цей MEGAGUIDE = «пам’ять у git».  
- Cloud Agent також має читати цей файл.  
- Юзер часто пише коротко українською; відповідай по суті, без води.

---

## 2) Що таке цей проєкт

**FoxTerminal** — не один скрипт, а стек:

```
Ghostty (термінал)
  └── bash/PowerShell boot + Oh My Posh / fox prompt
        └── cmd/  (85+ команд)
              ├── notes, media, network, AI
              ├── themes / shaders
              ├── (Windows) foxos + foxlook + home/lock/settings
              └── sites/ локальні веб-апки + hub
```

На Linux ядро = **Ghostty + install.sh + cmd/** (+ опційно `pwsh` для PowerShell-скриптів).  
«Красивий стіл як на Windows FoxOS» = налаштування **DE** (розділ 9), не `foxos.ps1`.

Офіційний термінал: **тільки Ghostty**.  
Windows використовує [winghostty](https://github.com/amanthanvi/winghostty); Linux/macOS — upstream Ghostty.

---

## 3) Карта репозиторію

```
FoxTerminal/          ← git root часто так і зветься після clone
├── AGENTS.md                 коротка пам’ять (корінь)
├── CHANGELOG.md              історія
├── cmd/                      УСІ команди (.ps1 / .bat / .sh / .cs / .ahk)
│   ├── foxauth.ps1           логін, теми, shared helpers
│   ├── foxhelp.ps1           інтерактивна довідка
│   ├── foxos*.ps1 / .cs      FoxOS desktop (Windows)
│   ├── foxlook*.ps1          Windows look
│   ├── home.ps1 lock.ps1 settings.ps1 foxsetup.ps1
│   ├── foxlife/              C# Life app (Windows)
│   ├── foxmirror/            iPhone mirror (Python)
│   ├── notes/                локальні нотатки юзера
│   ├── foxterm-bash-init.sh  bash prompt на Linux/macOS
│   └── chek.sh               перевірка Ghostty (unix)
├── FoxTerminal/
│   ├── install.ps1 / install.sh
│   ├── ghostty/config        ВІЗУАЛ ТЕРМІНАЛУ (єдиний файл)
│   ├── ghostty/shaders/      GLSL під теми
│   ├── ghostty/foxterminal-boot.sh
│   ├── firefox-addon/        Companion
│   ├── zen/                  Zen theme
│   ├── oh-my-posh/
│   ├── FOXTERMINAL_GUIDE_UA.md / _EN.md
│   ├── README.md
│   └── linux/                ← ТИ ТУТ (гайди для іншого ПК)
│       ├── CURSOR_MEGAGUIDE_UA.md   ★ цей файл
│       ├── LINUX_GUIDE_UA.md
│       ├── COMMANDS_LINUX.md
│       ├── AGENTS.md
│       └── README.md
├── sites/                    локальні міні-сайти
│   ├── fox-terminal/         презентація системи
│   ├── hub/
│   └── …
└── builds/                   знімки від команди build
```

**Внутрішні lib (не для юзера напряму):**  
`foxauth`, `ghostty-lib`, `foxos-lib`, `foxlook-lib`, `shader-lib`, `note-lib`, `pride-lib`, `foxcursor-lib`, `foxsys-lib`, `hk_lib`, …

---

## 4) Git, акаунти, як тягнути код

| Акаунт | Роль |
|--------|------|
| **shew4uk** | основна історія розробки на Windows |
| **ShewchukV4** | акаунт / репо для іншого ПК; shew4uk = collaborator write |

```bash
# чистий клон
cd ~
rm -rf FoxTerminal   # якщо порожня/бита папка
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal

# оновлення
git pull origin master
# або якщо remote зветься інакше:
git remote -v
git pull
```

Якщо GitHub просить пароль — це **PAT**, не пароль акаунта:  
https://github.com/settings/tokens  

Гілка за замовчуванням: **master**.

Не коміть: `__pycache__/`, секрети, випадкові `theme.txt` / локальний state якщо юзер не просив.

---

## 5) Як працювати в Cursor на цьому ПК

### 5.1 Відкриття проєкту

1. Cursor → Open Folder → `~/FoxTerminal` (корінь git).  
2. Той самий акаунт Cursor, що на Windows — **не** підтягне старі чати (вони локальні).  
3. Новий Agent chat → промпт з шапки цього файлу.

### 5.2 Що агент має робити з інструментами

- Читати файли через Read/Grep, не здогадуватись.  
- Для shell — bash на Kali.  
- Не ламати `FoxTerminal/ghostty/config` без бекапу / пояснення.  
- Після змін конфіга Ghostty нагадуй: `ctrl+shift+,`.

### 5.3 Типові задачі юзера на Kali

| Просить | Ти робиш |
|---------|----------|
| «постав термінал» | `install.sh`, залежності, Nerd Font |
| «як на Windows foxos» | розділ 9 — DE wallpaper/dock/dark |
| «оптимізуй екран» | розділ 10–11 — ratio, scale, opacity |
| «добав команду» | новий `cmd/foo.ps1` + `.bat` за потреби + запис у `foxhelp.ps1` known + foxtest manifest |
| «документація» | оновлюй UA гайди + цей MEGAGUIDE якщо зміна велика |
| «запуш» | commit + push на ShewchukV4 (і origin якщо є доступ) |

### 5.4 Alias для терміналу Cursor / Ghostty

```bash
export FOX="$HOME/FoxTerminal"
export PATH="$FOX/cmd:$PATH"
fox() { pwsh -NoProfile -File "$FOX/cmd/$1.ps1" "${@:2}"; }
```

Без `pwsh` багато команд недоступні — постав PowerShell 7 або використовуй native з `COMMANDS_LINUX.md`.

---

## 6) Шари системи FoxTerminal

| Шар | Команди | Windows | Linux |
|-----|---------|---------|-------|
| A. Термінал | `term`, `chek`, `shader`, Ghostty config | ✅ | ✅ |
| B. Prompt / теми сесії | `sw`, `themes`, `noir`, … | ✅ | ⚠️ через pwsh |
| C. Команди cmd/ | media, notes, net, AI | ✅ | ⚠️ / native |
| D. FoxOS wallpaper | `foxos` | ✅ | ❌ → feh/gsettings/swww |
| E. Windows look | `foxlook` | ✅ | ❌ → DE |
| F. Shell UX | `home`, `lock`, `settings`, `foxsetup` | ✅ | ⚠️ обмежено |
| G. Apps | `foxlife`, companion | ✅ | ❌ / Firefox |
| H. Pack | `build`, `foxpack`, `changelog` | ✅ | ⚠️ |

---

## 7) Повний каталог команд (з Linux-нотатками)

Формат: **команда** — usage — опис — Linux.

### 7.1 Користувачі

| Команда | Usage | Опис | Linux |
|---------|-------|------|-------|
| `l` | `l <name> <pass>` | логін / реєстрація якщо новий | ⚠️ pwsh |
| `nuser` | `nuser <name> <pass>` | новий юзер | ⚠️ |
| `passwd` | `passwd` | зміна пароля | ⚠️ |
| `users` | `users` | список | ⚠️ |
| `who` | `who` | хто активний | ⚠️ |
| `uexit` | `uexit` | logout | ⚠️ |

### 7.2 Системна оболонка Fox

| Команда | Usage | Опис | Linux |
|---------|-------|------|-------|
| `home` | `home` | дім після логіну | ⚠️ |
| `lock` | `lock [-Status\|-Unlock]` | lock сесії Fox | ❌ → `loginctl lock-session` |
| `settings` | `settings [-Status\|-Gui\|-StopGui]` | TUI / Control UI :17321 | ⚠️ |
| `foxsetup` | `foxsetup` | first-boot wizard | ⚠️; на Linux — install.sh + ручні кроки |
| `changelog` | `changelog` | історія | ⚠️ або `less CHANGELOG.md` |
| `off` / `shutdown` | `off` | вимкнути ПК | `systemctl poweroff` (з підтвердженням!) |

### 7.3 AI

| Команда | Usage | Linux |
|---------|-------|-------|
| `ask` | `ask "…" [--image path]` | ⚠️ + ollama |
| `friend` | `friend` (вихід `exitt`) | ⚠️ |
| `sum` | `sum <file>` | ⚠️ + OPENAI_API_KEY |

У friend: `/clear` `/help` `/model` `/cmds` `/repo` `/read` `/explain`.  
Фрази типу «open youtube» закривають чат і запускають команду.

### 7.4 Медіа

| Команда | Usage | Linux |
|---------|-------|-------|
| `yt` | `yt <query>` | `firefox "https://youtube.com/results?search_query=…"` |
| `ytm` | `ytm [query]` | music.youtube.com |
| `ytm-ui` | `ytm-ui` | ⚠️ TUI |
| `ytsplit` | `ytsplit` | ⚠️ вікна Windows |
| `sp` / `sp-ui` | Spotify | `xdg-open` / веб |
| `dj` | visualizer | ⚠️ |
| `youtube` | відкрити YT | `xdg-open` |
| `foximg` | фото в терміналі | ⚠️ / `chafa` |
| `foxmirror` | iPhone screen | ⚠️ інший usbmuxd stack |

### 7.5 Веб / alias / сайти

| Команда | Usage | Linux |
|---------|-------|-------|
| `ff` | `ff open [alias\|url]` | firefox / ⚠️ |
| `sites` | `sites [-createn\|-open]` | ⚠️ / відкрий `sites/` у Cursor |
| `bbind` `blist` `bdel` | alias | ⚠️ |
| `gask` | ChatGPT prefill | firefox URL |
| `ser` | google | firefox URL |
| `ffbot` | .NET watcher | ❌ |
| `ffsync` | sidebar bridge | ⚠️ |

### 7.6 Telegram

| `tg` | `tg [@user\|alias]` | web.telegram.org |
| `tgub` / `tglist` | binds | ⚠️ |

### 7.7 Нотатки

| `wai` `go` `up` | навігація notes | `cd cmd/notes` |
| `nfile` `nfould` `fdel` | CRUD | `touch`/`mkdir`/`rm` |
| `edit` `nano` `view` | редактори | `micro`/`nano`/`less` |
| `hash` `unhash` | хеші | `sha256sum` / ⚠️ |

### 7.8 Теми / візуал

| `sw` | system info + theme arrows | ⚠️ |
| `themes` | picker | ⚠️ |
| `noir` `dnote` `apple` `pride` `arthas` `spider` | mood modes | ⚠️ |
| `shader` | GLSL glass | ⚠️ / правка config |
| `frederik` | waveform | ⚠️ |
| `foxos` | ASCII rain wallpaper | ❌ §9 |
| `foxlook` | Windows wear FoxOS | ❌ §9 |

### 7.9 Мережа / діагностика

| `wifi` `reconnect` `ip` `netping` `weather` `disk` `ftime` `fday` | | native: `nmcli`, `ip`, `ping`, `curl wttr.in`, `df`, `date` |
| `chek` `sixel` | Ghostty check | `chek.sh` / kitty graphics |
| `foxscan` `foxbg` | скан / cleaner | ⚠️ / `btop` |

### 7.10 Layout

| `interface` | splits | Ghostty keys |
| `term` | config mgr | ⚠️ + `ghostty +show-config` |
| `apps` `appbind` | window layout | wmctrl / hyprctl / Super+arrows |

### 7.11 Life / Companion

| `foxlife` | notes/finance app | ❌ Windows |
| `foxaddon` `foxzen` | Zen/Firefox addon | ⚠️ частково |

### 7.12 Hotkeys / pack / deps

| `foxhotkeys` `foxinfo` | AHK | ❌ → DE shortcuts |
| `build` `foxpack` `foxreset` `foxdeps` `foxtest` `foxhelp` | | ⚠️ |

---

## 8) Ghostty: конфіг, клавіші, фішки

Файл джерела: `FoxTerminal/ghostty/config` → після install: `~/.config/ghostty/config`.

### Клавіші (вже в конфігу)

| Фішка | Клавіші |
|-------|---------|
| Quick terminal | `ctrl+`` ` (global, якщо DE дозволяє) / `ctrl+shift+`` ` |
| Split | `ctrl+shift+enter` / `j` / `l` |
| Zoom split | `ctrl+shift+z` |
| Equalize | `ctrl+shift+e` |
| Resize | `ctrl+alt+стрілки` |
| Jump prompt | `ctrl+shift+↑/↓` |
| Search | `ctrl+shift+f` |
| Scrollback→file | `ctrl+shift+u` |
| Palette | `ctrl+shift+p` |
| Inspector | `ctrl+shift+i` |
| Reload config | `ctrl+shift+,` |
| Fox shortcuts | `ctrl+shift+h/k/s/g/o` |

**GNOME Wayland:** глобальний quick-terminal часто **немає** (немає wlr-layer-shell) → використовуй внутрішній `ctrl+shift+backquote` або Hyprland/Sway.

### Ключі під екран

```ini
font-size = 13
window-padding-x = 8
window-padding-y = 8
background-opacity = 0.92    # на слабкому GPU → 1.0
background-blur = 20         # → 0 якщо лаги
quick-terminal-size = 45%    # 35–50% від ratio
gtk-single-instance = true   # Linux
```

Палітра FoxNight: bg `#0B0F1A`, text `#E6E6E6`, accent `#DC7A14`.

---

## 9) Робочий стіл Linux (замість foxos/foxlook)

### Визнач DE

```bash
echo $XDG_CURRENT_DESKTOP
echo $XDG_SESSION_TYPE
```

### Ефект «FoxOS» чекліст

1. **Dark** тема DE  
2. **Accent** ≈ `#DC7A14`  
3. **Wallpaper** під твій aspect ratio (не розтягнутий 16:9 на 21:9)  
4. **Один dock/panel**, compact, autohide бажано  
5. **Без** зайвих іконок на столі  
6. Ghostty як головний «desk prompt» (quick terminal)

### Шпалери

```bash
feh --bg-fill ~/Pictures/fox-wall.png          # X11
swww img ~/Pictures/fox-wall.png               # Wayland
gsettings set org.gnome.desktop.background picture-uri-dark "file://$HOME/Pictures/fox-wall.png"
```

### Dock

Dash to Dock / Plank / Latte / Waybar — один стиль, icons 28–36px на 1080p.

### Hotkeys замість AHK

| Було | Стало |
|------|-------|
| Shift+Alt+T | Ghostty quick terminal / Super+Enter → ghostty |
| Shift+Alt+L | DE lock |
| Win | Super |

Детальніше: `LINUX_GUIDE_UA.md` §4.

---

## 10) Пропорції екрана, DPI, layout до оптимізації

```bash
xrandr | grep connected
# або
wlr-randr
```

| Ratio | Приклади | Ghostty / стіл |
|-------|----------|----------------|
| 16:9 | 1080p, 1440p, 4K | quick 45%; стандарт |
| 16:10 | 1920×1200 | padding-y +2..4 |
| 21:9 | 3440×1440 | **не** на всю ширину один pane; 2–3 колонки; quick ~38% |
| 3:2 | ноутбуки | font +1; dock compact |

| Роздільність | Scale | font-size | dock |
|--------------|-------|-----------|------|
| 1080p | 100% | 13–14 | 32 |
| 1440p | 100% | 13–14 | 32–36 |
| 4K 27" | 150–200% | 12–13 | 32 @ scale |

**Safe zone:** 2–3% margin від країв під панель/заокруглення.

**Layouts:**

- Focus: Ghostty 100%  
- Code: 70/30 split  
- Ultrawide: 33/33/33 або editor | term | browser на різних workspace  

Спочатку вирівняй **scale DE**, потім `font-size` Ghostty.

Обрізка wallpaper під розмір:

```bash
convert src.png -resize 3440x1440^ -gravity center -extent 3440x1440 out.png
```

---

## 11) Оптимізація Kali / Linux під Fox

1. `btop` — знайди пожирачів CPU/RAM.  
2. Ghostty: opacity **1.0**, blur **0**, якщо лаги.  
3. Вимкни анімації DE на слабкому залізі; XFCE легший за GNOME.  
4. Не тримай зайві `systemctl` сервіси (але не чіпай NetworkManager).  
5. Nerd Font обов’язково (`fc-cache -fv`).  
6. `LANG=C.UTF-8` для кирилиці.  
7. Ollama — тягни модель лише коли треба AI.  
8. Clone з LFS: при потребі `GIT_LFS_SKIP_SMUDGE=1` потім вибірковий pull.  
9. Працюй не під root у Cursor.  
10. Один primary-монітор для терміналу.

APT база:

```bash
sudo apt update
sudo apt install -y git curl wget firefox-esr jq python3 \
  imagemagick chafa fonts-noto-color-emoji wl-clipboard xclip btop
```

Install Fox:

```bash
bash ./FoxTerminal/install.sh
```

---

## 12) AI: Ollama, friend, ask

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-vl
ollama serve
```

```bash
fox ask "поясни install.sh"
fox friend
```

Env (опційно): `OLLAMA_URL`, `FOXTERM_OLLAMA_MODEL`, `FOXTERM_FRIEND_MAX_TURNS`.

---

## 13) Сайти sites/ і презентація

```bash
ls sites/
# презентація системи:
xdg-open sites/fox-terminal/index.html
# або python -m http.server у sites/fox-terminal
```

Сторінки fox-terminal: index, themes, commands, terminal, ai, media, hotkeys, ecosystem, settings, companion.

Новий сайт: структура `index.html` + `assets/css` + `assets/js` (або `fox sites -createn` через pwsh).

---

## 14) Zen / Firefox Companion

На Linux юзер швидше на **Firefox ESR**.  
Addon: `FoxTerminal/firefox-addon/`.  
`foxzen` / `foxaddon` — орієнтовані на Windows paths; на Linux став native messaging вручну за README addon.

---

## 15) Що Windows-only і чого не робити

**Не роби на Linux:**

- `foxos on/off` як ніби спрацює  
- `foxlook …` / `foxlook shell on`  
- `foxhotkeys` (AHK)  
- `DisableBloat` / `DisableAds`  
- `foxlife` як GUI  
- обіцянки що Win+L / OEM About стануть FoxOS  

**Роби замість цього:** розділи 9–11 + `COMMANDS_LINUX.md`.

---

## 16) Сценарії роботи (копіюй як чеклісти)

### A) Перший день на Kali

- [ ] `git clone` ShewchukV4/FoxTerminal  
- [ ] Ghostty + Nerd Font  
- [ ] `bash FoxTerminal/install.sh`  
- [ ] Відкрити папку в Cursor  
- [ ] Новий чат з промптом з шапки MEGAGUIDE  
- [ ] Dark DE + wallpaper під ratio  
- [ ] `chek` / `echo $FOXTERM`

### B) Ранок

```bash
cd ~/FoxTerminal && git pull
curl -s 'wttr.in/Kyiv?format=3'
ping -c 2 1.1.1.1
ghostty &
```

### C) Coding focus 16:9

Ghostty + split 70/30; quick terminal; browser на іншому workspace.

### D) Ultrawide

Три зони; quick ~38%; wallpaper 3440×1440.

### E) Документація / фіча

1. Зміна коду в `cmd/` або `ghostty/`  
2. Онови `foxhelp` known якщо нова команда  
3. Онови MEGAGUIDE / LINUX_GUIDE якщо UX змінився  
4. Коміт лише з прохання юзера  

---

## 17) Стиль коду і правила змін

- PowerShell: як існуючі `cmd/*.ps1` — `foxauth.ps1`, кольори через palette.  
- Bash: `set -euo pipefail` у нових install-скриптах.  
- Не роби giant refactor без запиту.  
- Не додавай markdown-файли без потреби — **цей** MEGAGUIDE вже головний для іншого ПК.  
- UI сайтів: якщо чіпаєш `sites/fox-terminal`, тримай існуючий visual language.  
- Секрети в репо = заборонено.

---

## 18) Troubleshooting мега-таблиця

| Симптом | Дія |
|---------|-----|
| Порожній clone | репо було empty → `git pull`; перевір ShewchukV4 |
| Нема команд у PATH | `export PATH="$HOME/FoxTerminal/cmd:$PATH"` |
| `.ps1` не біжить | постав `pwsh` або native-заміну |
| Не Ghostty | `install.sh`, ярлик, `chek` |
| Квадратики-іконки | Nerd Font + fc-cache |
| Quick terminal не global | GNOME Wayland обмеження |
| Лаги прозорості | opacity 1.0 blur 0 |
| Кирилиця криво | LANG=C.UTF-8 |
| Агент «нічого не знає» | змусь прочитати цей MEGAGUIDE |
| Push 403 | не той GitHub user / потрібен PAT ShewchukV4 або collaborator |
| foxos «Windows only» | очікувано → §9 |

---

## 19) Пам’ять розмов (що вже було зроблено)

Станом на вересень 2026 (перенос на інший ПК):

1. Повні гайди UA/EN оновлені під FoxOS / foxlook / home / settings / foxlife / foxmirror.  
2. `AGENTS.md` у корені + linux pack.  
3. Код запушений на **shew4uk** і **ShewchukV4**.  
4. Collaborator invite прийнято (shew4uk → ShewchukV4/FoxTerminal).  
5. Пояснено: чати Cursor локальні; пам’ять = git-файли.  
6. Створено `FoxTerminal/linux/` з LINUX_GUIDE (стіл, DPI, оптимізація) + COMMANDS_LINUX.  
7. Цей **CURSOR_MEGAGUIDE_UA.md** — головний контекст для Cursor на Kali.

---

## 20) Готові промпти для цього Cursor

### Старт сесії

```
Прочитай повністю FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md.
Підтверди коротко що зрозумів і чекай задачу. Українською.
```

### Порт фічі зі Windows на Linux

```
За MEGAGUIDE §9–11 і COMMANDS_LINUX.md запропонуй Linux-еквівалент для: <команда/ефект>.
Не стверджуй що foxos/foxlook працюють.
```

### Піджене під мій екран

```
Мій DE: <GNOME|KDE|XFCE|Hyprland>, сесія: <wayland|x11>,
роздільність: <WxH>, діагональ: <N>".
За §10 піджени Ghostty font/padding/quick-terminal і стіл.
```

### Нова команда

```
Додай команду <ім'я> у cmd/ у стилі існуючих.
Онови foxhelp known. Поясни Linux-запуск (pwsh або bash).
Не коміть доки не скажу.
```

### Документація

```
Онови LINUX_GUIDE / COMMANDS_LINUX / цей MEGAGUIDE під зміну: <…>
```

---

## 21) Шпаргалка одним екраном

```bash
# код
cd ~/FoxTerminal && git pull

# термінал
bash ./FoxTerminal/install.sh
ghostty

# helper
export FOX=~/FoxTerminal
export PATH=$FOX/cmd:$PATH
fox(){ pwsh -NoProfile -File $FOX/cmd/$1.ps1 "${@:2}"; }

# стіл
# dark DE + accent #DC7A14 + wallpaper під ratio + 1 dock

# екран
xrandr | grep connected
# scale DE → font-size Ghostty → opacity 1.0 якщо лаги

# AI
ollama pull qwen3-vl && ollama serve

# Cursor
# Open Folder ~/FoxTerminal
# «Прочитай FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md»
```

**Палітра:** `#0B0F1A` / `#E6E6E6` / `#DC7A14`  
**Репо:** https://github.com/ShewchukV4/FoxTerminal  
**Головне правило:** Windows-шар стільця ≠ Linux; термінал Ghostty = спільне ядро.

---

*Кінець CURSOR MEGAGUIDE. Якщо додаєш велику фічу — допиши розділ 19 і за потреби §7.*
