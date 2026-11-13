# Features — фактичний статус

Легенда: ✅ реалізовано і перевірено автоматично/smoke · 🟡 реалізовано, потрібна ручна перевірка на пристрої · ⚠ частково · ❌ не зроблено

## Windows Agent

| Функція | Статус |
|---------|--------|
| WPF Dashboard / Devices / Actions / Settings / Logs | 🟡 |
| Start/Stop HTTPS server | ✅ smoke |
| QR + LAN URL | 🟡 |
| Pairing approve/reject | ✅ API smoke + UI wired |
| Device list / remove | 🟡 |
| Allowlist apps/URLs/folders | 🟡 |
| Remote control toggle | 🟡 |
| Screen share toggle + ACTIVE indicator | 🟡 |
| Logging без секретів | ✅ unit (redact) |

## Мобільний PWA

| Функція | Статус |
|---------|--------|
| React/Vite/TS PWA + manifest | ✅ build |
| Pairing UI + polling | 🟡 |
| Stream Deck + profiles | 🟡 |
| Macro execute + cancel | 🟡 |
| Import/export deck JSON | 🟡 |
| Touchpad move/click/scroll/drag | 🟡 |
| Keyboard text + shortcuts | 🟡 |
| Screen view + touch control | 🟡 |
| Multi-monitor select | 🟡 |
| Add to Home Screen | 🟡 (iOS Safari) |

## Дії

| Дія | Статус |
|-----|--------|
| Open URL (allowlist) | 🟡 |
| Launch app (allowlist / known ids) | 🟡 |
| Open folder | 🟡 |
| Volume / media keys | 🟡 |
| Screenshot to LocalAppData | 🟡 |
| Lock workstation | 🟡 |
| Hotkey combos | 🟡 |
| Macros + delays | 🟡 |
| Arbitrary shell/code | ❌ by design |

## Streaming

| Функція | Статус |
|---------|--------|
| Real-time frames | 🟡 JPEG/SignalR |
| ~30 FPS target / up to 60 configurable | 🟡 |
| Adaptive JPEG quality | ⚠ basic |
| 1080p max width cap | 🟡 |
| Multi-monitor switch | 🟡 |
| Visible share indicator on PC | 🟡 |
| Full WebRTC H.264 media | ❌ (наступний етап) |
| Windows.Graphics.Capture path | ⚠ API presence stub; runtime = BitBlt |

## Безпека

| Функція | Статус |
|---------|--------|
| HTTPS/WSS | ✅ smoke |
| Auth on hub (401 unauth) | ✅ smoke |
| Token hashing | ✅ unit |
| Rate limiter | ✅ unit |
| Input release on disconnect | 🟡 code path |
| LAN pairing restriction | ✅ code |
