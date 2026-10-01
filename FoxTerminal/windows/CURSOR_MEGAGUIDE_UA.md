# CURSOR MEGAGUIDE — інший ПК (Windows)

> **Головний файл для Cursor на другому Windows-комп’ютері.**  
> Відкрий репо → новий Agent-чат → напиши:

```
Прочитай повністю FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md
і працюй за ним. Відповідай українською.
Спочатку зніми залізо й усі монітори (розділ 10), потім піджени FoxOS/Ghostty під них.
Обов’язково: прожени КОЖНУ команду (розділ 23 / VERIFY_ALL.md)
і перевір усю оболонку Windows — Alt+Tab, таскбар, Win-меню, lock, dock.
```

Репо: `https://github.com/ShewchukV4/FoxTerminal` · дзеркало `shew4uk/FoxTerminal`.

Суміжні файли:

- `AGENTS.md` — коротка пам’ять Windows-паку  
- `HARDWARE_SCREEN.md` — швидка таблиця DPI / моніторів / GPU  
- **`VERIFY_ALL.md`** — прогін кожної команди + Alt+Tab / таскбар  
- `../FOXTERMINAL_GUIDE_UA.md` — повний системний гайд  
- `../linux/CURSOR_MEGAGUIDE_UA.md` — якщо раптом Linux  
- `../../CHANGELOG.md` · `../../AGENTS.md`

---

## Зміст

