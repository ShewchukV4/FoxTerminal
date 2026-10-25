# VERIFY_ALL — перевірка кожної команди + оболонка Windows

Обов’язковий протокол для Cursor на **іншому Windows-ПК** після переносу / підгонки.

Читай разом з [`CURSOR_MEGAGUIDE_UA.md`](CURSOR_MEGAGUIDE_UA.md) §23.

**Результат:** таблиця `команда | PASS/FAIL | нотатка` + блок «Оболонка Windows».  
Без цього звіту робота агента **не завершена**.

---

## 0) Правила прогону

1. Працюй у **Ghostty** з встановленим Fox (`chek` = Ghostty).  
2. Спочатку автомат, потім ручні TUI / небезпечні.  
3. Не запускай без потреби: `texit`, `off`/`shutdown`, `foxreset` (лише з дозволу), `foxlook shell on`, `fdel` чужих файлів, `unhash` довгий брут.  
4. Для TUI: відкрив меню → Esc / Ctrl+E → PASS якщо намалювалось.  
5. Логин: якщо треба — `l` тестовим юзером (не світи пароль у звіті).  
6. Після `foxlook on` — **обов’язково** блок оболонки (§2).

---

## 1) Автопрогін foxtest

```powershell
foxtest -List
foxtest -Group info
# повний (довго, ~хвилини):
foxtest
foxtest -Quiet
```

У звіт внеси: скільки PASS / FAIL / skip / not covered.

Усе з «Not covered by foxtest» — перевір **вручну** (§3).

---

## 2) ★ Оболонка Windows (Alt+Tab, таскбар, усе системне)

Роби **після** `foxos on` + `foxlook on` (і після підгонки DPI).  
Для кожного пункту: PASS / FAIL + один рядок що побачив.

### 2.1 Таскбар

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| T1 | Таскбар видно / autohide | Навести вниз/вгору екрана | Поведінка = `foxlook taskbar` / dock hide |
| T2 | Пошук / Copilot / Widgets | Подивитись іконки | Зайве сховано під FoxOS (як задумано) або поясни |
| T3 | Годинник / трей | Клік по трею | Відповідає `foxlook dock tray clock\|full\|off` |
| T4 | Іконки відкритих вікон | Відкрий Ghostty + Firefox | Показує titles/dots/off як у `dock apps` |
| T5 | Клік по іконці Ghostty | Клік | Фокус / restore вікна |
| T6 | Правий клік по таскбару | ПКМ | Меню Windows або Fox-dock — без зависання |
| T7 | На другому моніторі (якщо Extend) | Подивитись secondary | Немає зламаного другого dock / дубля |

### 2.2 Alt+Tab і перемикання вікон

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| A1 | Alt+Tab | Тримай Alt, Tab | Список вікон, можна вибрати |
| A2 | Alt+Shift+Tab | Назад по списку | Працює |
| A3 | Win+Tab | Timeline / Task View | Відкривається, не чорний екран |
| A4 | Alt+Tab з Fox-темою | Під час foxlook on | Читабельні прев’ю, не «з’їдені» dark-режимом |
| A5 | Перемикання Ghostty ↔ Firefox | Alt+Tab Enter | Фокус коректний |
| A6 | Закрити з Alt+Tab | Alt+Tab → **E** або Del (якщо юзер ок) | Вікно закрилось, стрічка лишилась |
| A7 | Slide / прев’ю | Тримай Alt, подивись strip | Slide-in без миготіння мініатюр; `foxhotkeys` running |

### 2.3 Меню Пуск / Win-клавіші (foxlook winkeys)

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| W1 | Клавіша Win / Super | Натиснути Win | Відкриває те, що задумано (Пуск або FoxTerminal, якщо winkeys on) |
| W2 | Win+E | Провідник / edit binding | Очікувана дія, не краш |
| W3 | Win+I | Параметри / settings Fox | Очікувана дія |
| W4 | Win+R | Run / desk prompt | Якщо winkeys on — Fox desk prompt; інакше системне |
| W4b | Win+S / Win+Alt+A | Apps launcher | winkeys on → FoxOS Home **APPS**; Win+Alt+A якщо Search з’їдає Win+S |
| W4c | Dock Home → APPS | пошу + Enter | Запускає довільну програму без Windows taskbar; F5 оновлює список |
| W4d | APPS pinned | Ctrl+P / ПКМ | Секція **Pinned** зверху; Discord+Copilot за замовчуванням; Ctrl+P закріпити/відкріпити |
| W5 | Win+D | Показати стіл | Rain/wallpaper видно; desk prompt якщо overlay |
| W6 | Win+L | Lock | Якщо `winlock on` → Fox `lock`; інакше Windows lock. **Не чіпай shell.** |

