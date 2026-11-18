(async () => {
  const status = document.getElementById("status");
  const set = (t) => { if (status) status.textContent = t; };

  try {
    if (window.Widget && Widget.self) {
      await Widget.self.init();
      await Widget.self.ready();
    }
  } catch (_) {}

  const post = async (path, label) => {
    set(label + "…");
    try {
      const r = await fetch("http://127.0.0.1:17321" + path, { method: "POST" });
      const t = await r.text();
      set(t || "ok");
    } catch (e) {
      set("Запусти foxseelen watch (міст не слухає :17321)");
    }
  };

  document.getElementById("btn-apply")?.addEventListener("click", () => post("/apply", "Apply"));
  document.getElementById("btn-ui")?.addEventListener("click", () => post("/open-ui", "FOXUI"));
})();
