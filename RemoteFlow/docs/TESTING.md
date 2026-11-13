# Testing

## Автоматично виконано (2026-11-01)

| Тест | Результат |
|------|-----------|
| `dotnet build RemoteFlow.slnx -c Release` | Passed |
| `dotnet test tests/Unit` (5 tests: tokens, rate limit, redact) | Passed |
| `npm run build` (RemoteFlow.Web) | Passed |
| HTTPS smoke: `GET /api/status` → 200 | Passed |
| HTTPS smoke: `POST /api/pair/request` → pairingCode | Passed |
| HTTPS smoke: `GET /hub` without token → 401 | Passed |
| Agent process starts (`RemoteFlow.exe`) | Passed (process launch) |

Команди:

```powershell
dotnet test .\tests\Unit\RemoteFlow.Tests.Unit.csproj -c Release
cd src\RemoteFlow.Web; npm run build
```

## Ручна перевірка (потрібна на вашому ПК + iPhone)

1. Start Agent → Start Server → QR видно, IP коректний (Wi‑Fi, не VirtualBox)
2. Safari відкриває HTTPS після довіри до сертифіката
3. Pairing Approve → Online badge на телефоні
4. Deck: Volume Up чутно змінює гучність
5. Deck: Launch VS Code / Browser / YouTube (якщо встановлено)
6. Macro Programming виконує кроки; Stop macro скасовує
7. Touchpad: рух, L/R click, scroll двома пальцями, Hold L drag
8. Keyboard: український/англійський текст, Copy/Paste
9. Screen: увімкнути allow → Start → видно робочий стіл → тап відкриває іконку
10. Перемикання моніторів
11. Вимкнути Wi‑Fi на телефоні → на ПК курсор не «залипає»
12. Remove device → повторні команди відхиляються
13. Add to Home Screen → PWA відкривається standalone

Не стверджуйте «протестовано на iPhone», доки пункти 2–13 не виконані фізично.
