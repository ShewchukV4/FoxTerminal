# Security

## Модель загроз (локальна мережа)

RemoteFlow розрахований на довірену домашню/офісну Wi‑Fi. Він **не** відкриває порт на інтернет і не змінює роутер.

## Захист

| Механізм | Реалізація |
|----------|------------|
| Транспорт | HTTPS + WSS (self-signed cert у `%LOCALAPPDATA%\RemoteFlow\certs`) |
| Pairing | Одноразовий код, TTL ~2 хв, ручний Approve на Agent |
| Сесія | `deviceId` + high-entropy token; на диску лише SHA-256 hash |
| Авторизація команд | SignalR `[Authorize]` + DeviceToken scheme |
| Rate limit | Pairing і command limiter |
| Origin/LAN | Pairing відхиляє non-private IP при `bindLocalNetworkOnly` |
| Allowlist | Лише заздалегідь дозволені app/url/folder/hotkey/media |
| Немає RCE | Немає endpoint для shell/script/PowerShell з клієнта |
| Permissions | Окремо `allowRemoteControl` і `allowScreenShare` |
| Disconnect safety | `ReleaseAllInput` на disconnect / reconnect |
| Логи | Не пишуть typed text / tokens / passwords |
| UAC / Secure Desktop | Не обходяться; BitBlt їх не захоплює |
| Privileges | `asInvoker` — без elevation |

## Відкликання доступу

- Agent → Devices → **Remove** (видаляє авторизацію)
- На телефоні: Settings → видалити авторизацію (чистить localStorage)

## Обмеження

- Self-signed TLS вимагає ручної довіри в Safari
- Будь-хто в LAN, хто вже має token, може керувати — захищайте Wi‑Fi і revoke devices
- Screen share передає вміст робочого столу — вмикайте лише свідомо
