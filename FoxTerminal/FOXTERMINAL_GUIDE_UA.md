# FoxTerminal: Повний практичний гайд

Це великий документальний гайд по всьому FoxTerminal: від встановлення і першого запуску до щоденних сценаріїв, темізації, діагностики, роботи з нотатками, AI-командами, гарячими клавішами, збірками та пакуванням.

Документ орієнтований на реальне використання в Windows-середовищі, з акцентом на PowerShell/CMD запуск, Firefox-інтеграцію, локальні сайти, медіа-сценарії та інструменти персоналізації.

---

## 1) Що таке FoxTerminal

FoxTerminal — це набір скриптів, профілів та утиліт для персоналізованого терміналу з фокусом на:

- швидкий доступ до веб/медіа (YouTube, YouTube Music, Spotify, Telegram, пошук);
- системні інструменти (мережа, диски, час, IP, діагностика);
- локальні нотатки з багаторівневою структурою;
- AI-команди для одноразових запитів і діалогового режиму;
- теми/візуальні режими (включно з noir/pride/arthas/dnote/spider);
- керування вікнами, хоткеями та оточенням запуску;
- знімки конфігурації (`build`) і пакування (`foxpack`) для передачі іншому користувачу.

---

## 2) Швидкий старт (10 кроків)

1. Відкрий PowerShell у корені проєкту.
2. Переконайся, що команда залежностей працює:
   - `foxdeps -Check`
3. Якщо чогось не вистачає:
   - `foxdeps -Install`
4. Подивись повну довідку:
   - `foxhelp`
5. Зареєструй користувача:
   - `nuser myname mypass`
6. Увійди:
   - `l myname mypass`
7. Перевір, хто активний:
   - `who`
8. Створи першу нотатку:
   - `nfile hello.txt`
   - `edit hello.txt`
9. Протестуй медіа-команду:
   - `yt lofi hip hop`
10. Збережи стан у збірку:
   - `build first-day`

---

## 3) Архітектура команд і де що лежить

Основна папка команд:

- `cmd/` — головні користувацькі команди (`.ps1`, `.bat`, `.cmd`);
- `sites/` — локальні міні-сайти та реєстр сайтів;
- `FoxTerminal/` — компоненти встановлення/інтеграції/теми;
- `builds/` — снапшоти конфігурації і службові інсталятори.

Важливо:

- Команди часто мають `.ps1` і `.bat` обгортки з однаковими іменами.
- Частина скриптів — службові (внутрішні) і не призначені для прямого запуску вручну.
- Головний вхід у довідку: `foxhelp`.

---

## 4) Повний каталог команд (по категоріях)

Нижче — структурований перелік робочих користувацьких команд із синтаксисом і прикладами.

### 4.1 Користувачі та авторизація

#### `l`
- Призначення: логін (або реєстрація, якщо користувач новий).
- Синтаксис: `l <name> <pass>`
- Приклади:
  - `l dmytr qwerty123`

#### `nuser`
- Призначення: створення нового користувача.
- Синтаксис: `nuser <name> <pass>`
- Приклади:
  - `nuser fox admin123`

#### `passwd`
- Призначення: зміна пароля (коли користувач залогінений).
- Синтаксис: `passwd`
- Приклади:
  - `passwd`

#### `users`
- Призначення: показати зареєстрованих користувачів.
- Синтаксис: `users`

#### `who`
- Призначення: показати поточного активного користувача.
- Синтаксис: `who`

#### `uexit`
- Призначення: вийти з акаунту (logout).
- Синтаксис: `uexit`

---

### 4.2 AI-команди

#### `ask`
- Призначення: одноразовий запит до AI (Ollama).
- Синтаксис: `ask "..." [--image <path>]`
- Приклади:
  - `ask "Поясни цей скрипт"`
  - `ask "Що на зображенні?" --image C:\img\photo.png`

