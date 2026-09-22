# FoxTerminal: повний гайд по всій системі

Документація українською: від Ghostty-терміналу до FoxOS на робочому столі Windows, команд, сайтів, AI, хоткеїв і щоденних сценаріїв.

> English version: [`FOXTERMINAL_GUIDE_EN.md`](FOXTERMINAL_GUIDE_EN.md)  
> Короткий README: [`README.md`](README.md)  
> Інтерактивна презентація: `sites/fox-terminal/` (відкрий через `sites`)

---

## Зміст

1. [Що це за система](#1-що-це-за-система)
2. [Швидкий старт](#2-швидкий-старт)
3. [Де що лежить](#3-де-що-лежить)
4. [Шари системи](#4-шари-системи)
5. [FoxOS і foxlook](#5-foxos-і-foxlook)
6. [home · lock · settings · foxsetup](#6-home--lock--settings--foxsetup)
7. [Каталог команд](#7-каталог-команд)
8. [Сценарії та гайди](#8-сценарії-та-гайди)
9. [Локальні сайти](#9-локальні-сайти)
10. [Теми і візуал](#10-теми-і-візуал)
11. [Ghostty: фішки і клавіші](#11-ghostty-фішки-і-клавіші)
12. [Zen / Firefox Companion](#12-zen--firefox-companion)
13. [AI (FRIEND / ask)](#13-ai-friend--ask)
14. [Безпека](#14-безпека)
15. [Troubleshooting](#15-troubleshooting)
16. [Шпаргалки](#16-шпаргалки)
17. [Готові набори команд](#17-готові-набори-команд)

---

## 1) Що це за система

**FoxTerminal** — не просто alias-и в PowerShell. Це локальна екосистема:

| Шар | Що робить |
|-----|-----------|
| **Ghostty** | Термінал: теми, splits, keybinds, shaders, command palette |
| **cmd/** | 85+ команд: медіа, нотатки, мережа, теми, AI, пакування |
| **FoxOS (`foxos`)** | Анімований ASCII-шпалери + акцент Windows + desk-prompt |
| **Fox look (`foxlook`)** | Windows «одягає» FoxOS: dark, курсори, dock, Win-клавіші, shell |
| **Системна оболонка** | `home`, `lock`, `settings`, `foxsetup` — як міні-ОС після логіну |
| **Додатки** | `foxlife` (нотатки/фінанси), `sites` (локальні веб-апки), Zen Companion |
| **builds / foxpack** | Знімки конфіга і zip для передачі іншому ПК |

Працює **тільки в Ghostty**. На Windows — [winghostty](https://github.com/amanthanvi/winghostty) (`winget install AmanThanvi.winghostty`). На Linux/macOS — офіційний Ghostty. Уся візуалка терміналу — у `FoxTerminal/ghostty/config`.

---

## 2) Швидкий старт

### Встановлення (один раз)

```powershell
winget install AmanThanvi.winghostty
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
```

На Linux/macOS: `bash ./FoxTerminal/install.sh`

Інсталер копіює конфіг Ghostty, створює ярлик і (за бажанням) автозапуск при логіні Windows.

### Перший день у терміналі

```powershell
chek                  # чи це справді Ghostty
term -Doctor          # діагностика конфіга / шрифту / shell
foxdeps -Install      # Firefox, Nerd Font, Oh My Posh, AHK, .NET…
foxsetup              # майстер: юзер, тема, FoxOS, hotkeys, idle lock
```

Або вручну:

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

### Якщо хочеш «повний» FoxOS на Windows

```powershell
l myname mypass
foxos on              # ASCII rain wallpaper + accent
foxlook on            # dark Windows, cursors, dock, Win keys
home                  # системний дім після логіну
settings              # TUI налаштувань (або settings -Gui)
```

---

## 3) Де що лежить

```
FireFoxBot/
├── cmd/                    ← усі команди (.ps1 + .bat обгортки)
├── sites/                  ← локальні міні-сайти + hub
│   └── fox-terminal/       ← інтерактивна презентація / docs UI
├── FoxTerminal/
│   ├── ghostty/config      ← єдиний файл візуалу терміналу
│   ├── ghostty/shaders/    ← GLSL під теми
│   ├── install.ps1 / .sh
│   ├── FOXTERMINAL_GUIDE_UA.md   ← цей файл
│   └── FOXTERMINAL_GUIDE_EN.md
├── builds/                 ← знімки від команди build
└── CHANGELOG.md            ← історія змін (читається через changelog)
```

Важливо:

- Багато команд мають пару `.ps1` + `.bat` з однаковим іменем — у Ghostty можна писати просто `ytm`, `foxos`, `home`.
- Службові скрипти (`foxauth.ps1`, `foxos-lib.ps1`, `shader-lib.ps1`…) **не** для прямого запуску.
- Головна довідка в терміналі: **`foxhelp`** (стрілки + Enter).

---

## 4) Шари системи

Думай про FoxTerminal як про цибулю:

```
┌─────────────────────────────────────────────┐
│  Windows desktop (foxlook: dark, dock…)     │
│  ┌───────────────────────────────────────┐  │
│  │  FoxOS wallpaper (foxos: rain + fox)  │  │
│  │  desk prompt: sw slate, ytm, help…    │  │
│  └───────────────────────────────────────┘  │
│  Ghostty (термінал + shaders + splits)      │
│    └── PowerShell + Oh My Posh + cmd\       │
│         home / settings / notes / media / AI│
└─────────────────────────────────────────────┘
```

| Команда | Шар | Коротко |
|---------|-----|---------|
| `term`, `chek`, `shader` | Термінал | Конфіг Ghostty, діагностика, скло-шейдери |
| `sw`, `themes`, `noir`… | Візуал сесії | Палітра, mood-режими |
| `foxos` | Desktop skin | Шпалери + accent + live rain |
| `foxlook` | Windows shell | Dark/cursors/dock/Win keys/shell |
| `home` | UX після логіну | Дайджест дня + швидкі дії |
| `lock` | Безпека сесії | Ховає термінал, потрібен пароль Fox |
| `settings` | Керування | TUI або Control UI у браузері |
| `foxlife` | Окремий застосунок | Нотатки, фінанси, таблиці, AI |

---

## 5) FoxOS і foxlook

### 5.1 `foxos` — шпалери і акцент

```powershell
foxos                 # статус
foxos on              # увімкнути ASCII rain + Windows accent з теми
foxos off             # повернути попередні шпалери/акцент
foxos apply           # перемалювати зараз (тема вже змінена через sw)
foxos toggle
```

Що відбувається при `foxos on`:

- анімований ASCII rain з лисицею (як у `sw`);
- колір акценту Windows береться з поточної теми;
- пошук / Copilot / погода на таскбарі ховаються, поки FoxOS увімкнений;
- під лисицею працює **desk prompt** — можна клікнути й набрати команди на кшталт `sw slate`, `ytm`, `help`, `home`.

Вимкнути skin лише для поточної сесії: `$env:FOXTERM_FOXOS = "0"`.

### 5.2 `foxlook` — Windows носить FoxOS

```powershell
foxlook               # статус усіх частин
foxlook on            # увімкнути весь look
foxlook off           # відновити Windows зі snapshot
```

Частини (можна вмикати окремо):

| Частина | Приклад | Ефект |
|---------|---------|--------|
| `dark` | `foxlook dark on` | Темні додатки Windows |
| `icons` | `foxlook icons on` | Ховає іконки робочого столу |
| `taskbar` | `foxlook taskbar on` | Автоприховування таскбару |
| `sounds` | `foxlook sounds on` | Вимикає системні звуки |
| `cursors` | `foxlook cursors on` | Піксельні курсори під тему |
| `lockscreen` | `foxlook lockscreen on` | Lock screen = FoxOS, без Spotlight |
| `winkeys` | `foxlook winkeys on` | Win → FoxTerminal, Win+I → settings… |
| `oem` | `foxlook oem on` | Settings → About: FoxOS (потрібен адмін раз) |
| `winlock` | `foxlook winlock on` | Win+L → Fox `lock` (Windows lock вимкнено) |
| `shell` | `foxlook shell on` | **Наступний** логін цього юзера = FoxOS замість Explorer |

#### Курсори

```powershell
foxlook cursor pixel
foxlook cursor chunky 2
foxlook cursor neon 3
foxlook cursor fox
foxlook cursor inverted
foxlook cursor preview     # PNG-прев’ю всіх стилів
```

Стилі: `pixel` | `chunky` | `neon` | `fox` | `inverted`. Розмір: `1` | `2` | `3`.

#### Шпалери: overlay vs behind

```powershell
foxlook wall overlay   # rain як вікно (desk prompt працює) — за замовчуванням
foxlook wall behind    # rain під іконками (Win+D безпечний; desk prompt вимкнений)
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

#### Профіль look (експорт / імпорт)

```powershell
foxlook export                 # JSON на Desktop
foxlook export D:\looks\work.json
foxlook import D:\looks\work.json
```

#### ⚠ `foxlook shell on` — уважно

Після наступного входу **цього** Windows-користувача стартує FoxOS, а не Explorer. Інший обліковий запис Windows не змінюється.

**Рятувальний шлях:**

1. Ctrl+Alt+Del → Task Manager → File → Run  
2. `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd`  
   або `cmd\fox-restore-windows.bat` з репо  
3. Або: `foxlook shell off` / `foxlook off` з робочого терміналу

Якщо dock мовчить ~30 с після логіну — Explorer повертається сам (safety).

### 5.3 Рекомендований порядок «повного FoxOS»

```powershell
l myname mypass
themes                 # або sw slate
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style glass
home
settings -Status
```

Повернути класичний Windows:

```powershell
foxlook off
foxos off
```

---

## 6) home · lock · settings · foxsetup

### `foxsetup` — перший запуск

Майстер: користувач, тема, FoxOS, logon autostart, hotkeys, idle lock. Запускається автоматично на свіжій машині або вручну: `foxsetup`.

### `home` — системний дім

Після логіну показує дайджест дня, нотатки, останній сайт і швидкі дії: Prompt / YTM / Sites / Help / Settings / Lock.

```powershell
l myname mypass
home
```

### `lock` — блокування Fox-сесії

```powershell
lock                  # сховати Ghostty + wallpaper lock; Windows лишається залогіненим
lock -Status
lock -Unlock          # або Shift+Alt+T і пароль Fox
```

Глобально: **Shift+Alt+L** (через `foxhotkeys`).  
Якщо увімкнено `foxlook winlock on`, то **Win+L** теж іде в Fox lock.

### `settings` — налаштування системи

```powershell
settings              # інтерактивне TUI (після логіну)
settings -Status      # короткий звіт: theme, foxos, look, dock, shell, idle…
settings -Gui         # Control UI у браузері (http://127.0.0.1:17321/settings.html)
settings -StopGui     # зупинити host
```

У settings видно й можна крутити: тему, FoxOS, look, dock, cursor, shader, logon, hotkeys, idle lock.

### `changelog`

```powershell
changelog             # історія доданого/прибраного (той самий viewer, що й для notes)
```

---

## 7) Каталог команд

Нижче — робочі користувацькі команди. Повний живий список завжди в `foxhelp`.

### 7.1 Користувачі

| Команда | Синтаксис | Приклад |
|---------|-----------|---------|
| `l` | `l <name> <pass>` | `l dmytr secret` |
| `nuser` | `nuser <name> <pass>` | `nuser fox admin123` |
| `passwd` | `passwd` | (потрібен логін) |
| `users` | `users` | список |
| `who` | `who` | хто активний |
| `uexit` | `uexit` | вийти з Fox-юзера |

### 7.2 Системна оболонка

| Команда | Синтаксис | Навіщо |
|---------|-----------|--------|
| `home` | `home` | дім після логіну |
| `lock` | `lock [-Status\|-Unlock]` | блокування сесії |
| `settings` | `settings [-Status\|-Gui\|-StopGui]` | налаштування |
| `foxsetup` | `foxsetup` | first-boot wizard |
| `changelog` | `changelog` | історія змін |
| `off` / `shutdown` | `off` | вимкнути ПК (Yes/No, default No) |

### 7.3 AI

| Команда | Синтаксис | Навіщо |
|---------|-----------|--------|
| `ask` | `ask "…" [--image path]` | одноразовий запит (Ollama) |
| `friend` | `friend` | чат FRIEND; вихід: `exitt` |
| `sum` | `sum <file>` | резюме файлу (потрібен `OPENAI_API_KEY`) |

У чаті `friend`: `/clear`, `/help`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`. Фрази на кшталт «open youtube», «notes» закривають чат і запускають команду.

### 7.4 Медіа

| Команда | Приклад | Навіщо |
|---------|---------|--------|
| `yt` | `yt lofi hip hop` | YouTube у Firefox/Zen |
| `ytm` | `ytm`, `ytm chill` | YouTube Music |
| `ytm-ui` | `ytm-ui` | TUI + DJ visualizer |
| `ytsplit` | `ytsplit` | YouTube \| YTM ліворуч/праворуч |
| `sp` | `sp radiohead` | Spotify |
| `sp-ui` | `sp-ui` | Spotify DJ UI |
| `dj` | `dj` | visualizer рівня системи |
| `youtube` | `youtube` | просто відкрити YouTube |
| `foximg` | `foximg photo.jpg` | фото в терміналі |
| `foxmirror` | `foxmirror` | екран iPhone (USB / Wi‑Fi) |

`foxmirror` (коротко):

```powershell
foxmirror -Check
foxmirror -Setup
foxmirror                 # USB
foxmirror -Wifi           # після одного разу з кабелем
foxmirror -Video -Fps 30
```

### 7.5 Веб, alias, сайти

| Команда | Приклад |
|---------|---------|
| `ff` | `ff open github` |
| `sites` | `sites`, `sites -createn my-tool`, `sites -open my-tool` |
| `bbind` | створити .bat або site-alias |
| `blist` / `bdel` | список / видалити alias |
| `gask` | `gask how does OSC 133 work` |
| `ser` | `ser powershell hash` |
| `ffbot` | .NET watcher для Firefox |
| `ffsync` | `ffsync start\|stop\|status\|shell` — міст sidebar ↔ термінал |

### 7.6 Telegram

| Команда | Приклад |
|---------|---------|
| `tg` | `tg @friend`, `tg work` |
| `tgub` | `tgub @user work` або `tgub phone 380… mom` |
| `tglist` | список/редагування binds |

### 7.7 Нотатки і файли

| Команда | Приклад |
|---------|---------|
| `wai` | `wai`, `wai -pin` |
| `go` / `up` | `go files/work` |
| `nfile` / `nfould` | `nfile plan.md` |
| `fdel` | `fdel old.txt` (з паролем) |
| `edit` / `nano` / `view` | `edit plan.md` |
| `hash` / `unhash` | `hash sha256 hello` |

### 7.8 Теми і візуальні режими

| Команда | Навіщо |
|---------|--------|
| `sw [theme]` | system info + стрілки міняють тему; Ctrl+E вихід |
| `themes` | головний picker (Fox, Arthas, Pride, Noir, Death Note…) |
| `noir` | Ч/Б режим (toggle) |
| `dnote` | Death Note стиль + intro |
| `apple` | сцена Death Note великим ASCII |
| `pride` | rainbow стилі; стрілки в `sw` |
| `arthas` | панель Arthas dark/light |
| `spider` | Spider-Noir панель (у noir) |
| `shader` | `shader on\|off\|status` — GLSL скло під тему |
| `frederik` | waveform з мікрофона / системи |
| `foxos` | desktop skin |
| `foxlook` | Windows look |

### 7.9 Система, мережа, діагностика

| Команда | Приклад |
|---------|---------|
| `wifi` / `reconnect` | статус / перепідключення |
| `ip` / `netping` | `netping 1.1.1.1 github.com` |
| `weather` / `ftime` / `fday` | `fday Kyiv` |
| `disk` | використання дисків |
| `chek` / `sixel` | Ghostty? / inline images? |
| `foxscan` | `foxscan -Deep` |
| `foxbg` | інтерактивне чищення фону |
| `clear` / `texit` | очистити / вбити термінал |

### 7.10 Layout вікон

| Команда | Приклад |
|---------|---------|
| `interface` | `interface -Split`, `-Keys`, `-Gui` |
| `term` | `term -Status\|-Apply\|-Edit\|-New\|-Doctor` |
| `apps` | `apps firefox / telegram / spotify` |
| `appbind` | `appbind add code "C:\…\Code.exe"` |

### 7.11 FoxOS Life і Companion

| Команда | Навіщо |
|---------|--------|
| `foxlife` | нативне вікно: notes, finance, tables, AI (`-Status`, `-Rebuild`) |
| `foxaddon` | `foxaddon -Install\|-Pack\|-OpenFolder` |
| `foxzen` | `foxzen status\|default\|theme\|host\|addon` — Zen як основний браузер |

### 7.12 Хоткеї, знімки, пакування

| Команда | Приклад |
|---------|---------|
| `foxhotkeys` | `foxhotkeys -Status\|-Restart\|-Stop` |
| `foxinfo` | менеджер біндингів хоткеїв |
| `build` | `build demo`, `build -list`, `build -restore demo` |
| `foxpack` | `foxpack`, `foxpack -Full -Open` |
| `foxreset` | hard reset кешів / prompt |
| `foxdeps` | `foxdeps -Check\|-Install` |
| `foxtest` | `foxtest -Group info`, `foxtest -Only chek,term` |
| `foxhelp` | інтерактивна довідка |

---

## 8) Сценарії та гайди

### A) Робочий ранок

```powershell
l myname mypass
home
fday Kyiv
ytm lofi coding
wai
nfile standup.md
edit standup.md
```

### B) Повний FoxOS desktop

```powershell
foxsetup                 # якщо ще не проходив
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style pill
home
```

### C) Демо / стрім

```powershell
themes
apps firefox / telegram / spotify
ytm-ui
build demo-ready
```

### D) Мережева діагностика

```powershell
wifi
ip
netping 8.8.8.8 1.1.1.1 github.com
reconnect
netping github.com
```

### E) Передача оточення колезі

```powershell
build transfer-base
foxpack                  # clean zip без особистих даних
# або:
foxpack -Full -OutPath C:\Exports -Open
```

Колега: розпакувати → `FoxTerminal\install.ps1` → `foxsetup`.

### F) Безпечний експеримент з темою / look

```powershell
build before-look
foxlook on
foxlook cursor neon 3
# ...експерименти...
# якщо погано:
build -restore before-look
foxlook off
```

### G) iPhone на екрані ПК

```powershell
foxmirror -Setup
foxmirror                # кабель
# пізніше без кабелю:
foxmirror -Wifi
```

---

## 9) Локальні сайти

`sites` керує папкою `sites/`. Зараз є, зокрема: `fox-terminal`, `hub`, `fox-utils`, `web-ui-guide`, ігри, forge-тули тощо.

```powershell
sites                         # список / відкрити
sites -createn my-dashboard   # каркас нової папки
sites -open my-dashboard      # відкрити в VS Code / Cursor
```

Рекомендована структура нового сайту:

```
sites/my-dashboard/
  index.html
  assets/css/style.css
  assets/js/main.js
```

Презентація самої системи: `sites/fox-terminal/` — теми, команди, Ghostty, AI, media, hotkeys, ecosystem, settings.

---

## 10) Теми і візуал

- Щоденна робота: спокійні теми через `themes` / `sw slate` (або інша з палітри).
- Демо / стрім: `noir`, `pride`, `arthas`, `dnote`.
- Скло поверх усього: `shader on` (GLSL з `FoxTerminal/ghostty/shaders/`).
- Desktop під тему: `foxos on` — rain і accent підхоплюють `sw`.

Перед `foxpack -Full` подумай, чи хочеш віддавати свою тему й look-профіль.

Редагування візуалу терміналу — лише `FoxTerminal/ghostty/config`, потім `ctrl+shift+,`.

---

## 11) Ghostty: фішки і клавіші

Усе вже в `ghostty/config`:

| Фішка | Клавіші | Що робить |
|-------|---------|-----------|
| Quick terminal | `ctrl+`` ` або `ctrl+shift+`` ` | Quake-dropdown згори |
| Splits | `ctrl+shift+enter` / `j` / `l` | Нативні панелі |
| Zoom split | `ctrl+shift+z` | Панель на весь екран |
| Equalize | `ctrl+shift+e` | Вирівняти панелі |
| Resize | `ctrl+alt+стрілки` | ±40 px |
| Jump prompt | `ctrl+shift+↑/↓` | OSC 133 |
| Search | `ctrl+shift+f` | Пошук у scrollback |
| Scrollback → file | `ctrl+shift+u` | Вивантажити буфер |
| Palette | `ctrl+shift+p` | Команди FoxTerminal |
| Inspector | `ctrl+shift+i` | VT / шрифти / render |
| Reload config | `ctrl+shift+,` | Без рестарту |
| Fox shortcuts | `ctrl+shift+h/k/s/g/o` | help / chek / sw / term / shader |

**Глобальні (Windows, AHK `foxhotkeys`):**

| Клавіші | Дія |
|---------|-----|
| `Shift+Alt+T` | Показати FoxTerminal |
| `Shift+Ctrl+Alt+T` | Закрити |
| `Shift+Alt+Space` / `Shift+Ctrl+Space` | Show / hide |
| `Shift+Alt+L` | Fox `lock` |

Пасивне: Kitty graphics, нотифікації довгих команд, OSC 9;4 прогрес, opacity 0.92 + blur, Nerd Font ligatures, захист від підозрілої вставки, `window-save-state always`.

---

## 12) Zen / Firefox Companion

```powershell
foxaddon -Install          # Native Messaging host
foxaddon -Pack             # зібрати .xpi
foxzen status              # який браузер відкриває FoxTerminal
foxzen default             # зробити Zen основним
foxzen theme               # userChrome теми FoxTerminal
foxzen host                # реєстрація native host
foxzen addon               # rebuild + replace addon у профілі Zen
ffsync start               # синхрон sidebar ↔ термінал
```

Companion дає sidebar, теми, bridge до терміналу. Файли: `FoxTerminal/firefox-addon/`, `FoxTerminal/zen/`.

---

## 13) AI (FRIEND / ask)

```powershell
ollama serve
ollama pull qwen3-vl

ask "Explain this file"
ask "What is in this image?" --image C:\path\img.png
friend
```

Опційні змінні (після `setx` — новий термінал):

```
OLLAMA_URL=http://localhost:11434
FOXTERM_OLLAMA_MODEL=qwen3-vl
FOXTERM_OLLAMA_SYSTEM=...
FOXTERM_OLLAMA_AUTOSTART=1
FOXTERM_OLLAMA_LOW_POWER=1
FOXTERM_FRIEND_MAX_TURNS=25
```

`foxlife` також має вбудованого AI-асистента у своєму вікні.

---

## 14) Безпека

1. Не клади паролі/токени у відкриті notes.
2. `foxpack` без `-Full` — для чужих машин; `-Full` перевіряй перед відправкою.
3. `build` перед експериментами з `foxlook shell` / темами.
4. `foxscan -Deep` для підозрілих скриптів; `foxbg` для дивних процесів.
5. `foxlook shell on` — тільки якщо розумієш rescue-шлях.
6. Пароль міняй через `passwd`.

Опційно з папки FoxTerminal (адмін):

```powershell
.\DisableBloat     # важкі служби
.\DisableAds       # реклама / підказки Windows
.\Status
.\Enable           # повернути назад
```

---

## 15) Troubleshooting

| Симптом | Що зробити |
|---------|------------|
| Команда не знайдена | Перевір PATH / відкрий Ghostty з ярлика інсталера; або `powershell -File .\cmd\foxhelp.ps1` |
| Не Ghostty | `chek`, `term -Doctor`, `term -Apply` |
| Квадратики замість іконок | `foxdeps -Install` (Nerd Font), `ctrl+shift+,` |
| AI мовчить | `ollama serve`, `ollama pull qwen3-vl` |
| Splits не працюють | Тільки в Ghostty; `term -Status` |
| FoxOS не малює | Windows only; `foxos status`; скинь `FOXTERM_FOXOS` |
| Після `shell on` немає Explorer | Ctrl+Alt+Del → Task Manager → Run → `restore-windows.cmd` |
| `foxpack` «не той» | За замовчуванням clean; персональне — `-Full` |
| Firefox/Zen не відкриває | `foxzen status`, `ff open youtube`, `blist` |

---

## 16) Шпаргалки

### Авторизація і дім
`nuser` · `l` · `who` · `uexit` · `home` · `lock` · `settings` · `foxsetup`

### FoxOS
`foxos on/off` · `foxlook on/off` · `foxlook cursor …` · `foxlook dock …` · `foxlook shell off`

### AI / медіа
`ask` · `friend` · `yt` · `ytm` · `ytm-ui` · `sp` · `sp-ui` · `dj` · `foxmirror`

### Нотатки
`wai` · `go` · `up` · `nfile` · `edit` · `view` · `changelog`

### Система
`fday` · `wifi` · `ip` · `netping` · `chek` · `term` · `foxhelp` · `foxtest`

### Знімки
`build` · `foxpack` · `foxreset` · `foxdeps`

---

## 17) Готові набори команд

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

## Підсумок

FoxTerminal = **термінал + команди + FoxOS desktop + системна оболонка + сайти + AI + companion**.

Стабільний щоденний flow:

1. `foxsetup` один раз → далі `l` → `home`
2. Робота: `sites` + notes + `ytm` / `friend`
3. Desktop: за бажанням `foxos` + `foxlook`
4. Перед експериментами — `build`
5. Для передачі — `foxpack`

Жива довідка в будь-який момент: **`foxhelp`**.
