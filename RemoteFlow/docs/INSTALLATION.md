# Installation

## 1. Збірка Windows Agent

```powershell
cd RemoteFlow
.\scripts\build.ps1
```

Скрипт:

1. Збирає React PWA
2. Копіює її в `src/RemoteFlow.Agent/wwwroot`
3. Компілює .NET solution (Release)

Запуск:

```powershell
.\scripts\run-agent.ps1
```

Або відкрийте:

`src\RemoteFlow.Agent\bin\Release\net10.0-windows10.0.19041.0\RemoteFlow.exe`

## 2. Перший запуск

1. У Agent натисніть **Start Server**
2. Дозвольте доступ у Windows Firewall (Private networks), якщо з’явиться запит
3. На Dashboard з’являться IP, порт (за замовчуванням `8745`) і QR-код
4. На iPhone (та сама Wi‑Fi) відкрийте Safari і відскануйте QR

### Самопідписаний сертифікат (обов’язково для Safari)

Safari вимагає довіри до сертифіката:

1. Відкрийте `https://<LAN-IP>:8745` у Safari
2. При попередженні оберіть перегляд / продовжити (Show Details → visit website)
3. Після завантаження сторінки можна робити pairing

Якщо сторінка не відкривається — перевірте Firewall і що телефон у тій же підмережі.

## 3. Pairing

1. У PWA натисніть **Запит на підключення**
2. На Windows з’явиться банер з кодом — **Approve**
3. Телефон отримає `deviceId` + `deviceToken` (зберігаються в localStorage)
4. SignalR підключиться автоматично

## 4. Add to Home Screen

Safari → Share → **Add to Home Screen** → RemoteFlow.

## 5. Увімкнення screen share

У Agent → Settings → **Allow screen sharing** → Save.  
На телефоні: вкладка Screen → Start. На Dashboard Agent з’явиться **ACTIVE**.

## Перенесення на інший ПК

1. Скопіюйте зібраний `RemoteFlow.exe` + залежності з `bin/Release/...` **або** зберіть з джерел
2. Дані користувача (`%LOCALAPPDATA%\RemoteFlow`) не копіюються автоматично — pairing доведеться повторити

Інсталятор MSI/Setup ще не зібраний (див. DEVELOPMENT_PROGRESS) — зараз portable EXE після `dotnet build`.
