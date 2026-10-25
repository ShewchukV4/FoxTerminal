# FoxTerminal — повний бриф для стороннього чату (ChatGPT тощо)

Оновлено: **2026-10-25**. Це один файл, щоб зрозуміти проєкт без репозиторію.  
Робоча папка на диску власника досі називається **FireFoxBot**. Продукт — **FoxTerminal**.

**Репо:** https://github.com/ShewchukV4/FoxTerminal  
**Дзеркало:** https://github.com/shew4uk/FoxTerminal  
**Мова з власником:** українська.

Якщо тобі скинули ще гайди — цей файл головний; деталі бери з `FOXTERMINAL_GUIDE_UA.md`, `CHANGELOG.md`, `AGENTS.md`.

---

## 1. Що це

Локальна екосистема навколо терміналу **Ghostty** (на Windows — **winghostty**). Не «набір alias-ів», а шари:

| Шар | Команди | Роль |
|-----|---------|------|
| Термінал | `term`, `chek`, `shader` | теми, splits, keybinds, GLSL-скло |
| Команди | `cmd/` (85+) | медіа, notes, мережа, AI, пакування |
| FoxOS | `foxos` | ASCII rain wallpaper + акцент Windows + desk prompt |
| Fox look | `foxlook` | dark, курсори, dock, Win-клавіші, опційно shell замість Explorer |
| Оболонка | `home`, `lock`, `settings`, `foxsetup` | міні-ОС після логіну Fox |
| Студія / меню | `foxstyle`, `foxnodes`, `foxstt` | вигляд, Node Launcher (Ctrl+Alt+Space), український STT |
| Додатки | `foxlife`, `sites/`, Zen Companion | Life app, локальні сайти, Firefox/Zen addon |
| Знімки | `build`, `foxpack` | снапшоти й zip |

Працює **тільки в Ghostty**. Інші термінали (Windows Terminal, WezTerm, mintty) більше не підтримуються як хост візуалу. Команди з `cmd/` можуть бігти в будь-якому PowerShell, але splits / shaders / look розраховані на Ghostty.

**Windows-only:** `foxos`, `foxlook`, `foxlife`, `foxstyle`, `foxnodes`, `foxstt`, `foxhotkeys` (AHK), `foxmirror` (повний стек).  
**Linux:** Ghostty + частина команд через `pwsh`; стіл = DE, не FoxOS.

---

## 2. Як зібрати / поставити на новий ПК

### Windows

```powershell
winget install AmanThanvi.winghostty
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
```

Далі в Ghostty:

```powershell
foxdeps -Install
foxsetup
l <user> <pass>
home
foxhelp
```

Повний стіл (лише якщо власник хоче):

```powershell
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style pill
foxnodes
foxstyle
```

⚠ `foxlook shell on` міняє **наступний** логін цього Windows-юзера на FoxOS замість Explorer. Без явного «так» не вмикати. Rescue: `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd` або `cmd/fox-restore-windows.bat`.

