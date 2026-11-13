# RemoteFlow

Локальне дистанційне керування Windows з iPhone через Wi‑Fi.

Складається з **Windows Agent** (WPF + ASP.NET Core HTTPS/SignalR) і **мобільного PWA** (React + TypeScript + Vite), яке відкривається в Safari і додається на головний екран.

## Можливості

- Stream Deck: профілі, кнопки, макроси, імпорт/експорт
- Touchpad + клавіатура (відносний курсор, кліки, скрол, drag)
- Remote Desktop: JPEG-кадри екрана в реальному часі + тач-керування
- Pairing через QR / код з підтвердженням на ПК
- Allowlist програм, URL і папок (без довільних shell-команд)

## Швидкий старт

### Вимоги

- Windows 10/11
- .NET 10 SDK
- Node.js 20+ (лише для збірки PWA)

### Збірка та запуск

```powershell
cd RemoteFlow
.\scripts\build.ps1
.\scripts\run-agent.ps1
```

У вікні Agent натисніть **Start Server**. Відскануйте QR-код iPhone (Safari, та сама Wi‑Fi). Підтвердіть pairing на ПК. У Safari: Share → **Add to Home Screen**.

Детальніше: [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Структура

```
RemoteFlow/
  src/RemoteFlow.Agent/     # WPF UI + HTTPS/SignalR host
  src/RemoteFlow.Core/      # моделі, протокол, defaults
  src/RemoteFlow.Security/  # сертифікати, токени, devices
  src/RemoteFlow.Input/     # мишка/клавіатура/дії
  src/RemoteFlow.Capture/   # захоплення екрана
  src/RemoteFlow.Web/       # React PWA
  tests/Unit/
  docs/
  scripts/
```

## Документація

| Файл | Зміст |
|------|--------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архітектура |
| [INSTALLATION.md](docs/INSTALLATION.md) | Встановлення |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Налаштування |
| [SECURITY.md](docs/SECURITY.md) | Безпека |
| [FEATURES.md](docs/FEATURES.md) | Статус функцій |
| [TESTING.md](docs/TESTING.md) | Тести |
| [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Відомі проблеми |
| [CHANGELOG.md](docs/CHANGELOG.md) | Історія |
| [DEVELOPMENT_PROGRESS.md](docs/DEVELOPMENT_PROGRESS.md) | Прогрес |

## Безпека (коротко)

- Лише локальна мережа за замовчуванням
- Самопідписаний HTTPS + WSS
- Pairing з ручним Approve
- Кожна команда вимагає device token
- Окремі перемикачі remote control / screen share
- Немає виконання довільного коду з мережі

## Ліцензія

Приватний проєкт власника репозиторію.
