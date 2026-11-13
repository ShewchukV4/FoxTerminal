# Architecture

## Огляд

```
iPhone Safari/PWA  --HTTPS/WSS-->  RemoteFlow Agent (Windows user session)
                                   ├─ WPF Dashboard
                                   ├─ Kestrel HTTPS (self-signed)
                                   ├─ Pairing REST API
                                   ├─ SignalR RemoteHub (auth)
                                   ├─ Input (SendInput)
                                   └─ Capture (GDI BitBlt → JPEG frames)
```

## Модулі

| Проєкт | Відповідальність |
|--------|------------------|
| `RemoteFlow.Core` | DTO, action kinds, deck/profiles, paths, defaults |
| `RemoteFlow.Security` | Self-signed cert, token hash, device store, rate limit |
| `RemoteFlow.Input` | Mouse/keyboard via Win32 SendInput, allowlisted actions, monitors |
| `RemoteFlow.Capture` | Screen frames for streaming |
| `RemoteFlow.Agent` | WPF shell + ASP.NET Core host + SignalR + static PWA |
| `RemoteFlow.Web` | React PWA client |

## Протокол

1. **Pairing** (unauthenticated, LAN-only checks):
   - `POST /api/pair/request` → `requestId` + `pairingCode`
   - Agent UI Approve → token cached briefly
   - `POST /api/pair/complete` → `deviceId` + `deviceToken` (one-time)
2. **Control** (authenticated):
   - SignalR `/hub` with `X-Device-Id` / `X-Device-Token` or `access_token=deviceId.token`
   - Methods: ExecuteAction, Mouse*, Keyboard, Start/StopScreenShare, GetDeck/SaveDeck, …
3. **Screen frames**:
   - Server pushes `Frame` events (JPEG base64) to SignalR group `screen`

## Чому JPEG/SignalR, а не повний WebRTC media pipeline

Повний H.264 WebRTC encode з Windows.Graphics.Capture + SIPSorcery потребує окремого media pipeline і GPU encoder wiring. Для стабільної v1 реалізовано **адаптивний JPEG stream через SignalR**, який:

- працює в Safari на iPhone;
- використовує захищений WSS;
- дає керування з координатною нормалізацією;
- показує індикатор ACTIVE на Agent.

Архітектурне місце для WebRTC signaling залишено в протоколі (`WebRtcOffer/Answer/Ice` константи); media track — наступний етап (див. KNOWN_ISSUES / DEVELOPMENT_PROGRESS).

## Дані на диску

`%LOCALAPPDATA%\RemoteFlow\`

- `config.json` — налаштування агента
- `devices.json` — paired devices (лише hash токенів)
- `deck.json` — профілі/кнопки
- `certs/agent.pfx` — локальний TLS
- `logs/`, `screenshots/`

## Потік введення

Touchpad/Screen → SignalR → `MouseService`/`KeyboardService` → `SendInput`.  
При disconnect Agent викликає `ReleaseAllInput()` (кнопки миші + модифікатори + cancel macro).

## Багатомоніторність

`MonitorService` читає `Screen.AllScreens`. Клієнт обирає monitor index; absolute click нормалізує 0..1 у bounds вибраного монітора.
