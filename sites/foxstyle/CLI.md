# FOXSTYLE CLI

Робочі команди терміналу. Нативне вікно — основний UI. `sites/foxstyle/` тримає пресети й схему.

## Команди

| Команда | Дія |
|---------|-----|
| `foxstyle` | Відкрити нативну студію |
| `foxstyle -NodeEditor` | Візуальний редактор Node Launcher |
| `foxstyle -Preset neon` | Скопіювати пресет у `style.json` і відкрити (`dark` / `light` / `neon` / `foxpurple` / `custom`) |
| `foxstyle -Apply <path.json>` | Імпорт JSON → `style.json` і відкрити студію |
| `foxstyle -Export [path]` | Копія `style.json` (типово на Desktop) |
| `foxstyle -Status` | Шлях exe + `style.json` + чи зібрано |
| `foxstyle -Rebuild` | Примусово `csc` |
| `foxstyle -SelfTest` | Перевірки моделі редактора без вікна |
| `foxnodes` | Старт / активувати overlay (Ctrl+Alt+Space) |
| `foxnodes -Show` / `-Hide` / `-Stop` / `-Settings` / `-Status` | Керування демоном |
| `foxstt` / `-Install` / `-Test` / `-Stop` | Локальний whisper.cpp |

## Apply-цикл (важливо)

1. FOXSTYLE пише `launcher.json` (структура меню користувача).  
2. Пише `style.json` (вигляд).  
3. Пише `foxnodes.signal`.  
4. Overlay перечитує обидва файли і акає `foxnodes.applied`.  
5. Статус «Застосовано» — лише після ack. Без запущеного `foxnodes` — «Збережено».

Шляхи:

- `style.json` — `%LOCALAPPDATA%\FoxTerminal\foxos\style.json`
- `launcher.json` — `%LOCALAPPDATA%\FoxTerminal\foxos\apps\foxnodes\<fox-user>\launcher.json`
- сигнали — `%LOCALAPPDATA%\FoxTerminal\foxos\`

## Сумісність зі старими командами

| Старе | Нове (шар) |
|-------|------------|
| `sw neon` | colors / preset neon; швидкий акцент |
| `sw -slate` | лише колір, без UI лисиці |
| `foxlook dock style pill` | dock / texture в look, не замінює FOXSTYLE |
| `themes` | швидкий picker; `foxstyle` = повна студія |

HTML-прототип у браузері досі експонує `window.FoxStyle` — це референс, не продакшн.
