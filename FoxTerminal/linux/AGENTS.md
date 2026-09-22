# AGENTS.md — пам’ять (Linux pack)

Канонічна копія для агентів на Kali / Linux.  
Повний Linux-гайд: [`LINUX_GUIDE_UA.md`](LINUX_GUIDE_UA.md) · шпаргалка команд: [`COMMANDS_LINUX.md`](COMMANDS_LINUX.md)

**Промпт для Cloud Agent на Linux:**

```
Прочитай FoxTerminal/linux/AGENTS.md і FoxTerminal/linux/LINUX_GUIDE_UA.md.
Потім FOXTERMINAL_GUIDE_UA.md за потреби. Відповідай українською.
На Linux foxos/foxlook/foxlife — Windows-only; пропонуй Linux-еквіваленти зі гайда.
```

---

# AGENTS.md — пам’ять проєкту FoxTerminal / FireFoxBot

Контекст для будь-якого агента (локального чи Cloud) на іншому ПК.
Читай це першим, потім гайди нижче.

**Мова з користувачем:** українська (за замовчуванням).  
**Репо:** `https://github.com/ShewchukV4/FoxTerminal` і дзеркало `https://github.com/shew4uk/FoxTerminal`.

---

## Що це

Локальна екосистема навколо **Ghostty**-терміналу (на Windows — winghostty):

| Шар | Команди / місце | Роль | Linux |
|-----|-----------------|------|-------|
| Термінал | `FoxTerminal/ghostty/config`, `term`, `chek`, `shader` | теми, splits, keybinds | ✅ повністю |
| Команди | `cmd/` | медіа, notes, мережа, AI | ⚠️ багато через `pwsh`; частина native bash |
| FoxOS / foxlook | `foxos`, `foxlook` | wallpaper, dock, shell | ❌ Windows only → див. LINUX_GUIDE |
| home / lock / settings | `home`, `lock`, `settings` | оболонка | ⚠️ переважно PowerShell |
| sites / AI | `sites`, `ask`, `friend` | сайти, Ollama | ✅ |
| foxlife / foxmirror | native Win apps | Life, iPhone | ❌ / обмежено |

Повна документація:

- `FoxTerminal/linux/LINUX_GUIDE_UA.md` ← **почни тут на Linux**
- `FoxTerminal/FOXTERMINAL_GUIDE_UA.md`
- `FoxTerminal/FOXTERMINAL_GUIDE_EN.md`

---

## Швидкий старт (Kali / Linux)

```bash
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
# Ghostty: https://ghostty.org/download або пакет дистрибутива
bash ./FoxTerminal/install.sh
ghostty   # або ярлик foxterminal
```

Далі: `chek` → `term -Doctor` (через pwsh, якщо є) → `foxhelp`.

---

## Git / акаунти

- **shew4uk** — основна історія розробки  
- **ShewchukV4** — акаунт для іншого ПК (Kali); shew4uk є collaborator  
- Локальні Cursor-чати не синхроняться; пам’ять = `AGENTS.md` + linux-гайд у git  

---

## Правила для агента

1. На Linux не пропонуй `foxlook shell on` / `foxos on` як робочі — поясни Windows-only і дай Linux-альтернативи з `LINUX_GUIDE_UA.md`.
2. Перед змінами desktop (wallpaper, scaling, compositor) — спитай DE (GNOME/KDE/XFCE/Hyprland) і роздільність.
3. Не коміть секрети; не вигадуй паролі GitHub.
4. Оптимізуй під реальний aspect ratio і DPI екрана (розділ «Робочий стіл» у Linux-гайді).
