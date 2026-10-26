/* FOX SERPENT — short animated how-to (demo only; no real save side-effects) */
(function (FS) {
  "use strict";

  FS.GUIDE_STEPS = [
    {
      title: "Один крок",
      text: "Натисни — один крок. Утримуй — кілька кроків. Відпусти — повна зупинка.",
      keys: "WASD / стрілки"
    },
    {
      title: "Вороги не чекають",
      text: "Ти можеш стояти й планувати. Ворожі змії продовжують рухатися. Пробіл ставить на паузу всіх.",
      keys: "Пробіл — пауза світу"
    },
    {
      title: "Повороти й зіткнення",
      text: "Поворот на 90° дозволений. Назад у шию — ні. Стіна або тіло — смерть (або серце).",
      keys: "Напрямок = останній успішний крок"
    },
    {
      title: "Пожива = довжина",
      text: "З’їв плід → +1 пожива → +1 сегмент. Шкала: пожива 0–9, довжина 3–12.",
      keys: "3 + пожива = довжина"
    },
    {
      title: "Витрата коротшає",
      text: "Покупка за поживу відрізає хвіст. Було 8 сегментів і 5 поживи → витратив 3 → 5 сегментів і 2 поживи.",
      keys: "Голова не телепортується"
    },
    {
      title: "Талант або серце",
      text: "На розвилці: сильний талант (A) або одноразове серце (B). Серце не відновлюється.",
      keys: "T — сад розвитку"
    },
    {
      title: "Земля й урожай",
      text: "З’їв → місце звільнилось → за ~10 с бутон → стиглий плід. Нові ділянки — за поживу; пізніше з’являться змії.",
      keys: "Tab — карта"
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
        cargo: state.cargo,
        nestMaterials: state.nestMaterials,
        xp: state.xp,
        hearts: state.talents ? state.talents.hearts : 0,
        heartsSpent: state.talents ? state.talents.heartsSpent : 0
      }
    };
    FS.setPauseReason(state, "guide", true);
    FS.clearInput(state.input);
    FS.mountGuideUI(state);
    FS.showGuideStep(state, 0);
  };

  FS.closeGuide = function (state, markSeen) {
    if (!state.guide || !state.guide.open) return;
    if (state.guide.raf) cancelAnimationFrame(state.guide.raf);
    var el = document.getElementById("guide-overlay");
    if (el) el.classList.add("hidden");
    FS.setPauseReason(state, "guide", false);
    // Restore prior manual pause; do not surprise-unpause
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
        '    <button type="button" class="btn" id="guide-back">Назад</button>',
        '    <button type="button" class="btn primary" id="guide-next">Далі →</button>',
        "  </footer></div>"
      ].join("");
      root.appendChild(existing);
    }
    existing.classList.remove("hidden");
    var reduced = document.getElementById("guide-reduced");
    reduced.checked = !!(state.settings && state.settings.reducedMotion) ||
      (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    reduced.onchange = function () {
      if (state.settings) state.settings.reducedMotion = reduced.checked;
      FS.showGuideStep(state, state.guide.step);
    };
    document.getElementById("guide-skip").onclick = function () {
      FS.closeGuide(state, true);
    };
    document.getElementById("guide-back").onclick = function () {
      FS.showGuideStep(state, state.guide.step - 1);
    };
    document.getElementById("guide-next").onclick = function () {
      if (state.guide.step < FS.GUIDE_STEPS.length - 1) {
        FS.showGuideStep(state, state.guide.step + 1);
      } else {
        FS.closeGuide(state, true);
      }
    };
    setTimeout(function () {
      var n = document.getElementById("guide-next");
      if (n) n.focus();
    }, 0);
  };

  FS.showGuideStep = function (state, n) {
    if (!state.guide || !state.guide.open) return;
    if (state.guide.raf) cancelAnimationFrame(state.guide.raf);
    n = Math.max(0, Math.min(FS.GUIDE_STEPS.length - 1, n));
    state.guide.step = n;
    state.guide.start = performance.now();
    var step = FS.GUIDE_STEPS[n];
    document.getElementById("guide-count").textContent = (n + 1) + " / " + FS.GUIDE_STEPS.length;
    document.getElementById("guide-title").textContent = step.title;
    document.getElementById("guide-desc").textContent = step.text;
    document.getElementById("guide-keys").textContent = step.keys;
    document.getElementById("guide-back").disabled = n === 0;
    document.getElementById("guide-next").textContent =
      n === FS.GUIDE_STEPS.length - 1 ? "Зрозуміло ✓" : "Далі →";
    var dots = document.getElementById("guide-dots");
    dots.innerHTML = "";
    FS.GUIDE_STEPS.forEach(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "guide-dot" + (i === n ? " active" : "");
      b.setAttribute("aria-label", "Крок " + (i + 1));
      if (i === n) b.setAttribute("aria-current", "step");
      b.onclick = function () { FS.showGuideStep(state, i); };
      dots.appendChild(b);
    });
    FS.tickGuide(state, performance.now());
  };

  FS.guideKey = function (state, e) {
    if (!state.guide || !state.guide.open) return false;
    if (e.repeat) return true;
    if (e.code === "Escape") { FS.closeGuide(state, true); return true; }
    if (e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space") {
      document.getElementById("guide-next").click();
      return true;
    }
    if (e.code === "ArrowLeft" || e.code === "Backspace") {
      document.getElementById("guide-back").click();
      return true;
    }
    return true; // swallow other keys while guide open
  };

  FS.onGuideVisibility = function (state) {
    if (!state.guide || !state.guide.open) return;
    if (document.hidden) {
      if (state.guide.raf) cancelAnimationFrame(state.guide.raf);
      state.guide.raf = 0;
    } else {
      FS.showGuideStep(state, state.guide.step);
    }
  };

  FS.tickGuide = function (state, now) {
    if (!state.guide || !state.guide.open) return;
    var cv = document.getElementById("guide-canvas");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var reduced = document.getElementById("guide-reduced");
    var useStatic = reduced && reduced.checked;
    var t = useStatic ? 1.6 : (now - state.guide.start) / 1000;
    var step = state.guide.step;
    var phase = t % 5;
    var beat = Math.min(4, Math.floor(phase * 1.5));

    function label(txt, x, y, c) {
      ctx.fillStyle = c || "#dce9d0";
      ctx.font = "16px system-ui,Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(txt, x, y);
    }
    function board(x, y, w, h) {
      ctx.fillStyle = "#263e2c";
      ctx.fillRect(x, y, w * 34, h * 34);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      var i, j;
      for (i = 0; i <= w; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 34, y); ctx.lineTo(x + i * 34, y + h * 34); ctx.stroke();
      }
      for (j = 0; j <= h; j++) {
        ctx.beginPath(); ctx.moveTo(x, y + j * 34); ctx.lineTo(x + w * 34, y + j * 34); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(126,154,98,0.47)";
      ctx.strokeRect(x, y, w * 34, h * 34);
    }
    function snake(points, dir, color, ox, oy) {
      FS.drawSnakeBody(ctx, points, dir, color || FS.COLORS.player, {
        cell: 34, ox: ox == null ? 145 : ox, oy: oy == null ? 55 : oy
      });
    }

    ctx.clearRect(0, 0, 800, 350);
    ctx.fillStyle = "#1c2d22";
    ctx.fillRect(0, 0, 800, 350);

    if (step === 0) {
      board(145, 55, 15, 6);
      var n0 = phase < 1.2 ? 0 : phase < 1.8 ? 1 : phase < 3.2 ? Math.min(4, 1 + Math.floor((phase - 1.8) * 3)) : 4;
      snake([[4 + n0, 3], [3 + n0, 3], [2 + n0, 3]], "R");
      label(phase < 1.2 ? "Натисни →" : phase < 3.2 ? "Утримання →" : "Відпустив — стоїш", 400, 305);
    } else if (step === 1) {
      board(145, 55, 15, 6);
      snake([[4, 2], [3, 2], [2, 2]], "R");
      snake([[7 + beat, 4], [6 + beat, 4], [5 + beat, 4]], "R", "#d68d74");
      label("Ти стоїш", 290, 40);
      label("Ворог рухається", 530, 40);
      label("Пробіл — пауза всіх", 400, 305);
    } else if (step === 2) {
      board(145, 55, 15, 6);
      var turn = phase > 1.5;
      snake(turn ? [[7, 2], [7, 3], [6, 3], [5, 3]] : [[7, 3], [6, 3], [5, 3], [4, 3]], turn ? "U" : "R");
      label(phase < 1.5 ? "Рух праворуч" : phase < 3 ? "Поворот угору" : "Назад у шию — відхилено", 400, 305);
      if (phase >= 3) {
        ctx.strokeStyle = "#e7a18d"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(400, 146); ctx.lineTo(400, 170); ctx.stroke();
        label("×", 400, 185, "#e7a18d");
      }
    } else if (step === 3) {
      board(145, 55, 15, 6);
      var segs = 3 + Math.min(3, beat);
      var body3 = [];
      for (var i = 0; i < segs; i++) body3.push([4 + (segs - 3) - i, 3]);
      snake(body3, "R");
      if (beat < 2) FS.drawFruit(ctx, "apple", 145 + 7.5 * 34, 55 + 3.5 * 34, 1, { time: t, reducedMotion: useStatic });
      label("Пожива " + Math.min(3, beat) + "/9 · довжина " + segs, 400, 305);
    } else if (step === 4) {
      board(145, 55, 15, 6);
      var cut = phase < 2.2 ? 8 : 5;
      var body4 = [];
      for (var j = 0; j < cut; j++) body4.push([3 + (cut - 1) - j, 3]);
      snake(body4, "R");
      label(phase < 2.2 ? "5 поживи · 8 сегментів" : "Витратив 3 → 2 поживи · 5 сегментів", 400, 305);
    } else if (step === 5) {
      ctx.fillStyle = "#304a32";
      ctx.fillRect(140, 70, 230, 160);
      ctx.fillRect(430, 70, 230, 160);
      label("A · Сильний талант", 255, 120);
      label("Контроль / дослідження", 255, 180);
      label("B · Одне серце", 545, 120);
      ctx.font = "48px system-ui";
      ctx.fillStyle = "#eda99f";
      ctx.textAlign = "center";
      ctx.fillText(phase < 3 ? "♥" : "♡", 545, 190);
      label(phase < 3 ? "Обери один із двох" : "Порятунок — серце зникло", 400, 290);
    } else if (step === 6) {
      board(155, 65, 7, 6);
      snake([[3, 3], [2, 3], [1, 3]], "R", "#aace78", 155, 65);
      if (phase < 1.5) FS.drawFruit(ctx, "apple", 155 + 5.5 * 34, 65 + 3.5 * 34, 1, { phase: "bud", reducedMotion: useStatic });
      else FS.drawFruit(ctx, "apple", 155 + 5.5 * 34, 65 + 3.5 * 34, 1, { time: t, reducedMotion: useStatic });
      if (phase > 2.2) {
        board(393, 65, 7, 6);
        snake([[4, 2], [5, 2], [6, 2]], "L", "#d68d74", 393, 65);
      }
      label(phase < 1.5 ? "Бутон ~1 с" : phase < 2.2 ? "Новий плід ~10 с" : "Нова земля — ризик змії", 400, 310);
    }

    if (!document.hidden && state.guide.open && !useStatic) {
      state.guide.raf = requestAnimationFrame(function (t2) { FS.tickGuide(state, t2); });
    } else if (useStatic) {
      state.guide.raf = 0;
    }
  };
})(window.FoxSerpent);
