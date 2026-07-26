(() => {
  const wrap = document.getElementById("media-bars");
  const btn = document.getElementById("start-viz");
  if (!wrap || !btn) return;

  const bars = [];
  for (let i = 0; i < 40; i++) {
    const b = document.createElement("div");
    b.style.cssText = "flex:1;border-radius:4px 4px 0 0;min-height:6px;background:linear-gradient(180deg,var(--fox),var(--accent-2));transition:height 0.08s";
    wrap.appendChild(b);
    bars.push(b);
  }

  let running = false;
  let raf;

  function setBtn() {
    const t = window.foxI18n?.t || ((k) => k);
    btn.textContent = running ? "⏸ " + t("media.dj.stop") : "▶ " + t("media.dj.start");
    btn.dataset.vizRunning = running ? "1" : "";
  }

  function tick() {
    if (!running) return;
    bars.forEach((b) => {
      b.style.height = (8 + Math.random() * 90) + "px";
    });
    raf = requestAnimationFrame(tick);
  }

  btn.addEventListener("click", () => {
    running = !running;
    setBtn();
    if (running) tick();
    else cancelAnimationFrame(raf);
  });

  document.addEventListener("foxlangchange", setBtn);
  setBtn();
})();
