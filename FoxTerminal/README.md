# Fox Terminal (Ghostty)

Full system docs (guides + examples):

- Українською: [`FOXTERMINAL_GUIDE_UA.md`](FOXTERMINAL_GUIDE_UA.md)
- English: [`FOXTERMINAL_GUIDE_EN.md`](FOXTERMINAL_GUIDE_EN.md)
- **Windows (інший ПК):** [`windows/CURSOR_MEGAGUIDE_UA.md`](windows/CURSOR_MEGAGUIDE_UA.md) ★ · [`windows/VERIFY_ALL.md`](windows/VERIFY_ALL.md) ★ · [`windows/HARDWARE_SCREEN.md`](windows/HARDWARE_SCREEN.md)
- **Linux / Kali:** [`linux/CURSOR_MEGAGUIDE_UA.md`](linux/CURSOR_MEGAGUIDE_UA.md) ★ · [`linux/`](linux/)
- Interactive site: `sites/fox-terminal/` (open with `sites`)
- In-terminal docs browser: **`foxdocs`** (arrows select; Left = Open in terminal button; Right = Show location in Explorer; Back at bottom)
- External chat dump: [`CHATGPT_PROJECT.md`](CHATGPT_PROJECT.md)

This is a portable terminal setup built exclusively for **[Ghostty](https://ghostty.org)**.
Everything visual — the FoxNight palette, fonts, opacity, blur, padding, splits, tabs,
keybinds and the command palette — lives in one file: `ghostty/config`.

Beyond the terminal it also covers **FoxOS** (`foxos` / `foxlook`), the look studio
(`foxstyle` / `foxnodes` / `foxstt`), the system shell (`home`, `lock`, `settings`, `foxsetup`),
local sites, Zen Companion, and AI (`friend` / `ask` + desktop assistant).
See the guides above for the full map. Dump for an external chat: [`CHATGPT_PROJECT.md`](CHATGPT_PROJECT.md).

| Platform | Build | Install | Shell |
|----------|-------|---------|-------|
| Windows | [winghostty](https://github.com/amanthanvi/winghostty) — the Ghostty core on a native Win32 runtime, identical config format | `winget install AmanThanvi.winghostty` | PowerShell 5.1 / 7 |
| Linux | official Ghostty | `pacman -S ghostty` / `dnf install ghostty` / [ghostty.org/download](https://ghostty.org/download) | bash |
| macOS | official Ghostty | `brew install --cask ghostty` | bash |

Upstream Ghostty has no Windows app yet, which is why Windows uses the winghostty fork.
`chek` and `term -Doctor` print the exact install command for your platform.

Other terminals (Windows Terminal, WezTerm, mintty/Cygwin, the legacy FoxTerminalApp)
are no longer supported. FoxTerminal commands still run in any shell, but the visuals,
splits and hotkeys assume Ghostty.

## Ollama assistant (qwen3-vl)

1) Start Ollama:
```
ollama serve
```

2) Pull the model (one time):
```
ollama pull qwen3-vl
```

3) Use in FoxTerminal:
```
ask "Explain this file"
ask "What is in this image?" --image C:\path\img.png
friend
foxhelp
```
The `friend` command starts the Frederik Endiscot (FRIEND) chat. To exit, type `exitt`. In-chat: `/clear`, `/help`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`. Say e.g. **open youtube**, **open spotify**, **notes**, **open telegram** to close chat and run that command. FRIEND replies in English and keeps the last 25 turns of context (`FOXTERM_FRIEND_MAX_TURNS`).

The `foxhelp` command opens an interactive help menu. The "Commands (all)" section auto-detects commands from `cmd\` so it stays complete.

Optional env vars (new terminal after setx):
```
setx OLLAMA_URL http://localhost:11434
setx FOXTERM_OLLAMA_MODEL qwen3-vl
setx FOXTERM_OLLAMA_SYSTEM "You are Frederik Endiscot (FRIEND), a FoxTerminal assistant. Reply in English only."
setx FOXTERM_OLLAMA_AUTOSTART 1
setx FOXTERM_OLLAMA_LOW_POWER 1
```

## Use this config

### Windows

```
winget install AmanThanvi.winghostty
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The installer copies `ghostty\config` into the Ghostty config directory
(`%LOCALAPPDATA%\winghostty\config.ghostty`, or an existing config it finds first),
writes a machine-specific `foxterminal-local.ghostty` overlay next to it (repo path +
shell command pointing at `ghostty\foxterminal-boot.ps1`), validates the result with
`winghostty.com +show-config` (the `.com` is the console binary; the `.exe` is GUI-only
and would pop a "WriteFailed" dialog), and creates a desktop shortcut plus a logon
scheduled task so Ghostty opens at sign-in and asks Test / Login / Register.
Use `-NoShortcut` to skip the desktop icon, `-NoLogonStart` to skip autostart, and
`-Force` to overwrite without prompting.