#### `friend`
- Призначення: інтерактивний чат-режим.
- Синтаксис: `friend`
- Корисно в чаті:
  - `/help`, `/clear`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`

#### `sum`
- Призначення: стислий підсумок вмісту файлу через OpenAI.
- Синтаксис: `sum <file>`
- Приклад:
  - `sum .\cmd\foxdeps.ps1`

---

### 4.3 Медіа та контент

#### `yt`
- Призначення: пошук YouTube у Firefox.
- Синтаксис: `yt <query>`
- Приклад:
  - `yt cyberpunk ambient`

#### `ytm`
- Призначення: YouTube Music (відкрити, шукати, працювати через alias/url).
- Синтаксис: `ytm [query|alias|url]`
- Приклади:
  - `ytm`
  - `ytm synthwave`

#### `ytm-ui`
- Призначення: TUI-режим управління YouTube Music + DJ-візуалізація.
- Синтаксис: `ytm-ui`

#### `ytsplit`
- Призначення: розкладка вікон YouTube/YTM в split-режим.
- Синтаксис: `ytsplit [-ReportOnly]`
- Приклад:
  - `ytsplit`

#### `sp`
- Призначення: Spotify (відкрити або шукати).
- Синтаксис: `sp [query|url]`
- Приклад:
  - `sp dark ambient`

#### `sp-ui`
- Призначення: Spotify DJ UI (Play/Next/Prev тощо).
- Синтаксис: `sp-ui`

#### `dj`
- Призначення: візуалізатор аудіо-рівня.
- Синтаксис: `dj`

#### `youtube`
- Призначення: швидко відкрити YouTube у Firefox.
- Синтаксис: `youtube`

---

### 4.4 Веб, Firefox, alias-менеджмент

#### `ff`
- Призначення: відкривати URL/alias у Firefox.
- Синтаксис: `ff open [alias-or-url]`
- Приклади:
  - `ff open youtube`
  - `ff open https://developer.mozilla.org`

#### `sites`
- Призначення: каталог локальних сайтів, scaffold/відкриття папки сайту.
- Синтаксис: `sites [-createn <name>] [-open <name>]`
- Приклади:
  - `sites`
  - `sites -createn fox-lab`
  - `sites -open fox-lab`

#### `bbind`
- Призначення: створити custom-команду `.bat` або alias сайту для `ff`.
- Синтаксис: `bbind`

#### `blist`
- Призначення: список alias-ів сайтів.
- Синтаксис: `blist`

#### `bdel`
- Призначення: видалити alias сайту.
- Синтаксис: `bdel <alias>`
- Приклад:
  - `bdel docs`

#### `gask`
- Призначення: відкрити ChatGPT у Firefox з передзаповненим запитом.
- Синтаксис: `gask <question>`
- Приклад:
  - `gask як оптимізувати powershell скрипт`

#### `ser`
- Призначення: швидкий Google-пошук у Firefox.
- Синтаксис: `ser <terms>`
- Приклад:
  - `ser powershell compare object examples`

#### `ffbot`
- Призначення: .NET watcher, що працює з відкриттям URL при подіях вікна Firefox.
- Синтаксис: `ffbot`

#### Персональний Firefox аддон (`FoxTerminal Companion`)
- Призначення: швидкий popup у Firefox, який запускає web-команди FoxTerminal через Native Messaging.
- Запуск бічного терміналу з адресного рядка:
  - введи `ff`, натисни Space, потім Enter -> відкриється sidebar-термінал
  - введи `ff`, натисни Space, потім `history -clear` -> очистка історії Firefox
- Режим спільної сесії (синхрон sidebar <-> термінал):
  - виконай `ffsync start`
  - запусти `ffsync shell`
  - після цього відкрий sidebar через `ff` + Space + Enter
- Розташування: `FoxTerminal/firefox-addon/`
- Встановити native host:
  - `powershell -ExecutionPolicy Bypass -File .\FoxTerminal\firefox-addon\native-host\install-host.ps1`
- Підключити аддон тимчасово у Firefox:
  - `about:debugging#/runtime/this-firefox`
  - Обрати `FoxTerminal/firefox-addon/manifest.json`

---

### 4.5 Telegram

#### `tg`
- Призначення: відкрити Telegram Web або перейти до користувача/URL.
- Синтаксис: `tg [alias|@username|url|tg://...]`
- Приклади:
  - `tg`
  - `tg @foxhelper`

