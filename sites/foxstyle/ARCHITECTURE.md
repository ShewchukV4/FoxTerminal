# FOXSTYLE — модульна система стилювання FoxOS

> Панель вигляду FoxOS: Steam Deck UI × macOS Control Center × Discord Settings  
> у фірмовому фіолетово-скляному неоні FOXOS.

**Статус (2026-10-25):** основний UI — **нативне WinForms-вікно** (`foxstyle` → `%LOCALAPPDATA%\FoxTerminal\foxos\foxstyle.exe`).  
Ця папка `sites/foxstyle/` — source of truth для **токенів, схеми й пресетів**, не робочий інтерфейс.

---

## Принцип

Кожна вісь вигляду — **окремий модуль**. Пресет (Dark / Light / Neon / FoxPurple / Custom) лише **заповнює модулі**, а не монолітний «колірний switch». Користувач може крутити будь-який параметр незалежно; Custom зберігає повний JSON.

```
ThemeDocument
├── colors        # bg / surface / ink / accent / glass
├── chrome        # opacity / blur / height / icons
├── window        # radius / shadow / openAnim
├── panel         # enter / speed / blur
├── button        # rounded | sharp | glass | liquid
├── motion        # scale / durations / ease / stagger
├── typography    # ui / display / mono / size / tracking
├── texture       # glass | metal | fabric | neon-grid + rain/dock
├── labs          # dynamicShadows / foxGlow / motionBlur / liquidWindows
└── perElementAnims  # dock / nav / card / tile / toggle → keyframe ids
```

Схема: [`schema/theme.schema.json`](schema/theme.schema.json)  
Пресет-файли: [`presets/`](presets/)  
Рантайм: `%LOCALAPPDATA%\FoxTerminal\foxos\style.json`

---

## Мапінг на існуючі теми FoxOS

| FOXSTYLE preset | FoxOS / `sw` / FoxTheme | Характер |
|-----------------|-------------------------|----------|
| **dark** | FoxOS night + `FoxTheme.dark` | #0B0A12 canvas, violet accent |
| **light** | `sw white` / `FoxTheme.default` | paper #F3F1F8, deepened violet AA |
| **neon** | `sw neon` (#7EF06B) | electric violet + neon green |
| **foxpurple** | `sw purple` / midnight | #A05AFF + fox ember |
| **custom** | user JSON | усі `--fs-custom-*` через `color-mix` |

Старе `FoxTheme.Ids` (slate, mint, sunset, rose…) лишаються як **акцентні свотчі** і CLI `sw <name>`, не зникають.

---

## Рендер-пайплайн (живий)

```
FOXSTYLE Apply
  → style.json  +  launcher.json
  → foxnodes.signal
  → foxnodes overlay перечитує обидва файли
  → foxnodes.applied  (статус «Застосовано» лише після ack)
  → foxos-live / dock / chrome читають style.json
```

HTML-прототип у цій папці лишається референсом:

```
JSON state  →  ThemeEngine.applyState()
            →  CSS custom properties (--fs-*)
            →  data-* на :root
            →  live .fs-mini preview
```

Load order CSS: `tokens.css` → `motion.css` → `foxstyle.css`.

---

## Native UI (реальний)

Три панелі / зони в `foxstyle.exe` (джерела: `cmd/foxstyle/*.cs` + `cmd/fox-assistant.cs` + `cmd/fox-stt.cs` + `cmd/fox-understand.cs`):

| Зона | Що |
|------|----|
| Look studio | модулі теми, пресети, Apply / Export / Import |
| Node Launcher editor (`foxstyle -NodeEditor`) | дерево / полотно / властивості; undo/redo; чернетка vs Apply |
| Помічник | модель Ollama, мікрофон, дозволи, журнал, STT-модель |

Профілі вигляду меню (компактний / м’яке скло / контрастний / за темою) **не** змінюють структуру `launcher.json`.  
Анімації меню: Стриманий / Плавний / Пружний / Мінімальний рух.

---

## CLI

Див. [`CLI.md`](CLI.md). Коротко:

```text
foxstyle                 # відкрити нативне вікно
foxstyle -NodeEditor     # редактор меню
foxstyle -Preset neon
foxstyle -Apply file.json
foxstyle -Export [path]
foxstyle -Status
foxstyle -Rebuild
```

---

## Збірка

`cmd/foxstyle.ps1` викликає `csc.exe` (.NET Framework 4.x), пише `foxstyle.exe` у `%LOCALAPPDATA%\FoxTerminal\foxos\`. Те саме для `foxnodes.exe`. STT-моделі — окремо через `foxstt -Install`, не в git.
