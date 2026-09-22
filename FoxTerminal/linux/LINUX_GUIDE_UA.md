# FoxTerminal на Linux — повний гайд

Для **Kali** і будь-якого Linux з Ghostty.  
Мета: зрозуміти, **які команди писати**, як налаштувати **робочий стіл і пропорції екрана**, і як **оптимізувати** систему під FoxTerminal.

Суміжні файли: [`COMMANDS_LINUX.md`](COMMANDS_LINUX.md) · [`AGENTS.md`](AGENTS.md) · [`../FOXTERMINAL_GUIDE_UA.md`](../FOXTERMINAL_GUIDE_UA.md)

---

## Зміст

1. [Що працює / що ні](#1-що-працює--що-ні)
2. [Встановлення на Kali](#2-встановлення-на-kali)
3. [Як правильно писати команди](#3-як-правильно-писати-команди)
4. [Робочий стіл (детально)](#4-робочий-стіл-детально)
5. [Пропорції екрана, DPI, масштаби](#5-пропорції-екрана-dpi-масштаби)
6. [Ghostty під Linux: вікно, padding, quick terminal](#6-ghostty-під-linux-вікно-padding-quick-terminal)
7. [Оптимізація системи](#7-оптимізація-системи)
8. [Сценарії дня](#8-сценарії-дня)
9. [Troubleshooting](#9-troubleshooting)

---

## 1) Що працює / що ні

| Функція | Linux | Коментар |
|---------|-------|----------|
| Ghostty + Fox конфіг | ✅ | `bash FoxTerminal/install.sh` |
| Splits / keybinds / shaders | ✅ | як у гайді Ghostty |
| Prompt / теми в bash | ✅ | `foxterminal-boot.sh` + `foxterm-bash-init.sh` |
| `sites`, браузер, `ser`/`gask` (якщо є обгортки) | ⚠️ | через Firefox + bash/pwsh |
| Ollama `ask` / `friend` | ✅ | якщо стоїть `pwsh` або портовані скрипти |
| `foxos` / `foxlook` / dock / Win keys | ❌ | **тільки Windows** |
| `foxlife` (C# WinForms/WPF-стиль) | ❌ | Windows native |
| `foxmirror` (iPhone) | ⚠️ | логіка Python; на Linux інший шлях до usbmuxd |
| `foxhotkeys` (AHK) | ❌ | на Linux — Ghostty global `ctrl+backquote` або DE-hotkeys |
| `DisableBloat` / Windows ads | ❌ | див. розділ оптимізації Linux |

**Правило:** усе, що малює/ламає **Windows shell**, на Linux замінюється інструментами DE (GNOME/KDE/XFCE/Hyprland) — команди нижче.

---

## 2) Встановлення на Kali

### 2.1 Залежності

```bash
sudo apt update
sudo apt install -y git curl wget firefox-esr fonts-noto-color-emoji \
  imagemagick chafa jq python3 python3-pip \
  wl-clipboard xclip   # буфер обміну Wayland/X11
```

Ghostty (якщо немає в репо):

```bash
# перевірити
command -v ghostty || echo "постав з https://ghostty.org/download"

# Nerd Font (іконки в prompt)
mkdir -p ~/.local/share/fonts
# скачай CaskaydiaCove Nerd Font → розпакуй у ~/.local/share/fonts
fc-cache -fv
```

PowerShell (щоб ганяти `.ps1` з `cmd/`):

```bash
# офіційний пакет Microsoft або через snap — дивись docs.microsoft.com
command -v pwsh || echo "без pwsh багато fox*-команд не стартують"
```

Ollama (AI):

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-vl
ollama serve   # якщо не як сервіс
```

### 2.2 Клон і інстал FoxTerminal

```bash
cd ~
rm -rf FoxTerminal   # якщо була порожня/бита папка
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
bash ./FoxTerminal/install.sh
```

Конфіг ляже в `~/.config/ghostty/config` (+ overlay `foxterminal-local.ghostty`).  
Лаунчер часто: `~/.local/bin/foxterminal`.

Перевірка:

```bash
ghostty +show-config 2>/dev/null | head
# у відкритому Ghostty:
chek          # якщо є chek.sh у PATH
echo $FOXTERM
```

### 2.3 Cursor на Kali

```bash
cd ~/FoxTerminal
# File → Open Folder → ця папка
git pull
```

Агенту: «прочитай `FoxTerminal/linux/LINUX_GUIDE_UA.md` і `AGENTS.md`».

---

## 3) Як правильно писати команди

### 3.1 Три способи виклику

| Спосіб | Коли | Приклад |
|--------|------|---------|
| **Native bash / `.sh`** | є обгортка | `chek` (якщо `chek.sh` у PATH) |
| **`pwsh -File`** | скрипт лише `.ps1` | `pwsh -NoProfile -File ./cmd/foxhelp.ps1` |
| **Linux-еквівалент** | Windows-only | замість `foxos on` → `feh` / `gsettings` / `swww` |

Не пиши Windows-шляхи:

```bash
# погано
pwsh -File C:\Users\...\cmd\home.ps1

# добре
pwsh -NoProfile -File "$HOME/FoxTerminal/cmd/foxhelp.ps1"
# або з кореня репо
cd ~/FoxTerminal && pwsh -NoProfile -File ./cmd/weather.ps1
```

### 3.2 Alias у `~/.bashrc` (зручність)

Додай після install (підстав свій шлях):

```bash
export FOXTERM_ROOT="$HOME/FoxTerminal"
export PATH="$FOXTERM_ROOT/cmd:$PATH"

fox() { pwsh -NoProfile -File "$FOXTERM_ROOT/cmd/$1.ps1" "${@:2}"; }

# приклади:
# fox foxhelp
# fox weather Kyiv
# fox netping 1.1.1.1
# fox sites
```

Або окремі короткі:

```bash
alias fhelp='pwsh -NoProfile -File "$FOXTERM_ROOT/cmd/foxhelp.ps1"'
alias fday='pwsh -NoProfile -File "$FOXTERM_ROOT/cmd/fday.ps1"'
alias fweather='pwsh -NoProfile -File "$FOXTERM_ROOT/cmd/weather.ps1"'
alias fscan='pwsh -NoProfile -File "$FOXTERM_ROOT/cmd/foxscan.ps1"'
```

### 3.3 Що писати замість популярних Windows-команд

Див. повну таблицю в [`COMMANDS_LINUX.md`](COMMANDS_LINUX.md). Коротко:

| Хотів на Windows | На Linux пиши |
|------------------|---------------|
| `foxos on` | wallpaper через DE (розділ 4) |
| `foxlook on` | dark theme DE + dock (Plank/Dash to Dock/Waybar) |
| `foxhotkeys` | Ghostty `ctrl+backquote` або DE Custom Shortcuts |
| `apps firefox / telegram` | `wmctrl` / `hyprctl dispatch` / GNOME Extension |
| `DisableBloat` | `systemd` mask + прибрати зайві сервіси Kali |
| `yt` / `ff open` | `firefox 'https://…'` або `xdg-open` |
| `edit file` | `nano` / `micro` / `vim` / `cursor` |
| `clip` / буфер | `wl-copy` / `xclip -selection clipboard` |

### 3.4 Синтаксис аргументів

- PowerShell: `foxscan -Deep` → у bash через pwsh так само:  
  `pwsh -File ./cmd/foxscan.ps1 -Deep`
- Не мішай `\` і `/` у шляхах — на Linux тільки `/`.
- Лапки для пробілів: `fox weather "New York"` →  
  `pwsh -File ./cmd/weather.ps1 "New York"`.

### 3.5 Коли краще взагалі не кликати Fox-команду

| Задача | Краще на Linux |
|--------|----------------|
| IP / ping | `ip -br a`, `ping -c 3 1.1.1.1` |
| Диски | `df -h`, `lsblk`, `ncdu` |
| Процеси | `htop`, `btop`, `ps aux` |
| Погода | `curl wttr.in/Kyiv` |
| Редактор | `micro`, `nvim` |
| Файли notes | звичайний `cd ~/FoxTerminal/cmd/notes && ls` |

Fox-команди лишай для **тем, friend/ask, sites, build**, коли хочеш єдиний UX з Windows.

---

## 4) Робочий стіл (детально)

На Windows «стіл FoxOS» = `foxos` + `foxlook`.  
На Linux ти збираєш **той самий ефект** вручну під своє DE.

### 4.1 Визнач середовище

```bash
echo "XDG_CURRENT_DESKTOP=$XDG_CURRENT_DESKTOP"
echo "XDG_SESSION_TYPE=$XDG_SESSION_TYPE"   # wayland | x11
echo "DESKTOP_SESSION=$DESKTOP_SESSION"
```

| DE | Типово на | Підхід до «FoxOS look» |
|----|-----------|-------------------------|
| **GNOME** | Fedora, Ubuntu | `gsettings`, Extension Manager, Dash to Dock |
| **KDE Plasma** | Neon, Kali (іноді) | System Settings → Appearance, Latte/Panel |
| **XFCE** | Xubuntu, легкий Kali | Settings → Desktop / Panel / Appearance |
| **Hyprland / sway** | tiling WM | `hyprland.conf` / `sway` + `waybar` + `swww` |
| **i3 / bspwm** | мінімалізм | polybar + feh/nitrogen |

Kali часто йде з **XFCE** або GNOME-варіантом — спочатку глянь `XDG_CURRENT_DESKTOP`.

### 4.2 Темний стіл + акцент (аналог foxlook dark + accent)

**GNOME:**

```bash
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita-dark'
# акцент (GNOME 42+):
gsettings set org.gnome.desktop.interface accent-color 'orange'   # якщо ключ є
```

**KDE:** System Settings → Colors / Plasma Style → Breeze Dark; Accent colour.

**XFCE:** Settings → Appearance → Style (темний) + Settings → Desktop.

**FoxNight-палітра** (з Ghostty, щоб стіл і термінал збігались):

| Роль | Hex |
|------|-----|
| Background | `#0B0F1A` |
| Text | `#E6E6E6` |
| Accent (orange) | `#DC7A14` |
| Accent 2 | `#F2953A` |

Постав ці кольори в темі DE / wallpaper gradient, щоб не було «термінал Fox, стіл білий Kali».

### 4.3 Шпалери (аналог `foxos` rain)

Варіанти від простого до «живого»:

```bash
# статичне зображення (X11)
feh --bg-fill ~/Pictures/fox-wall.png

# XFCE
xfconf-query -c xfce4-desktop -p /backdrop/screen0/monitor0/workspace0/last-image \
  -s "$HOME/Pictures/fox-wall.png"

# GNOME
gsettings set org.gnome.desktop.background picture-uri-dark \
  "file://$HOME/Pictures/fox-wall.png"

# Wayland animated / slideshow
swww init
swww img ~/Pictures/fox-wall.png --transition-type fade
```

Зроби wallpaper **під свій aspect ratio** (розділ 5), інакше будуть чорні поля або crop «лисиці» не по центру.

Іконки на столі (аналог `foxlook icons on` = сховати):

```bash
# GNOME
gsettings set org.gnome.desktop.background show-desktop-icons false
# XFCE: Desktop settings → Icons → вимкнути
```

### 4.4 Dock / панель (аналог foxlook dock)

Мета як у Fox: **одна нижня/верхня смуга**, компактна, без зайвого.

| Стиль Fox | Linux |
|-----------|-------|
| `rail` / `pill` / `glass` / `slim` | Dash to Dock / Plank / Latte / Waybar modules |
| `place top\|bottom` | позиція панелі в DE |
| `size compact\|normal\|large` | icon size 24 / 32 / 48 |
| `hide on` | autohide панелі |
| `tray clock\|full\|off` | які applets лишити |

**Рекомендація Fox-look:**

- одна панель **знизу** або **зверху** (не обидві);
- іконки **32px** на 1080p, **40–48px** на 1440p/4K з scale 100%;
- autohide **on**, якщо працюєш у fullscreen Ghostty;
- прибери weather/search widgets, якщо хочеш «чистий» FoxOS-вайб.

### 4.5 Desk prompt (клік під лисицею)

На Windows це частина `foxos`. На Linux:

- **Найближче:** завжди відкритий Ghostty quick-terminal (`ctrl+backquote`) = «prompt згори».
- Або віджет Run (GNOME Activities / KRunner `Alt+F2` / XFCE App Finder).
- У Hyprland: `bind = SUPER, D, exec, ghostty` або woofi/rofi:

```bash
rofi -show run
# або
wofi --show drun
```

### 4.6 Гарячі клавіші стільця (замість foxhotkeys AHK)

| Дія Windows | Linux |
|-------------|-------|
| Shift+Alt+T показати термінал | Ghostty **global** `ctrl+backquote` (Wayland + layer-shell) |
| Win → меню | Super (GNOME/KDE) |
| Win+L lock | `loginctl lock-session` / DE lock |
| Show desktop | Super+D (залежить від DE) |

Перевірка Wayland layer-shell (для quick terminal):

```bash
echo $XDG_SESSION_TYPE
# на GNOME Wayland quick-terminal Ghostty часто НЕ працює (немає wlr-layer-shell)
# тоді: лише ctrl+shift+backquote всередині вікна, або Hyprland/Sway/wlroots DE
```

### 4.7 Композиція робочого простору (як «apps layout»)

**Ідея Fox `apps a / b / c`:** фіксовані зони екрана.

На Linux задай **snap zones** пропорційно (див. §5):

```
┌─────────────┬─────────────┐
│   50% left  │  50% right  │   2-pane coding
└─────────────┴─────────────┘

┌────────┬────────┬────────┐
│  33%   │  34%   │  33%   │   browser | term | notes
└────────┴────────┴────────┘

┌──────────────────────────┐
│     Ghostty 100%         │   focus mode
└──────────────────────────┘
```

**GNOME:** Super+стрілки (tile).  
**KDE:** Meta+стрілки / Tiling.  
**Hyprland** приклад:

```conf
# ~/.config/hypr/hyprland.conf (фрагмент)
bind = SUPER, LEFT, movefocus, l
bind = SUPER, RIGHT, movefocus, r
dwindle {
  force_split = 2
}
```

**wmctrl** (X11) розкласти Firefox ліворуч:

```bash
wmctrl -r Firefox -e 0,0,0,960,1080   # для 1920x1080, половина
```

---

## 5) Пропорції екрана, DPI, масштаби

Спочатку зніми факти:

```bash
# Wayland (wlr)
wlr-randr 2>/dev/null || true
# X11
xrandr | grep -w connected
# універсально
xdpyinfo 2>/dev/null | grep dimensions
```

### 5.1 Типові aspect ratio

| Ratio | Приклади | Як ставити UI Fox |
|-------|----------|-------------------|
| **16:9** | 1920×1080, 2560×1440, 3840×2160 | стандарт; quick-terminal **45%** висоти ок |
| **16:10** | 1920×1200, 2560×1600 | трохи вищий стіл; padding Ghostty можна +2–4 px по Y |
| **21:9** ultrawide | 3440×1440, 2560×1080 | **не** розтягуй один термінал на всю ширину — 2–3 колонки |
| **3:2** | Surface-like | шрифт трохи більший; dock compact |
| **4:3 / 5:4** | старі панелі | уникай wide wallpaper crop; font-size 14–15 |

Формула:

```text
aspect = width / height
16/9 ≈ 1.778
16/10 = 1.6
21/9 ≈ 2.333
```

### 5.2 Масштаб (HiDPI)

| Фіз. роздільність | Рекомендований scale | Font Ghostty | Dock icons |
|-------------------|----------------------|--------------|------------|
| 1080p 14–15" | 100% | 13–14 | 32 |
| 1080p 24"+ | 100% | 13 | 28–32 |
| 1440p 27" | 100% | 13–14 | 32–36 |
| 4K 27" | 150–200% | 12–13 * scale | 32 @ scale |
| 4K 32"+ | 125–150% | підігнати на око | — |

**GNOME:**

```bash
gsettings set org.gnome.desktop.interface text-scaling-factor 1.0
# дробовий масштаб дисплея — через Settings → Displays (Wayland)
```

**KDE:** Display Configuration → Global scale.  
**Hyprland:** `monitor=eDP-1,1920x1080@60,0x0,1.25`

**Правило Fox:** якщо текст у Ghostty «мильний» — спочатку вирівняй **scale DE**, потім `font-size` у `ghostty/config`, не навпаки.

### 5.3 Safe zones під Fox-термінал

Тримай контент у «безпечній» зоні:

```
┌──────────────────────────────────────────┐
│  margin 2–3% (панель / notch / rounded) │
│  ┌────────────────────────────────────┐  │
│  │     робоча зона Ghostty            │  │
│  │     padding-x/y ≈ 8–12 px          │  │
│  └────────────────────────────────────┘  │
│  dock / panel (autohide краще)           │
└──────────────────────────────────────────┘
```

- На **ноутбуці 16:9** quick-terminal `45%` — добре для «quake».  
- На **ultrawide 21:9** постав `quick-terminal-size = 40%` або менше й **обмеж ширину** вікна (не на весь span).  
- На **вертикальному** моніторі (9:16) — splits `ctrl+shift+enter` горизонтальні важливіші за вертикальні.

### 5.4 Мультимонітор

```bash
xrandr --listmonitors
```

- Primary = той, де Ghostty + dock.  
- Wallpaper **окремо на кожен** монітор з правильним crop під його ratio.  
- Не розтягуй один 16:9 wallpaper на 21:9 — згенеруй/обріж під ширину.

```bash
# приклад: згенерувати під ширину (ImageMagick)
convert fox-src.png -resize 3440x1440^ -gravity center -extent 3440x1440 fox-3440.png
```

### 5.5 Пропорції панелей у самому Ghostty

| Layout | Коли | Клавіші |
|--------|------|---------|
| 50/50 vertical split | код + лог | `ctrl+shift+enter` потім `ctrl+shift+l` |
| 70/30 | код + friend/ask | ресайз `ctrl+alt+←/→` |
| 33/33/33 | ultrawide | два splits |
| zoom | фокус | `ctrl+shift+z` |
| equalize | вирівняти | `ctrl+shift+e` |

Неактивні панелі в конфігу вже приглушені (~85% opacity) — на HiDPI це нормально; якщо важко читати — зменши кількість splits.

---

## 6) Ghostty під Linux: вікно, padding, quick terminal

Файл: `FoxTerminal/ghostty/config` (після install — у `~/.config/ghostty/`).

Ключі, які крутити під екран:

```ini
font-family = CaskaydiaCove Nerd Font
font-size = 13                 # ↑ на HiDPI після scale DE
window-padding-x = 8           # 8–14; на 4K можна 12–16
window-padding-y = 8
window-padding-balance = true
background-opacity = 0.92      # ↓ якщо композитор лагає: 1.0
background-blur = 20           # 0 якщо GPU слабкий
quick-terminal-position = top
quick-terminal-size = 45%      # 35–50% залежно від ratio
quick-terminal-autohide = true

# Linux GTK (на macOS/Windows ігноруються)
gtk-single-instance = true
gtk-tabs-location = bottom
gtk-titlebar = true
```

Після правок: **`ctrl+shift+,`** (reload).

Перевірка:

```bash
ghostty +show-config
ghostty +list-actions | head
```

Шейдери: `shader on` (якщо команда доступна через pwsh) або ключ у конфігу — на слабкій інтегрованій GPU краще **вимкнути** для FPS стільця.

---

## 7) Оптимізація системи

### 7.1 Ціль «як DisableBloat», але для Linux

```bash
# що з’їдає CPU/RAM
btop   # або htop

# сервіси
systemctl --user list-units --state=running
systemctl list-units --type=service --state=running
```

На **Kali** після install часто зайве:

```bash
# приклад обережного маскування (розумій, що робиш)
# sudo systemctl disable --now bluetooth.service   # якщо не треба
# sudo systemctl disable --now cups.service        # якщо немає принтера
```

Не вимикай `NetworkManager`, `ssh`, дисплейний менеджер.

### 7.2 Композитор і батарея / FPS

| Симптом | Дія |
|---------|-----|
| Лаги прозорості Ghostty | `background-opacity = 1.0`, `background-blur = 0` |
| Лаги всього DE | вимкни анімації DE; на слабких ноутах — XFCE замість GNOME |
| Wayland + NVIDIA проблеми | часто X11-сесія стабільніша |
| Вентилятор на idle | знайди процес у `btop`; зайві snap/flatpak фоном |

### 7.3 Диск і SSD

```bash
df -h
ncdu ~
# не тримай гігантські node_modules / .venv у notes
```

Git LFS у репо вже є (addon dist) — на слабкому інтернеті: `GIT_LFS_SKIP_SMUDGE=1 git clone …` потім `git lfs pull` вибірково.

### 7.4 Шрифти і рендер

```bash
# чіткіший текст
mkdir -p ~/.config/fontconfig
# hinting/antialias через DE Settings → Fonts
fc-list | grep -i caskaydia
```

Якщо іконки = квадратики → Nerd Font не підхопився (`fc-cache -fv`, перевір `font-family` у Ghostty).

### 7.5 Мережа / DNS (аналог reconnect / netping)

```bash
ping -c 3 1.1.1.1
ping -c 3 github.com
nmcli networking connectivity
# reconnect Wi‑Fi
nmcli device wifi rescan
nmcli device wifi connect "SSID"
```

### 7.6 Безпека на Kali (коротко)

- Не працюй постійно під `root` у Ghostty/Cursor.  
- Fox-сканер: `pwsh -File ./cmd/foxscan.ps1` якщо pwsh є.  
- Окремий юзер для щоденної роботи; Kali-root лише для пентесту.

### 7.7 Оптимізація під Fox-workflow

1. Один монітор / primary — Ghostty + browser.  
2. Quick terminal замість купи вікон.  
3. Opacity 1.0 + без blur на ноуті.  
4. Font size підігнати **один раз** під scale.  
5. Wallpaper уже в розмірі панелі (без live rain, якщо CPU жарить).  
6. Ollama: `OLLAMA_LOW_POWER`-аналог — менша модель або `fox` тільки коли треба.

---

## 8) Сценарії дня

### Ранок на Kali

```bash
cd ~/FoxTerminal && git pull
ghostty &
# у Ghostty:
curl wttr.in/Kyiv?format=3
ping -c 2 1.1.1.1
# якщо pwsh:
fox fday    # або pwsh -File ./cmd/fday.ps1
```

### Coding focus (16:9)

1. Ghostty fullscreen або 70% ширини.  
2. Split 70/30: код | логи.  
3. Quick terminal для коротких команд.  
4. Firefox на другому workspace.

### Ultrawide 21:9

1. Три колонки: editor | Ghostty | browser **або** два splits у Ghostty + browser окремо.  
2. `quick-terminal-size = 38%`.  
3. Не розтягуй wallpaper 16:9 на всю ширину.

### Демо / стрім

1. Темний DE + FoxNight wallpaper.  
2. Opacity 0.95–1.0 (читабельність на записі).  
3. Font +1 від звичного.  
4. Сховати dock (autohide).

---

## 9) Troubleshooting

| Проблема | Що робити |
|----------|-----------|
| Clone порожній | тягни `ShewchukV4/FoxTerminal` після push; `git pull` |
| `foxos` каже Windows only | норма; використай §4 |
| Немає `chek` / команд | `export PATH="$HOME/FoxTerminal/cmd:$PATH"`; для `.ps1` — `pwsh` |
| Quick terminal не глобальний | GNOME Wayland часто без layer-shell → Hyprland/Sway або внутрішній `ctrl+shift+backquote` |
| Квадратики замість іконок | Nerd Font + `fc-cache` + `font-family` |
| Мильний шрифт | спочатку scale DE, потім `font-size` |
| Прозорість лагає | opacity 1.0, blur 0 |
| Кирилиця криво | `LANG=C.UTF-8` (boot скрипт уже пробує виставити) |

---

## Підсумок

1. На Linux **ядро** FoxTerminal = **Ghostty + bash boot + cmd/**.  
2. **Стіл FoxOS** збираєш через DE: dark + accent `#DC7A14` + wallpaper під **свій ratio** + один dock.  
3. Команди: або `pwsh -File ./cmd/….ps1`, або Linux-native з [`COMMANDS_LINUX.md`](COMMANDS_LINUX.md).  
4. Пропорції: зніми `xrandr`/`wlr-randr` → піджени scale, font, quick-terminal %, splits.  
5. Оптимізація: менше blur/opacity-ефектів, чисті сервіси, один primary-монітор для терміналу.

Далі глибше по всій системі (включно з Windows-шарами): [`../FOXTERMINAL_GUIDE_UA.md`](../FOXTERMINAL_GUIDE_UA.md).
