# Історія FoxTerminal

Папка на Desktop досі називається **FireFoxBot**. Створена **4 лютого 2026, 12:23**.

**2025.** У git, у чатах Cursor цього воркспейсу і в датах файлів на диску слідів немає. Найраніший файл у папці: `cmd/youtube.bat` (4 лютого 2026, 13:47). Якщо старт був у 2025 в іншій папці — того вже немає.

Джерела: час створення файлів на диску, ~70 чатів Cursor, 6 комітів git (`3ba0515` → `fc5a60a`), збірка `builds/2build` (23 квітня 2026). Репозиторій: `shew4uk/FoxTerminal`.

Шари проєкту по черзі: C# бот вкладок → скрипти `cmd\` + Windows Terminal / WezTerm → свій Avalonia-емулятор → логін і медіа → mintty і локальні сайти → нотатки і теми → Firefox Companion і Zen → Ghostty і шейдери → FoxOS і система (home / lock / settings).

---

## 2026-02-04 — день нуль

Папка `Desktop\FireFoxBot` з’явилась о 12:23.

### Додано

- **13:47–13:58** перші команди: `youtube`, `ff`, `bbind`, `ffbot`, `bindings.json`.
- **15:22–15:26** папка `FoxTerminal\`: README, `install.ps1` / `install.sh` (WezTerm, профіль Windows Terminal).
- **15:31–15:39** **FoxTerminalApp** на Avalonia: PTY, VT parser, вкладки, `foxterminal.sample.json`. Спроба свого емулятора, не обгортки.
- **22:17–22:36** `ser` (пошук), `gask` (ChatGPT: `.bat` + AutoHotkey + userscript).

Того ж дня в чаті «C# бот для вкладок Firefox» з’явився шар **FireFoxBot**: `Program.cs` + `urls.txt`. Дивиться вікно Firefox і відкриває вкладки через `--new-tab`. Запуск: `dotnet run --project FireFoxBot`. Папку з ботом прибрали 7 березня; команда `ffbot` лишилась у help.

---

## 2026-02-05 — оболонка, gask, логін

Чати: gask, мова стрілками, команди без сторонніх програм.

### Додано

- **13:28** `sum`.
- **14:40** `yt`, `tg` (окремо від youtube.bat).
- **14:50** перші файли в `cmd/notes\`.
- **15:27** `sw` (перемикач вигляду / лисиця).
- **18:39–18:43** **логін:** `foxauth.ps1`, `nuser`, `l`, `uexit`, `texit`. Без юзера сесія не йде далі. Prompt після входу: `username>`.
- **21:59** `foxhelp`.
- **22:36** `wifi`.
- **23:02** `theme.txt`.
- **23:13** `clear`.

---

## 2026-02-06 — пачка системних команд

Чати: нові команди, аналіз усіх команд, логотип лисиці, блокування логіном.

### Додано

- **21:27–21:51** `disk`, `netping`, `who`, `users`, `passwd`, `blist`, `bdel`, `ftime`, `weather`, `ip`, `reconnect`.
- **22:13** `fday`.
- **23:10–23:23** Telegram-бінди: `tgub`, `tg_bindings.json`, `tglist`.

Логотип лисиці перемалювали в коді (не лише картинка).

---

## 2026-02-07 — вигляд

Чати: плагіни для графіки, кольори тем не змінювались, продуктивність WT, бінди.

### Додано

- **10:13** Oh My Posh: `FoxTerminal/oh-my-posh/foxterm.omp.json`.
- Теми з `theme.txt` під кожну палітру. Слово FireFoxBot прибрали з prompt.

### Виправлено

- Профіль Windows Terminal (opacity, blur, padding) під швидкість.
- `sw` почав реально міняти кольори скрізь, не лише в одному вікні.

---

## 2026-02-08 … 2026-02-13 — AI і музика

### Додано

- **8 лютого, 08:44** `ask` — Ollama / qwen3-vl (спочатку часто не конектилось).
- **10 лютого, 21:31** `friend` — чат FRIEND (Frederik Endiscot): `exitt`, `/clear`, `/help`, `/model`.
- **11 лютого, 23:19** `DisableBloat` / `DisableAds` / `Status` / `Enable` в `FoxTerminal\`.
- **13 лютого, 17:48–17:53** Spotify: `sp`, `sp-ui`, `dj`.
- **13 лютого, 22:33–22:41** YouTube Music: `ytm`, `ytm-ui`, `ytm_bindings.json`. Назва пісні, Continue, якщо вкладка грає.

`foxhelp` і README підтягнули під повний список команд (включно з Disable*).

Папка `FireFoxBot\` з C# ботом ще лежала в корені поруч із `cmd\` і `FoxTerminal\`.

---

## 2026-03-07 — перший git

Коміт `3ba0515` о 14:44 · *FoxTerminal* · 131 файл.

Чат: «прибери фаєр фокс бот і залиши тільки фокс термінал».

### Додано в git

- `cmd\` (логін, нотатки-файли, медіа, `ask`/`friend`, `sw`, `ff`, Telegram, DJ).
- `FoxTerminal\`: install, Oh My Posh, WezTerm, Windows Terminal, bloat/ads.
- `FoxTerminalApp\`: Avalonia GUI.

### Забрано

- Коренева папка **`FireFoxBot/`** (C# watcher). `ffbot` лишився як ярлик у help.

---

## 2026-04-20 … 2026-04-21 — mintty і свій UI

Чати: сумісність з mintty, термінал запуску, мінті не відкривається.

### Додано

- **20 квітня** `chek`, `term` (перемикач backend), `foxterm-bash-init.sh`, `foxterm-cmd-init.cmd`.
- У FoxTerminalApp: `shellBackend`, `shellPath` — bash / mintty, не лише PowerShell.
- **21 квітня** `sixel` (картинки в mintty), `interface` + `interface-gui.ps1` (WinForms).

---

## 2026-04-23 — сайти і збірки

Чат «Папка з сайтами…». `fox_ver` 1.0.

### Додано

- **15:09** `sites/sites.json`, команда `sites` (список у PS; у mintty — окреме вікно interface).
- **15:57** перший сайт: **Key Rush** (`sites/typewriter`) — тренажер друку.
- **16:19** `build`, інсталятор `builds/1firstbuild/install.ps1` (банер, куди ставити, копіює проєкт).
- **16:31** знімок **`builds/2build`** (notes, binds, theme orange).
- **16:33** `foxpack` — zip для друга (`-Full` = твої notes/binds).

---

## 2026-05-02 — ігри за один вечір

### Додано

- **18:53** **Serpent Fox** (`sites/snake`) — змійка, теми cyber/neon/lava.
- **19:33** **Sunstrike Lab** (`sites/invoker`) — комбо Invoker, іконки сфер.
- **20:18** **Boom Grid** (`sites/techies-sweeper`) — сапер Techies (Lane / Jungle / Ancient).
- **21:52** **Crystal Roll** (`sites/dice-forge`) — 3D-кубики (Default, DND, Dota, пізніше Ivory / Space / Arcane).
- **22:11** **Item Oracle** (`sites/dota-items-randomizer`) — рандом предметів Dota 2.

---

## 2026-05-03 … 2026-05-04 — хаб і гайд

### Додано

- **3 травня, 10:56** **UI Forge Guide** (`sites/web-ui-guide`) — HTML/CSS/JS, курсори, патерни.
- Того ж ранку пробували **foxchat** (месенджер на Firebase, без домену). Увечері прибрали.
- **3 травня, 22:32** **Fox Hub** (`sites/hub`) — картки всіх локальних сайтів. `sites -Main` відкриває хаб.
- **4 травня, 21:11** **Fox Den** (`sites/OnePageStore`) — вітрина мерчу з кошиком (спочатку чернетка Product 1).

### Забрано

- **`sites/foxchat`** і запис у `sites.json` (той самий день, що й створення).

---

## 2026-05-09 — хоткеї

Чат: Firefox / YouTube shortcuts.

### Додано

- **16:40** `foxreset`.
- **17:00–17:14** AutoHotkey v2: `foxhotkeys` (показати/сховати термінал, YouTube, Firefox), `hk_lib`, `hk_parse`.
- **17:02** `foxinfo` — шлях до exe, прихований старт.
- **17:18** `foxdeps` — повна перевірка залежностей (не лише bash/mintty).
- `sites -createn <name>` — заготовка нового сайту.

---

## 2026-06-02 … 2026-06-06 — нотатки як ФС, noir, коміт

Чат про файли в терміналі (3 червня) — файли з’явились **2 червня о 22:10**.

### Додано

- **2 червня, 22:10** `hash` / `unhash` / `foxcodec` / `foxhash-lookup`.
- **2 червня, 22:12** нотатки замість одного `note.ps1`: `note-lib`, `wai`, `go`, `up`, `nfile`, `nfould`, `fdel`, `edit` (TUI).
- **6 червня, 20:52** команда **`noir`** (окремий ч/б режим, не просто колір у `sw`).
- **6 червня, 22:42** коміт `4354098` · *changes* — збірки, sites, notes-ФС, interface, hash, hotkeys.

### Забрано

- Старий один файл `note.ps1` — логіка роз’їхалась по `note-lib` і дрібних командах.

---

## 2026-06-10 … 2026-06-13 — вітрина, ігри, pride

### Додано

- **10 червня, 23:12** easter egg **`spider`** (Spider-Man Noir, тільки в noir).
- Того вечора в FoxTerminalApp: `TerminalTheme.cs`, `FoxThemeLoader.cs`.
- **10 червня, 23:44** початок вітрини **`sites/fox-terminal`** (index, themes, commands, terminal, ai, media, hotkeys, ecosystem).
- **11 червня, 00:21** **Fox Utils** — Hash Vault, Text Tools, Network Fox, Pomodoro.
- **12 червня, 23:08** **Fox Stack** (`sites/fox-stack`) — Tetris (Hold, Rush, Ghost, Chain).
- **13 червня, 21:04** режим **`pride`** (як noir: команда + підстилі через `sw`).
- **13 червня, 21:45** **Fox Word** (`sites/fox-wordle`) — Wordle, словник ~370k у gzip.

Noir полагодили: шорткати більше не скидали режим.

---

## 2026-06-18 … 2026-06-30 — світи, теми, вікна

### Додано

- **18 червня, 16:48** **DnD Hero Forge** — персонаж D&D 5e (раса, клас, заклинання).
- **18 червня, 18:14** **Fox Realm Forge** — генератор світу (Voronoi, біоми, держави, як Azgaar).
- **23 червня** `foxscan` (скан Downloads/Desktop/Startup), `foxbg` (фонові процеси), `frederik`, **`dnote`** (тема Death Note), **`apple`** (великий ASCII), `nano`, `view`.
- **26 червня** чат **Foxsprite** — WinForms піксель-редактор. У репо файлів не лишилось.
- **30 червня, 23:16** **`arthas`** (ASCII з двох фото, dark/light).
- **30 червня, 23:25** `themes` — список/перемикач тем.
- **30 червня, 23:45** `ytsplit` — розкладка вікон YouTube / YTM.

---

## 2026-07-01 — гайд і додатки

### Додано

- **00:13** `apps` / `appbind` — ярлики програм і URL.
- **00:21** `FoxTerminal/FOXTERMINAL_GUIDE_UA.md` і EN — повний каталог команд.

13 липня поставили skills (control-ui-e2e тощо) — це інструменти агента, не продукт.

19 липня вітрину fox-terminal розширили (картки «Що нового 2026», каталог команд).

---

## 2026-07-21 … 2026-07-28 — Companion і Zen

### Додано

- **21 липня, 02:58** **FoxTerminal Companion** (Firefox addon): popup, sidebar, native host, `foxaddon -Install`.
- **21 липня, 03:28** `ffsync`.
- **25 липня, 21:16** тема **Zen**: `FoxTerminal/zen/userChrome.css`, `user.js`, команда `foxzen`.
- **26 липня** design-export-ui (моки sidebar/popup), голос у аддоні («хочу телеграм», «відкрий ютуб»), сторінка companion на вітрині.
- Коміти того вечора:
  - `6a00adf` 23:40 — addon + вітрина + екосистема
  - `5fa2636` 23:56 — ассети, skills, zen installer
  - `0006745` 27 липня 00:04 — `.exe` / `.xpi` у Git LFS
- **28 липня** допилювання вигляду Zen (toolbar, tabs, sidebar, accent).

Збірки Companion у git: 0.8.1 … 0.9.15.

---

## 2026-08-05 … 2026-08-06 — Кадр

Чат 5 серпня вночі.

### Додано

- **6 серпня, 00:12** **Кадр** (`sites/kadr`) — фільми/серіали, TMDB, оцінки 1–10, localStorage, без сервера.

---

## 2026-08-18 — Ghostty замість усього

Кілька чатів того дня. Конфіг: `FoxTerminal/ghostty/config`.

### Додано

- **15:21** Ghostty: `config`, `foxterminal-boot.ps1` / `.sh`, `ghostty-lib.ps1`. Палітра FoxNight, CaskaydiaCove Nerd Font. Команда `term` крутить Ghostty, не WezTerm/WT.
- **17:48** `foxtest`.
- **22:11** `foximg`.

### Забрано (завершено комітом 5 вересня)

- WezTerm (`wezterm.lua`) і Windows Terminal як підтримувані хости.
- `interface-ui.sh`, `sites-ui.sh` (Cygwin/tmux TUI — на Ghostty не працювали).

24–25 серпня: pin у чаті `friend`/`wai -pin`; ідея шифру «квадрат FOXTERMINAL» (пасхалка, не заміна `passwd`); вітрину підтягнули під Hub (скло, pill-навігація).

---

## 2026-08-30 … 2026-08-31 — шейдери і **зародження FoxOS**

Файли з’явились до коміту 5 вересня. Тут починається окремий шар проєкту: не «ще одна команда в терміналі», а **живий стіл** поверх Windows.

### Додано

- **30 серпня, 13:15** `shader` / `shader-lib` — скло Ghostty, палітри під теми (orange, noir, pride, arthas, dnote…).
- **31 серпня, 16:24–16:52** **FoxOS народжується на шпалерах:**
  - `foxos` + `foxos-lib` + `foxos-live.cs` / `foxos-live.exe`
  - повноекранний **ASCII-дощ** замість статичної картинки Windows
  - **лисиця** з `FoxTerminal\assets\fox.png` у центрі (ASCII / bitmap під тему)
  - **desk prompt** знизу: рядок `> команда` прямо на шпалерах
  - палітра `night` / `accent` з теми (`sw`, slate, noir, pride…)
  - стан у `%LOCALAPPDATA%\FoxTerminal\foxos\live.json`

Це і є точка «додавання шпалер» у сенсі продукту: стіл більше не порожній фон — це FoxOS Live.

---

## 2026-09-05 — коміт Ghostty-only + FoxOS

Коміт `fc5a60a` о 23:00 · *Ship FoxOS live desktop and show the Ghostty look on the site.*

### Додано в git

- Увесь шар Ghostty + шейдери + FoxOS (`foxos-live.cs`, `foxos-help.cs`).
- `foxtest`, `foximg`, before/after кадри на сайті (term / wall / zen).

### Забрано

- `wezterm.lua`, `windows-terminal/*`.
- Гайди інших терміналів як основний шлях.

---

## 2026-09-05 … 2026-09-07 — система (ще не в коміті)

Чат «Terminal enhancements ideas». Файли системи: **7 вересня, 20:46**.

### Додано

| Коли | Що | Навіщо |
|------|----|--------|
| 7 вер 20:46 | `home` | Дім після логіну |
| 7 вер 20:46 | `foxsys-lib` | Профіль юзера: тема, FoxOS, шейдер, idle lock |
| 7 вер 20:46 | `lock` | Shift+Alt+L; пароль тільки в Ghostty |
| 7 вер 20:46 | `foxsetup` | Майстер першого запуску |
| 7 вер 20:46 | `settings` | TUI + Control UI `127.0.0.1:17321` |
| 7 вер 22:21 | `CHANGELOG.md` + команда `changelog` | Ця історія, тільки читання |
| 5–7 вер | тости FoxOS | Смуга на дощі |
| 5–7 вер | Zen як браузер команд | `Open-FoxBrowserUrl` |
| 5–7 вер | швидкий logon Ghostty | Task, не папка Startup |

### Забрано

- Автологін з самого `current_user.txt` (нове вікно: Test / Login / Register).
- `+new-window` / `-e` на GUI Ghostty (ламали одне вікно).
- `window-width` / `window-height` у конфігу (після `reload_config` вікно з’їжджало з fullscreen).

### Виправлено

- Settings більше не вішає панель і не роз’їжджається з FoxOS/шейдерами (apply у фоні, хост поза Ghostty).
- Тема з сайту пише в профіль юзера; у TUI стрілки + кнопка Apply.
- `Complete-FoxSession` — `foxsys-lib.ps1` тільки ASCII (стрілки як `[char]0x2191`, інакше PS 5.1 ламає весь файл).
- Український текст у `changelog` (читання UTF-8, файл з BOM).
- Дощ не їсть CPU, коли спереду Ghostty / Cursor / Zen.

---

## 2026-09-12 — екран айфона по USB і Wi-Fi

Чат «iPhone screen mirror». Два режими, вибираються самі: на iOS 27+ — справжнє HEVC-відео зі звуком через CoreDevice display service (той самий шлях, що в Xcode mirror; pymobiledevice3 роздає на localhost, декодує Chrome/Edge у режимі app-вікна); на старіших iOS — скріншоти через сервіс розробника `instruments`, кілька кадрів на секунду, без звуку. Без підміни драйверів і без адміна (iOS 17.4+ userspace-тунель). Телефон на iOS 26.6.1 відповів «Remote control requires iOS 27.0» — відео вмикається після оновлення 14 вересня.

### Додано

| Що | Навіщо |
|----|--------|
| `foxmirror` (`foxmirror.ps1` + `foxmirror/mirror.py`) | Живий екран телефона. Відео-режим: вікно Chromium, закрити = зупинити. Фото-режим: Esc вихід, `f` fullscreen, `s` зберегти кадр у `Pictures\FoxMirror`, пробіл пауза |
| `foxmirror -Video` / `-Photo` / `-NoAudio` | Примусовий режим; без звуку |
| `foxmirror -Check` / `-Setup` | Стан пристрою без вікна / тільки підготовка (парування, Developer Mode, образ розробника) |
| автоустановка залежностей | Python 3.12 (winget, user scope), `pymobiledevice3` + `pillow`; Apple Mobile Device Support витягується з `iTunes64Setup.exe` портативним 7-Zip і ставиться сам `.msi` без iTunes (один запит UAC) |
| без кабеля: `-Wifi` / `-Usb`, `foxmirror -PairWifi` | Перший запуск з кабелем сам створює RemotePairing-запис через lockdownd (без жодного діалогу на телефоні); далі `foxmirror` бере USB, коли кабель є, і Wi-Fi, коли нема — і фото-, і відео-режим (по Wi-Fi ~29 fps проти ~38 по USB). `-PairWifi` — те саме вручну, а без кабеля — через Налаштування → Розробник → Paired Macs з 6-значним кодом (iOS 27+; «Macs» — просто назва екрана). `-Setup` ще вмикає на телефоні «Wi-Fi connections»; правило Windows Firewall для python додається саме (UAC) |
| Python 3.13 | Wi-Fi-тунель — TLS-PSK, який уміє тільки `ssl` з 3.13 (на 3.12 pymobiledevice3 просить `sslpsk_pmd3`, чий Windows-wheel зібраний проти OpenSSL 1.1 і не вантажиться). Обгортка ставить 3.13 через winget; `lzfse` без wheel для 3.13 — ставиться shim поверх `pyliblzfse` |
| скін FoxMirror | Як scrcpy на Linux: вікно = екран телефону (без панелей pymobiledevice3). Знизу док з SVG-іконками (Home, Lock, кадр, обертання, звук). `viewer.js` патчиться, щоб картинка займала все вікно, не 20% |

Що не автоматизується: на телефоні з код-паролем Apple дозволяє увімкнути Developer Mode лише в Налаштуваннях телефона — скрипт показує пункт і чекає. Звук у відео-режимі — тільки на macOS (AAC-ELD декодує AudioToolbox), на Windows картинка без звуку. Windows сам сидить на mDNS-порту 5353 і не віддає python запити телефона, тому режим Paired Macs працює через періодичні анонси, а не відповіді. На iOS 26 по Wi-Fi нічого не працює: CoreDevice-тунель телефон приймає тільки по USB, RemotePairing не анонсує — після оновлення до 27.0 усе піднялося.

---

## 2026-09-13 — FoxOS look: Windows перестає бути схожою на Windows

Чат «захватити віндовс». Рівень 1 з трьох: усе, що робиться через HKCU і API без заміни Explorer. Перший `on` знімає знімок кожного значення Windows, `off` повертає його і стирає знімок.

### Додано

| Що | Навіщо |
|----|--------|
| `foxlook` (`foxlook.ps1` + `foxlook-lib.ps1`) | `on` / `off` / `status` / `<part> on\|off`. Частини: `dark` (AppsUseLightTheme + SystemUsesLightTheme), `icons` (Explorer сам ховає іконки, без рестарту), `taskbar` (автоприховування через `SHAppBarMessage`), `sounds` (усі системні звуки → `.None`), `cursors` (піксельні курсори FoxOS, див. нижче), `lockscreen` (картинка дощу з лисицею у темі, Spotlight вимкнено; через WinRT `LockScreen.SetImageFileAsync`, оригінал копіюється), `winkeys` (клавіша Win → FoxOS) |
| `foxlook oem on` | Параметри → Про систему: Manufacturer FoxOS, Model FoxTerminal, логотип лисиці 120×120. Єдина частина з UAC, питає один раз; `foxlook on` з терміналу її включає, логін і Control UI — ні |
| `foxlook winlock on` | Win+L лочить FoxTerminal, а не Windows (`DisableLockWorkstation` для юзера). Не в `on`, лише явно |
| `foxlook wall behind` / `overlay` | `behind` — дощ у WorkerW Explorer'а, під шаром іконок: Win+D і z-order його не чіпають, але desk prompt недосяжний. `overlay` (за замовчуванням) — як було |
| Win-клавіші в `foxhotkeys.ahk` | Win → показати/сховати FoxTerminal (не Пуск); Win+R, Win+S → desk prompt на шпалерах (`prompt.req`); Win+E → `edit`, Win+I → `settings` у Ghostty (`desk.req`); Win+L → Fox lock після `winlock`. Інші Win+… лишаються Windows. Прапорець `foxos\winkeys.txt`, `foxlook winkeys on\|off` перезапускає AHK |
| `look` у профілі юзера | `settings` (TUI рядок «FoxOS look», Control UI кнопка), `foxsetup` (питання після FoxOS), `home`, `settings -Status`. При логіні `Apply-FoxUserWorld` тихо переприкладає / знімає |
| Lock screen за темою | `sw` міняє тему → `Sync-FoxOsSkin` перемальовує картинку lock screen, якщо частина `lockscreen` включена |
| Піксельні курсори (`foxcursor-lib.ps1`) | Кожен курсор — ASCII-карта пікселів, темна обводка домальовується сама, кольори з палітри теми (accent / accent4 / accent3 / night). 15 форм (Arrow, Hand, IBeam, Wait, AppStarting, Help, No, Cross, 4 Size, SizeAll, UpArrow, Pen) пишуться як `.cur` (32bpp + AND-маска) у `foxos\cursors\<стиль>-<тема>-x<масштаб>\`. Стилі: `neon` (порожня, лише обвід акцентом; за замовчуванням), `pixel` (класична тонка стрілка), `chunky` (обводка 2px), `fox` (голова лисиці, hotspot — кінчик лівого вуха); `inverted` — стара схема Windows. `foxlook cursor <стиль> [1\|2\|3]`, `foxlook cursor preview` малює всі стилі в кількох темах. `sw` перегенеровує набір під нову тему |

Що не тут (Рівень 3): boot-логотип, UI екрана входу / PIN / Hello.

### Рівень 2 — FoxOS як shell цього юзера

`foxlook shell on` (не входить у `foxlook on`). Наступний вхід **цього** акаунта запускає `foxos-shell.cmd` замість Explorer. Другий юзер Windows не чіпається (його HKCU лишається Explorer).

#### Док / стіл / контент (розширення shell)

| Що | Як |
|----|-----|
| Піни будь-чого | `pins.json`; перетягни `.exe`/`.lnk` на док; drag щоб змінити порядок |
| FOX-меню | term / home / foxlife / mirror / music / settings / files / sites / lock / restore |
| Мультимонітор | окремий док на кожен екран |
| Мініатюри вікон | hover над іконкою вікна |
| Home launcher | при старті shell + пункт меню; `foxlook dock home on\|off` |
| Віджети | годинник / weather / note зверху справа; `foxlook dock widgets on\|off` |
| Alt-Tab FoxOS | `Alt+Tab` коли `foxos-live` крутиться (`foxhotkeys.ahk` → `alttab.req`) |
| Rescue | `Win+Esc` → `restore-windows.cmd` |
| Профіль | `foxlook export [path]` / `foxlook import <path>` (look + pins + theme) |
| Desk quick | `wifi` / `bt` / `bright` / `vol` / `bat` / `cal` / `mirror` / `foxlife` / `home` |

| Що | Навіщо |
|----|--------|
| `HKCU\...\Winlogon\Shell` | per-user, без адміна. Знімок попереднього значення; `foxlook shell off` / `foxlook off` повертає Explorer |
| `foxos-shell.ps1` | тримає сесію: `foxos-live`, hotkeys, Ghostty logon; якщо live падає 3 рази за хвилину — сам відкатує Shell і стартує `explorer.exe` |
| `FoxOS-ShellWatch` | scheduled task цього юзера: 30 с після входу, немає heartbeat у `shell-alive.json` → Explorer назад |
| Rescue | `Ctrl+Alt+Del` → Диспетчер → Файл → Виконати `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd` або `cmd\fox-restore-windows.bat` / `foxlook rescue` (без логіну) |
| Док (`foxos-dock.cs`) | окреме вікно знизу: FOX-меню, піни, вікна, трей bt / wifi / vol / bat. Дощ лишається знизу, док — TopMost |

Поточний сеанс не вбиває Explorer: оболонка міняється з наступного входу. Док з'являється одразу (прев'ю поверх автоприхованого таскбару).

Док стилі (`pill` за замовчуванням, також `rail` / `glass` / `slim`): заокруглені чіпи, hover, активне вікно з акцентною рискою, трей з доріжкою гучності. У `settings` (стрілки ← →): Taskbar / place / size / hide / apps / tray, плюс Cursor і FoxOS shell. Те саме з терміналу: `foxlook dock style pill`, `foxlook dock place top`, `foxlook dock hide on`.

---

## 2026-09-15 … 2026-09-19 — FoxOS chrome: панелі, анімації, quick settings

Чати про прозорість Home / Alt+Tab / power-off / відновлення теми / анімації / Wi‑Fi / quick panels. Збірка: `foxos-live` + `foxos-chrome.cs` + `foxos-dock.cs` + `foxos-quick.cs`.

### Додано

| Що | Навіщо |
|----|--------|
| **Alt+Tab slide** | `AltTabBoard`: DWM-мініатюри, strip знизу, slide-in + fade при першому показі |
| **Desk breathe** | м’який pulse акценту на pill / rail дока |
| **Boot fox** | лисиця з’являється зі scale + fade при старті wall |
| **Theme morph** | wash старої `night` при зміні теми (~640 ms) |
| **WifiBoard** | список мереж з dock / desk `wifi`: scan, connect, disconnect, filter; для нових secured — **пароль у панелі** (XML profile + `netsh`) |
| **VolumeBoard** | слайдер + mute (ПКМ на vol = mute); desk `vol` |
| **BrightBoard** | яскравість через WMI `WmiMonitorBrightness`; desk `bright`, ПКМ на bat |
| **BatteryBoard** | %, AC, смужка, кнопки bright / saver; desk `bat` |
| **BluetoothBoard** | paired-девайси (без адаптерів/Microsoft junk), enable/disable, pair…; desk `bt` |
| **ReminderBoard** | Life reminders з `foxlife/.../reminders.json`; desk `cal` / `calendar` / `reminders` |
| **SoftClose** | панелі з’їжджають з fade; відкриття іншої панелі ховає попередню; фокус на YouTube тощо — те саме |
| `foxos-quick.cs` | спільний chrome для quick-панелей у збірці live |

### Виправлено

- Home / Help: скло (`Opacity`), resize, вкладки WALL / TERM у стилі foxhelp.
- Power-off з меню: підтвердження, graceful `shutdown /s` (без `/f`).
- Slate accent і `dockHide` bool/`"on"` у look → live.
- Wi‑Fi connect: `name`+`ssid`+`interface`, disconnect перед switch, poll до реального SSID.
- Док ширший (іконки/gap), годинник з трею прибрано (календар лишився через `cal`).
- `EnsureDock` більше не вбиває Alt+Tab щокадру при `shell: off` (ламало slide).
- `Write-FoxOsLiveState` читає `look.json` навіть без завантаженого `foxlook-lib` (shell знову `on`).

---

## 2026-10-04 — pulse, Alt+Tab E, тихий sw, гайди Windows

Сесія на основному Windows-ПК (ultrawide 3440×1440, Ryzen + RTX 5060 Laptop): оболонка FoxOS, vitals, чистка RAM.

### Додано

| Що | Навіщо |
|----|--------|
| **`pulse`** | live CPU/GPU/RAM + **оцінка ноута** `/100` (A…F), feeling, trend sparkline, батарея; `-Once` = знімок |
| **`pulse apps`** | стрілки вибирають важку апку → Enter закриває; **Back** / Esc назад у vitals; з live — клавіша **A** |
| **`sw -<тема>`** | тиха зміна кольору без лисиці (`sw -slate`, `sw -orange`…); `sw` / `sw slate` лишає UI + стрілки |
| **Alt+Tab → E** | тримаєш Alt, жмеш **E** (або Del) — закриває вибране вікно; прапорець `alttab.open` + `alttab-close.req` |

### Виправлено

- Alt+Tab slide: без крутіння `Form.Opacity` під час DWM-мініатюр; окремий poll `.req` ~33 ms (не 400 ms під Cursor/браузером); soft-close на вихід.
- `foxlook taskbar`: hard-hide лише коли shell/dock on; інакше тільки autohide + показ таскбару.
- `foxhotkeys` стартує разом із `foxos-live` (інакше Fox Alt+Tab не ловився).
- `sw -колір` більше не ламається як «невідомий параметр» powershell `-File` (без `param()` — аргументи в `$args`).

### Документація

- Windows pack: `CURSOR_MEGAGUIDE_UA.md`, `VERIFY_ALL.md`, кореневий `AGENTS.md` — `pulse` / `sw -theme` / Alt+E у шпаргалці й прогоні на інший ноут.
- Гайди UA/EN, linux `COMMANDS_LINUX`, README — той самий шар + команда **`foxdocs`** (список усіх гайдів/історії).

### Додано (пізніше того ж дня)

| Що | Навіщо |
|----|--------|
| **`foxdocs`** | інтерактивний список усіх гайдів / CHANGELOG / AGENTS / Windows+Linux pack; **←** відкрити в терміналі, **→** кнопка «Open + Explorer», **Back** внизу |
| **`notebook`** | режим «зошит»: пергаментний стіл, лінії паперу, червона маргіна, чорнильний rain; toggle як `dnote` / пункт у `themes` |

---

## 2026-10-21 — FOXSTYLE: візуальний редактор Node Launcher

### Додано

| Що | Навіщо |
|----|--------|
| **FOXSTYLE → Node Launcher** | три панелі: дерево / полотно / властивості; без JSON і слайдер-звалища |
| **Чернетка vs Застосувати** | undo/redo, статус, підтвердження при виході; `launcher.json` + `style.json` + `foxnodes.signal` |
| **Профілі та пресети вигляду** | компактний / м’яке скло / контрастний / за темою FOXSTYLE — не чіпають структуру меню |
| **Анімації Node Launcher** | пресети Стриманий / Плавний / Пружний / Мінімальний рух — і preview, і desktop overlay |

### Виправлено

- «Застосувати» у FOXSTYLE більше не пише `foxnodes.signal` **до** `style.json`. Overlay чекає на обидва файли, потім акає `foxnodes.applied`.
- `Show`/`Hide` спочатку перечитують `launcher.json`, тож живе меню не затирає щойно застосовані налаштування старим станом у пам’яті.
- Статус «Застосовано» лише після ack overlay; якщо `foxnodes` не запущено — «Збережено. Буде застосовано після запуску меню».
- Прозорість скла більше не затиснута мінімумом alpha 145; зміна opacity видно на робочому столі.
- Помічник більше не відкриває YouTube лише через слово «YouTube»: `TryYoutubeSearch` вимагає майданчик («на YouTube»), а не `Contains`. Пошук у Google зі словом YouTube лишається Google. «Що таке YouTube?» і «поки не відкривай» не запускають браузер.

### Додано (пізніше того ж дня)

| Що | Навіщо |
|----|--------|
| **Помічник Node Launcher** | текст + push-to-talk, локальна Ollama, відкриття Google/пошук/програми/нотатки/таймер |
| **FOXSTYLE → Помічник** | модель, мікрофон, дозволи, журнал; Apply пише `assistant.json` і сигнал overlay |
| **Локальний STT** | whisper.cpp b5454 (BLAS CPU) у `%LOCALAPPDATA%\FoxTerminal\foxos\stt`; типово `small-q8_0` (~2 с), `large-v3-turbo-q8_0` лишається як якісніша опція |
| **Вільні формулювання помічника** | повний запит, заперечення/виправлення, кілька дій, контекст «те саме», пауза перед надсиланням голосу |
| **Діагностика маршруту помічника** | `FOXASSIST_TRACE=1` або FOXSTYLE → Помічник → assistant-trace.log (без аудіо) |

---

## 2026-10-26 — FOX SERPENT 1.4.0 (склад, арт, AI)

| | |
|--|--|
| **Склад їжі** | carried 0–9 vs база; F-панель; deposit коротшає; без XP; носій → pantry |
| **Грядки** | `isFarmableGround` — будь-яка суха вільна земля |
| **Build фікси** | похідний woodCap/pantryCap; fence-ряд all-or-nothing; ПКМ = cancel; X = demolish; пауза зупиняє таймери |
| **Арт** | `art.js` — дерева/паркан bitmask/ворота/грядки/комора/склад деревини |
| **AI** | злодій з loot+втеча; розвідник + intel; elder ламає огорожу з боку |
| **Союзники** | носій→склад, ремонтник, сторож; wait_pantry |
| **Гайд** | `drawGuideBoard` + pantry/farm/thief/scout сцени |

Файли: `storage.js`, `art.js`, `build.js`, `farms.js`, `ai.js`, `allies.js`, `guide.js`. Тести: All passed (`node tests/_run-node.js`).

---

## 2026-10-26 — FOX SERPENT 1.3.0 (бази, деревина, B-курсор)

| | |
|--|--|
| **Дерево талантів** | col/row layout без overlap; pan/zoom; «До доступних» центрує |
| **Tab-покупка** | підтвердження в панелі (не `confirm`); помилки в панелі; повний rollback світу |
| **Земля** | спокійний зелений ґрунт; різноманітність через об’єкти |
| **Деревина** | окремо від поживи; гілки/пень; HUD |
| **B-режим** | курсор, змія стоїть, вороги йдуть; паркан/ворота/блок/грядка/дім/склад |
| **Рейди** | AI цілить зрілі грядки за видимістю/шляхом; чужі гнізда на небезпечних землях |
| **Гайд** | 11 розділів + легенда в H |

Файли: `sites/serpent-evolution/` (`build.js`, UI/renderer/AI/save). Тести: `tests/logic-tests.html`.

---

## 2026-10-26 — FOX SERPENT 1.2.0 (світ, ферми, союзники)

### Земля
- Причина блокування: старі ціни матеріалів 12–16 при обмеженому запасі; тепер **поживі** + `getExpansionQuote` / `purchaseExpansion` (ціна UI = списання, offer id, anti double-buy).
- Процедурний seed (`tiles.js` + `generate.js`), зважений вибір регіону, узгоджені входи.

### Системи
| Модуль | Що вміє |
|--------|---------|
| 12+ tile types | луг/родючість/стежка/багнюка/вода/камінь/зарості/міст/грядка/двері |
| `farms.js` | ягоди/сад/розсадник, стадії, фізичний урожай, upgrades |
| `allies.js` | домівка, найм, садівник збирає→доставляє, команди work/home/follow/wait |
| CSS | `user-select: none` на UI; input/seed/selectable — текст OK |
| Гілка «Господарство» | ~10 вузлів + 2 forks з реальними effects |

Тести All passed. Без commit/push.

---

## 2026-10-26 — FOX SERPENT 1.1.0 (поживі, їжа, сад, графіка)

### Економіка

| Правило | Деталі |
|---------|--------|
| Пожива 0–9 | єдина витратна валюта; довжина = 3 + пожива (макс 12) |
| `economy.js` | `gainNutrition` / `spendNutrition` / sync body; без прихованого growthDebt-гаманця |
| Розширення | ціни ~3…9 поживи; підтвердження «після довжина X→Y» |
| Смерть / серце | без серця — пожива 0; серце зберігає поживу |
| Міграція v2 | старі cargo/materials → пожива; backup у SAVE_BAK |

### Їжа й світ

| Що | Навіщо |
|----|--------|
| `food-director.js` | місткість chunk, бутон→плід, 8–12 с, пауза зупиняє |
| Спрайти їжі (`draw.js`) | яблуко / ягоди / груша / насіння / золотий |
| 6+ регіонів + landmarks | сад, галявина, каміння, зарості, берег, коридори, elder; кущ, стежка, садовий вузол, vista… |

### Дерево й UI

| Що | Навіщо |
|----|--------|
| ~48 вузлів / 8 forks | control / explore / tactics з реальними effect→consumer |
| Сад розвитку | pan-схема, SVG-зв’язки, детальна панель, легенда |
| Гайд 7 сцен | економіка + витрата хвоста + цикл їжі; спільний draw |

Тести `logic-tests.html` — All passed. Без commit/push.

---

## 2026-10-26 — FOX SERPENT 1.0.1 (dir + гайд)

### Виправлено

| Дефект | Виправлення |
|--------|-------------|
| Після кроку `dir` повертався до стартового (`pendingDir`) | committed `dir` лише на успішному `commitSnakeMove(…, moveDir)`; окремий `requestedDir` / queue |
| W→A ігнорувався як «180»; W→S убивав у шию | перевірка шиї `wouldEnterNeck`; reverse без кроку/смерті/повороту малюнка |
| Два алгоритми вводу (input + fixedUpdate) | одна `consumePlayerStepIntent`; tap не дублюється з queue |
| Вороги `standing=true` → хвіст ніколи не звільнявся | `setStanding` на крок; vacate лише при реальному ході без росту |
| `e.repeat` на T/Tab/H/Space | ігнор OS-repeat для панелей |

### Додано

| Що | Навіщо |
|----|--------|
| `guide.js` — 6 анімованих карток | коротке навчання; меню / H / авто на першій новій грі |
| Тести W→A, reverse, dir migrate, guide pause | регресії головного бага |
| Load: `syncDirFromBody` | старі сейви з битим `dir` без скидання прогресу |

Траву з FIX-пакета **не інтегровано** (за запитом). Без commit/push у цій сесії фіксу — лише локальні зміни.

---

## 2026-10-26 — FOX SERPENT: EVOLUTION

### Додано

| Що | Навіщо |
|----|--------|
| **`sites/serpent-evolution/`** | нова клітинкова змійка: tap/hold/stop, серця, дерево A/B, chunks, AI |
| Картка Hub / `sites.json` | Playground → FOX SERPENT: EVOLUTION |
| `tests/logic-tests.html` | регресії руху, колізій, сердець, сейву |

Окрема гра від `snake/` і `fox-genesis/`. Запуск: Hub або `sites/serpent-evolution/index.html`.

---

## 2026-10-26 — FOX GENESIS 1.1 (якість гри)

### Виправлено

| Дефект | Виправлення |
|--------|-------------|
| DoT (кислота) убивав без дропу/нагород | єдиний `dealDamage`/`onDeath`, DoT з `bypassInvuln` |
| Здібності списували енергію при недостачі / regen без біомаси | префлайт вартості; miss-політика |
| HUD E ≠ фактична здібність | реєстр `ABILITY_DEFS` + `abilityBinds` (ПКМ/Q/E) |
| F під паузою; blur лишав інпути | причини паузи; очистка input; aim після камери |
| Пошкоджений primary блокував backup; `enemies:[]` ресідив світ | незалежні snapshots; порожній масив валідний |
| Landmarks ≠ biomeAt | єдина модель центрів біомів |
| Покоління без ціни / фейкові A/B | ціна, підтвердження, heritage/levels у `bodyStats` |

### Додано / покращено

- Лікування: відпочинок біля серця, **R** у полі, regen/камера; підказка біля HP
- «Наступний крок», шляхи Мисливець/Вартовий/Колонія, 6 особливих локацій
- Canvas-прев’ю тіла, карта Tab drag/zoom, видимі бар’єри, декор зі seed
- Союзники: ролі UA, збирач-цикл, підтримка лікує; архів/сховище; тунель hidden stub
- Події з геймплеєм (посуха, міграція, рідкісна здобич, рейд…); усі 5 босів
- Тести: `sites/fox-genesis/tests/logic-tests.html`

Запуск: Hub / `sites/fox-genesis/index.html`. Деталі — README гри.

---

## 2026-10-25 — FOX GENESIS

### Додано

| Що | Навіщо |
|----|--------|
| **`sites/fox-genesis/`** | локальна браузерна еволюційна сага: 5 біомів, 24+ органи, синергії, гніздо/колонія, союзники, події, сейви |
| Картка в `sites.json` + `hub/catalog.js` | Playground → FOX GENESIS |

Запуск: `sites` / Hub → FOX GENESIS, або `sites/fox-genesis/index.html`. Керування й можливості — `sites/fox-genesis/README.md`.

---

## 2026-10-25 — гайди під FOXSTYLE + дамп для стороннього чату

### Додано

| Що | Навіщо |
|----|--------|
| **`FoxTerminal/CHATGPT_PROJECT.md`** | один бриф: що це, як зібрати, шари, команди, Apply-цикл, правила — щоб скинути в ChatGPT / інший чат |
| FOXSTYLE / foxnodes / foxstt / notebook / default у системних гайдах | UA/EN, AGENTS, README, Windows MEGAGUIDE + VERIFY_ALL, Linux COMMANDS / MEGAGUIDE |
| `foxdocs` пункти FOXSTYLE + ChatGPT dump | список гайдів у терміналі бачить нові файли |

### Виправлено

- `sites/foxstyle/ARCHITECTURE.md` і `CLI.md` більше не кажуть, що native «наступний етап» — живий UI вже `foxstyle.exe`.

---

## Що зникло за весь час

| Коли | Що |
|------|----|
| 7 бер 2026 | Папка C# **FireFoxBot/** |
| 3 тра 2026 | Сайт **foxchat** (той самий день) |
| 26 чер 2026 | Експеримент **Foxsprite** (у репо не лишився) |
| 18 сер / 5 вер 2026 | **WezTerm**, **Windows Terminal**, bash `interface-ui.sh` / `sites-ui.sh` |
| 5–7 вер 2026 | Автологін з `current_user.txt`, `+new-window` на Ghostty, фіксований розмір вікна |

Що лишилось з нульового дня: папка `FireFoxBot` на диску, `ff` / `bbind`, FoxTerminalApp (Avalonia), ідея «свій термінал».

---

## Локальні сайти зараз

**Fox Deck:** Hub, FoxTerminal Showcase (з settings).
**Toolbox:** Fox Utils, UI Forge Guide, Кадр.
**Playground:** Serpent Fox, Sunstrike Lab, Boom Grid, Crystal Roll, Item Oracle, Key Rush, Fox Stack, Fox Word, DnD Hero Forge, Fox Realm Forge.
**Sandbox:** Fox Den (OnePageStore).

---

## Коміти git

```
3ba0515  2026-03-07 14:44  FoxTerminal
4354098  2026-06-06 22:42  changes
6a00adf  2026-07-26 23:40  Zen Companion, showcase, ecosystem
5fa2636  2026-07-26 23:56  assets, skills, zen installer
0006745  2026-07-27 00:04  Zen installer + addon dist → Git LFS
fc5a60a  2026-09-05 23:00  FoxOS + Ghostty look on the site
```

Між комітами робота жила тільки в чатах і на диску.

---

## Як дописувати

Новий день — заголовок `## РРРР-ММ-ДД`. Блоки **Додано** / **Забрано** / **Виправлено**. Конкретні імена команд і папок, не «покращення».

Читати в терміналі: `changelog`.