### Linux / macOS

```
bash ./install.sh
```

Same flow against `~/.config/ghostty/config` (or the macOS
`~/Library/Application Support/com.mitchellh.ghostty/config`), with the overlay pointing
at `ghostty/foxterminal-boot.sh`, plus a `foxterminal` launcher in `~/.local/bin`.

Because the machine-specific bits live in the overlay, `ghostty/config` itself stays
portable and safe to commit.

### Managing the config afterwards

| Command | Дія |
|---------|-----|
| `term` | Інтерактивне меню менеджера конфіга |
| `term -Status` | Шлях до конфіга, версія Ghostty, чи це Ghostty-сесія |
| `term -Apply` | Перевстановити конфіг із репо (з бекапом) |
| `term -Edit` | Відкрити конфіг у редакторі |
| `term -New` | Нове вікно Ghostty у поточній папці |
| `term -Doctor` | Діагностика: бінар, конфіг, шрифт, shell integration |
| `chek` | Перевірка, що ти справді в Ghostty |
| `foxdeps` | Ghostty, Nerd Font, Oh My Posh та решта залежностей |
| `foxtest` | Прогнати всі команди й показати, що зламалось |

Після ручного редагування конфіга натисни `ctrl+shift+,` — Ghostty перечитає його без
перезапуску.

### Перевірка, що все живе

`foxtest` проганяє кожну команду FoxTerminal і каже, що з ними сталось. Команди, які мають
завершитись самі, справді запускаються; меню перевіряються на те, що вони малюються;
а те, що змінює налаштування або закриває термінал, свідомо пропускається.

```
foxtest                     прогнати все
foxtest -List               показати план і що саме пропускається
foxtest -Group info         тільки команди, які завершуються самі
foxtest -Only chek,term     перевірити конкретні команди
foxtest -Quiet              тільки підсумок
```

Повний прогін триває близько 6 хвилин, бо `foxscan` сканує диск, а `netping` і `weather`
ходять у мережу. Якщо додаєш нову команду в `cmd\`, `foxtest` у кінці окремо перелічить її
як не покриту — внеси її в манiфест на початку `cmd\foxtest.ps1`.

**Вимкнути непотрібні служби Windows** (запуск від адміна):
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DisableBloat
```
Вимикає тільки те, що найбільше навантажує: телеметрія (DiagTrack, dmwappushservice), SysMain (Superfetch), GamingServices, OneSyncSvc, PimIndexMaintenanceSvc, WerSvc, MapsBroker, CDPUserSvc.

