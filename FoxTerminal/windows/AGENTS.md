# AGENTS.md — пам’ять (Windows pack / інший ПК)

★ Головне: [`CURSOR_MEGAGUIDE_UA.md`](CURSOR_MEGAGUIDE_UA.md)  
Швидко про екрани: [`HARDWARE_SCREEN.md`](HARDWARE_SCREEN.md)

**Промпт:**

```
Прочитай повністю FoxTerminal/windows/CURSOR_MEGAGUIDE_UA.md.
Зніми залізо й монітори (§10–11), визнач Low/Mid/High/Ultra, піджени Fox.
Українською. Не вмикай foxlook shell без мого «так».
```

---

## Контекст

- Репо: `ShewchukV4/FoxTerminal` (+ дзеркало `shew4uk`)  
- На Windows повний стек: Ghostty (winghostty) + `foxos` + `foxlook` + `home`/`lock`/`settings`  
- Чати Cursor між ПК не синхроняться → MEGAGUIDE в git = пам’ять  
- Мова: українська  

## Перенос коротко

```powershell
git clone https://github.com/ShewchukV4/FoxTerminal.git
cd FoxTerminal
winget install AmanThanvi.winghostty
powershell -NoProfile -ExecutionPolicy Bypass -File .\FoxTerminal\install.ps1
.\cmd\foxdeps.ps1 -Install
foxsetup
foxos on
foxlook on
```

Потім обов’язково піджени DPI/монітори за MEGAGUIDE §11–12.

## Правила агента

1. Спочатку зняти залізо + AllScreens.  
2. Не `foxlook shell on` без явного підтвердження + rescue.  
3. Різний DPI / Extend — primary = Ghostty.  
4. Ultrawide: quick-terminal 35–40%, не розтягувати один pane на весь span.  
5. Не коміть без прохання.
