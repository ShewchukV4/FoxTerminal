# Development Progress

Оновлено: 2026-11-01

## Етапи

| Етап | Статус | Примітка |
|------|--------|----------|
| 1 Structure + Agent + server + UI + logs | ✅ | Build OK |
| 2 Pairing + HTTPS/WSS + devices | ✅ | API smoke OK; iPhone manual pending |
| 3 PWA Stream Deck + profiles + macros | ✅ | Build OK; device manual pending |
| 4 Touchpad + keyboard | ✅ | Implemented; device manual pending |
| 5 Screen capture + stream + control | ⚠ | JPEG/SignalR working path; WebRTC media TBD |
| 6 Multi-monitor + adaptive quality | ⚠ | Monitor switch done; adaptive basic |
| 7 Full test matrix + installer + polish | ⚠ | Unit+smoke done; MSI + iPhone matrix pending |

## Реалізовано

- Повна модульна структура репозиторію
- Працюючий Agent EXE з локальним HTTPS
- Pairing з підтвердженням
- PWA клієнт зібраний у `wwwroot`
- Input + allowlisted actions + macros
- Screen frames + touch absolute control

## Перевірено тут

- Compile Release
- 5 unit tests
- npm production build
- API status / pair / hub 401 smoke
- Process launch Agent

## Не завершено / далі

1. Фізичний прогін на iPhone (див. TESTING.md)
2. WebRTC H.264 (SIPSorcery + encoder) замість/поряд із JPEG
3. Повноцінний Windows.Graphics.Capture session
4. MSI / install script з firewall rule helper
5. Розширений WYSIWYG editor кнопок (розміри, reorder gesture)
6. Більше integration/e2e тестів SignalR

## Наступний крок

Запустити Agent на цьому ПК, пройти INSTALLATION.md з iPhone і записати результати в TESTING.md.
