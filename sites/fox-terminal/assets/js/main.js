(() => {
  const body = document.body;
  const page = body.dataset.page || "home";
  const cursorGlow = document.getElementById("cursor-glow");
  const toast = document.getElementById("toast");

  const THEME_KEY = "foxterm-site-theme";
  const NOIR_KEY = "foxterm-site-noir";
  const PRIDE_KEY = "foxterm-site-pride";
  const PRIDE_STYLE_KEY = "foxterm-site-pride-style";
  const SCAN_KEY = "foxterm-site-scan";

  function pickPrideColor(colors, index) {
    if (!colors?.length) return "#ff6eb4";
    return colors[Math.min(index, colors.length - 1)];
  }

  function applyPrideStyle(styleId) {
    const data = window.FOX_DATA;
    if (!data?.prideStyles) return;
    const style = data.prideStyles.find((s) => s.id === styleId) || data.prideStyles[0];
    body.classList.remove("noir-mode");
    body.classList.add("pride-mode");
    localStorage.setItem(PRIDE_KEY, "1");
    localStorage.setItem(PRIDE_STYLE_KEY, style.id);
    window.foxCurrentPrideStyle = style.id;

    const c = style.colors;
    const mid = hexToRgb(pickPrideColor(c, 1));
    const dark = mixColor(hexToRgb(pickPrideColor(c, 0)), { r: 0, g: 0, b: 0 }, 0.35);
    const bright = mixColor(hexToRgb(pickPrideColor(c, Math.min(2, c.length - 1))), { r: 255, g: 255, b: 255 }, 0.35);

    document.documentElement.style.setProperty("--fox", pickPrideColor(c, 1));
    document.documentElement.style.setProperty("--theme-hex", pickPrideColor(c, 1));
    document.documentElement.style.setProperty("--theme-mid", pickPrideColor(c, 1));
    document.documentElement.style.setProperty("--theme-bright", rgbToHex(bright.r, bright.g, bright.b));
    document.documentElement.style.setProperty("--theme-dark", rgbToHex(dark.r, dark.g, dark.b));

    document.dispatchEvent(new CustomEvent("foxthemechange", {
      detail: { theme: { id: "pride", label: style.label, prideStyle: style }, noir: false, pride: true }
    }));
  }
  window.foxApplyPrideStyle = applyPrideStyle;

  function exitPrideMode() {
    body.classList.remove("pride-mode");
    localStorage.setItem(PRIDE_KEY, "0");
  }
  window.foxExitPrideMode = exitPrideMode;

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
  }
  window.foxShowToast = showToast;

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function mixColor(a, b, t) {
    const A = typeof a === "string" ? hexToRgb(a) : a;
    const B = typeof b === "string" ? hexToRgb(b) : b;
    return {
      r: Math.round(A.r + (B.r - A.r) * t),
      g: Math.round(A.g + (B.g - A.g) * t),
      b: Math.round(A.b + (B.b - A.b) * t)
    };
  }

  function toNoirGray(r, g, b) {
    const lum = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    if (lum < 48) return { r: 20, g: 20, b: 20 };
    if (lum < 112) return { r: 85, g: 85, b: 85 };
    if (lum < 176) return { r: 155, g: 155, b: 155 };
    return { r: 225, g: 225, b: 225 };
  }

  function applySiteTheme(themeId) {
    const data = window.FOX_DATA;
    if (!data) return;
    const theme = data.themes.find((t) => t.id === themeId) || data.themes[0];
    const noir = body.classList.contains("noir-mode") || theme.noir;

    exitPrideMode();

    let dark, mid, bright;
    if (noir) {
      dark = { r: 18, g: 18, b: 18 };
      mid = { r: 136, g: 136, b: 136 };
      bright = { r: 216, g: 216, b: 216 };
      body.classList.add("noir-mode");
    } else {
      body.classList.remove("noir-mode");
      const base = hexToRgb(theme.hex);
      dark = mixColor({ r: 0, g: 0, b: 0 }, base, 0.35);
      mid = base;
      bright = mixColor(base, { r: 255, g: 255, b: 255 }, 0.45);
    }

    const hex = rgbToHex(mid.r, mid.g, mid.b);
    const hexBright = rgbToHex(bright.r, bright.g, bright.b);
    const hexDark = rgbToHex(dark.r, dark.g, dark.b);

    document.documentElement.style.setProperty("--fox", hex);
    document.documentElement.style.setProperty("--theme-hex", hex);
    document.documentElement.style.setProperty("--theme-mid", hex);
    document.documentElement.style.setProperty("--theme-bright", hexBright);
    document.documentElement.style.setProperty("--theme-dark", hexDark);

    localStorage.setItem(THEME_KEY, theme.id);
    window.foxCurrentTheme = theme.id;
    document.dispatchEvent(new CustomEvent("foxthemechange", { detail: { theme, noir, pride: false } }));
  }
  window.foxApplyTheme = applySiteTheme;

  const savedTheme = localStorage.getItem(THEME_KEY) || "orange";
  if (localStorage.getItem(NOIR_KEY) === "1") body.classList.add("noir-mode");
  if (localStorage.getItem(SCAN_KEY) === "1") body.classList.add("scan-on");
  if (localStorage.getItem(PRIDE_KEY) === "1" && localStorage.getItem(NOIR_KEY) !== "1") {
    applyPrideStyle(localStorage.getItem(PRIDE_STYLE_KEY) || "gay");
  } else {
    applySiteTheme(savedTheme);
  }

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    body.classList.toggle("light");
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = body.classList.contains("light") ? "Dark" : "Light";
  });

  document.getElementById("noir-toggle")?.addEventListener("click", () => {
    body.classList.toggle("noir-mode");
    const on = body.classList.contains("noir-mode");
    localStorage.setItem(NOIR_KEY, on ? "1" : "0");
    if (on) exitPrideMode();
    applySiteTheme(window.foxCurrentTheme || savedTheme);
    const t = window.foxI18n?.t || ((k) => k);
    showToast(on ? t("toast.noirOn") : t("toast.noirOff"));
  });

  document.getElementById("scan-toggle")?.addEventListener("click", () => {
    body.classList.toggle("scan-on");
    localStorage.setItem(SCAN_KEY, body.classList.contains("scan-on") ? "1" : "0");
  });

  if (cursorGlow) {
    window.addEventListener("pointermove", (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    });
  }

  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.dataset.page === page) a.classList.add("active");
  });

  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    reveals.forEach((el) => io.observe(el));
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.dataset.copy || btn.closest("[data-copy-text]")?.dataset.copyText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const tr = window.foxI18n?.t || ((k) => k);
      showToast(tr("toast.copiedPrefix") + text);
    } catch {
      showToast((window.foxI18n?.t || ((k) => k))("toast.copyFail"));
    }
  });

  function typeWriter(el, lines, speed = 28) {
    if (!el) return;
    let li = 0, ci = 0;
    el.innerHTML = "";
    function tick() {
      if (li >= lines.length) {
        const caret = document.createElement("span");
        caret.className = "caret";
        el.appendChild(caret);
        return;
      }
      const line = lines[li];
      if (ci === 0) {
        const div = document.createElement("div");
        div.className = "prompt-line";
        el.appendChild(div);
      }
      const current = el.lastChild;
      if (ci < line.length) {
        current.innerHTML += line[ci] === "<" ? "" : line[ci];
        if (line.slice(ci, ci + 4) === "<seg") {
          const end = line.indexOf("</seg>", ci) + 6;
          current.innerHTML += line.slice(ci, end);
          ci = end;
        } else ci++;
        setTimeout(tick, speed);
      } else {
        li++; ci = 0;
        setTimeout(tick, speed * 2);
      }
    }
    tick();
  }

  document.querySelectorAll(".portal-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    });
  });

  window.foxTypeWriter = typeWriter;
})();