**Вимкнути рекламу та підказки** (1–5: Пуск, екран блокування, підказки в роботі, рекомендації в Параметрах, індивідуальний досвід):
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DisableAds
```
Без адміна — тільки поточний користувач. **Від адміна** — також профіль «типовий користувач», тож нові облікові записи теж отримають вимкнення. Після виконання перезапусти Explorer або вийди/зайди в обліковий запис.

### Короткі команди (з папки FoxTerminal)

| Команда | Дія |
|---------|-----|
| `.\DisableBloat` або `DisableBloat` | Вимкнути служби, що навантажують (від адміна) |
| `.\DisableAds` або `DisableAds` | Вимкнути рекламу та підказки (1–5) |
| `.\Status` або `Status` | Показати, що вимкнено / увімкнено |
| `.\Enable` або `Enable` | Увімкнути назад служби та рекламу/підказки (від адміна для служб) |

У PowerShell: `.\DisableBloat`, `.\DisableAds`, `.\Status`, `.\Enable`.  
Якщо папку FoxTerminal додати в PATH, можна викликати просто `DisableBloat`, `DisableAds`, `Status`, `Enable` з будь-якого каталогу.

**Щоб вимкнення діяли завжди і на всьому ноуті:** запусти `DisableBloat` і `DisableAds` **від адміністратора**. Служби тоді вимкнені на весь комп’ютер; реклама/підказки — для поточного юзера і для усіх нових облікових записів. Увімкнути назад — `Enable` від адміна.

## Ghostty features wired into FoxTerminal

| Фішка | Клавіші | Що робить |
|-------|---------|-----------|
| Quick terminal | `ctrl+backquote` (global) або `ctrl+shift+backquote` | Quake-drop-down згори екрана, 45% висоти, автоприховування |
| Splits | `ctrl+shift+enter` / `j` / `l` | Нативний поділ вікна замість tmux; неактивні панелі 85% opacity |
| Split zoom | `ctrl+shift+z` | Розгорнути активну панель на все вікно |
| Equalize splits | `ctrl+shift+e` | Вирівняти всі панелі |
| Resize split | `ctrl+alt+←↑↓→` | Змінити розмір панелі на 40 пікселів |
| Jump to prompt | `ctrl+shift+↑` / `↓` | Стрибок між промптами (OSC 133) |
| Scrollback search | `ctrl+shift+f` | Пошук з підсвіткою в кольорах FoxNight |
| Scrollback → file | `ctrl+shift+u` | Вивантажити буфер у файл і відкрити |
| Command palette | `ctrl+shift+p` | Команди FoxTerminal: foxhelp, chek, term, sw, themes, friend, sites, foxdeps, foxscan, foxtest, foxreset, shader |
| Terminal inspector | `ctrl+shift+i` | Live-дебагер VT, шрифтів і рендера |
| Config reload | `ctrl+shift+,` | Застосувати конфіг без перезапуску |
| Fox shortcuts | `ctrl+shift+h/k/s/g/o` | `foxhelp`, `chek`, `sw`, `term`, `shader toggle` |
| Glass shaders | `shader` / `ctrl+shift+o` | GLSL на все вікно під тему; `shader off` вимикає |

Плюс те, що працює саме собою: Kitty graphics (картинки через `chafa`/`timg`, `sixel`
покаже стан), desktop-нотифікації про завершені довгі команди, OSC 9;4 прогрес-бари,
`background-opacity 0.92` + 20px blur, лігатури Nerd Font, захист від вставки
підозрілого тексту, `ssh-terminfo` для віддалених хостів і `window-save-state always`.

Дві платформні поправки, які варто знати:

- Глобальний `ctrl+backquote` Ghostty підтримує на macOS і на частині Linux-композиторів.
  На Windows системний хоткей дає AHK-демон `foxhotkeys` (`Shift+Alt+T` показати,
  `Shift+Ctrl+Alt+T` закрити; `Shift+Alt+Space` / `Shift+Ctrl+Space` теж show/hide),
  а всередині Ghostty завжди працює `ctrl+shift+backquote`.
- На Linux quick terminal вимагає Wayland із `wlr-layer-shell-v1` (тобто не GNOME).
  Таби, `gtk-*` ключі та `window-titlebar-*` — теж GTK-only; на інших платформах Ghostty
  просто їх ігнорує.

## Editing the visuals

Усе в одному файлі `ghostty/config`. Найчастіше правлять:

```
font-family = CaskaydiaCove Nerd Font
font-size = 13
background-opacity = 0.92
background-blur = 20
window-padding-x = 12
window-padding-y = 10
cursor-style = bar
quick-terminal-position = top
```

`ghostty +show-config --default` покаже всі доступні ключі,
`ghostty +list-actions` — усі дії для `keybind`.
На Windows це `winghostty.com`, не `winghostty.exe`: `.exe` відкриває вікно і не вміє
писати в консоль.
