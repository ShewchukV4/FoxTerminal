(() => {
  const grid = document.getElementById("theme-grid");
  const prideGrid = document.getElementById("pride-grid");
  const previewArt = document.getElementById("preview-art");
  const previewPrompt = document.getElementById("preview-prompt");
  const hueSlider = document.getElementById("hue-slider");
  const satSlider = document.getElementById("sat-slider");
  const briSlider = document.getElementById("bri-slider");
  const exportBox = document.getElementById("export-cmd");

  if (!grid || !window.FOX_DATA) return;

  const FOX_ASCII = [
    "    /\\_/\\  ",
    "   ( o.o ) ",
    "    > ^ <  ",
    "  FOXTERM  "
  ];

  function currentPrideStyle() {
    if (!document.body.classList.contains("pride-mode")) return null;
    return window.foxCurrentPrideStyle || localStorage.getItem("foxterm-site-pride-style") || "gay";
  }

  function getFlagColors(styleId) {
    const style = FOX_DATA.prideStyles?.find((s) => s.id === styleId);
    return style?.colors || FOX_DATA.prideStyles?.[0]?.colors || ["#E40303", "#FF8C00", "#008026"];
  }

  function renderArt(themeId) {
    if (!previewArt) return;
    const noir = document.body.classList.contains("noir-mode") || themeId === "noir";
    const prideId = currentPrideStyle();
    const theme = FOX_DATA.themes.find((t) => t.id === themeId);
    const flag = prideId ? getFlagColors(prideId) : null;
    const lines = FOX_ASCII.map((l, li) => l.split("").map((ch, ci) => {
      if (ch === " ") return " ";
      const t = (li * 20 + ci) / 80;
      let hex;
      if (noir) hex = "#888";
      else if (flag) hex = flag[Math.floor(t * flag.length) % flag.length];
      else hex = theme?.hex || "#dc7a14";
      const alpha = 0.45 + (t % 1) * 0.55;
      return `<span style="color:${hex};opacity:${alpha}">${ch}</span>`;
    }).join("")).join("<br>");
    previewArt.innerHTML = lines;
  }

  function renderPrompt(themeId) {
    if (!previewPrompt) return;
    const noir = document.body.classList.contains("noir-mode") || themeId === "noir";
    const prideId = currentPrideStyle();
    const flag = prideId ? getFlagColors(prideId) : null;
    const segs = noir
      ? ["#484848", "#686868", "#787878"]
      : flag
        ? flag.slice(0, 3)
        : ["var(--theme-dark)", "var(--theme-hex)", "var(--theme-bright)"];
    const time = new Date().toLocaleTimeString("uk", { hour: "2-digit", minute: "2-digit" });
    const styleLabel = prideId
      ? (FOX_DATA.prideStyles.find((s) => s.id === prideId)?.label || prideId)
      : themeId;
    const grad = flag
      ? `background:linear-gradient(90deg,${flag.join(",")});-webkit-background-clip:text;background-clip:text;color:transparent`
      : "";
    previewPrompt.innerHTML = `
      <div class="prompt-line">
        ${segs.map((bg, i) => `<span class="seg" style="background:${bg};color:#f2f4fc"> ${["FOXTERM", "user", time][i]} </span>`).join("")}
      </div>
      <div style="margin-top:10px;color:#909090;font-family:var(--mono)">❯ <span style="color:${flag ? flag[0] : "var(--fox)"}">${prideId ? "pride" : "sw"}</span> — ${prideId ? "flag" : "theme"}: <strong style="${grad}">${styleLabel}</strong></div>`;
  }

  function updateExport(themeId) {
    if (!exportBox) return;
    const prideId = currentPrideStyle();
    exportBox.textContent = prideId
      ? `pride → sw → стрілки → ${prideId}  |  pride знову — вихід`
      : `sw → стрілки → ${themeId}  |  pride — flag mode`;
  }

  function updatePrideBar(show) {
    const prideBar = document.getElementById("pride-bar");
    if (!prideBar) return;
    prideBar.hidden = !show;
    prideBar.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function fallbackApplyTheme(id) {
    const theme = FOX_DATA.themes.find((t) => t.id === id) || FOX_DATA.themes[0];
    const root = document.documentElement;
    if (!theme) return;
    document.body.classList.remove("pride-mode");
    if (theme.id === "noir") {
      document.body.classList.add("noir-mode");
      root.style.setProperty("--fox", "#888888");
      root.style.setProperty("--theme-hex", "#888888");
      root.style.setProperty("--theme-mid", "#909090");
      root.style.setProperty("--theme-bright", "#d8d8d8");
      root.style.setProperty("--theme-dark", "#303030");
    } else {
      document.body.classList.remove("noir-mode");
      root.style.setProperty("--fox", theme.hex);
      root.style.setProperty("--theme-hex", theme.hex);
      root.style.setProperty("--theme-mid", theme.hex);
    }
    window.foxCurrentTheme = theme.id;
    localStorage.setItem("foxterm-site-theme", theme.id);
    localStorage.setItem("foxterm-site-pride", "0");
  }

  function fallbackApplyPrideStyle(id) {
    const style = FOX_DATA.prideStyles?.find((s) => s.id === id) || FOX_DATA.prideStyles?.[0];
    if (!style) return;
    document.body.classList.remove("noir-mode");
    document.body.classList.add("pride-mode");
    window.foxCurrentPrideStyle = style.id;
    localStorage.setItem("foxterm-site-pride", "1");
    localStorage.setItem("foxterm-site-pride-style", style.id);
  }

  function applyThemeBridge(id) {
    if (typeof window.foxApplyTheme === "function") {
      window.foxApplyTheme(id);
      return;
    }
    fallbackApplyTheme(id);
  }

  function applyPrideBridge(id) {
    if (typeof window.foxApplyPrideStyle === "function") {
      window.foxApplyPrideStyle(id);
      return;
    }
    fallbackApplyPrideStyle(id);
  }

  function selectTheme(id) {
    applyThemeBridge(id);
    grid.querySelectorAll(".theme-chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
    prideGrid?.querySelectorAll(".theme-chip").forEach((c) => c.classList.remove("active"));
    renderArt(id);
    renderPrompt(id);
    updateExport(id);
    updatePrideBar(false);
    const theme = FOX_DATA.themes.find((t) => t.id === id);
    if (theme && hueSlider) {
      hueSlider.value = theme.hue;
      document.getElementById("hue-val").textContent = theme.hue + "°";
    }
  }

  function selectPrideStyle(id) {
    applyPrideBridge(id);
    prideGrid?.querySelectorAll(".theme-chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
    grid.querySelectorAll(".theme-chip").forEach((c) => c.classList.remove("active"));
    renderArt(window.foxCurrentTheme || "orange");
    renderPrompt(window.foxCurrentTheme || "orange");
    updateExport(window.foxCurrentTheme || "orange");
    updatePrideBar(true);
  }

  FOX_DATA.themes.filter((t) => !t.noir).forEach((t) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip";
    chip.dataset.id = t.id;
    chip.innerHTML = `
      <div class="theme-swatch" style="background:${t.hex}"></div>
      <span>${t.label}</span>`;
    chip.addEventListener("click", () => selectTheme(t.id));
    grid.appendChild(chip);
  });

  FOX_DATA.prideStyles?.forEach((s) => {
    if (!prideGrid) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip pride-chip";
    chip.dataset.id = s.id;
    const grad = `linear-gradient(135deg,${s.colors.join(",")})`;
    chip.innerHTML = `
      <div class="theme-swatch" style="background:${grad}"></div>
      <span>${s.label}</span>`;
    chip.addEventListener("click", () => selectPrideStyle(s.id));
    prideGrid.appendChild(chip);
  });

  document.addEventListener("foxthemechange", (e) => {
    const themeId = e.detail.pride ? (window.foxCurrentTheme || "orange") : e.detail.theme.id;
    renderArt(themeId);
    renderPrompt(themeId);
    if (e.detail.pride) {
      grid.querySelectorAll(".theme-chip").forEach((c) => c.classList.remove("active"));
      prideGrid?.querySelectorAll(".theme-chip").forEach((c) =>
        c.classList.toggle("active", c.dataset.id === e.detail.theme.prideStyle?.id)
      );
      updatePrideBar(true);
    } else {
      grid.querySelectorAll(".theme-chip").forEach((c) =>
        c.classList.toggle("active", c.dataset.id === e.detail.theme.id)
      );
      prideGrid?.querySelectorAll(".theme-chip").forEach((c) => c.classList.remove("active"));
      updatePrideBar(false);
    }
    updateExport(themeId);
  });

  if (localStorage.getItem("foxterm-site-pride") === "1") {
    selectPrideStyle(localStorage.getItem("foxterm-site-pride-style") || "gay");
  } else {
    selectTheme(window.foxCurrentTheme || "orange");
  }

  [hueSlider, satSlider, briSlider].forEach((sl) => {
    sl?.addEventListener("input", () => {
      if (document.body.classList.contains("pride-mode")) return;
      const h = +hueSlider.value;
      const s = +satSlider.value;
      const l = +briSlider.value;
      document.getElementById("hue-val").textContent = h + "°";
      document.getElementById("sat-val").textContent = s + "%";
      document.getElementById("bri-val").textContent = l + "%";
      if (!document.body.classList.contains("noir-mode")) {
        const hsl = `hsl(${h} ${s}% ${l}%)`;
        document.documentElement.style.setProperty("--fox", hsl);
        document.documentElement.style.setProperty("--theme-hex", hsl);
        document.documentElement.style.setProperty("--theme-mid", hsl);
      }
    });
  });

  document.getElementById("shuffle-theme")?.addEventListener("click", () => {
    const pool = FOX_DATA.themes.filter((t) => !t.noir);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selectTheme(pick.id);
    window.foxShowToast("Тема: " + pick.label);
  });

  document.getElementById("noir-demo")?.addEventListener("click", () => {
    document.getElementById("noir-toggle")?.click();
    setTimeout(() => renderArt(window.foxCurrentTheme), 100);
  });

  document.getElementById("pride-demo")?.addEventListener("click", () => {
    selectPrideStyle(window.foxCurrentPrideStyle || "gay");
    window.foxShowToast("Pride: " + (FOX_DATA.prideStyles.find((s) => s.id === (window.foxCurrentPrideStyle || "gay"))?.label || "Gay"));
  });
})();
