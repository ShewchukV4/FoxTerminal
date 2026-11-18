# Перенос FoxOS на Linux

Ноут: ASUS Zenbook S16 UM5606GA, Ryzen AI 9 465, Radeon 880M.
Стіл на Linux — не Seelen і не Nusa. Їх замінює одна оболонка DarkShadowShell.

Windows з диска C не стирати, поки це не сказано окремо. Флешка лише запускає установник.

## Посилання

| Що | Навіщо | Адреса |
| --- | --- | --- |
| CachyOS | Система, на яку ставиться оболонка. Свіже ядро під цей Zenbook | https://cachyos.org/ |
| Образ, який уже скачаний | Desktop ISO 260809, сума перевірена | `C:\Users\shewc\Downloads\CachyOS\cachyos-desktop-linux-260809.iso` |
| Дзеркало ISO | Звідки взято файл | https://mirror.cachyos.org/ISO/desktop/260809/ |
| DarkShadowShell | Док, панель, острів, шпалери Super+W, налаштування | https://github.com/shadowww-dev/DarkShadowShell |
| solid-shadow | Вигляд, з якого зібрано Shewchuk. Це не ISO | https://github.com/hugo-sants/solid-shadow |
| FoxTerminal | Цей репозиторій | https://github.com/ShewchukV4/FoxTerminal |
| Dynamic Music Pill | Острів, якщо лишатись на GNOME, а не на DarkShadowShell | https://extensions.gnome.org/extension/9334/dynamic-music-pill/ |
| Rainclock | Годинник на шпалерах у solid-shadow | https://github.com/hugo-sants/rain-clock-gnome |
| Dash2Dock Lite | Док GNOME | https://extensions.gnome.org/extension/4994/dash2dock-lite/ |
| OpenBar | Верхня панель GNOME | https://extensions.gnome.org/extension/6580/openbar/ |
| Blur my Shell | Скло | https://extensions.gnome.org/extension/3193/blur-my-shell/ |

Debian не використовувати: інсталятор DarkShadowShell його не вміє.

## Що вже зроблено на Windows

- BitLocker на C вимикається скриптом `Prepare-WindowsForLinux.ps1` (розшифрування може ще йти).
- Швидкий запуск і гібернація вимикаються тим самим скриптом, щоб Linux бачив диск.
- Флешка SanDisk записана Rufus 4.16, мітка `COS_202608`.
- Шейдери Fox лишаються вимкнені. Шелл і курсор macOS на Windows закріплені.

## Запуск флешки

1. Перезавантаження, одразу кілька разів **Esc**. Якщо меню дисків не вилізло — **F2**.
2. Обрати **UEFI: SanDisk** або **COS_202608**. Не обирати Windows Boot Manager.
3. Установник побачить Samsung на 954 ГБ. Це теперішній диск C.
4. Поки немає окремої команди стерти Windows, у цьому меню нічого не видаляти.

## Після входу в CachyOS

Термінал:

```bash
sudo pacman -S --needed git base-devel
git clone https://github.com/shadowww-dev/DarkShadowShell shadows-shell
cd shadows-shell
./install.sh
```

Вийти з сесії, на екрані входу обрати **Hyprland**, потім `Super+U` — налаштування оболонки.
`Super+W` — шпалери. Кольори панелі йдуть за картинкою. Острів зверху замінює Nusa: музика, звук і яскравість в одному місці, без другої смужки Seelen.

FoxTerminal з цього репозиторію:

```bash
git clone https://github.com/ShewchukV4/FoxTerminal
```

Шейдери не вмикати.
