(() => {
  const output = document.getElementById("sim-output");
  const input = document.getElementById("sim-input");
  if (!output || !input) return;

  const responses = {
    foxhelp: "Відкриваю меню допомоги… На шпалерах FoxOS — command picker: WALLPAPER / TERMINAL.",
    foxos: "foxos on — ASCII rain, desk, rig. foxos off повертає попередній стіл.",
    noir: "Noir mode toggled. Весь термінал — чорно-білий. Тема sw заблокована.",
    spider: "Spider-Noir panel. Потрібен noir mode. Ctrl+E — вихід.",
    sw: "System info + theme picker. ←→ змінюють тему, Ctrl+E вихід.",
    friend: "FRIEND (Frederik Endiscot) online. exitt — вихід. /help /clear /model",
    ask: 'Usage: ask "your question" [--image path]',
    sites: "Fox Hub: typewriter, snake, invoker, fox-terminal… sites -createn <name>",
    ytm: "Opening YouTube Music in Firefox…",
    "ytm-ui": "YTM DJ visualizer — Play/Pause/Next у TUI.",
    sp: "Opening Spotify…",
    dj: "DJ visualizer — system audio peaks.",
    weather: "Kyiv: +18°C · partly cloudy (wttr.in)",
    ip: "Public: 203.0.113.42 · Local: 192.168.1.7",
    wifi: "SSID: HomeNet · Signal: 82% · Channel: 36",
    who: "Current user: guest (not logged in). Use: l <name> <pass>",
    foxdeps: "Checking: Ghostty ✓ · Nerd Font ✓ · Firefox ✓ · OhMyPosh ✓ · AHK ✓",
    foxtest: "39 ran clean · 27 drew their UI · 0 need attention",
    clear: "__CLEAR__",
    chek: "Terminal: Ghostty ✓ · FOXTERM=1 · FOXTERM_HOST=ghostty · PowerShell 5.1",
    term: "Ghostty config manager: -Status · -Apply · -Edit · -New · -Doctor",
    interface: "Ghostty splits: ctrl+shift+enter · ctrl+shift+j / l · ctrl+shift+z zoom",
    sixel: "Ghostty uses the Kitty graphics protocol (not SIXEL). chafa ✓ · timg ✗",
    ff: "Usage: ff open [alias-or-url]",
    help: "FoxTerminal — portable terminal OS. foxhelp для повного списку."
  };

  function println(text, cls = "sim-line-out") {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  function handle(cmd) {
    const key = cmd.trim().split(/\s+/)[0].toLowerCase();
    if (!key) return;
    println("❯ " + cmd, "sim-line-user");

    if (key === "clear") {
      output.innerHTML = "";
      return;
    }

    const res = responses[key];
    if (res === "__CLEAR__") {
      output.innerHTML = "";
      return;
    }
    if (res) {
      println(res, key === "noir" || key === "spider" ? "sim-line-sys" : "sim-line-out");
      return;
    }
    println(`Command not found: ${key}. Type 'help' or 'foxhelp'.`, "sim-line-err");
  }

  println("FoxTerminal Simulator v1 — не справжній shell, але команди впізнає.", "sim-line-sys");
  println("Спробуй: foxhelp · noir · sites · friend · weather · ytm-ui", "sim-line-out");

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handle(input.value);
      input.value = "";
    }
  });

  document.querySelectorAll("[data-sim-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.simCmd;
      handle(input.value);
      input.value = "";
    });
  });

  function renderBackends() {
    const backendsEl = document.getElementById("backends-list");
    if (!backendsEl || !window.FOX_DATA) return;
    backendsEl.innerHTML = FOX_DATA.backends.map((b) => {
      const desc = foxDesc(FOX_I18N_DATA?.backends, b.name, b.desc);
      return `<div class="kbd-card reveal">
        <div class="kbd-keys"><span class="badge">${b.tag}</span> ${b.name}</div>
        <p class="muted" style="margin:0;font-size:0.88rem">${desc}</p>
      </div>`;
    }).join("");
    backendsEl.querySelectorAll(".kbd-card").forEach((c) => requestAnimationFrame(() => c.classList.add("visible")));
  }
  renderBackends();
  document.addEventListener("foxlangchange", renderBackends);

  function renderGhosttyFeatures() {
    const el = document.getElementById("ghostty-list");
    if (!el || !window.FOX_DATA || !FOX_DATA.ghostty) return;
    el.innerHTML = FOX_DATA.ghostty.map((f) => {
      const desc = foxDesc(FOX_I18N_DATA?.ghostty, f.name, f.desc);
      const keys = f.keys && f.keys !== "—" ? `<span class="badge">${f.keys}</span>` : "";
      return `<div class="kbd-card reveal">
        <div class="kbd-keys">${keys} ${f.name}</div>
        <p class="muted" style="margin:0;font-size:0.88rem">${desc}</p>
      </div>`;
    }).join("");
    el.querySelectorAll(".kbd-card").forEach((c) => requestAnimationFrame(() => c.classList.add("visible")));
  }
  renderGhosttyFeatures();
  document.addEventListener("foxlangchange", renderGhosttyFeatures);
})();