#### `tgub`
- Призначення: створення Telegram-аліасів за юзернеймом/телефоном.
- Синтаксис:
  - `tgub <@user|user|url> <alias>`
  - `tgub phone <num> <alias>`
- Приклади:
  - `tgub @myfriend mf`
  - `tgub phone +380XXXXXXXXX myphone`

#### `tglist`
- Призначення: показ/редагування Telegram alias-баз.
- Синтаксис: `tglist`

---

### 4.6 Нотатки, файли, текст

#### `wai`
- Призначення: де ти зараз у notes-дереві + список файлів.
- Синтаксис: `wai`

#### `go`
- Призначення: перейти в підпапку notes.
- Синтаксис: `go <path>`
- Приклад:
  - `go files/important`

#### `up`
- Призначення: на рівень вище в notes.
- Синтаксис: `up`

#### `nfile`
- Призначення: створити файл у поточній папці notes.
- Синтаксис: `nfile <name.ext>`
- Приклад:
  - `nfile plan.md`

#### `nfould`
- Призначення: створити папку в поточній позиції notes.
- Синтаксис: `nfould <name>`

#### `fdel`
- Призначення: видалити файл у notes (з перевіркою).
- Синтаксис: `fdel <name.ext>`

#### `edit`
- Призначення: редагування файлів у терміналі.
- Синтаксис: `edit <path-or-name>`
- Приклад:
  - `edit todo.txt`
  - `edit C:\temp\notes.md`

#### `nano`
- Призначення: Linux-style редагування (micro/nano/vim, з fallback).
- Синтаксис: `nano <file>`

#### `view`
- Призначення: read-only перегляд файлу у pager-режимі.
- Синтаксис: `view <file>`

#### `hash`
- Призначення: хешування рядка.
- Синтаксис: `hash [fx1|md5|sha1|sha256|ntlm|b64] <text>`
- Приклад:
  - `hash sha256 mySecret`

#### `unhash`
- Призначення: спроба відновлення хешу (офлайн/правила/брутфорс сценарії).
- Синтаксис: `unhash [-offline] [hash]`
- Приклад:
  - `unhash -offline 5f4dcc3b5aa765d61d8327deb882cf99`

---

### 4.7 Теми, режими, візуальні профілі

#### `sw`
- Призначення: системний info-екран + перемикач тем.
- Синтаксис: `sw [themeName] [live] [color|mono] [imagePath]`
- Приклади:
  - `sw`
  - `sw slate`

#### `themes`
- Призначення: головний пікер тем (стрілки + Enter).
- Синтаксис: `themes`

#### `noir`
- Призначення: toggle noir-режиму (ч/б стиль).
- Синтаксис: `noir`

#### `dnote`
- Призначення: Death Note-режим із особливими стилями/ефектами.
- Синтаксис: `dnote`

#### `apple`
- Призначення: ASCII-сцена Death Note у fullscreen-стилі.
- Синтаксис: `apple [imagePath]`

#### `pride`
- Призначення: toggle pride-режиму (кілька прапорних стилів).
- Синтаксис: `pride`

#### `arthas`
- Призначення: toggle Arthas mode з панеллю/перемиканнями.
- Синтаксис: `arthas`

#### `spider`
- Призначення: Spider-Noir панель (працює в контексті noir-стилізації).
- Синтаксис: `spider`

#### `frederik`
- Призначення: голосова/аудіо-reactive візуалізація.
- Синтаксис:
  - `frederik [-ListMics] [-Source Auto|Mic|System] [-Mic <idx|name>] [-SetMainMic] [-Bars <n>] [-Height <n>]`

---

### 4.8 Система, мережа, діагностика

#### `wifi`
- Призначення: статус Wi-Fi (SSID/сигнал/канал).
- Синтаксис: `wifi`

#### `reconnect`
- Призначення: перепідключення до Wi-Fi.
- Синтаксис: `reconnect [ssid]`

#### `ip`
- Призначення: публічний і локальні IP.
- Синтаксис: `ip`

