# Аудит Системи Фокс — 2026-10-31

Повний прохід перевірки наявного коду (гілка `fix/cave-vision-freeze`, робоче дерево після виправлень аудиту).  
Продукт: **Система Фокс / Fox System**. Компоненти: FoxTerminal, FoxOS, FOXSTYLE, foxnodes, foxlook.

**Легенда статусів:** PASS · FAIL · BLOCKED · NOT TESTED · NOT APPLICABLE

---

## Підсумок

| Статус | Кількість (орієнтовно) |
|--------|------------------------|
| PASS | 68 |
| FAIL (знайдено → виправлено в цій сесії) | 5 |
| BLOCKED | 4 |
| NOT TESTED (потрібна ручна / обладнання) | 22 |
| NOT APPLICABLE (Linux-only або небезпечні) | 6 |

Не стверджується «все працює»: див. розділ «Ручна перевірка».

---

## Виправлені в цій сесії

| ID | Проблема | Причина | Виправлення | Повторна перевірка |
|----|----------|---------|-------------|-------------------|
| F1 | `term -Status` падав ParserError | Em-dash `—` у рядку ламав PowerShell 5.1 без BOM | ASCII `-` у `cmd/term.ps1` | `term -Status` → PASS |
| F2 | foxtest: 1 ERROR на `term` | наслідок F1 | те саме | `foxtest -Group info` → 50 clean, 0 attention |
| F3 | Apply ack міг зіпсуватись | `ProcessStyle` писав `foxnodes.applied` без reload; старий revision міг перезаписати новий | Прибрано `WriteApplied` з style-watcher; `WriteApplied` ігнорує older revision | SelfTest `applied-monotonic` PASS |
| F4 | `foxos on` / `Write-FoxOsLiveState` губив / лишав rain=0 | `style-applied` був джерелом wall*; застарілий rain=0 перебивав `style.json` | `style.json` texture — source of truth; sync applied; defaults | live.wallRain == style.rain PASS |
| F5 | foxtest не покривав foxdoctor/foxstyle/foxnodes/foxlook/foxstt | маніфест застарів | додано info + skip libs | `-Only …` і info group PASS |

---

## Інвентар і статуси

### A. Інсталяція / діагностика / перенесення

| Сценарій | Очікування | Як перевірено | Результат | Статус |
|----------|------------|---------------|-----------|--------|
| `foxdoctor` | root, runtime write, Ghostty, csc, fonts, style, binds | запуск | OK, 0 error | PASS |
| `foxdeps -Check` | звіт залежностей | foxtest info | clean | PASS |
| `term -Status` / Doctor | статус Ghostty/config | прямий запуск | працює після F1 | PASS |
| `foxpack -Profile export` | zip + manifest, без секретів/exe/stt | export у TEMP, список entries | 12 entries, allowlist OK | PASS |
| `foxpack -ImportProfile` | план + .bak | — | потрібен інтерактив Confirm | NOT TESTED |
| `install.ps1` повторно | overlay/paths | статично + foxdoctor overlay | overlay OK | PASS (статично) |
| `foxsetup` повний майстер | 8 кроків | — | інтерактив | NOT TESTED |
| Unicode/пробіли в шляху репо | коректна робота | поточний шлях без пробілів | NOT TESTED |
| Секрети в zip | відсутні | scan імен у profile zip | PASS |

### B. Термінал і команди (foxtest info)

| Сценарій | Статус |
|----------|--------|
| `foxtest -Group info` (50 команд) | PASS (0 attention) |
| `chek`, `shader status`, `foxos status`, `pulse -Once`, `foxdocs -Paths` | PASS (у складі info) |
| TUI-команди (`foxhelp`, `home`, …) | NOT TESTED (потрібен Ghostty + клавіші) |
| `sw` / `noir` / `pride` / `notebook` / `default` | NOT TESTED (змінюють тему; skip у foxtest) |

### C. Сесія Фокс

| Сценарій | Статус |
|----------|--------|
| `who` / `users` | PASS (foxtest) |
| `l` / `nuser` / `passwd` / `uexit` | NOT TESTED (не чіпаємо паролі) |
| `home` / `settings -Status` / `lock -Status` | settings/lock Status PASS; home TUI NOT TESTED |
| Fox lock ≠ Windows lock | задокументовано | PASS (статично) |

### D. FoxOS / foxlook

