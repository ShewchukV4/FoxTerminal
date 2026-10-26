/* FOX SERPENT — short animated how-to (demo only; no real save side-effects) */
(function (FS) {
  "use strict";

  FS.GUIDE_STEPS = [
    {
      title: "Рух і зупинка",
      text: "Натисни — один крок. Утримуй — кілька. Відпусти — повна зупинка. Назад у шию — ні. Стіна або тіло — смерть (або серце).",
      keys: "WASD / стрілки · Пробіл — пауза світу"
    },
    {
      title: "Пожива = довжина",
      text: "Плід → +1 пожива → +1 сегмент. Шкала: пожива 0–9, довжина 3–12. Їжа росте лише на грядках (на старті їх 4).",
      keys: "3 + пожива = довжина"
    },
    {
      title: "Жовті позначки",
      text: "Не все жовте — монета. Плід, урожай, кущ, місце інтересу й гілки мають різні іконки. H — повна легенда. POI не списує поживу само по собі — підтверди F.",
      keys: "H — легенда"
    },
    {
      title: "Tab — нова земля",
      text: "Карта → відкрити територію. Ціна з поживи. Підтвердження в панелі (не системне вікно). При помилці генерації — повний відкат.",
      keys: "Tab"
    },
    {
      title: "Дерево талантів",
      text: "Чотири гілки в колонках. Pan/zoom збережені. «До доступних» центрує вузол. Розвилка A/B — серце одноразове.",
      keys: "T"
    },
    {
      title: "Деревина ≠ пожива",
      text: "Шукай дерево: гілки лежать лише під кроною / коло стовбура. Підбери головою або F біля дерева. Витрата не коротшає хвіст.",
      keys: "HUD: Деревина"
    },
    {
      title: "B — будівництво",
      text: "Змія стоїть, курсор ставить будь-де на відкритій карті. ЛКМ — поставити, ПКМ / X — знести (−50% деревини). R обертає, Esc/B вихід.",
      keys: "B · Shift+B — панель бази"
    },
    {
      title: "Грядка",
      text: "Посадка → ріст → стиглий плід на клітинці. Збери сам або садівником. Урожай — фізичний плід, не «монета в гаманці».",
      keys: "B → грядка"
    },
    {
      title: "Паркан і ворота",
      text: "Паркан блокує ворогів. Ворота: свої проходять, зачинені — для ворогів ні. Дірка в огорожі = шлях для рейду.",
      keys: "ЛКМ / drag ряду"
    },
    {
      title: "Союзник",
      text: "Домівка → найм. Садівник / носій / заготівельник / розвідник. «Усім додому» при небезпеці. Проходять свої ворота.",
      keys: "Shift+B"
    },
    {
      title: "Чужа база і рейд",
      text: "На небезпечних землях — чужі гнізда. Змій може помітити грядку й піти красти, якщо є шлях. Закрий огорожею; ремонт дешевий.",
      keys: "Сигнал у toast"
    }
  ];

  FS.guideSeenVersion = function () {
    try {
      return +(localStorage.getItem(FS.GUIDE_SEEN_KEY) || 0) || 0;
    } catch (e) {
      return 0;
    }
  };

  FS.markGuideSeen = function () {
    try {
      localStorage.setItem(FS.GUIDE_SEEN_KEY, String(FS.GUIDE_VERSION));
    } catch (e) {}
  };

  FS.shouldAutoOpenGuide = function () {
    return FS.guideSeenVersion() < FS.GUIDE_VERSION;
  };

  FS.openGuide = function (state, opts) {
    opts = opts || {};
    if (state.guide && state.guide.open) return;
    if (state.buildMode && state.buildMode.on) FS.exitBuildMode(state);
    var panelWas = state.ui.panel;
    if (panelWas) {
      state.ui.panel = null;
      FS.setPauseReason(state, "panel", false);
    }
    state.guide = {
      open: true,
      step: 0,
      start: performance.now(),
      raf: 0,
      firstRun: !!opts.firstRun,
      savedManual: !!(state.pauseReasons && state.pauseReasons.manual),
      snap: {
        nutrition: state.nutrition,
        wood: state.wood,
        xp: state.xp,
        hearts: state.talents ? state.talents.hearts : 0,
        heartsSpent: state.talents ? state.talents.heartsSpent : 0
      }
    };
    FS.setPauseReason(state, "guide", true);
    FS.clearInput(state.input);
    FS.mountGuideUI(state);
    FS.showGuideStep(state, opts.step || 0);
  };

  FS.closeGuide = function (state, markSeen) {
    if (!state.guide || !state.guide.open) return;
    if (state.guide.raf) cancelAnimationFrame(state.guide.raf);
    var el = document.getElementById("guide-overlay");
    if (el) el.classList.add("hidden");
    FS.setPauseReason(state, "guide", false);
    if (state.guide.savedManual) FS.setPauseReason(state, "manual", true);
    if (markSeen) FS.markGuideSeen();
    state.guide.open = false;
    FS.clearInput(state.input);
  };

  FS.mountGuideUI = function (state) {
    var root = document.getElementById("ui-root");
    var existing = document.getElementById("guide-overlay");
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "guide-overlay";
      existing.className = "guide-overlay";
      existing.innerHTML = [
        '<div class="guide-shell" role="dialog" aria-modal="true" aria-labelledby="guide-title">',
        '  <header class="guide-head"><span class="guide-brand">FOX SERPENT / ЯК ГРАТИ</span>',
        '  <span class="guide-count" id="guide-count"></span></header>',
        '  <canvas id="guide-canvas" width="800" height="350" aria-label="Анімований приклад"></canvas>',
        '  <div class="guide-copy"><h2 id="guide-title"></h2><p id="guide-desc"></p>',
        '  <div class="guide-keys" id="guide-keys"></div></div>',
        '  <label class="guide-motion"><input type="checkbox" id="guide-reduced"/> Без анімації</label>',
        '  <footer class="guide-foot">',
        '    <nav class="guide-dots" id="guide-dots" aria-label="Кроки"></nav>',
        '    <button type="button" class="btn ghost" id="guide-skip">Пропустити</button>',
        '    <button type="button" class="btn" id="guide-prev">Назад</button>',
        '    <button type="button" class="btn primary" id="guide-next">Далі</button>',
        '  </footer>',
        '</div>'
      ].join("");
      root.appendChild(existing);
      document.getElementById("guide-skip").onclick = function () { FS.closeGuide(state, true); };
      document.getElementById("guide-prev").onclick = function () {
        FS.showGuideStep(state, Math.max(0, state.guide.step - 1));
      };
      document.getElementById("guide-next").onclick = function () {
        if (state.guide.step >= FS.GUIDE_STEPS.length - 1) FS.closeGuide(state, true);
        else FS.showGuideStep(state, state.guide.step + 1);
      };
      document.getElementById("guide-reduced").onchange = function (ev) {
        state.settings.reducedMotion = ev.target.checked;
      };
      document.getElementById("guide-dots").onclick = function (ev) {
        var b = ev.target.closest("[data-gstep]");
        if (b) FS.showGuideStep(state, +b.dataset.gstep);
      };
    }
    existing.classList.remove("hidden");
    var dots = document.getElementById("guide-dots");
    dots.innerHTML = FS.GUIDE_STEPS.map(function (_, i) {
      return '<button type="button" class="gdot" data-gstep="' + i + '" aria-label="Крок ' + (i + 1) + '"></button>';
    }).join("");
  };

  FS.showGuideStep = function (state, i) {
    i = FS.clamp(i | 0, 0, FS.GUIDE_STEPS.length - 1);
    state.guide.step = i;
    state.guide.start = performance.now();
    var step = FS.GUIDE_STEPS[i];
    document.getElementById("guide-title").textContent = step.title;
    document.getElementById("guide-desc").textContent = step.text;
    document.getElementById("guide-keys").textContent = step.keys || "";
    document.getElementById("guide-count").textContent = (i + 1) + " / " + FS.GUIDE_STEPS.length;
    document.getElementById("guide-next").textContent = i >= FS.GUIDE_STEPS.length - 1 ? "Грати" : "Далі";
    Array.prototype.forEach.call(document.querySelectorAll(".gdot"), function (d, di) {
      d.classList.toggle("on", di === i);
    });
    if (state.guide.raf) cancelAnimationFrame(state.guide.raf);
    FS.paintGuide(state);
  };

  FS.guideKey = function (state, e) {
    if (e.code === "Escape") { FS.closeGuide(state, true); return true; }
    if (e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space") {
      if (state.guide.step >= FS.GUIDE_STEPS.length - 1) FS.closeGuide(state, true);
      else FS.showGuideStep(state, state.guide.step + 1);
      return true;
    }
    if (e.code === "ArrowLeft") {
      FS.showGuideStep(state, Math.max(0, state.guide.step - 1));
      return true;
    }
    return false;
  };

  FS.onGuideVisibility = function (state) {
    if (document.hidden && state.guide && state.guide.open && state.guide.raf) {
      cancelAnimationFrame(state.guide.raf);
      state.guide.raf = 0;
    }
  };

  FS.tickGuide = function (state, now) {
    if (!state.guide || !state.guide.open) return;
    FS.paintGuide(state, now);
  };

  FS.paintGuide = function (state, now) {
    var canvas = document.getElementById("guide-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    now = now || performance.now();
    var t = (now - state.guide.start) / 1000;
    if (state.settings.reducedMotion) t = 0.5;
    ctx.fillStyle = "#1c2d22";
    ctx.fillRect(0, 0, w, h);
    var step = state.guide.step;
    var cx = w / 2, cy = h / 2;
    // Shared demo sprites — never touch real state wallets
    if (step <= 1) {
      var body = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
      if (!state.settings.reducedMotion) {
        var phase = Math.floor(t * 2) % 4;
        if (phase === 1) body = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }];
        if (phase === 2) body = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
      }
      FS.drawSnakeBody(ctx, body, "R", FS.COLORS.player, { cell: 36, ox: cx, oy: cy });
      FS.drawFruit(ctx, "apple", cx + 90, cy, 1, { phase: "ripe", time: t });
    } else if (step === 2) {
      ctx.fillStyle = "#f2d597";
      ctx.font = "28px Segoe UI";
      ctx.textAlign = "center";
      [["❀ кущ", -180], ["≡ гілки", -60], ["🍎 плід", 60], ["⌂ POI", 180]].forEach(function (p) {
        ctx.fillText(p[0], cx + p[1], cy);
      });
    } else if (step === 5 || step === 6) {
      ctx.fillStyle = "#8a6a38";
      ctx.fillRect(cx - 80, cy - 10, 40, 12);
      ctx.fillStyle = "#c4a060";
      ctx.fillText("деревина", cx - 60, cy + 40);
      ctx.strokeStyle = "#69E0BE";
      ctx.strokeRect(cx + 40, cy - 30, 50, 50);
      ctx.fillStyle = "#eaf3df";
      ctx.font = "14px Segoe UI";
      ctx.fillText("B preview", cx + 65, cy + 50);
    } else if (step === 8) {
      ctx.fillStyle = "#8a6a40";
      for (var i = -2; i <= 2; i++) {
        if (i === 0) continue;
        ctx.fillRect(cx + i * 36 - 10, cy - 40, 20, 12);
      }
      ctx.strokeStyle = "#69E0BE";
      ctx.strokeRect(cx - 16, cy - 48, 32, 28);
      ctx.fillStyle = "#eaf3df";
      ctx.font = "13px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("ворота відкриті для своїх", cx, cy + 40);
    } else {
      FS.drawSnakeBody(ctx, [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }], "R", FS.COLORS.player, {
        cell: 36, ox: cx - 40, oy: cy
      });
      FS.drawSnakeBody(ctx, [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }], "L", FS.COLORS.enemyCareful, {
        cell: 36, ox: cx - 40, oy: cy
      });
    }
  };
})(window.FoxSerpent);