#### `weather`
- Призначення: погода через wttr.in.
- Синтаксис: `weather [location]`
- Приклад:
  - `weather Kyiv`

#### `netping`
- Призначення: ping перевірки стандартних або кастомних цілей.
- Синтаксис: `netping [targets...]`
- Приклад:
  - `netping 8.8.8.8 1.1.1.1 github.com`

#### `disk`
- Призначення: використання дисків.
- Синтаксис: `disk`

#### `ftime`
- Призначення: поточні дата/час.
- Синтаксис: `ftime`

#### `fday`
- Призначення: daily summary (час + погода + wifi + ip).
- Синтаксис: `fday [location]`

#### `chek`
- Призначення: визначення backend-середовища терміналу.
- Синтаксис: `chek`

#### `sixel`
- Призначення: перевірка готовності SIXEL у mintty.
- Синтаксис: `sixel`

#### `foxscan`
- Призначення: евристичний пошук підозрілих скриптів.
- Синтаксис: `foxscan [-Deep] [-IncludeLow] [-IncludeWorkspace] [-Top <n>] [-Path <dir1,dir2,...>]`
- Приклад:
  - `foxscan -Deep -Top 30`

#### `foxbg`
- Призначення: інтерактивне керування фоновими процесами.
- Синтаксис: `foxbg [-IncludeLow] [-Top <n>] [-MinMemoryMB <n>]`

#### `clear`
- Призначення: очистити екран.
- Синтаксис: `clear`

#### `texit`
- Призначення: force-exit поточного процесу терміналу.
- Синтаксис: `texit`

---

### 4.9 Інтерфейс, backend, layout

#### `interface-deps`
- Призначення: встановлення/перевірка пакетів для interface-режиму.
- Синтаксис: `interface-deps [-Install|-Check]`

#### `interface`
- Призначення: запуск split-інтерфейсу (tmux/mintty/gui режими).
- Синтаксис: `interface [-TwoWindows] [-Terminal] [-Gui]`
- Приклади:
  - `interface`
  - `interface -TwoWindows`
  - `interface -Gui`

#### `term`
- Призначення: вибір/перемикання backend (auto/windows/mintty/cygwin).
- Синтаксис: `term [-Set auto|windows|mintty|cygwin] [-Now] [-App mintty]`
- Приклад:
  - `term -Set mintty -Now`

#### `apps`
- Призначення: розкладка до 4 вікон застосунків.
- Синтаксис: `apps <app1> / <app2> [/ <app3> [/ <app4>]]`
- Приклад:
  - `apps firefox / spotify / telegram`

#### `appbind`
- Призначення: прив’язка alias до exe/аргументів/матчингу заголовка.
- Синтаксис: `appbind [add|del|list] ...`

---

### 4.10 Хоткеї та керування прив’язками

#### `foxhotkeys`
- Призначення: глобальний daemon гарячих клавіш.
- Синтаксис: `foxhotkeys [-Stop] [-Restart] [-Status]`

#### `foxinfo`
- Призначення: менеджер гарячих клавіш і FoxTerminal-шляху.
- Синтаксис: `foxinfo`

---

### 4.11 Знімки, reset, пакування

#### `build`
- Призначення: створення/список/відновлення/видалення снапшотів конфігурації.
- Синтаксис: `build <name> | -list | -restore <name> | -delete <name>`
- Приклади:
  - `build mysetup`
  - `build -list`
  - `build -restore mysetup`

#### `foxpack`
- Призначення: запакувати FoxTerminal у zip для передачі.
- Синтаксис: `foxpack [-Full] [-Open] [-OutPath <path>]`
- Режими:
  - стандартний: clean-збірка (без персональних даних);
  - `-Full`: включає поточні binds/notes/theme (але `users.json` чиститься для безпеки).
- Приклади:
  - `foxpack`
  - `foxpack -Full -Open`
  - `foxpack -OutPath C:\Exports`

#### `foxreset`
- Призначення: жорсткий reset кешів/ініціалізації оточення.
- Синтаксис: `foxreset [-Git] [-NoGit]`

