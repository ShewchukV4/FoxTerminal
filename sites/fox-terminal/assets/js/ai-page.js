(() => {
  const out = document.getElementById("ai-chat");
  const inp = document.getElementById("ai-input");
  if (!out || !inp) return;

  let i = 0;
  const replyKeys = ["ai.demo.r1", "ai.demo.r2", "ai.demo.r3", "ai.demo.r4", "ai.demo.r5"];

  function t(key) {
    return window.foxI18n?.t(key) || key;
  }

  function say(text, cls) {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  function boot() {
    out.innerHTML = "";
    say(t("ai.demo.sys"), "sim-line-sys");
  }

  boot();
  document.addEventListener("foxlangchange", boot);

  inp.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !inp.value.trim()) return;
    say("you: " + inp.value, "sim-line-user");
    const r = inp.value.startsWith("/")
      ? t("ai.demo.slash")
      : t(replyKeys[i++ % replyKeys.length]);
    setTimeout(() => say("FRIEND: " + r, "sim-line-out"), 320);
    inp.value = "";
  });
})();
