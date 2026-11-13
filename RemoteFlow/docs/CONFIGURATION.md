# Configuration

Файли: `%LOCALAPPDATA%\RemoteFlow\`

## config.json

| Поле | Опис | Default |
|------|------|---------|
| `port` | HTTPS порт | `8745` |
| `bindLocalNetworkOnly` | Pairing лише з private IP | `true` |
| `autostart` | Старт сервера при відкритті Agent | `false` |
| `allowRemoteControl` | Дозвіл на input/actions | `true` |
| `allowScreenShare` | Дозвіл на трансляцію | `false` |
| `stream.targetFps` | Цільовий FPS | `30` |
| `stream.maxFps` | Макс FPS | `60` |
| `stream.maxWidth` | Макс ширина кадру | `1920` |
| `stream.jpegQuality` | JPEG quality | `70` |
| `stream.adaptiveQuality` | Авто-якість | `true` |
| `touchpad.*` | Чуття тачпада (серверний дефолт) | |
| `allowedApps` | Allowlist програм | presets |
| `allowedUrls` | Allowlist URL | presets |
| `allowedFolders` | Allowlist папок | Documents/Desktop |

Додавати app/URL можна в Agent → Actions.

Built-in app ids: `browser`, `vscode`, `discord`, `steam`, `terminal` — резолвляться у відомі шляхи/протоколи. Також можна вказати повний `.exe`.

## deck.json

Профілі Programming / Gaming / Multimedia з кнопками та макросами. Редагуються з телефону (Profiles import/export) або напряму у файлі.

## devices.json

Список paired devices. Зберігається **hash** токена (SHA-256), не plaintext.
