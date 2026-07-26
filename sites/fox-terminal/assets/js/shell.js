/* Shared shell helpers */
(() => {
  const mark = document.querySelector(".brand-mark");
  if (mark && !mark.textContent.trim()) mark.textContent = "❯";

  document.querySelectorAll(".page-hero-visual.hero-mesh").forEach((el) => {
    if (el.dataset.meshReady) return;
    el.dataset.meshReady = "1";
    if (!el.querySelector(".hero-mesh-blobs")) {
      el.innerHTML = `
        <div class="hero-mesh-blobs"><span class="blob blob-1"></span><span class="blob blob-2"></span><span class="blob blob-3"></span></div>
        <div class="hero-mesh-scan"></div>
        <div class="hero-mesh-grid"></div>
        <div class="hero-mesh-label mono"></div>
        <div class="hero-mesh-swatch"></div>`;
    }
    const mesh = el.dataset.mesh || document.body.dataset.page || "themes";
    el.dataset.mesh = mesh;
    const label = el.querySelector(".hero-mesh-label");
    const meshKey = mesh === "home" ? "home.eyebrow" : mesh + ".mesh";
    if (label) {
      label.dataset.i18n = meshKey;
      if (window.foxI18n) label.textContent = foxI18n.t(meshKey);
    }
    const swatches = {
      themes: ["#ff6b35", "#7c5cff", "#24d6c8", "#dc7a14"],
      ai: ["#5a8cff", "#a855f7", "#24d6c8", "#0ea5e9"],
      commands: ["#3ecf8e", "#5a8cff", "#dc7a14", "#7c5cff"],
      terminal: ["#dc7a14", "#484848", "#24d6c8", "#909090"],
      media: ["#ff4e45", "#ff9a45", "#7c5cff", "#24d6c8"],
      hotkeys: ["#5a8cff", "#24d6c8", "#7c5cff", "#ff9a45"],
      ecosystem: ["#24d6c8", "#5a8cff", "#3ecf8e", "#7c5cff"]
    };
    const sw = el.querySelector(".hero-mesh-swatch");
    if (sw) {
      sw.innerHTML = (swatches[mesh] || swatches.themes)
        .map((c) => `<span style="background:${c}"></span>`).join("");
    }
  });

  document.addEventListener("foxlangchange", () => {
    document.querySelectorAll(".hero-mesh-label[data-i18n]").forEach((el) => {
      el.textContent = foxI18n.t(el.dataset.i18n);
    });
  });
})();
