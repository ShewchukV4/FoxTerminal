(() => {
  const cards = document.getElementById("hotkey-cards");
  const viz = document.getElementById("keyboard-viz");
  if (!cards || !viz || !window.FOX_DATA) return;

  function action(h) {
    return foxDesc(FOX_I18N_DATA?.hotkeys, h.keys, h.action);
  }

  function renderCards() {
    cards.innerHTML = "";
    FOX_DATA.hotkeys.forEach((h, idx) => {
      const card = document.createElement("div");
      card.className = "kbd-card reveal";
      const parts = h.keys.split("+").map((k) => `<kbd>${k}</kbd>`).join(" + ");
      card.innerHTML = `<div class="kbd-keys">${parts}</div><p class="muted" style="margin:0;font-size:0.88rem">${action(h)}</p>`;
      card.style.borderColor = h.color + "44";
      card.style.animationDelay = (idx * 0.07) + "s";
      cards.appendChild(card);
      requestAnimationFrame(() => card.classList.add("visible"));
    });
  }

  renderCards();
  document.addEventListener("foxlangchange", renderCards);

  const keys = [
    { label: "Space", x: 180, y: 180, w: 200, hk: "Shift+Alt+Space" },
    { label: "Y", x: 60, y: 100, w: 44, hk: "Shift+Alt+Y" },
    { label: "F", x: 20, y: 140, w: 44, hk: "Shift+Alt+F" },
    { label: "M", x: 110, y: 100, w: 44, hk: "Shift+Alt+M" },
    { label: "T", x: 155, y: 100, w: 44, hk: "Shift+Alt+T" }
  ];

  const hkMap = Object.fromEntries(FOX_DATA.hotkeys.map((h) => [h.keys, h]));

  keys.forEach((k) => {
    const cap = document.createElement("button");
    cap.type = "button";
    cap.className = "key-cap";
    cap.textContent = k.label;
    cap.style.left = k.x + "px";
    cap.style.top = k.y + "px";
    cap.style.width = k.w + "px";
    const hk = hkMap[k.hk];
    if (hk) cap.style.setProperty("--key-color", hk.color);
    cap.addEventListener("click", () => {
      viz.querySelectorAll(".key-cap").forEach((c) => c.classList.remove("lit"));
      cap.classList.add("lit");
      window.foxShowToast?.(k.hk + " → " + action(hk || { keys: k.hk, action: "" }));
    });
    viz.appendChild(cap);
  });
})();
