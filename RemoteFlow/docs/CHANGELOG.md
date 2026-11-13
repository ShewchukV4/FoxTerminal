# Changelog

## 0.1.0 — 2026-11-01

### Added

- Solution structure: Core, Security, Input, Capture, Agent, Web, Unit tests
- Windows Agent WPF UI (Dashboard, Devices, Actions, Settings, Logs)
- HTTPS Kestrel host with self-signed certificate
- Device pairing (QR URL, code, Approve/Reject, hashed tokens)
- SignalR RemoteHub with device authentication
- Allowlisted actions: URL, app, folder, media, volume, screenshot, lock, hotkey, macros
- Mouse/keyboard input via SendInput + release-on-disconnect
- Screen capture JPEG streaming over SignalR + multi-monitor select
- React PWA: Deck, Touchpad, Screen, Profiles, Settings
- Docs set + build/run scripts
- Unit tests for tokens, rate limiter, log redaction
- Smoke test for status/pair/hub 401
