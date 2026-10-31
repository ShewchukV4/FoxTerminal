# Перенесення Системи Фокс на новий ПК

Коротко: **код** клонуєш/розпаковуєш будь-де; **вигляд** переносиш профілем; **шляхи програм / DPI / монітори** перевіряєш на місці. Це **не** повністю portable-режим: `install.ps1` пише локальний overlay Ghostty і runtime у `%LOCALAPPDATA%\FoxTerminal\`.

## Що експортувати (старий ПК)

```powershell
foxpack -Profile export
# опційно нотатки:
foxpack -Profile export -IncludeNotes
```

Або повний zip коду: `foxpack` / `foxpack -Full` (користувачі очищаються).

**Не** клади в профіль: recovery-коди, `.foxlocal/GITHUB`, логи, exe, STT-моделі, стан `foxlook shell`.

## На новому ПК

1. `winget install AmanThanvi.winghostty`
2. `git clone …` або розпакуй zip (шлях може мати пробіли/Unicode)
3. `powershell -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1`
4. У Ghostty: `foxdeps -Install` → `foxsetup`
5. Імпорт вигляду: `foxpack -ImportProfile <файл.foxprofile.zip>` (покаже план змін, з `.bak`)
6. `foxdoctor` → виправ відсутні шляхи біндів
7. `l <user> <pass>` → `home` → `foxstyle` / `foxnodes`

AI/STT **не** обов’язкові. `foxlook shell on` — лише з явним «так».

## Якщо переїхав лише репозиторій в іншу папку

```powershell
# з нового кореня:
powershell -File .\FoxTerminal\install.ps1 -Force -NoShortcut
foxdoctor -Fix
```

## Типові проблеми

| Симптом | Дія |
|---------|-----|
| Старий шлях у Ghostty | `install.ps1 -Force` |
| Немає csc / не збирається FOXSTYLE | увімкни .NET 4.8 |
| Пункти меню «мертві» | `bbind` / Node Launcher — новий шлях |
| Дублікати foxos-live | `foxdoctor -Fix` |
| Панель за екраном | `foxstyle` Apply / перемісти вручну; позиції з іншого ПК не довіряй |

Детальніше: [`CURSOR_MEGAGUIDE_UA.md`](CURSOR_MEGAGUIDE_UA.md), [`VERIFY_ALL.md`](VERIFY_ALL.md).