### 2.4 FoxOS стіл / dock / cursors

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| F1 | `foxos status` | команда | ON, тема/accent ок |
| F2 | ASCII rain / wallpaper | Візуально | Малює, FPS прийнятний для профілю Low/Mid/High |
| F3 | Desk prompt | Клік під лисицею | Приймає коротку команду або фокус |
| F4 | `foxlook status` | команда | look ON, частини збігаються |
| F5 | Курсор | Порухати | Стиль fox/pixel… і scale x1–x3 ок на DPI |
| F6 | Dock style/place/size | Візуально | Як виставлено після підгонки екрана |
| F7 | Іконки стільця | Подивитись | Сховані якщо `icons on` |
| F8 | Dark apps | Відкрити Параметри | Темний chrome |

### 2.5 Lock / hotkeys / сесія

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| L1 | `lock -Status` | команда | open / коректний стан |
| L2 | `Shift+Alt+L` або `lock` | з логіном | Ховає Ghostty; unlock паролем / `lock -Unlock` |
| L3 | `foxhotkeys -Status` | команда | демон running |
| L4 | `Shift+Alt+T` | show Ghostty | Показує/фокусує |
| L5 | `home` | після логіну | Дайджест + пункти меню |

### 2.6 Ghostty у системі

| # | Перевірка | Як | PASS якщо |
|---|-----------|-----|-----------|
| G1 | `chek` | | Сесія Ghostty |
| G2 | Splits | `ctrl+shift+enter` | Панелі |
| G3 | Quick terminal | `ctrl+shift+`` ` | Dropdown |
| G4 | Reload config | `ctrl+shift+,` | Без крашу |
| G5 | Прозорість/blur | Візуально | Відповідає профілю заліза; без 5 FPS |

---

## 3) Кожна команда — чекліст

Легенда статусу в звіті: **PASS** · **FAIL** · **SKIP** (з причиною) · **N/A**.

### 3.1 Автоматично через foxtest -Group info (обов’язково всі)

`chek`, `term -Status`, `sixel`, `interface -Keys`, `foxdeps -Check`, `build -list`, `sites` (list), `foxaddon`/`foxzen`/`ffsync`/`foxhotkeys` -Status, `foxbg -Top 3`, `foxscan -Top 3`, `ftime`, `disk`, **`pulse -Once`**, `ip`, `wifi`, `who`, `users`, `blist`, `apps`, `appbind`, `hash`, `netping`, `weather`, `fday`, `shader status`, `foxos status`, `lock -Status`, `settings -Status`, `foxlife -Status`, `foxstyle -Status`, `foxnodes -Status`, `foxstt` (статус), … (усе що в `foxtest` info).

### 3.2 Ручний прогін / TUI (відкрив → закрив Esc/Ctrl+E)

| Команда | Як перевірити | Не робити |
|---------|---------------|-----------|
| `foxhelp` | меню малюється | — |
| `sw` | панель + стрілки теми | не лишати назавжди в odd theme без відкату |
| `sw -slate` (або інший `-колір`) | один рядок `theme …`, **без** лисиці | — |
| `pulse` | картка оцінки + vitals; **A** → apps | не закривати Defender / Fox / Cursor |
| `pulse apps` | список → Back без закриття | Enter лише на тестову апку з дозволу |
| `themes` | picker | — |
| `noir` / `pride` / `arthas` / `dnote` / `spider` / `notebook` / `default` | toggle → назад | — |
| `foxstyle` | вікно студії відкрилось; закрити | не Apply на чужий профіль без дозволу |
| `foxstyle -NodeEditor` | три панелі дерево/полотно/властивості | не зберігати експеримент як Apply |
| `foxnodes` | overlay / Ctrl+Alt+Space | `-Stop` після перевірки якщо юзер не хоче демон |
| `foxstt` | статус; `-Test` якщо вже встановлено | не качати модель без дозволу (~ГБ) |
| `apple` | сцена → Esc | — |
| `frederik` | хвиля → Esc | — |
| `dj` / `ytm-ui` / `sp-ui` | UI → вихід | — |
| `home` | екран дому | — |
| `settings` | TUI; опційно `-Gui` | — |
| `friend` | старт → `exitt` | довгі діалоги |
| `edit` / `nano` / `view` | на тестовому файлі в notes | — |
| `wai` `go` `up` `nfile` | notes flow | `fdel` без потреби |
| `interface -Split` | split з’явився | — |
| `term -Doctor` | діагностика | — |