#### `foxdeps`
- Призначення: перевірка/автоінсталяція залежностей FoxTerminal.
- Синтаксис: `foxdeps [-Check] [-Install]`

#### `foxhelp`
- Призначення: інтерактивне меню довідки.
- Синтаксис: `foxhelp`

---

## 5) Реальні сценарії використання (покроково)

### Сценарій A: “Робочий ранок”

1. `who` — перевірити активного користувача.
2. `fday Kyiv` — короткий технічний ранковий дайджест.
3. `sites` — відкрити локальні інструменти.
4. `ytm lofi coding` — запустити фон.
5. `wai` — перевірити папку нотаток.
6. `nfile standup.md`
7. `edit standup.md` — швидко заповнити план дня.

### Сценарій B: “Швидка підготовка демо”

1. `themes` — вибрати візуальний стиль.
2. `apps firefox / telegram / spotify` — розкласти вікна.
3. `sp-ui` або `ytm-ui` — керувати аудіо без миші.
4. `ser demo checklist` — швидкий пошук.
5. `build demo-ready` — зафіксувати стан перед показом.

### Сценарій C: “Передача оточення колезі”

1. `build transfer-base` — знімок поточного стану.
2. `foxpack` — clean zip без персональних даних.
3. (за потреби) `foxpack -Full` — включити твої notes/binds/theme.
4. Передати zip, колега запускає `install.ps1`.

### Сценарій D: “Мережева перевірка”

1. `wifi`
2. `ip`
3. `netping 8.8.8.8 1.1.1.1 github.com`
4. Якщо мережа нестабільна: `reconnect`
5. Повторити `netping`.

---

## 6) Робота з `sites` та локальними веб-додатками

`sites` керує локальними mini-apps. Це зручно для:

- типінг-тренажерів;
- персональних web-дашбордів;
- локальних утиліт без підняття бекенду.

Базовий потік:

1. Створення: `sites -createn my-tool`
2. Відкриття папки: `sites -open my-tool`
3. Наповнення `index.html`, `assets/css`, `assets/js`
4. Повернення в список: `sites`

Порада: тримай назви сайтів короткими та читабельними, а структуру однаковою (`index.html`, `assets/css/style.css`, `assets/js/main.js`) — це полегшує підтримку.

---

## 7) Тема, стиль, mood-профілі

FoxTerminal підтримує швидку зміну “настрою” інтерфейсу:

- нейтральний/робочий режим (`themes`, `sw`);
- темний кінематографічний (`noir`, `spider`);
- стилізований тематичний (`dnote`, `apple`);
- палітра-режими (`pride`, `arthas`).

Рекомендована практика:

- для щоденної роботи: спокійні теми;
- для стріму/демо: контрастні стилі;
- перед пакуванням `foxpack -Full`: перевір, чи хочеш передавати поточну тему.

---

## 8) Безпека та hygiene

1. Не клади секрети в `notes` у відкритому вигляді.
2. Не передавай `-Full` пакети без перевірки вмісту.
3. Регулярно використовуй `build` перед великими змінами.
4. Для підозрілих скриптів запускай `foxscan -Deep`.
5. Якщо є дивна активність процесів — `foxbg`.
6. Паролі міняй через `passwd`.

---

## 9) Troubleshooting: часті проблеми

### Проблема: команда не знайдена
- Перевір, чи `cmd` шлях у `PATH`.
- Використай повний запуск:
  - `powershell -ExecutionPolicy Bypass -File .\cmd\foxhelp.ps1`

### Проблема: AI-команди не відповідають
- Перевір Ollama:
  - `ollama serve`
  - `ollama pull qwen3-vl`
- Перевір змінні оточення (якщо налаштовані кастомно).

### Проблема: `interface` не стартує
- `interface-deps -Check`
- Якщо немає `tmux`, спробуй:
  - `interface -TwoWindows`
  - або `interface -Gui`

### Проблема: Firefox-інтеграція працює некоректно
- Перевір `ff open youtube`.
- Перевір alias-таблиці:
  - `blist`
- За потреби перествори binding через `bbind`.