Інсталер копіює `FoxTerminal/ghostty/config` у `%LOCALAPPDATA%\winghostty\`, пише overlay `foxterminal-local.ghostty` (шлях до репо + boot-скрипт), робить ярлик і (опційно) logon-task. Прапорці: `-NoShortcut`, `-NoLogonStart`, `-Force`.

### Linux / Kali

```bash
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
bash ./FoxTerminal/install.sh
```

Ghostty з пакетів дистрибутива або ghostty.org. `foxos` / `foxlook` / `foxstyle` тут не живуть.

### Залежності (Windows)

Ghostty/winghostty, CaskaydiaCove Nerd Font, Oh My Posh, AutoHotkey v2, Firefox/Zen, .NET Framework 4.x (`csc.exe` для нативних вікон), опційно Ollama + qwen3-vl, Python 3.13 (лише для `foxmirror`). Усе разом: `foxdeps -Install`.

---

## 3. Карта репозиторію

```
FireFoxBot/                          ← корінь (clone = FoxTerminal)
├── AGENTS.md                        ← пам’ять для Cursor
├── CHANGELOG.md                     ← історія продукту
├── cmd/                             ← усі команди (.ps1 + .bat)
│   ├── foxstyle/                    ← C# студія FOXSTYLE
│   ├── foxnodes/                    ← C# overlay меню
│   ├── foxlife/                     ← C# Life
│   ├── fox-assistant.cs / fox-stt.cs / fox-understand.cs
│   ├── foxos-lib.ps1 / foxlook-lib.ps1 / foxauth.ps1   ← бібліотеки, не запускати
│   └── notes/                       ← файлова система нотаток юзера
├── sites/                           ← локальні HTML-апки + hub
│   ├── fox-terminal/                ← вітрина системи
│   └── foxstyle/                    ← референс токенів (не живий UI)
├── FoxTerminal/
│   ├── install.ps1 / install.sh
│   ├── ghostty/config + shaders/
│   ├── firefox-addon/ · zen/
│   ├── FOXTERMINAL_GUIDE_UA.md / _EN.md
│   ├── CHATGPT_PROJECT.md           ← цей файл
│   ├── windows/                     ← MEGAGUIDE + VERIFY_ALL + залізо
│   └── linux/                       ← MEGAGUIDE + COMMANDS_LINUX
└── builds/                          ← знімки команди build
```

Рантайм **не в git**:

```
%LOCALAPPDATA%\FoxTerminal\foxos\
  style.json              ← вигляд FOXSTYLE
  live.json               ← стан foxos-live
  foxstyle.exe / foxnodes.exe / foxos-live.exe / …
  apps\foxnodes\<user>\launcher.json
  stt\                    ← whisper.cpp + моделі
  cursors\
  restore-windows.cmd
