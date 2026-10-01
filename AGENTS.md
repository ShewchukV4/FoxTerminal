# AGENTS.md — пам’ять проєкту FoxTerminal / FireFoxBot

Контекст для будь-якого агента (локального чи Cloud) на іншому ПК.
Читай це першим, потім гайди нижче.

**Мова з користувачем:** українська (за замовчуванням).  
**Репо:** `https://github.com/ShewchukV4/FoxTerminal` і дзеркало `https://github.com/shew4uk/FoxTerminal`.

---

## Що це

Локальна екосистема навколо **Ghostty**-терміналу (на Windows — winghostty):

| Шар | Команди / місце | Роль |
|-----|-----------------|------|
| Термінал | `FoxTerminal/ghostty/config`, `term`, `chek`, `shader` | теми, splits, keybinds |
| Команди | `cmd/` (85+) | медіа, notes, мережа, AI, пакування |
| FoxOS skin | `foxos` | ASCII rain wallpaper + Windows accent + desk prompt |
| Windows look | `foxlook` | dark, cursors, dock, Win keys, optional shell=FoxOS |
| Системна оболонка | `home`, `lock`, `settings`, `foxsetup` | дім після логіну, lock, TUI/GUI settings |
| Додатки | `foxlife`, `sites/`, Zen Companion | Life app, локальні сайти, Firefox/Zen addon |
| Знімки | `build`, `foxpack`, `CHANGELOG.md` | снапшоти й історія |

Повна документація:

- **Windows (інший ПК):** `FoxTerminal/windows/`  
  - ★ **`CURSOR_MEGAGUIDE_UA.md`** — перенос + залізо + екрани для Cursor  
  - ★ **`VERIFY_ALL.md`** — кожна команда + Alt+Tab / таскбар / Win  
  - `HARDWARE_SCREEN.md` — таблиці DPI / GPU / монітори  
- **Linux / Kali pack:** `FoxTerminal/linux/`  
  - ★ **`CURSOR_MEGAGUIDE_UA.md`** — гігантський гайд для Cursor на Linux  
  - `LINUX_GUIDE_UA.md` — стіл, пропорції, оптимізація  
  - `COMMANDS_LINUX.md` — Windows → Linux
- `FoxTerminal/FOXTERMINAL_GUIDE_UA.md` (UA, уся система)
- `FoxTerminal/FOXTERMINAL_GUIDE_EN.md` (EN)
- `FoxTerminal/README.md`
- Інтерактивно: `sites/fox-terminal/` через `sites`

---

## Швидкий старт (новий ПК)

```powershell
# Windows
winget install AmanThanvi.winghostty
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
```

```bash
# Kali / Linux
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
bash ./FoxTerminal/install.sh
```

Далі в Ghostty: `foxdeps -Install` → `foxsetup` → `l <user> <pass>` → `home` / `foxhelp`.

---

## Важливі команди (шпаргалка)

- Довідка: `foxhelp`
- Дім / lock / settings: `home`, `lock`, `settings` / `settings -Gui`
- Desktop: `foxos on|off`, `foxlook on|off`, `foxlook cursor fox 2`, `foxlook dock style pill`
- ⚠ `foxlook shell on` — наступний логін цього Windows-юзера = FoxOS замість Explorer. Rescue: `%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd` або `cmd/fox-restore-windows.bat`
- AI: `ask`, `friend` (Ollama / qwen3-vl); вихід з friend: `exitt`
- Life app: `foxlife`
- iPhone screen: `foxmirror`
- Знімки: `build <name>`, `foxpack`, `changelog`

---

## Git / акаунти (стан на 2026-09-22)

- Основний акаунт з історією розробок: **shew4uk**
- Другий акаунт (для іншого ПК / Kali): **ShewchukV4**
- Remotes у робочій копії Windows: `origin` → shew4uk, `shewchukv4` → ShewchukV4
- Collaborator: **shew4uk** прийнятий у `ShewchukV4/FoxTerminal` (write)
- Актуальний код запушений на **обидва** репо (master)
- Локальні IDE-чати Cursor **не синхроняться** в хмару; контекст між компами = цей файл + гайди в git
- Cloud Agent стартує з нуля — завжди читай `AGENTS.md` + UA-гайд

---

## Що вже зроблено в сесіях (пам’ять розмов)

1. Оновлено повні гайди UA/EN під усю систему (FoxOS, foxlook, home/lock/settings, foxlife, foxmirror…).
2. README вказує на ці гайди.
3. Користувач клонував на Kali; порожній clone був через те, що ShewchukV4 спочатку був empty — пізніше push пройшов.
4. Запит collaborator прийнято від імені shew4uk; код залито в ShewchukV4.
5. Пояснено: звичайні Cursor-чати локальні; Cloud Agent не наслідує цей тред автоматично.

---

## Правила для агента

1. Не коміть/не пуш без явного прохання (окрім випадків, коли юзер сказав «роби / запуш»).
2. Не вигадуй паролі GitHub; для git clone/push — PAT або браузерний логін.
3. Не вмикай `foxlook shell on` без явного підтвердження і нагадування про rescue.
4. Зміни документуй у дусі існуючих гайдів; тримай UA і EN узгодженими, якщо чіпаєш docs.
5. Службові `*-lib.ps1` не для прямого запуску користувачем.
6. Секрети / `.env` / токени в репо не класти.

---

## Промпт для Cloud Agent (скопіюй)

```
Ти працюєш у репозиторії FoxTerminal (FireFoxBot).
Windows-ПК: спочатку FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md
  (зніми залізо/монітори, піджени FoxOS/Ghostty).
Linux/Kali: FoxTerminal/linux/CURSOR_MEGAGUIDE_UA.md.
Далі за потреби: AGENTS.md, FOXTERMINAL_GUIDE_UA.md, CHANGELOG.md.
Відповідай українською.
Не вмикай foxlook shell без мого «так».
На Linux foxos/foxlook — Windows-only.
```

---

## Куди дивитись у коді

- Auth / themes / home / lock / settings: `cmd/foxauth.ps1`, `cmd/home.ps1`, `cmd/lock.ps1`, `cmd/settings.ps1`, `cmd/foxsetup.ps1`
- FoxOS / look: `cmd/foxos.ps1`, `cmd/foxos-lib.ps1`, `cmd/foxlook.ps1`, `cmd/foxlook-lib.ps1`
- Help inventory: `cmd/foxhelp.ps1`
- Install: `FoxTerminal/install.ps1`, `FoxTerminal/install.sh`
- History: `CHANGELOG.md`, команда `changelog`
