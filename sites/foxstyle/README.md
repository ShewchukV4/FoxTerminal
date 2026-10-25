# FOXSTYLE

Преміальна панель стилювання **FoxOS**.

**Основне:** нативне вікно як `foxlife` — команда `foxstyle` → `%LOCALAPPDATA%\FoxTerminal\foxos\foxstyle.exe`.

Ця папка `sites/foxstyle/` — лише референс дизайн-системи (токени/схема), не основний UI.

## Відкрити

```powershell
foxstyle
foxstyle -Rebuild
foxstyle -Preset neon
```

## Структура

```
foxstyle/
├── index.html              # UI
├── ARCHITECTURE.md         # модульна архітектура
├── ui-flows.md             # interaction flows
├── CLI.md                  # CLI-контракт
├── schema/theme.schema.json
├── presets/{dark,light,neon,foxpurple,custom}.json
└── assets/
    ├── css/{tokens,motion,foxstyle}.css   # Claude design pass
    └── js/foxstyle.js                     # ThemeEngine
```

## Пресети

Dark · Light · Neon · FoxPurple · Custom — усі параметри модуляризовані (кольори, chrome, вікна, панелі, кнопки, motion, typography, textures, labs, per-element anims).

Живий Apply пише `%LOCALAPPDATA%\FoxTerminal\foxos\style.json` і сигнал для `foxnodes`. Редактор меню: `foxstyle -NodeEditor`. Помічник + STT: вкладка Помічник / `foxstt`.