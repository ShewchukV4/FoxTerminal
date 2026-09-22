(() => {
  const banner = document.getElementById("ctl-banner");
  const api = (window.location.origin.includes("127.0.0.1") ? "" : "http://127.0.0.1:17321");
  let live = false;
  let busy = false;
  let state = null;

  function setBusy(on) {
    busy = on;
    document.querySelectorAll("[data-set], [data-toggle], [data-cycle], #b-lock").forEach((el) => {
      el.disabled = on;
    });
  }

  function paint(next) {
    if (!next) return;
    state = next;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("v-user", next.user || "—");
    set("v-theme", next.theme || "orange");
    set("v-locked", next.locked ? "LOCKED" : "open");
    const onOff = (id, on) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = on ? "on" : "off";
    };
    onOff("b-foxos", next.foxos);
    onOff("b-look", next.look);
    onOff("b-dockHide", next.dockHide);
    onOff("b-shell", next.shell);
    onOff("b-shader", next.shader);
    onOff("b-autostart", next.autostart);
    onOff("b-hotkeys", next.hotkeys);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
    setVal("b-dockStyle", next.dockStyle);
    setVal("b-dockPos", next.dockPos);
    setVal("b-dockSize", next.dockSize);
    setVal("b-dockWins", next.dockWins);
    setVal("b-dockTray", next.dockTray);
    setVal("b-cursor", next.cursor);
    const lock = document.getElementById("b-lock");
    if (lock) lock.textContent = next.lockMinutes > 0 ? (next.lockMinutes + " min") : "off";
    if (next.theme && typeof window.foxApplyTheme === "function") {
      window.foxApplyTheme(next.theme);
    }
  }

  function setBanner(ok, text) {
    if (!banner) return;
    banner.className = ok ? "ctl-banner ok" : "ctl-banner warn";
    banner.innerHTML = text;
  }

  async function fetchJson(url, opts) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) throw new Error("http " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function load() {
    try {
      const next = await fetchJson(api + "/api/state");
      live = true;
      paint(next);
      setBanner(true, "Live Control UI  ·  user " + (next.user || "none"));
      return true;
    } catch {
      live = false;
      setBanner(false, "Host is off. In FoxTerminal run <code>settings -Gui</code>, then click again.");
      return false;
    }
  }

  async function apply(patch) {
    if (busy) return;
    if (!live && !(await load())) return;
    setBusy(true);
    setBanner(true, "Saving…");
    try {
      const next = await fetchJson(api + "/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      paint(next);
      setBanner(true, "Saved  ·  " + (next.theme || "") + "  foxos " + (next.foxos ? "on" : "off") + "  look " + (next.look ? "on" : "off") + "  shader " + (next.shader ? "on" : "off"));
    } catch {
      setBanner(false, "Did not apply. Run <code>settings -Gui</code> and try once more.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  document.querySelectorAll("[data-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      apply(JSON.parse(btn.getAttribute("data-set")));
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-toggle");
      const nowOn = state ? !!state[key] : btn.textContent.trim() === "on";
      apply({ [key]: !nowOn });
    });
  });

  document.querySelectorAll("[data-cycle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-cycle");
      const values = (btn.getAttribute("data-values") || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!key || values.length === 0) return;
      const now = state && state[key] ? String(state[key]) : btn.textContent.trim();
      const i = Math.max(0, values.indexOf(now));
      apply({ [key]: values[(i + 1) % values.length] });
    });
  });

  const lockBtn = document.getElementById("b-lock");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      const nowOn = state ? state.lockMinutes > 0 : lockBtn.textContent.indexOf("min") >= 0;
      apply({ lockMinutes: nowOn ? 0 : 10 });
    });
  }

  load();
})();