### 3.3 Медіа / веб (smoke)

| Команда | Перевірка |
|---------|-----------|
| `yt test` / `youtube` | Firefox відкрив |
| `ytm` | YTM |
| `sp` | Spotify або handler |
| `ser foxterminal` | google |
| `gask hi` | chatgpt tab |
| `ff open youtube` | alias/url |
| `tg` | telegram web |
| `sites` | список/відкриття |
| `foximg` | якщо є тестове фото |

### 3.4 AI

| `ask "ping"` | відповідь або зрозуміла помилка Ollama |
| `friend` | вхід/вихід `exitt` |
| `sum` | SKIP якщо немає OPENAI_API_KEY |

### 3.5 Fox look / os (стан, не руйнувати)

| `foxos status` `foxos apply` | OK |
| `foxlook status` | OK |
| `foxlook cursor preview` | відкриє PNG |
| `shader status` / `on`/`off` за профілем | OK |
| `foxlook shell on` | **SKIP назавжди** у автопрогоні |
| `foxlook off` потім `on` | лише якщо юзер дозволив повний цикл |

### 3.6 Пак / сервіс

| `changelog` | viewer |
| `foxdocs` | стрілки: список гайдів; ← термінал, → Explorer, Back внизу |
| `build -list` | OK |
| `foxpack` | SKIP або dry — не обов’язково писати zip |
| `foxtest` | вже зверху |
| `foxreset` | **SKIP** без дозволу |
| `texit` / `off` | **SKIP** |

### 3.7 Не в маніфесті foxtest

Після `foxtest` подивись «Not covered» і для **кожної** назви:

- або ручний smoke  
- або SKIP з причиною (lib / небезпечно)  
- додай у звіт — нічого не мовчати  

Типові lib (SKIP): `foxauth`, `ghostty-lib`, `foxos-lib`, `foxlook-lib`, `shader-lib`, …

---

## 4) Формат звіту (встав у чат юзеру)

```markdown
## Звіт перевірки FoxTerminal (Windows)

**ПК:** <модель> | **Профіль:** Low/Mid/High/Ultra
**Екрани:** <WxH primary + …> | **Win+P:** Extend/…

### foxtest
- info: PASS=… FAIL=…
- full/not covered: …

### Оболонка Windows
| ID | Перевірка | Результат | Нотатка |
|----|-----------|-----------|---------|
| T1 | Таскбар | PASS/FAIL | |
| A1 | Alt+Tab | PASS/FAIL | |
| W1 | Win | PASS/FAIL | |
| F1 | foxos | PASS/FAIL | |
| … | … | … | |

### Команди (зведення)
| Група | PASS | FAIL | SKIP |
|-------|------|------|------|
| info/foxtest | | | |
| TUI | | | |
| media | | | |
| AI | | | |
| look/os | | | |

### FAIL детально
1. `команда` — що сталось — як фіксити

### Висновок
Готово до щоденної роботи: ТАК/НІ
```

---

## 5) Промпт «прожени все»

```
За FoxTerminal/windows/VERIFY_ALL.md і CURSOR_MEGAGUIDE §23:
1) foxtest -List і foxtest -Group info
2) ручний прогін TUI/media/AI за чеклістом
3) повністю блок оболонки: Alt+Tab, таскбар, Win-меню, dock, foxos, lock, hotkeys
4) усі «not covered» — PASS/FAIL/SKIP
5) фінальна таблиця звіту як у §4
Не вмикай foxlook shell. Не роби texit/off/foxreset.
Українською.
```
