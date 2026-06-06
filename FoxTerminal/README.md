# Fox Terminal (Windows Terminal)

This is a portable terminal setup based on **Windows Terminal**.

## Ollama assistant (qwen3-vl)

1) Start Ollama:
```
ollama serve
```

2) Pull the model (one time):
```
ollama pull qwen3-vl
```

3) Use in FoxTerminal:
```
ask "Explain this file"
ask "What is in this image?" --image C:\path\img.png
friend
foxhelp
```
The `friend` command starts the Frederik Endiscot (FRIEND) chat. To exit, type `exitt`. In-chat: `/clear`, `/help`, `/model`, `/cmds`, `/repo`, `/read <path>`, `/explain <path>`. Say e.g. **open youtube**, **open spotify**, **notes**, **open telegram** to close chat and run that command. FRIEND replies in English and keeps the last 25 turns of context (`FOXTERM_FRIEND_MAX_TURNS`).

The `foxhelp` command opens an interactive help menu. The "Commands (all)" section auto-detects commands from `cmd\` so it stays complete.

Optional env vars (new terminal after setx):
```
setx OLLAMA_URL http://localhost:11434
setx FOXTERM_OLLAMA_MODEL qwen3-vl
setx FOXTERM_OLLAMA_SYSTEM "You are Frederik Endiscot (FRIEND), a FoxTerminal assistant. Reply in English only."
setx FOXTERM_OLLAMA_AUTOSTART 1
setx FOXTERM_OLLAMA_LOW_POWER 1
```

## Use this config

### Windows

Run:
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

**Вимкнути непотрібні служби Windows** (запуск від адміна):
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DisableBloat
```
Вимикає тільки те, що найбільше навантажує: телеметрія (DiagTrack, dmwappushservice), SysMain (Superfetch), GamingServices, OneSyncSvc, PimIndexMaintenanceSvc, WerSvc, MapsBroker, CDPUserSvc.

**Вимкнути рекламу та підказки** (1–5: Пуск, екран блокування, підказки в роботі, рекомендації в Параметрах, індивідуальний досвід):
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DisableAds
```
Без адміна — тільки поточний користувач. **Від адміна** — також профіль «типовий користувач», тож нові облікові записи теж отримають вимкнення. Після виконання перезапусти Explorer або вийди/зайди в обліковий запис.

### Короткі команди (з папки FoxTerminal)

| Команда | Дія |
|---------|-----|
| `.\DisableBloat` або `DisableBloat` | Вимкнути служби, що навантажують (від адміна) |
| `.\DisableAds` або `DisableAds` | Вимкнути рекламу та підказки (1–5) |
| `.\Status` або `Status` | Показати, що вимкнено / увімкнено |
| `.\Enable` або `Enable` | Увімкнути назад служби та рекламу/підказки (від адміна для служб) |

У PowerShell: `.\DisableBloat`, `.\DisableAds`, `.\Status`, `.\Enable`.  
Якщо папку FoxTerminal додати в PATH, можна викликати просто `DisableBloat`, `DisableAds`, `Status`, `Enable` з будь-якого каталогу.

**Щоб вимкнення діяли завжди і на всьому ноуті:** запусти `DisableBloat` і `DisableAds` **від адміністратора**. Служби тоді вимкнені на весь комп’ютер; реклама/підказки — для поточного юзера і для усіх нових облікових записів. Увімкнути назад — `Enable` від адміна.

## FoxTerminalApp: mintty backend

У `~/.foxterminal.json` можна вибрати backend shell:

```json
{
  "shellBackend": "mintty"
}
```

`mintty` backend запускає сумісний `bash.exe` (MSYS2/Git Bash) всередині FoxTerminalApp.  
Автопошук шляхів:
- `C:\msys64\usr\bin\bash.exe`
- `C:\Program Files\Git\bin\bash.exe`
- `C:\Program Files\Git\usr\bin\bash.exe`

Також можна явно вказати shell:

```json
{
  "shellPath": "C:\\msys64\\usr\\bin\\bash.exe",
  "shellArguments": "--login -i"
}
```
