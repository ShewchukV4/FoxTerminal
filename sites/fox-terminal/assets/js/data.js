window.FOX_DATA = {
  themes: [
    { id: "orange",  label: "Original", hex: "#DC7A14", hue: 30,  noir: false },
    { id: "blue",    label: "Blue",     hex: "#5A8CFF", hue: 210, noir: false },
    { id: "purple",  label: "Purple",   hex: "#A05AFF", hue: 280, noir: false },
    { id: "cyan",    label: "Cyan",     hex: "#46DCC8", hue: 180, noir: false },
    { id: "crimson", label: "Crimson",  hex: "#D14A5A", hue: 350, noir: false },
    { id: "rose",    label: "Rose",     hex: "#E05A9A", hue: 330, noir: false },
    { id: "magenta", label: "Magenta",  hex: "#D44BBD", hue: 300, noir: false },
    { id: "violet",  label: "Violet",   hex: "#8356E6", hue: 270, noir: false },
    { id: "indigo",  label: "Indigo",   hex: "#4E75D8", hue: 230, noir: false },
    { id: "sky",     label: "Sky",      hex: "#6FC4F0", hue: 200, noir: false },
    { id: "teal",    label: "Teal",     hex: "#36B8B3", hue: 170, noir: false },
    { id: "mint",    label: "Mint",     hex: "#6BD3B0", hue: 155, noir: false },
    { id: "emerald", label: "Emerald",  hex: "#4CB874", hue: 140, noir: false },
    { id: "lime",    label: "Lime",     hex: "#9BD94A", hue: 90,  noir: false },
    { id: "gold",    label: "Gold",     hex: "#E0B148", hue: 45,  noir: false },
    { id: "amber",   label: "Amber",    hex: "#E5943A", hue: 35,  noir: false },
    { id: "peach",   label: "Peach",    hex: "#E7A37C", hue: 25,  noir: false },
    { id: "coral",   label: "Coral",    hex: "#E07D69", hue: 15,  noir: false },
    { id: "ruby",    label: "Ruby",     hex: "#C83B5C", hue: 355, noir: false },
    { id: "slate",   label: "Slate",    hex: "#7D93B0", hue: 215, noir: false },
    { id: "ice",     label: "Ice",      hex: "#7CC8E8", hue: 195, noir: false },
    { id: "neon",    label: "Neon",     hex: "#7EF06B", hue: 110, noir: false },
    { id: "forest",  label: "Forest",   hex: "#4E8C66", hue: 125, noir: false },
    { id: "mocha",   label: "Mocha",    hex: "#A17A5A", hue: 30,  noir: false },
    { id: "black",   label: "Black",    hex: "#111111", hue: 0,   noir: false },
    { id: "white",   label: "White",    hex: "#F2F2F2", hue: 0,   noir: false },
    { id: "noir",    label: "Noir",     hex: "#888888", hue: 0,   noir: true }
  ],

  prideStyles: [
    { id: "gay",     label: "Gay",     colors: ["#078D70", "#26CEAA", "#98E8C1", "#FFFFFF", "#7BADE2", "#5049CC", "#3D1A78"] },
    { id: "bi",      label: "Bi",      colors: ["#D60270", "#9B4F96", "#0038A8"] },
    { id: "lesbian", label: "Lesbian", colors: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4"] },
    { id: "trans",   label: "Trans",   colors: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"] },
    { id: "femboy",  label: "Femboy",  colors: ["#FF3D8A", "#FF6BAD", "#FF9FCC", "#FFFFFF", "#6AABFF", "#2E6FD4", "#1247A8"] }
  ],

  commandGroups: [
    {
      id: "core",
      title: "Ядро",
      icon: "⚡",
      cmds: [
        { name: "foxhelp", usage: "foxhelp", desc: "Інтерактивне меню допомоги з усіма командами" },
        { name: "foxdeps", usage: "foxdeps [-Check] [-Install]", desc: "Перевірка та авто-встановлення залежностей" },
        { name: "foxreset", usage: "foxreset [-Git] [-NoGit]", desc: "Жорсткий reset кешів і prompt" },
        { name: "build", usage: "build [-list|-restore <name>]", desc: "Знімки/відновлення стану FoxTerminal" },
        { name: "foxpack", usage: "foxpack [-Full] [-OutPath path] [-Open]", desc: "Пакування конфігів/команд для backup або share" },
        { name: "foxscan", usage: "foxscan", desc: "Швидкий scan health-стану середовища" },
        { name: "foxbg", usage: "foxbg", desc: "Запуск FoxTerminal у фоновому режимі" },
        { name: "apps", usage: "apps", desc: "Каталог локальних застосунків і швидкого запуску" },
        { name: "appbind", usage: "appbind", desc: "Прив'язки застосунків до коротких alias" },
        { name: "foxauth", usage: "foxauth", desc: "Сервісна авторизація/стан auth-модулів" },
        { name: "clear", usage: "clear", desc: "Очистити екран" },
        { name: "texit", usage: "texit", desc: "Примусовий вихід з процесу терміналу" }
      ]
    },
    {
      id: "ai",
      title: "AI / FRIEND",
      icon: "🤖",
      cmds: [
        { name: "friend", usage: "friend", desc: "Чат Frederik Endiscot (FRIEND); exitt для виходу" },
        { name: "ask", usage: 'ask "..." [--image path]', desc: "One-shot AI через Ollama" },
        { name: "sum", usage: "sum <file>", desc: "Summarize файлу через OpenAI" },
        { name: "gask", usage: "gask <question>", desc: "ChatGPT у Firefox з prefilled query" },
        { name: "ffbot", usage: "ffbot <prompt>", desc: "Швидкий web-бриф через Firefox-бот потік" },
        { name: "foxcodec", usage: "foxcodec <task>", desc: "AI helper для code/automation сценаріїв" }
      ]
    },
    {
      id: "media",
      title: "Медіа",
      icon: "🎵",
      cmds: [
        { name: "yt", usage: "yt <query>", desc: "YouTube search у Firefox" },
        { name: "youtube", usage: "youtube", desc: "Відкрити YouTube" },
        { name: "ytm", usage: "ytm [query|alias|url]", desc: "YouTube Music" },
        { name: "ytm-ui", usage: "ytm-ui", desc: "YTM TUI + DJ visualizer" },
        { name: "ytsplit", usage: "ytsplit [url]", desc: "Розбір/відкриття YouTube-плейлисту через split workflow" },
        { name: "sp", usage: "sp [query|url]", desc: "Spotify open/search" },
        { name: "sp-ui", usage: "sp-ui", desc: "Spotify DJ UI + controls" },
        { name: "dj", usage: "dj", desc: "Audio-level DJ visualizer" }
      ]
    },
    {
      id: "web",
      title: "Веб / Sites",
      icon: "🌐",
      cmds: [
        { name: "ff", usage: "ff open [alias-or-url]", desc: "URL/alias у Firefox" },
        { name: "sites", usage: "sites [-createn name] [-open name]", desc: "Локальні сайти Fox Hub" },
        { name: "bbind", usage: "bbind", desc: "Alias для ff або custom .bat" },
        { name: "blist", usage: "blist", desc: "Список alias (bindings.json)" },
        { name: "bdel", usage: "bdel <alias>", desc: "Видалити alias/binding" },
        { name: "ser", usage: "ser <terms>", desc: "Google search у Firefox" }
      ]
    },
    {
      id: "telegram",
      title: "Telegram",
      icon: "✈️",
      cmds: [
        { name: "tg", usage: "tg [@user|alias]", desc: "Відкрити Telegram Web/чат" },
        { name: "tgub", usage: "tgub @user [alias]", desc: "Додати Telegram alias binding" },
        { name: "tglist", usage: "tglist", desc: "Показати Telegram bindings" }
      ]
    },
    {
      id: "notes",
      title: "Нотатки",
      icon: "📝",
      cmds: [
        { name: "wai", usage: "wai", desc: "Де ти в notes + список файлів" },
        { name: "go", usage: "go <path>", desc: "Змінити папку в notes" },
        { name: "up", usage: "up", desc: "Піднятись на рівень вище у notes" },
        { name: "nfile", usage: "nfile <name.ext>", desc: "Створити файл" },
        { name: "nfould", usage: "nfould <name>", desc: "Створити папку" },
        { name: "edit", usage: "edit <name.txt>", desc: "Редагувати .txt у терміналі" },
        { name: "nano", usage: "nano <name.txt>", desc: "Швидке редагування файлу через nano-style wrapper" },
        { name: "view", usage: "view <name.txt>", desc: "Перегляд текстового файлу" },
        { name: "fdel", usage: "fdel <name>", desc: "Видалити файл (password)" },
        { name: "dnote", usage: "dnote", desc: "Daily note mode з короткими шаблонами" }
      ]
    },
    {
      id: "hash",
      title: "Hash",
      icon: "#️⃣",
      cmds: [
        { name: "hash", usage: "hash <text>", desc: "Hash рядка/тексту" },
        { name: "unhash", usage: "unhash <value>", desc: "Lookup/перевірка hash-значення" },
        { name: "foxhash-lookup", usage: "foxhash-lookup <value>", desc: "Розширений lookup hash через fox helper" }
      ]
    },
    {
      id: "network",
      title: "Мережа / Статус",
      icon: "📡",
      cmds: [
        { name: "weather", usage: "weather [location]", desc: "Погода через wttr.in" },
        { name: "ip", usage: "ip", desc: "Public + local IPs" },
        { name: "wifi", usage: "wifi", desc: "Wi-Fi status" },
        { name: "reconnect", usage: "reconnect", desc: "Перепідключення мережевого профілю" },
        { name: "netping", usage: "netping [targets]", desc: "Ping 8.8.8.8 або custom" },
        { name: "fday", usage: "fday [location]", desc: "Daily summary: time+weather+wifi+ip" },
        { name: "ftime", usage: "ftime", desc: "Поточний час/таймблок для status-репортів" },
        { name: "disk", usage: "disk", desc: "Disk usage по дисках" },
        { name: "sixel", usage: "sixel", desc: "Перевірка SIXEL/графічної підтримки терміналу" }
      ]
    },
    {
      id: "terminalops",
      title: "Terminal",
      icon: "🧱",
      cmds: [
        { name: "chek", usage: "chek", desc: "Поточний backend терміналу" },
        { name: "term", usage: "term [-Set auto|windows|mintty|cygwin]", desc: "Перемикач backend через меню" },
        { name: "interface", usage: "interface [-TwoWindows] [-Gui]", desc: "tmux split UI / GUI split" },
        { name: "interface-deps", usage: "interface-deps", desc: "Перевірка/встановлення залежностей interface mode" },
        { name: "interface-gui", usage: "interface-gui", desc: "GUI launcher для interface-поділу" }
      ]
    },
    {
      id: "themes",
      title: "Теми",
      icon: "🎨",
      cmds: [
        { name: "sw", usage: "sw [live] [color|mono]", desc: "System info + перемикач тем (стрілки)" },
        { name: "themes", usage: "themes", desc: "Повний picker тем FoxTerminal" },
        { name: "noir", usage: "noir", desc: "Повний чорно-білий режим, блокує sw picker" },
        { name: "pride", usage: "pride", desc: "Pride mode: sw стрілки — gay/bi/lesbian/trans/femboy" },
        { name: "arthas", usage: "arthas", desc: "Контрастний dark preset стилю Arthas" },
        { name: "apple", usage: "apple", desc: "Світлий Apple-style preset" },
        { name: "spider", usage: "spider", desc: "Noir-only: Spider-Noir панель + system info" },
        { name: "frederik", usage: "frederik", desc: "Фірмовий візуальний preset Frederik mode" }
      ]
    },
    {
      id: "auth",
      title: "Користувачі",
      icon: "🔐",
      cmds: [
        { name: "nuser", usage: "nuser <name> <pass>", desc: "Створити нового користувача" },
        { name: "l", usage: "l <name> <pass>", desc: "Login або register" },
        { name: "who", usage: "who", desc: "Поточний користувач" },
        { name: "users", usage: "users", desc: "Список зареєстрованих" },
        { name: "passwd", usage: "passwd", desc: "Змінити пароль" },
        { name: "uexit", usage: "uexit", desc: "Logout з поточного user-контексту" }
      ]
    },
    {
      id: "hotkeys",
      title: "Hotkeys",
      icon: "⌨️",
      cmds: [
        { name: "foxhotkeys", usage: "foxhotkeys [-Stop] [-Restart]", desc: "AHK daemon для глобальних hotkeys" },
        { name: "foxinfo", usage: "foxinfo", desc: "Менеджер bindings + шлях FoxTerminal" },
        { name: "hk_lib", usage: "hk_lib", desc: "Службова бібліотека hotkey-хелперів" },
        { name: "hk_parse", usage: "hk_parse", desc: "Парсер hotkey-конфігів (internal utility)" }
      ]
    },
    {
      id: "advanced",
      title: "Advanced",
      icon: "🛠️",
      cmds: [
        { name: "sw-script", usage: "sw-script", desc: "Низькорівневий скрипт тем-перемикача (internal)" },
        { name: "spider-script", usage: "spider-script", desc: "Скрипт рендеру Spider-панелі (internal)" },
        { name: "note-lib", usage: "note-lib", desc: "Бібліотека notes-операцій (internal)" },
        { name: "pride-lib", usage: "pride-lib", desc: "Бібліотека pride-палітр і режимів (internal)" },
        { name: "foxterm-cmd-init", usage: "foxterm-cmd-init", desc: "Ініціалізація cmd-оточення FoxTerminal (internal)" }
      ]
    }
  ],

  hotkeys: [
    { keys: "Shift+Alt+Y", action: "Відкрити YouTube у Firefox", color: "#ff4e45" },
    { keys: "Shift+Ctrl+Y", action: "Закрити вкладку YouTube", color: "#ff9a45" },
    { keys: "Shift+Alt+F", action: "Firefox / bring to front", color: "#5a8cff" },
    { keys: "Shift+Alt+M", action: "YouTube Music", color: "#24d6c8" },
    { keys: "Shift+Alt+Space", action: "Показати FoxTerminal", color: "#7c5cff" },
    { keys: "Shift+Ctrl+Space", action: "Сховати FoxTerminal (фон)", color: "#888888" }
  ],

  backends: [
    { name: "Windows Terminal", desc: "Основний FoxTerminal profile з Oh My Posh", tag: "default" },
    { name: "FoxTerminalApp", desc: "Власний Avalonia PTY термінал (.NET 9)", tag: "app" },
    { name: "mintty / Cygwin", desc: "interface mode, tmux split, SIXEL", tag: "unix" },
    { name: "MSYS2 / Git Bash", desc: "bash scripts, sites-ui.sh TUI", tag: "bash" }
  ],

  stats: [
    { n: "85+", label: "команд у cmd\\" },
    { n: "27", label: "тем кольорів" },
    { n: "15", label: "локальних сайтів" },
    { n: "8", label: "сторінок презентації" }
  ]
};
