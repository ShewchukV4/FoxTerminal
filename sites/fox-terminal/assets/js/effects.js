(() => {
  const body = document.body;
  const page = body.dataset.page || "home";
  const isHome = page === "home";

  /* ── Intro splash ── */
  const splash = document.getElementById("intro-splash");
  if (splash) {
    body.classList.add("is-loading");
    const bar = splash.querySelector(".splash-bar-fill");
    const dur = isHome ? 2400 : 1100;
    let start = null;

    function step(ts) {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      if (bar) bar.style.width = (p * 100) + "%";
      if (p < 1) requestAnimationFrame(step);
      else {
        splash.classList.add("out");
        body.classList.remove("is-loading");
        body.classList.add("entered");
        setTimeout(() => splash.remove(), 700);
        runEntrance();
      }
    }
    requestAnimationFrame(step);
  } else {
    body.classList.add("entered");
    runEntrance();
  }

  function runEntrance() {
    document.querySelectorAll("[data-stagger]").forEach((el, i) => {
      el.style.animationDelay = (i * 0.08) + "s";
      el.classList.add("stagger-in");
    });
    animateCounters();
    if (isHome) startHeroSequence();
  }

  /* ── Background particles ── */
  const canvas = document.getElementById("bg-particles");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let pts = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const n = Math.min(90, Math.floor(w * h / 14000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        a: 0.15 + Math.random() * 0.45
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const col = getComputedStyle(document.documentElement).getPropertyValue("--fox").trim() || "#dc7a14";
      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── Magnetic buttons ── */
  document.querySelectorAll(".btn-primary, .magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });

  /* ── Counter animation ── */
  function animateCounters() {
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || "";
      const prefix = el.dataset.prefix || "";
      if (isNaN(target)) return;
      let cur = 0;
      const step = Math.max(1, Math.ceil(target / 40));
      const tick = () => {
        cur = Math.min(target, cur + step);
        el.textContent = prefix + cur + suffix;
        if (cur < target) requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /* ── Hero terminal typewriter ── */
  function startHeroSequence() {
    const term = document.getElementById("hero-typewriter");
    if (!term) return;

    const lines = [
      { html: '<span class="seg seg-fox"> FOXTERM </span><span class="seg seg-user"> guest </span><span class="seg seg-time"> ' + new Date().toLocaleTimeString("uk", { hour: "2-digit", minute: "2-digit" }) + ' </span>', delay: 0 },
      { html: '❯ <span class="cmd-glow">foxhelp</span>', delay: 400, cls: "line-cmd" },
      { html: "=== FoxTerminal commands ===", delay: 900, cls: "line-dim" },
      { html: "  themes · appbind · friend · build · sites", delay: 1200, cls: "line-dim" },
      { html: '❯ <span class="caret"></span>', delay: 1600, cls: "line-cmd" }
    ];

    term.innerHTML = "";
    lines.forEach((ln) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.className = "prompt-line " + (ln.cls || "");
        div.innerHTML = ln.html;
        div.style.animation = "lineIn 0.5s cubic-bezier(0.22,1,0.36,1) both";
        term.appendChild(div);
      }, ln.delay);
    });
  }

  /* ── Marquee + stats i18n ── */
  function buildMarquee() {
    const track = document.querySelector(".marquee-track");
    if (!track || !window.foxI18n) return;
    const t = foxI18n.t;
    const items = [
      `<span><img src="assets/img/firefox.svg" alt=""> ${t("home.marquee1")}</span>`,
      `<span>◆ ${t("home.marquee2")}</span>`,
      `<span>◆ ${t("home.marquee3")}</span>`,
      `<span>◆ ${t("home.marquee4")}</span>`,
      `<span>◆ ${t("home.marquee5")}</span>`,
      `<span>◆ ${t("home.marquee6")}</span>`,
      `<span>◆ ${t("home.marquee7")}</span>`,
      `<span>◆ ${t("home.marquee8")}</span>`,
      `<span>◆ ${t("home.marquee9")}</span>`
    ];
    track.innerHTML = items.join("") + items.join("");
  }

  function initBaSliders() {
    document.querySelectorAll("[data-ba]").forEach((root) => {
      if (root.dataset.baReady) return;
      root.dataset.baReady = "1";
      const beforeImg = root.querySelector(".ba-before");
      const afterImg = root.querySelector(".ba-after");
      let pos = Number(root.style.getPropertyValue("--ba"));
      if (!Number.isFinite(pos) || pos <= 0) pos = 50;

      const setPos = (pct) => {
        const v = Math.max(0, Math.min(100, pct));
        pos = v;
        root.style.setProperty("--ba", String(v));
      };

      const syncFrame = () => {
        const w = Math.round(root.getBoundingClientRect().width);
        if (w > 0) {
          root.style.setProperty("--ba-frame-w", w + "px");
          if (beforeImg) {
            beforeImg.style.width = w + "px";
            beforeImg.style.height = "100%";
          }
          if (afterImg) {
            afterImg.style.width = w + "px";
            afterImg.style.height = "100%";
          }
        }
        setPos(pos);
      };

      const fromEvent = (e) => {
        const point = e.touches ? e.touches[0] : e;
        if (!point) return;
        const rect = root.getBoundingClientRect();
        if (!rect.width) return;
        setPos(((point.clientX - rect.left) / rect.width) * 100);
      };

      let dragging = false;
      const onDown = (e) => {
        dragging = true;
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
        fromEvent(e);
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        fromEvent(e);
      };
      const onUp = (e) => {
        dragging = false;
        try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      };

      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerup", onUp);
      root.addEventListener("pointercancel", onUp);
      window.addEventListener("resize", syncFrame);
      [beforeImg, afterImg].forEach((img) => {
        if (!img) return;
        if (img.complete) syncFrame();
        else img.addEventListener("load", syncFrame, { once: true });
      });
      requestAnimationFrame(syncFrame);
    });
  }

  function updateStatLabels() {
    if (!window.foxI18n) return;
    const labels = document.querySelectorAll("#stats-row .stat-card span");
    const keys = ["home.stat1", "home.stat2", "home.stat3", "home.stat4"];
    labels.forEach((el, i) => {
      if (keys[i]) el.textContent = foxI18n.t(keys[i]);
    });
  }

  buildMarquee();
  updateStatLabels();
  initBaSliders();
  document.addEventListener("foxlangchange", () => {
    buildMarquee();
    updateStatLabels();
  });

  /* ── Topbar scroll shrink ── */
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    window.addEventListener("scroll", () => {
      topbar.classList.toggle("scrolled", window.scrollY > 40);
    }, { passive: true });
  }
})();
