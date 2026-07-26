(function () {
  function paintThemes(container, activeId) {
    if (!container || !window.FoxThemes) return;
    const quick = [
      "slate", "orange", "blue", "purple", "cyan", "noir",
      "arthas-dark", "apple", "pride-gay", "neon", "ruby", "gold"
    ];
    container.textContent = "";
    quick.forEach((id) => {
      const theme = FoxThemes.getFoxTheme(id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-mini" + (id === activeId ? " active" : "");
      btn.title = theme.label;
      btn.style.background = theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
      btn.addEventListener("click", () => {
        FoxThemes.applyFoxTheme(theme);
        paintThemes(container, theme.id);
        const label = document.getElementById("theme-current-label");
        if (label) label.textContent = theme.label;
        const swatch = document.getElementById("theme-current-swatch");
        if (swatch) {
          swatch.style.background = theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
        }
      });
      container.appendChild(btn);
    });
  }

  function paintThemeCards(grid) {
    if (!grid || !window.FoxThemes) return;
    grid.textContent = "";
    FoxThemes.listFoxThemes().slice(0, 12).forEach((theme, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "theme-card";
      card.style.animationDelay = `${index * 0.03}s`;
      card.innerHTML = `
        <div class="theme-swatch" style="background:${theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`}"></div>
        <div class="theme-card-title">${theme.label}</div>
        <div class="theme-card-group">${theme.group}</div>
      `;
      card.addEventListener("click", () => {
        FoxThemes.applyFoxTheme(theme);
        document.querySelectorAll(".theme-card").forEach((el) => el.classList.remove("active"));
        card.classList.add("active");
        const label = document.getElementById("theme-current-label");
        if (label) label.textContent = theme.label;
        const swatch = document.getElementById("theme-current-swatch");
        if (swatch) {
          swatch.style.background = theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
        }
      });
      grid.appendChild(card);
    });
  }

  function wireTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
    const panels = {
      terminal: document.getElementById("panel-terminal"),
      sessions: document.getElementById("panel-sessions"),
      themes: document.getElementById("panel-themes"),
      translate: document.getElementById("panel-translate"),
      settings: document.getElementById("panel-settings")
    };
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        Object.entries(panels).forEach(([key, panel]) => {
          if (panel) panel.classList.toggle("active", key === name);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.FoxThemes) {
      FoxThemes.applyFoxTheme("slate");
    }
    paintThemes(document.getElementById("theme-row"), "slate");
    paintThemeCards(document.getElementById("themes-grid"));
    wireTabs();

    const out = document.getElementById("terminal-output");
    if (out && !out.children.length) {
      out.innerHTML = `
        <div class="line info">Demo sidebar — visual only</div>
        <div class="line command">~> ff open youtube</div>
        <div class="line success">Opened https://www.youtube.com</div>
      `;
    }

    const sessions = document.getElementById("sessions-list");
    if (sessions && !sessions.children.length) {
      sessions.innerHTML = `
        <article class="session-card pinned">
          <div class="session-head"><div>
            <h3 class="session-title">★ Work</h3>
            <p class="session-meta">3 сайт(ів) · сесія</p>
          </div></div>
          <div class="session-controls">
            <button type="button" class="open-btn">Відкрити</button>
            <button type="button">Нове вікно</button>
          </div>
        </article>
      `;
    }
  });
})();