### Проблема: зіп з `foxpack` “не той”
- За замовчуванням це clean-пак.
- Для передачі персонального стану потрібен `-Full`.

---

## 10) Практика “чистого” робочого процесу

### Базовий цикл щоденної роботи

1. Логін: `l <name> <pass>`
2. Статус: `who`, `fday`
3. Робота: `sites`, `ytm`, `notes` команди
4. Перевірки: `wifi`, `ip`, `netping` за потреби
5. Кінець сесії:
   - `build daily-YYYYMMDD`
   - `uexit` (якщо потрібно)

### Цикл змін конфігурації

1. `build before-theme-change`
2. Зміни через `themes` / `sw` / інші режими
3. Тест команди `foxhelp`
4. Якщо все ок — `build after-theme-change`
5. Якщо щось зламалося — `build -restore before-theme-change`

---

## 11) Шпаргалка команд (коротко)

### Авторизація
- `nuser`, `l`, `who`, `users`, `passwd`, `uexit`

### AI
- `ask`, `friend`, `sum`

### Медіа
- `yt`, `ytm`, `ytm-ui`, `ytsplit`, `sp`, `sp-ui`, `dj`, `youtube`

### Веб/alias
- `ff`, `sites`, `bbind`, `blist`, `bdel`, `gask`, `ser`, `ffbot`

### Telegram
- `tg`, `tgub`, `tglist`

### Нотатки
- `wai`, `go`, `up`, `nfile`, `nfould`, `fdel`, `edit`, `nano`, `view`

### Хеші
- `hash`, `unhash`

### Система/мережа
- `wifi`, `reconnect`, `ip`, `weather`, `netping`, `disk`, `ftime`, `fday`, `chek`, `sixel`

### Інтерфейс/термінал
- `term`, `interface`, `interface-deps`, `apps`, `appbind`, `clear`, `texit`

### Теми
- `sw`, `themes`, `noir`, `dnote`, `apple`, `pride`, `arthas`, `spider`, `frederik`

### Сервісні
- `foxscan`, `foxbg`, `foxdeps`, `foxreset`, `foxhelp`, `build`, `foxpack`, `foxhotkeys`, `foxinfo`

---

## 12) Приклади готових командних наборів

### Набір “Focus coding”

```powershell
themes
ytm focus electronic
wai
nfile sprint.md
edit sprint.md
```

### Набір “Network debug”

```powershell
wifi
ip
netping 1.1.1.1 8.8.8.8 github.com
reconnect
netping github.com
```

### Набір “Content + messenger”

```powershell
ytm chillwave
tg @teamlead
sp-ui
```

### Набір “Backup + share”

```powershell
build before-share
foxpack
foxpack -Full -OutPath C:\Exports -Open
```

---

## 13) Рекомендований стандарт іменування

Щоб не плутатись у нотатках та збірках:

- файли: `kebab-case` або `snake_case`;
- збірки: `YYYYMMDD-purpose`;
- папки нотаток: короткі, без зайвих пробілів;
- alias-и: мінімум символів, але зрозумілі (`gh`, `yt`, `docs`, `teamtg`).

---

## 14) Поради по продуктивності

1. Звичка починати з `fday` економить час на діагностиці контексту.
2. `apps` + `appbind` дають швидкий “рабочий layout” за один виклик.
3. `build` перед експериментами рятує від втрати конфігурації.
4. `friend` краще для сесій, `ask` краще для точкових запитів.
5. `foxpack` корисний не тільки для передачі, а й як знімок розгортання.

---

## 15) Підсумок

FoxTerminal — це не просто набір alias-ів, а цілісне shell-оточення:

- авторизація + персональні дані;
- файлово-нотатковий контур;
- браузерно-медійний контур;
- AI-контур;
- візуальні режими;
- системна діагностика;
- інструменти пакування і відновлення.

Якщо хочеш максимально стабільний flow:

1. починай день з `fday`;
2. працюй через `sites` + `notes`;
3. зберігай стани через `build`;
4. перед передачею середовища — `foxpack`.

Цього достатньо, щоб вести щоденну роботу в одному узгодженому середовищі без хаотичного перемикання між десятком окремих утиліт.