0. [Інструкція для агента Cursor](#0-інструкція-для-агента-cursor)
1. [Мета переносу](#1-мета-переносу)
2. [Що таке FoxTerminal](#2-що-таке-foxterminal)
3. [Карта репо](#3-карта-репо)
4. [Git і клон на новий Windows](#4-git-і-клон-на-новий-windows)
5. [Повний чекліст переносу (покроково)](#5-повний-чекліст-переносу-покроково)
6. [Встановлення залежностей](#6-встановлення-залежностей)
7. [Шари системи і команди](#7-шари-системи-і-команди)
8. [FoxOS + foxlook (повний стіл)](#8-foxos--foxlook-повний-стіл)
9. [Ghostty: конфіг і клавіші](#9-ghostty-конфіг-і-клавіші)
10. [★ Залізо: зняти комплектуючі](#10--залізо-зняти-комплектуючі)
11. [★ Екрани: роздільність, DPI, розширення, кілька моніторів](#11--екрани-роздільність-dpi-розширення-кілька-моніторів)
12. [Підстройка Fox під профіль заліза](#12-підстройка-fox-під-профіль-заліза)
13. [Профілі foxlook export/import](#13-профілі-foxlook-exportimport)
14. [AI, media, sites, companion](#14-ai-media-sites-companion)
15. [Оптимізація Windows під Fox](#15-оптимізація-windows-під-fox)
16. [Безпека foxlook shell](#16-безпека-foxlook-shell)
17. [Сценарії після переносу](#17-сценарії-після-переносу)
18. [Правила змін коду](#18-правила-змін-коду)
19. [Troubleshooting](#19-troubleshooting)
20. [Пам’ять розмов](#20-память-розмов)
21. [Готові промпти](#21-готові-промпти)
22. [Шпаргалка одним екраном](#22-шпаргалка-одним-екраном)
23. [★ Повна перевірка: кожна команда + Alt+Tab / таскбар](#23--повна-перевірка-кожна-команда--alttab--таскбар)

---

## 0) Інструкція для агента Cursor

Ти на **Windows** у репо FoxTerminal (інший ПК користувача).

**Завжди:**

1. Відповідай **українською**.  
2. Спочатку цей MEGAGUIDE, потім код.  
3. **Першим ділом** після старту: зніми залізо й монітори (§10–11) і коротко покажи профіль (Low / Mid / High / Ultra).  
4. Підганяй `font-size`, opacity/blur, `foxlook dock size`, cursor scale, `quick-terminal-size` під **реальні** DPI і кількість екранів.  
5. Не вмикай `foxlook shell on` без явного «так» + нагадування rescue.  
6. Не коміть/не пуш без прохання.  
7. Не клади секрети в репо.  
8. Після правок `ghostty/config` — нагадай `ctrl+shift+,`.  
9. На новому ПК шляхи інші — завжди через `%USERPROFILE%` / репо-корінь, не копіюй чужі `C:\Users\...` наосліп.  
10. Агент **зобов’язаний** після підгонки прогнати перевірку **кожной команди** і **оболонки Windows** (Alt+Tab, таскбар, Win-меню, dock) — див. §23 і [`VERIFY_ALL.md`](VERIFY_ALL.md). Без звіту PASS/FAIL перенос не вважається завершеним.

**Перший хід у новому чаті:**

```text
1) Підтверди: прочитав windows/CURSOR_MEGAGUIDE_UA.md
2) Зніми CPU/GPU/RAM/диски + усі display (розділ 10–11)
3) Запропонуй профіль Low/Mid/High/Ultra і конкретні значення Fox/Ghostty
4) Після підгонки — повний прогін §23 / VERIFY_ALL.md (команди + Alt+Tab/таскбар)
5) Видай підсумкову таблицю PASS/FAIL
```

---

## 1) Мета переносу

Перенести на новий Windows-ПК:

| Що | Як |
|----|-----|
| Код / команди | `git clone` ShewchukV4 (або shew4uk) |
| Термінал | winghostty + `FoxTerminal\install.ps1` |
| Стіл FoxOS | `foxos on` + `foxlook on` (+ export профіль) |
| Юзер Fox | `foxsetup` / `nuser` + `l` |
| Hotkeys | `foxhotkeys` (AHK) |
| AI | Ollama + qwen3-vl |
| Companion | `foxaddon` / `foxzen` за потреби |
| Пам’ять агента | цей MEGAGUIDE у git (чати Cursor **не** синхроняться) |

**Не переноситься само:** локальні Cursor-чати, Windows Credential Manager токени, особисті notes якщо не в `-Full` pack.

Альтернатива git: `foxpack -Full` з старої машини → розпакувати → `install.ps1`.

---

## 2) Що таке FoxTerminal

Екосистема навколо **Ghostty** (на Windows = [winghostty](https://github.com/amanthanvi/winghostty)):

```
Windows desktop (foxlook)
  └── FoxOS wallpaper (foxos rain + desk prompt)
        └── Ghostty + PowerShell + Oh My Posh
              └── cmd/ (85+ команд)
                    home / lock / settings / media / AI / sites / foxlife
```

Повний каталог і сценарії: `FoxTerminal/FOXTERMINAL_GUIDE_UA.md`.

---

## 3) Карта репо

```
FoxTerminal/   (корінь після clone)
├── AGENTS.md
├── CHANGELOG.md
├── cmd/                 ← команди
├── sites/               ← локальні сайти
├── builds/              ← знімки build
└── FoxTerminal/
    ├── install.ps1
    ├── ghostty/config + shaders/
    ├── firefox-addon/ · zen/
    ├── FOXTERMINAL_GUIDE_UA.md
    ├── windows/         ← ★ ТИ ТУТ
    │   ├── CURSOR_MEGAGUIDE_UA.md
    │   ├── HARDWARE_SCREEN.md
    │   ├── AGENTS.md
    │   └── README.md
    └── linux/           ← для Kali
```

---

## 4) Git і клон на новий Windows

```powershell
winget install Git.Git
# перезапусти термінал
cd $env:USERPROFILE\Desktop
# якщо стара порожня папка:
Remove-Item -Recurse -Force .\FoxTerminal -ErrorAction SilentlyContinue
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
```

Акаунти: **ShewchukV4** (інший ПК) · **shew4uk** (основна розробка, collaborator).  
Якщо просить пароль → **PAT**: https://github.com/settings/tokens  

```powershell
git pull
git status -sb
git remote -v
```

---

## 5) Повний чекліст переносу (покроково)

### Фаза A — код і термінал

- [ ] Clone репо  
- [ ] `winget install AmanThanvi.winghostty`  
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1`  
- [ ] Відкрити Ghostty з ярлика → `chek` → `term -Doctor`  
- [ ] `foxdeps -Install`  

### Фаза B — зняти залізо й екрани

- [ ] Запустити блок з §10 (CPU/GPU/RAM)  
- [ ] Запустити блок з §11 (усі монітори, DPI, primary)  
- [ ] Обрати профіль Low/Mid/High/Ultra (§12)  

### Фаза C — Fox-юзер і стіл

- [ ] `foxsetup` **або** `nuser` + `l`  
- [ ] Підігнати Ghostty `font-size` / opacity / blur / quick-terminal (§12)  
- [ ] `foxos on`  
- [ ] `foxlook on`  
- [ ] `foxlook cursor fox <1|2|3>` під DPI  
- [ ] `foxlook dock size …` під роздільність  
- [ ] `foxlook export` → зберегти профіль на Desktop  

### Фаза D — сервіси

- [ ] `foxhotkeys -Restart`  
- [ ] Ollama + `ollama pull qwen3-vl` (якщо AI)  
- [ ] `settings -Status` / `home`  
- [ ] Опційно: `DisableBloat` / `DisableAds` від адміна  
- [ ] Cursor: Open Folder на корінь репо + промпт з шапки  

### Фаза E — перевірка (обов’язково)

- [ ] `foxtest -List` → зрозуміти план  
- [ ] `foxtest -Group info` → усі info-команди  
- [ ] За [`VERIFY_ALL.md`](VERIFY_ALL.md): **кожна** команда вручну або через foxtest + ручні TUI  
- [ ] Оболонка Windows: **Alt+Tab**, **таскбар**, Win-меню, Win+L/Fox lock, dock, desk prompt  
- [ ] Підсумкова таблиця PASS/FAIL у чаті юзеру  

---

## 6) Встановлення залежностей

```powershell
winget install AmanThanvi.winghostty
winget install Git.Git
winget install Mozilla.Firefox
# Nerd Font — через foxdeps або вручну CaskaydiaCove Nerd Font
winget install JanDeDobbeleer.OhMyPosh
# AutoHotkey v2 для foxhotkeys
winget install AutoHotkey.AutoHotkey
# .NET (foxlife / частина тулів)
winget install Microsoft.DotNet.SDK.9
# Ollama
winget install Ollama.Ollama
```

Або одним махом після clone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\cmd\foxdeps.ps1 -Install
```

Install Fox config:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
# -NoShortcut / -NoLogonStart / -Force за потреби
```

---

## 7) Шари системи і команди

| Шар | Команди | На новому Windows |
|-----|---------|-------------------|
| Термінал | `term`, `chek`, `shader` | ✅ обов’язково |
| Теми | `sw`, `themes`, `noir`, … | ✅ |
| FoxOS | `foxos on/off/apply` | ✅ |
| Look | `foxlook …` | ✅ серце переносу стільця |
| Shell UX | `home`, `lock`, `settings`, `foxsetup` | ✅ |
| AI | `ask`, `friend` | ✅ + Ollama |
| Media | `yt`, `ytm`, `sp`, … | ✅ + Firefox |
| Life | `foxlife` | ✅ + .NET |
| Pack | `build`, `foxpack`, `changelog` | ✅ |

Довідка в терміналі: **`foxhelp`**.  
Повний каталог: `FOXTERMINAL_GUIDE_UA.md` §7 / `foxhelp.ps1` known[].

Короткі критичні:

```powershell
foxsetup
l myname mypass
home
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style glass
foxlook dock size normal
settings -Status
foxhotkeys -Restart
build after-migrate
foxlook export
```

---

## 8) FoxOS + foxlook (повний стіл)

### foxos

```powershell
foxos                 # статус
foxos on              # rain + accent з теми
foxos off             # відновити шпалери
foxos apply           # перемалювати після sw
```

Desk prompt під лисицею: кліки на кшталт `sw slate`, `ytm`, `help`, `home`.

### foxlook

```powershell
foxlook on
foxlook status
foxlook off           # повний rollback зі snapshot
```

Частини: `dark` `icons` `taskbar` `sounds` `cursors` `lockscreen` `winkeys` `oem` `winlock` `shell`.

```powershell
foxlook wall overlay  # desk prompt працює (default)
foxlook wall behind   # під іконками; Win+D safe
foxlook cursor fox 2  # scale 1|2|3 — див. §11
foxlook dock style pill|rail|glass|slim
foxlook dock place bottom|top
foxlook dock size compact|normal|large
foxlook dock hide on
foxlook dock apps titles|dots|off
foxlook dock tray clock|full|off
```

---

## 9) Ghostty: конфіг і клавіші

Джерело: `FoxTerminal\ghostty\config` → `%LOCALAPPDATA%\winghostty\` (або шлях з `term -Path`).

| Фішка | Клавіші |
|-------|---------|
| Quick terminal (в вікні) | `ctrl+shift+`` ` |
| Show/hide (AHK) | `Shift+Alt+T` / `Shift+Ctrl+Alt+T` |
| Lock Fox | `Shift+Alt+L` |
| Splits | `ctrl+shift+enter` / `j` / `l` |
| Zoom / equalize | `ctrl+shift+z` / `e` |
| Reload config | `ctrl+shift+,` |
| Palette | `ctrl+shift+p` |

Глобальний `ctrl+backquote` на Windows дає переважно **foxhotkeys**, не Ghostty.

Палітра FoxNight: `#0B0F1A` / `#E6E6E6` / `#DC7A14`.

---

## 10) ★ Залізо: зняти комплектуючі

Агент **зобов’язаний** прогнати (або попросити юзера вставити вивід):

```powershell
Write-Host '=== CPU ==='
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed | Format-List

Write-Host '=== RAM ==='
Get-CimInstance Win32_ComputerSystem | Select-Object @{n='RAM_GB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}} | Format-List
Get-CimInstance Win32_OperatingSystem | Select-Object @{n='FreeRAM_GB';e={[math]::Round($_.FreePhysicalMemory/1MB,1)}} | Format-List

Write-Host '=== GPU ==='
Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate | Format-List

Write-Host '=== Disks ==='
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{n='Size_GB';e={[math]::Round($_.Size/1GB,1)}}, @{n='Free_GB';e={[math]::Round($_.FreeSpace/1GB,1)}} | Format-Table -Auto

Write-Host '=== Battery / chassis ==='
Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object Name, EstimatedChargeRemaining
Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, PCSystemType | Format-List
```

### Профілі заліза (визнач один)

| Профіль | Орієнтир | Наслідки для Fox |
|---------|----------|------------------|
| **Low** | iGPU старий / ≤8 GB RAM / HDD | opacity 1.0, blur 0, shader off, dock compact, без live rain якщо лагає |
| **Mid** | сучасний iGPU / 16 GB / SSD | opacity 0.92, blur 10–20, shader optional, foxos on ok |
| **High** | discrete GPU / 16–32 GB | повний Fox look, glass dock, shader on, cursor x2 |
| **Ultra** | strong GPU / 32+ GB / high refresh | усе на максимум; multi-monitor fine; foxlife + mirror ok |

Ноутбук на батареї → тимчасово як **Low/Mid** (менше blur).

---

## 11) ★ Екрани: роздільність, DPI, розширення, кілька моніторів

### 11.1 Зняти усі дисплеї

```powershell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  [pscustomobject]@{
    Device       = $_.DeviceName
    Primary      = $_.Primary
    Bounds       = "$($_.Bounds.Width)x$($_.Bounds.Height)+$($_.Bounds.X)+$($_.Bounds.Y)"
    WorkingArea  = "$($_.WorkingArea.Width)x$($_.WorkingArea.Height)"
    BitsPerPixel = $_.BitsPerPixel
  }
} | Format-Table -Auto

Write-Host '=== DPI / scale (per monitor, Win10+) ==='
Get-CimInstance -Namespace root\wmi -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue | Format-List
# Scale % з Settings часто зручніше через:
Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -ErrorAction SilentlyContinue
# Або ручно: Settings → System → Display → Scale

Write-Host '=== GPU current modes ==='
Get-CimInstance Win32_VideoController | Select-Object Name, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate, CurrentBitsPerPixel | Format-Table -Auto
```

Також: **Win+P** — режим проєкції:

| Режим | Українською | Що робити з Fox |
|-------|-------------|-----------------|
| PC screen only | Лише ПК | один стіл |
| Duplicate | Дублювати | wallpaper під **менший** спільний режим; UI не для ultrawide-логіки |
| Extend | Розширити | primary = Ghostty + dock; wallpaper на кожен логічний стіл |
| Second only | Лише другий | підганяй під той екран |

### 11.2 Aspect ratio

```text
aspect = width / height
16/9  ≈ 1.778   → 1920×1080, 2560×1440, 3840×2160
16/10 = 1.600   → 1920×1200, 2560×1600
21/9  ≈ 2.333   → 2560×1080, 3440×1440
3/2   = 1.500
```

### 11.3 Таблиця підгонки UI

| Екран | Scale Windows | Ghostty font | padding | quick-terminal | foxlook cursor | dock size |
|-------|---------------|--------------|---------|----------------|----------------|-----------|
| 1080p 14–15" laptop | 125–150% | 12–13 | 8 | 42–45% | x1–x2 | compact/normal |
| 1080p 24" | 100% | 13–14 | 8–10 | 45% | x1–x2 | normal |
| 1440p 27" | 100–125% | 13–14 | 10–12 | 45% | x2 | normal/large |
| 4K 27" | 150–200% | 12–13 | 10–14 | 40–45% | x2–x3 | large |
| 4K 32"+ | 125–150% | 13–14 | 12–16 | 40% | x2–x3 | large |
| Ultrawide 3440×1440 | 100–125% | 13–14 | 10 | **35–40%** | x2 | normal; **не** тягни Ghostty на всю ширину |
| Vertical 1080×1920 | 100% | 14 | 8 | 30–35% | x2 | compact; горизонтальні splits |

### 11.4 Кілька моніторів (розширення)

**Правила Fox:**

1. **Primary** = монітор з Ghostty + Fox dock/taskbar логікою.  
2. `foxos` rain орієнтуй на primary; на другому — спокійний static wallpaper того ж accent.  
3. Не розтягуй один 16:9 wallpaper на span 2×1080 без crop.  
4. Ultrawide + 1080p side: UI-профіль бери від **primary**, не від суми пікселів.  
5. Різний DPI на моніторах (100% + 150%): cursor scale під primary; шрифт Ghostty перевіряй перетягуванням вікна.  
6. Ноут + зовнішній: при від’єднанні — `foxos apply` / `foxlook` status; інколи потрібен `term -New`.

**Рекомендовані layout після Extend:**

```
[ Primary 16:9 ]              [ Secondary ]
 Ghostty + splits              Browser / foxlife
 foxos rain + desk prompt      static wall
 dock bottom                   без другого dock
```

Ultrawide primary:

```
|  editor 1/3  |  Ghostty 1/3  |  browser 1/3  |
 quick-terminal лише над Ghostty-зоною (не на весь span)
```

### 11.5 Safe zones

- 2–3% від країв під панель / заокруглені кути ноута.  
- `window-padding-x/y` 8–14; на 4K зі scale краще більше padding, не більший font без кінця.  
- Спочатку вистав **Windows Scale**, потім `font-size` у Ghostty.

### 11.6 HDR / high refresh

- HDR on: інколи «сірі» кольори ASCII — якщо rain виглядає блідо, SDR для desktop.  
- 144/165 Hz: ок для Fox; blur дорожчий — на Low вимкни.  
- G-Sync / FreeSync не чіпай заради Fox.

---

## 12) Підстройка Fox під профіль заліза

### Low

```ini
# ghostty/config (після install правити живий config + ctrl+shift+,)
font-size = 13
background-opacity = 1.0
background-blur = 0
quick-terminal-size = 40%
```

```powershell
shader off
foxos on          # якщо лагає rain — wall static і лише accent
foxlook on
foxlook cursor fox 1
foxlook dock style slim
foxlook dock size compact
foxlook dock hide on
```

### Mid

```ini
font-size = 13
background-opacity = 0.92
background-blur = 12
quick-terminal-size = 45%
```

```powershell
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style pill
foxlook dock size normal
```

### High / Ultra

```ini
font-size = 13          # або 14 на 1440p 100%
background-opacity = 0.92
background-blur = 20
quick-terminal-size = 45%   # 38% на ultrawide
```

```powershell
shader on
foxos on
foxlook on
foxlook cursor fox 2     # x3 на 4K 200%
foxlook dock style glass
foxlook dock size large  # на 4K
foxlook wall overlay
```

Після змін теми: `sw` → `foxos apply`.

---

## 13) Профілі foxlook export/import

На старому ПК:

```powershell
foxlook export
# або
foxlook export D:\Backup\fox-look-work.json
```

На новому:

```powershell
foxlook import D:\Backup\fox-look-work.json
# потім ОБОВ’ЯЗКОВО перевір DPI — cursor/dock size можуть потребувати ручного bump
foxlook cursor fox 2
foxlook dock size normal
```

Також: `build migrate-ok` після стабілізації.

`foxpack -Full` переносить notes/binds/theme — обережно з секретами.

---

## 14) AI, media, sites, companion

```powershell
ollama serve
ollama pull qwen3-vl
ask "що вміє foxlook"
friend
```

Media: `yt`, `ytm`, `sp`, `sites`.  
Life: `foxlife`.  
Companion: `foxaddon -Install`, `foxzen status`.

---

## 15) Оптимізація Windows під Fox

```powershell
# з папки FoxTerminal (адмін для служб)
.\DisableBloat
.\DisableAds
.\Status
```

- Startup: лише Ghostty task якщо треба + `foxhotkeys`.  
- Game Mode / зайві overlays вимкни, якщо краде GPU у shader.  
- Живлення ноута: Balanced; на батареї — профіль Mid/Low.  
- `foxbg` — прибрати важкі фонові апки.  
- SSD: не клади `builds\` гігантські медіа без потреби.

---

## 16) Безпека foxlook shell

`foxlook shell on` = **наступний** логін цього Windows-юзера стартує FoxOS замість Explorer.

Rescue:

1. Ctrl+Alt+Del → Task Manager → File → Run  
2. `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd`  
3. або `cmd\fox-restore-windows.bat` з репо  
4. `foxlook shell off` / `foxlook off`

Якщо dock мовчить ~30 с — Explorer повертається сам.

**На новому ПК:** спочатку тиждень без `shell on`.

---

## 17) Сценарії після переносу

### Перший вечір

1. §5 фази A–E  
2. `home` → `fday` → `ytm`  
3. `foxlook export` на Desktop  

### Робота 1080p laptop

Mid/Low · cursor x1–x2 · dock compact · opacity 0.92 або 1.0 на батареї.

### Десктоп 1440p + другий 1080p Extend

Primary 1440p = Ghostty · High профіль · secondary browser · `foxos` на primary.

### Ultrawide

quick 38% · не fullscreen Ghostty на весь span · 2–3 колонки · wallpaper 3440×1440.

---

## 18) Правила змін коду

- Стиль як у існуючих `cmd/*.ps1`.  
- Нова команда → `foxhelp` known + `foxtest` manifest.  
- Документація: оновлюй цей MEGAGUIDE / HARDWARE_SCREEN якщо змінюєш DPI-логіку.  
- Не коміть без прохання.

---

## 19) Troubleshooting

| Симптом | Дія |
|---------|-----|
| Не Ghostty | `winget install AmanThanvi.winghostty`, `install.ps1`, `chek` |
| Команда не знайдена | ярлик Ghostty з PATH cmd; або повний `.\cmd\foxhelp.ps1` |
| Квадратики-іконки | Nerd Font + `foxdeps` |
| Дрібний/гігантський текст | Windows Scale спочатку, потім font-size |
| Rain/blur лаги | профіль Low: opacity 1 blur 0 shader off |
| Другий монітор «з’їв» стіл | Win+P Extend; primary у Display settings; `foxos apply` |
| Різний DPI мильний курсор | cursor scale під primary; перезапуск foxlook cursors |
| foxlook не відкотити | `foxlook off` |
| Після shell on немає Explorer | restore-windows.cmd |
| AI мовчить | `ollama serve` + pull model |
| Push 403 | PAT правильного акаунта |
| Агент без контексту | змусь читати цей MEGAGUIDE |

---

## 20) Пам’ять розмов

- Гайди UA/EN, linux pack, AGENTS.md уже в git.  
- Код на shew4uk + ShewchukV4.  
- Чати Cursor між ПК не синхроняться → MEGAGUIDE = пам’ять.  
- Цей **windows/CURSOR_MEGAGUIDE_UA.md** — головний контекст для Cursor на іншому Windows.

---

## 21) Готові промпти

### Старт

```
Прочитай повністю FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md.
Зніми залізо й усі монітори (§10–11), визнач профіль Low/Mid/High/Ultra
і запропонуй точні значення Ghostty + foxlook. Українською.
```

### Повний перенос

```
Проведи чекліст переносу §5 на цій машині крок за кроком.
Після кожного кроку — коротко статус. Не вмикай foxlook shell.
```

### Повна перевірка команд + оболонка

```
За FoxTerminal/windows/VERIFY_ALL.md і CURSOR_MEGAGUIDE §23:
прожени foxtest, кожну команду (PASS/FAIL/SKIP),
і всю оболонку Windows — Alt+Tab, таскбар, Win-меню, dock, foxos, lock.
Видай фінальний звіт. Не вмикай foxlook shell. Не роби texit/off/foxreset.
```

### Піджени під мої екрани

```
Монітори: <вставь вивід Screen::AllScreens>.
Win+P режим: Extend|Duplicate.
Піджени font, padding, quick-terminal, cursor scale, dock size.
```

### Імпорт вигляду зі старої машини

```
Ось foxlook export json / шлях. Імпортуй і поправ DPI під цей ПК.
```

---

## 22) Шпаргалка одним екраном

```powershell
cd $env:USERPROFILE\Desktop\FoxTerminal   # або твій шлях
git pull

winget install AmanThanvi.winghostty
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\cmd\foxdeps.ps1 -Install

# залізо + екрани → дивись вивід, обери профіль
# … команди з §10–11 …

foxsetup
foxos on
foxlook on
foxlook cursor fox 2
foxlook dock style glass
foxlook export
foxhotkeys -Restart
home

# Cursor: Open Folder на корінь репо
# «Прочитай FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md»
# потім обов’язково VERIFY_ALL (команди + Alt+Tab/таскбар)

foxtest -List
foxtest -Group info
```

**Rescue shell:** `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd`  
**Палітра:** `#0B0F1A` / `#E6E6E6` / `#DC7A14`  
**Репо:** https://github.com/ShewchukV4/FoxTerminal  
**Повна перевірка:** [`VERIFY_ALL.md`](VERIFY_ALL.md)

---

## 23) ★ Повна перевірка: кожна команда + Alt+Tab / таскбар

Це **обов’язковий** етап на іншому Windows-ПК. Детальний протокол і шаблон звіту: **[`VERIFY_ALL.md`](VERIFY_ALL.md)**.

### Навіщо

Після переносу мало «начебто працює». Треба підтвердити:

1. **Кожну** користувацьку команду (foxtest + ручні TUI + not covered).  
2. **Усю оболонку**, яку чіпає FoxOS/foxlook: таскбар, **Alt+Tab**, Win+Tab, меню Win, курсори, dock, lock, hotkeys, Ghostty splits.

### Мінімальний порядок для агента

```powershell
chek
foxtest -List
foxtest -Group info
# далі за VERIFY_ALL.md §2 (оболонка) і §3 (ручні команди)
foxos status
foxlook status
foxhotkeys -Status
```

Потім **вручну / з юзером** (агент дає інструкції й фіксує відповіді):

1. **Alt+Tab** / **Alt+Shift+Tab** / **Win+Tab** — список вікон читабельний.  
2. **Таскбар** — autohide, трей, іконки вікон, клік по Ghostty.  
3. **Win** / Win+E / Win+I — згідно `foxlook winkeys`.  
4. **Win+D** — стіл + rain/desk prompt.  
5. **Shift+Alt+T** / **Shift+Alt+L** — show / lock.  
6. Dock + cursor на реальному DPI.

### Заборонено в автопрогоні

`foxlook shell on` · `texit` · `off`/`shutdown` · `foxreset` без дозволу · довгий `unhash` · видалення notes.

### Готово лише коли

У чаті є звіт як у `VERIFY_ALL.md` §4 з рядками по **T\*** (таскбар), **A\*** (Alt+Tab), **W\*** (Win), **F\*** (foxos/look) і зведенням команд PASS/FAIL.

---

*Кінець Windows CURSOR MEGAGUIDE. При зміні foxlook DPI-поведінки — оновлюй §11–12 і HARDWARE_SCREEN.md. При нових командах — оновлюй VERIFY_ALL.md і foxtest manifest.*