```

Секрети / 2FA recovery — лише локально, **ніколи** в git / zip / чат:

- `%LOCALAPPDATA%\FoxTerminal\GITHUB\github-recovery-codes.txt`
- `.foxlocal/GITHUB/github-recovery-codes.txt`

---

## 4. Як збираються нативні вікна

Не MSBuild-солушн. Патерн: PowerShell-обгортка знаходить `csc.exe` (.NET Framework 4.0/4.8), склеює `.cs` файли, пише `winexe` у LocalAppData.

| Команда | Джерела | Exe |
|---------|---------|-----|
| `foxstyle` | `cmd/foxstyle/*.cs` + `foxos-sdk.cs` + assistant/stt/understand | `foxstyle.exe` |
| `foxnodes` | `cmd/foxnodes/*.cs` + ті самі спільні `.cs` | `foxnodes.exe` |
| `foxlife` | `cmd/foxlife/` | `foxlife.exe` |
| `foxos` | `foxos-live.cs` тощо | `foxos-live.exe` + dock/chrome |

`-Rebuild` зупиняє процес і збирає заново. Якщо `csc.exe` немає — вікно не збереться.

Apply FOXSTYLE:

1. Пише `launcher.json` (дерево меню).
2. Пише `style.json` (вигляд).
3. Пише `foxnodes.signal`.
4. Overlay перечитує **обидва** файли і відповідає `foxnodes.applied`.
5. «Застосовано» лише після ack. Без демона — «Збережено».

---

## 5. Логін і оболонка

Fox-юзер ≠ Windows-юзер. Сесія в терміналі:

```
nuser <name> <pass>     новий
l <name> <pass>         вхід
who / users / passwd / uexit
home                    дім після логіну
lock                    сховати Ghostty; Shift+Alt+L
settings                TUI; settings -Gui → http://127.0.0.1:17321
foxsetup                майстер першого запуску
```

Нове вікно Ghostty питає Test / Login / Register (автологін з файлу прибрано).

---

## 6. FoxOS і foxlook (Windows)

`foxos on` — ASCII-дощ + лисиця + акцент з теми + desk prompt під лисицею (`sw slate`, `ytm`, `help`, `home`…).

`foxlook on` — знімок Windows, потім dark / hide icons / autohide taskbar / mute sounds / pixel cursors / lock screen / Win-клавіші. `off` відкочує зі знімка.

Частини окремо: `dark`, `icons`, `taskbar`, `sounds`, `cursors`, `lockscreen`, `winkeys`, `oem` (адмін раз), `winlock`, `shell`.

Курсори: `foxlook cursor fox|pixel|chunky|neon|inverted [1|2|3]`.  
Dock: `style pill|rail|glass|slim`, `place top|bottom`, `size compact|normal|large`.  
Wall: `overlay` (desk prompt) або `behind` (під іконками).  
Профіль: `foxlook export` / `import`.

Alt+Tab у FoxOS: slide-стрічка; **E** або Del закриває вибране вікно (потрібні `foxos-live` + `foxhotkeys`).

---

## 7. FOXSTYLE, Node Launcher, помічник, STT

```
foxstyle                 студія вигляду
foxstyle -NodeEditor     дерево / полотно / властивості меню
foxnodes                 overlay; хоткей Ctrl+Alt+Space
foxstt -Install          whisper.cpp у LocalAppData (не git)
```

Помічник (вкладка FOXSTYLE або з меню): текст + push-to-talk, **локальна Ollama**. Відкриває пошук / програми / нотатки / таймер. Повне речення → модель, якщо це не коротка однозначна команда. Слово «YouTube» / «Google» — об’єкт запиту, не «відкрий сайт», поки немає майданчика («на YouTube») або явної команди. Трасування: `FOXASSIST_TRACE=1`.

STT: `foxstt -Install` ставить whisper.cpp b5454 (BLAS CPU) і `large-v3-turbo-q8_0`. У студії можна `small-q8_0` (~2 с) або turbo (~12 с на CPU). Fallback `large-v3-turbo-q5_0`.

---

## 8. Каталог команд (користувацькі)

Живий список завжди в `foxhelp`. Службові `*-lib.ps1` не для запуску.

**Юзер:** `l`, `nuser`, `passwd`, `users`, `who`, `uexit`  
**Оболонка:** `home`, `lock`, `settings`, `foxsetup`, `changelog`, `foxdocs`, `off`  
**AI термінал:** `ask`, `friend` (вихід `exitt`), `sum`  
**Медіа:** `yt`, `ytm`, `ytm-ui`, `ytsplit`, `sp`, `sp-ui`, `dj`, `youtube`, `foximg`, `foxmirror`  
**Веб:** `ff`, `sites`, `bbind`, `blist`, `bdel`, `gask`, `ser`, `ffsync`, `ffbot`  
**Telegram:** `tg`, `tgub`, `tglist`  
**Нотатки:** `wai`, `go`, `up`, `nfile`, `nfould`, `fdel`, `edit`, `nano`, `view`, `hash`, `unhash`  
**Теми:** `sw` / `sw -<тема>` (тиха), `themes`, `default`, `notebook`, `noir`, `dnote`, `apple`, `pride`, `arthas`, `spider`, `shader`, `frederik`  
**Стіл:** `foxos`, `foxlook`, `foxstyle`, `foxnodes`, `foxstt`, `foxlife`  
**Діагностика:** `wifi`, `reconnect`, `ip`, `netping`, `weather`, `ftime`, `fday`, `disk`, `chek`, `sixel`, `foxscan`, `foxbg`, `pulse`, `pulse apps`, `clear`, `texit`  
**Вікна:** `interface`, `term`, `apps`, `appbind`  
**Companion:** `foxaddon`, `foxzen`  
**Пак:** `foxhotkeys`, `foxinfo`, `build`, `foxpack`, `foxreset`, `foxdeps`, `foxtest`, `foxhelp`

Корисні нюанси:

- `sw slate` = лисиця + стрілки; `sw -slate` = тільки колір.
- `pulse` = оцінка ноута /100 + CPU/GPU/RAM; `pulse apps` / клавіша **A** = закрити важкі апки (не Defender / Fox / Cursor).
- `notebook` = пергаментний стіл; `default` = Fox orange.
- `foxdocs` = список усіх гайдів; ← термінал, → Explorer, Back внизу.
- `friend`: `/clear` `/help` `/model` `/cmds` `/repo` `/read` `/explain`; фрази «open youtube» закривають чат і запускають команду.

---

## 9. Ghostty

Увесь візуал терміналу — **один файл** `FoxTerminal/ghostty/config`. Після правок: `ctrl+shift+,`.

Ключі: `ctrl+shift+enter` splits, `ctrl+shift+z` zoom, `ctrl+shift+p` palette, `ctrl+shift+o` shader, `ctrl+shift+backquote` quick terminal.  
На Windows глобальний show/hide дає AHK: `Shift+Alt+T`, lock `Shift+Alt+L`.

`term -Apply` / `-Doctor` / `-Edit` / `-New`. `chek` = чи це Ghostty.

---

## 10. Локальні сайти (`sites/`)

Команда `sites`. Hub: `sites -Main`. Новий каркас: `sites -createn name`.

Зараз:

- **Fox Deck:** Hub, FoxTerminal Showcase (`fox-terminal`), settings.
- **Toolbox:** Fox Utils, UI Forge Guide, Кадр.
- **Playground:** Serpent Fox, Sunstrike Lab, Boom Grid, Crystal Roll, Item Oracle, Key Rush, Fox Stack, Fox Word, DnD Hero Forge, Fox Realm Forge.
- **Sandbox:** Fox Den (вітрина).
- **Референс:** `sites/foxstyle/` (токени, не UI).

---

## 11. AI

Термінал:

```
ollama serve
ollama pull qwen3-vl
ask "…"
friend          # вихід: exitt
```

Env: `OLLAMA_URL`, `FOXTERM_OLLAMA_MODEL`, `FOXTERM_OLLAMA_AUTOSTART`, `FOXTERM_FRIEND_MAX_TURNS`.

Окремо: desktop-помічник FOXSTYLE/foxnodes (див. §7) і AI всередині `foxlife`. `sum` потребує `OPENAI_API_KEY`.

---

## 12. Як пакувати і перевіряти

```
build <name>              знімок
build -list / -restore
foxpack                   чистий zip
foxpack -Full             з notes/binds/theme — не світити секрети
foxtest / foxtest -Group info
foxdeps -Check|-Install
```

На іншому Windows після переносу агент має прогнати `FoxTerminal/windows/VERIFY_ALL.md` (команди + Alt+Tab + таскбар) і дати PASS/FAIL.

Опційно з папки `FoxTerminal/` (адмін): `DisableBloat`, `DisableAds`, `Status`, `Enable`.

---

## 13. Правила для помічника (будь-який чат)

1. Відповідай українською, якщо власник не попросив інше.
2. Не коміть і не пуш без явного прохання.
3. Не вмикай `foxlook shell on` без «так» і нагадування rescue.
4. Не вигадуй паролі GitHub; не клади токени / recovery-коди в файли / чат / zip.
5. Службові `*-lib.ps1` не запускати як команди.
6. Нова команда в `cmd/` → запис у `foxhelp` known[] + згадка в гайдах UA/EN.
7. На Linux не обіцяй FoxOS / FOXSTYLE.
8. Не чіпай git config; не force-push.
9. Документуй конкретно (імена команд і шляхів), не «покращення».

Git-акаунти: **shew4uk** (історія розробки), **ShewchukV4** (другий ПК / Kali). Обидва репо на master мають той самий код. Локальні чати Cursor між ПК не синхроняться — пам’ять = ці markdown-файли.

---

## 14. Шлях системи в часі (стисло)

Шари по черзі: C# бот вкладок → `cmd\` + Windows Terminal / WezTerm → Avalonia-емулятор → логін і медіа → mintty і локальні сайти → нотатки і теми → Firefox Companion і Zen → Ghostty і шейдери → FoxOS (home / lock / settings / foxlook) → FOXSTYLE / foxnodes / STT.

2026-02-04: папка FireFoxBot, перші команди, Avalonia, C# бот вкладок.  
2026-02-05…13: логін, foxhelp, ask/friend, Spotify, YTM.  
2026-03-07: перший git; папку C# бота прибрано.  
2026-04: mintty, sites, build, foxpack, ігри.  
2026-05…06: hub, hotkeys, notes-ФС, noir/pride, вітрина.  
2026-07: Companion + Zen.  
2026-08-18: Ghostty замість WT/WezTerm.  
2026-08-31: народження FoxOS (ASCII rain).  
2026-09: home/lock/settings, foxmirror, foxlook, dock, Alt+Tab.  
2026-10-04: pulse, `sw -тема`, foxdocs, notebook.  
2026-10-21: FOXSTYLE + foxnodes + помічник + foxstt.  
2026-10-25: гайди + цей бриф.

Повна день-за-днем історія — **§16 нижче** (той самий текст, що `CHANGELOG.md`).

---

## 15. Що робити, якщо тебе просять змінити систему

1. Знайди шар (термінал / cmd / FoxOS / FOXSTYLE / site).
2. Дивись існуючий патерн поруч (`foxlife` для нових WinForms, `foxhelp` для нової команди).
3. Не ломай Apply-цикл FOXSTYLE (спочатку JSON, потім сигнал).
4. Після UX-зміни онови `FOXTERMINAL_GUIDE_UA.md` і EN, плюс цей файл якщо змінився шар.
5. Windows-перенос: `windows/CURSOR_MEGAGUIDE_UA.md` + `VERIFY_ALL.md`.
6. Linux-перенос: `linux/CURSOR_MEGAGUIDE_UA.md`.

Жива довідка власника в терміналі: **`foxhelp`**, усі доки: **`foxdocs`**.

---

## 16. Повна історія (з CHANGELOG.md)

Папка на Desktop досі називається **FireFoxBot**. Створена **4 лютого 2026, 12:23**.

**2025.** У git, у чатах Cursor цього воркспейсу і в датах файлів на диску слідів немає. Найраніший файл у папці: `cmd/youtube.bat` (4 лютого 2026, 13:47). Якщо старт був у 2025 в іншій папці — того вже немає.

Джерела: час створення файлів на диску, ~70 чатів Cursor, 6 комітів git (`3ba0515` → `fc5a60a`), збірка `builds/2build` (23 квітня 2026). Репозиторій: `shew4uk/FoxTerminal`.

Шари проєкту по черзі: C# бот вкладок → скрипти `cmd\` + Windows Terminal / WezTerm → свій Avalonia-емулятор → логін і медіа → mintty і локальні сайти → нотатки і теми → Firefox Companion і Zen → Ghostty і шейдери → FoxOS і система (home / lock / settings).

### 2026-02-04 — день нуль

Папка `Desktop\FireFoxBot` з’явилась о 12:23.

- **13:47–13:58** перші команди: `youtube`, `ff`, `bbind`, `ffbot`, `bindings.json`.
- **15:22–15:26** папка `FoxTerminal\`: README, `install.ps1` / `install.sh` (WezTerm, профіль Windows Terminal).
- **15:31–15:39** **FoxTerminalApp** на Avalonia: PTY, VT parser, вкладки. Спроба свого емулятора, не обгортки.
- **22:17–22:36** `ser` (пошук), `gask` (ChatGPT: `.bat` + AutoHotkey + userscript).
- Того ж дня шар **FireFoxBot**: `Program.cs` + `urls.txt` — дивиться вікно Firefox і відкриває вкладки. Папку з ботом прибрали 7 березня; `ffbot` лишився в help.

### 2026-02-05 — оболонка, gask, логін

- `sum`, `yt`, `tg`, перші `cmd/notes\`.
- **`sw`** — перемикач вигляду / лисиця.
- **Логін:** `foxauth.ps1`, `nuser`, `l`, `uexit`, `texit`. Без юзера сесія не йде далі. Prompt: `username>`.
- `foxhelp`, `wifi`, `theme.txt`, `clear`.

### 2026-02-06 — пачка системних команд

`disk`, `netping`, `who`, `users`, `passwd`, `blist`, `bdel`, `ftime`, `weather`, `ip`, `reconnect`, `fday`. Telegram-бінди: `tgub`, `tglist`. Логотип лисиці перемалювали в коді.

### 2026-02-07 — вигляд

Oh My Posh (`foxterm.omp.json`). Теми з `theme.txt`. Слово FireFoxBot прибрали з prompt. `sw` почав міняти кольори скрізь.

### 2026-02-08 … 2026-02-13 — AI і музика

- **8 лютого** `ask` — Ollama / qwen3-vl.
- **10 лютого** `friend` — чат FRIEND (Frederik Endiscot); вихід `exitt`.
- **11 лютого** `DisableBloat` / `DisableAds` / `Status` / `Enable`.
- **13 лютого** Spotify (`sp`, `sp-ui`, `dj`) і YouTube Music (`ytm`, `ytm-ui`).

### 2026-03-07 — перший git

Коміт `3ba0515` · 131 файл. Чат: «прибери фаєр фокс бот і залиши тільки фокс термінал». У git: `cmd\`, install, Oh My Posh, WezTerm, WT, Avalonia. Забрано кореневу папку **FireFoxBot/** (C# watcher).

### 2026-04-20 … 2026-04-21 — mintty і свій UI

`chek`, `term` (перемикач backend), bash/cmd init. У FoxTerminalApp — bash/mintty, не лише PowerShell. `sixel`, `interface` + WinForms GUI.

### 2026-04-23 — сайти і збірки

`sites` + `sites.json`. Перший сайт: **Key Rush**. `build`, знімок `builds/2build`, `foxpack`.

### 2026-05-02 — ігри за один вечір

Serpent Fox, Sunstrike Lab, Boom Grid, Crystal Roll, Item Oracle.

### 2026-05-03 … 2026-05-04 — хаб і гайд

UI Forge Guide. **foxchat** (Firebase) того ж дня прибрали. **Fox Hub**. **Fox Den** (вітрина).

### 2026-05-09 — хоткеї

`foxreset`. AutoHotkey v2: `foxhotkeys`, `foxinfo`, `foxdeps`. `sites -createn`.

### 2026-06-02 … 2026-06-06 — notes-ФС, noir

`hash` / `unhash`. Нотатки як ФС: `note-lib`, `wai`, `go`, `up`, `nfile`, `nfould`, `fdel`, `edit`. Команда **`noir`**. Коміт `4354098`. Старий один `note.ps1` роз’їхався по дрібних командах.

### 2026-06-10 … 2026-06-13 — вітрина, ігри, pride

`spider` (лише в noir). Вітрина `sites/fox-terminal`. Fox Utils. Fox Stack (Tetris). **`pride`**. Fox Word (Wordle).

### 2026-06-18 … 2026-06-30 — світи, теми, вікна

DnD Hero Forge, Fox Realm Forge. `foxscan`, `foxbg`, `frederik`, **`dnote`**, **`apple`**, `nano`, `view`. Експеримент Foxsprite (у репо не лишився). **`arthas`**, `themes`, `ytsplit`.

### 2026-07-01 — гайд і додатки

`apps` / `appbind`. Повні гайди UA/EN. Skills агента (не продукт). Вітрину розширили.

### 2026-07-21 … 2026-07-28 — Companion і Zen

FoxTerminal Companion (Firefox addon), `ffsync`. Тема Zen + `foxzen`. Голос у аддоні. Коміти `6a00adf`, `5fa2636`, `0006745` (LFS). Збірки addon 0.8.1 … 0.9.15.

### 2026-08-05 … 2026-08-06 — Кадр

`sites/kadr` — фільми/серіали, TMDB, localStorage.

### 2026-08-18 — Ghostty замість усього

`FoxTerminal/ghostty/config`, boot-скрипти, FoxNight, Nerd Font. `term` крутить Ghostty. `foxtest`, `foximg`. WezTerm / Windows Terminal зняті як хости (завершено комітом 5 вересня).

### 2026-08-30 … 2026-08-31 — шейдери і народження FoxOS

`shader` — скло Ghostty під теми. **FoxOS на шпалерах:** ASCII-дощ, лисиця, desk prompt, палітра з теми, стан у `%LOCALAPPDATA%\FoxTerminal\foxos\live.json`. Стіл більше не порожній фон.

### 2026-09-05 — коміт Ghostty-only + FoxOS

Коміт `fc5a60a`. У git: Ghostty + шейдери + FoxOS. Забрано `wezterm.lua`, `windows-terminal/*`.

### 2026-09-05 … 2026-09-07 — система

`home`, `foxsys-lib`, `lock` (Shift+Alt+L), `foxsetup`, `settings` (TUI + Control UI :17321), `CHANGELOG` + команда `changelog`. Прибрано автологін з `current_user.txt`. Дощ не їсть CPU, коли спереду Ghostty / Cursor / Zen.

### 2026-09-12 — foxmirror

Живий екран iPhone. iOS 27+: HEVC-відео (як Xcode mirror). Старіші iOS: скріншоти. USB і Wi-Fi після одного разу з кабелем. Автоустановка Python / pymobiledevice3 / Apple Mobile Device Support без повного iTunes.

### 2026-09-13 — foxlook

Windows «одягає» FoxOS без заміни Explorer: dark, icons, taskbar, sounds, cursors, lockscreen, winkeys, oem, winlock. `foxlook shell on` = наступний логін цього юзера = FoxOS замість Explorer (rescue: `restore-windows.cmd`). Док (pill/rail/glass/slim), піни, FOX-меню, Alt+Tab FoxOS.

### 2026-09-15 … 2026-09-19 — chrome FoxOS

Alt+Tab slide, desk breathe, boot fox, theme morph. Quick panels: wifi / vol / bright / bat / bt / reminders. SoftClose.

### 2026-10-04 — pulse, тихий sw, foxdocs, notebook

`pulse` / `pulse apps` (оцінка ноута, закрити важкі апки). `sw -<тема>` без лисиці. Alt+Tab **E** закриває вікно. `foxdocs`. `notebook` (пергаментний стіл).

### 2026-10-21 — FOXSTYLE

Візуальний редактор Node Launcher (дерево / полотно / властивості). Apply: `launcher.json` + `style.json` → `foxnodes.signal` → ack `foxnodes.applied`. Помічник (Ollama + push-to-talk). `foxstt` (whisper.cpp). Слово «YouTube» саме по собі сайт не відкриває.

### 2026-10-25 — гайди + цей бриф

Системні гайди під FOXSTYLE. Файл `CHATGPT_PROJECT.md` для стороннього чату.

### Що зникло за весь час

| Коли | Що |
|------|----|
| 7 бер 2026 | Папка C# **FireFoxBot/** |
| 3 тра 2026 | Сайт **foxchat** |
| 26 чер 2026 | Експеримент **Foxsprite** |
| 18 сер / 5 вер 2026 | **WezTerm**, **Windows Terminal**, bash TUI |
| 5–7 вер 2026 | Автологін з `current_user.txt`, фіксований розмір вікна Ghostty |

Що лишилось з нульового дня: папка `FireFoxBot` на диску, `ff` / `bbind`, FoxTerminalApp (Avalonia), ідея «свій термінал».

### Коміти git

```
3ba0515  2026-03-07 14:44  FoxTerminal
4354098  2026-06-06 22:42  changes
6a00adf  2026-07-26 23:40  Zen Companion, showcase, ecosystem
5fa2636  2026-07-26 23:56  assets, skills, zen installer
0006745  2026-07-27 00:04  Zen installer + addon dist → Git LFS
fc5a60a  2026-09-05 23:00  FoxOS + Ghostty look on the site
```

Між комітами робота жила в чатах і на диску. Канон історії в репо: кореневий `CHANGELOG.md` (у терміналі: `changelog`).