| Сценарій | Очікування | Результат | Статус |
|----------|------------|-----------|--------|
| `foxos status` | стан | foxtest PASS | PASS |
| `foxlook status` | parts, shell=off | foxtest PASS | PASS |
| `foxos on` + rain з style.json | wallRain відповідає texture.rain | після F4 | PASS |
| `foxlook shell on` | зміна Winlogon | **не запускалось** (політика) | NOT APPLICABLE / небезпечно |
| Dock / Alt+Tab візуал | плавність, DPI | потрібен UI | NOT TESTED |
| Multi-monitor / від’єднання екрана | clamp позицій | — | NOT TESTED |
| Курсори / winkeys | foxlook parts | status PASS; функціонал клавіш | NOT TESTED |

### E. FOXSTYLE / Node Launcher

| Сценарій | Статус |
|----------|--------|
| `foxstyle -SelfTest` (включно applied-monotonic) | PASS |
| `foxnodes -SelfTest` | PASS |
| `foxstyle -Status` / `foxnodes -Status` | PASS (foxtest) |
| Apply з overlay / без overlay | код + selftest signal; повний UI Apply | NOT TESTED (ручний) |
| Розділ «Анімації» preview stop | код EditorView Stop on leave | PASS (статично) |
| Імпорт/експорт профілів Node Editor | SelfTest import-export | PASS |
| Повторний Apply, швидкі зміни | monotonic WriteApplied | PASS (unit); UI NOT TESTED |

### F. Помічник / STT

| Сценарій | Статус |
|----------|--------|
| `foxstt` status (без args) | PASS (foxtest) |
| `foxstt -Install` / моделі | великий download | NOT TESTED |
| Push-to-talk / Ollama | потрібні mic + Ollama | BLOCKED (середовище) |
| Understanding / заперечення | unit intents у foxnodes SelfTest | PASS (частково) |

### G. Інше

| Сценарій | Статус |
|----------|--------|
| `foxlife -Status` | PASS |
| `sites -list` / `build -list` | PASS |
| `foxmirror` | потрібен iPhone | BLOCKED |
| `ff` / `wai` без ffsync | skip | BLOCKED без daemon |
| `off` / `shutdown` / `foxreset` / bloat services | не запускались | NOT APPLICABLE |
| Linux FoxOS/FOXSTYLE | Windows-only | NOT APPLICABLE |
| Pulse apps close / foxbg kill | чужі процеси | NOT TESTED (ризик) |

### H. Продуктивність (частково)

| Сценарій | Статус |
|----------|--------|
| SelfTest / rebuild без hang | PASS |
| Таймери анімацій stop when idle | код KickMotion/FoxAnimClock | PASS (статично) |
| Витік пам’яті довгий прогін | не вимірювався | NOT TESTED |
| CPU idle foxos-live + rain | NOT TESTED (немає A/B цифр) |

---

## Другий Windows-користувач / scope змін

| Операція | Scope | Примітка |
|----------|-------|----------|
| style.json, live.json, foxnodes.* | поточний user LocalAppData | OK |
| Ghostty overlay у LocalAppData\winghostty | поточний user | OK |
| foxlook dark/cursors/taskbar HKCU | поточний user | OK |
| foxlook oem / shell | HKLM / Winlogon — **не вмикалось** | небезпечно для інших сценаріїв логіну |
| PATH / scheduled tasks | install може чіпати user logon | перевірка foxdoctor tasks warn якщо >2 |
| pulse/foxbg close apps | процеси сеансу | не ганялись деструктивно |

---

## Документи, оновлені під цей аудит

- `FoxTerminal/windows/AUDIT_REPORT_2026-10-31.md` (цей файл)
- `CHANGELOG.md` — записи виправлень
- `FoxTerminal/windows/VERIFY_ALL.md` — посилання на аудит
- `cmd/foxtest.ps1` — покриття нових команд
- `cmd/foxdocs.ps1` — пункт аудиту (якщо додано)
- Гайди UA/EN — короткі нотатки про відомі фікси (за потреби)

---

## Ручна перевірка (короткі кроки)

1. У Ghostty: `foxstyle` → Анімації → Apply з увімкненим/вимкненим `foxnodes` (статуси Застосовано / Збережено).  
2. Dock + Alt+Tab: швидкі Tab, закриття вікна під час slide (**E**).  
3. `foxpack -ImportProfile` на копії профілю з TEMP.  
4. DPI 125/150 і другий монітор.  
5. Помічник: текстова команда + (за наявності) push-to-talk.

Не позначати ці пункти PASS без результату від власника ПК.
