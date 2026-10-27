/* FOX SERPENT — short animated how-to (demo only; no real save side-effects) */
(function (FS) {
  "use strict";

  FS.GUIDE_STEPS = [
    {
      title: "Рух і сітка",
      text: "Клітинки — основа світу. Натисни — крок, відпусти — стоп. Зіткнення смертельні.",
      keys: "WASD · Пробіл — пауза", scene: "move"
    },
    {
      title: "На змійці / На базі",
      text: "Carried 0–9 = довжина 3–12. Склад бази — окремий запас. F біля гнізда: скласти/взяти. Перекладання без XP.",
      keys: "F біля гнізда", scene: "pantry"
    },
    {
      title: "Скласти — коротшаєш",
      text: "Скласти 3 → хвіст −3 сегменти. Взяти назад → ціль довжини росте на кроках.",
      keys: "Склад їжі", scene: "pantry"
    },
    {
      title: "Грядка на сухій землі",
      text: "Будь-яка вільна суха клітинка. Червоний preview — вода/камінь/дерево.",
      keys: "B → грядка", scene: "farm"
    },
    {
      title: "Дерево й гілки",
      text: "Гілки лише під кроною. F біля стовбура — заготівля.",
      keys: "HUD: Деревина", scene: "tree"
    },
    {
      title: "B — будівництво",
      text: "Змія стоїть. ЛКМ ставити, ПКМ скасувати, X знести. Ряд паркану — увесь або нічого.",
      keys: "B", scene: "build"
    },
    {
      title: "Паркан і ворота",
      text: "Автоз’єднання секцій. Зачинені ворота блокують ворогів; свої проходять.",
      keys: "R обернути", scene: "fence"
    },
    {
      title: "Злодій урожаю",
      text: "Бере один плід і тікає з вантажем. Закрий шлях — перепланує.",
      keys: "Огорожа", scene: "thief"
    },
    {
      title: "Розвідник",
      text: "Обходить межу, запам’ятовує відкриті ворота. Після повернення — сигнал «Базу помітили».",
      keys: "Зачини ворота", scene: "scout"
    },
    {
      title: "Носій → склад",
      text: "Носій несе урожай у базовий склад, не в гаманець гравця.",
      keys: "Shift+B", scene: "ally"
    },
    {
      title: "Tab і таланти",
      text: "Земля за поживу. Дерево T — 4 колонки без overlap. Склад I — місткість бази.",
      keys: "Tab · T", scene: "move"
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

  /** Shared cell board for every guide scene — visible grid. */
  FS.drawGuideBoard = function (ctx, w, h, cols, rows, cell) {
    cols = cols || 10;
    rows = rows || 6;
    cell = cell || 36;
    var ox = (w - cols * cell) / 2;
    var oy = (h - rows * cell) / 2 + 8;
    ctx.fillStyle = "#1a2a20";
    ctx.fillRect(0, 0, w, h);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var px = ox + x * cell, py = oy + y * cell;
        ctx.fillStyle = (x + y) % 2 ? "#243528" : "#203024";
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "rgba(180,210,160,0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
      }
    }
    ctx.strokeStyle = "rgba(105,224,190,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 1, oy - 1, cols * cell + 2, rows * cell + 2);
    return { ox: ox, oy: oy, cell: cell, cols: cols, rows: rows };
  };

  FS.paintGuide = function (state, now) {
    var canvas = document.getElementById("guide-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    now = now || performance.now();
    var t = (now - state.guide.start) / 1000;
    if (state.settings.reducedMotion) t = 0.5;
    var step = FS.GUIDE_STEPS[state.guide.step] || {};
    var scene = step.scene || "move";
    var board = FS.drawGuideBoard(ctx, w, h, 10, 6, 36);
    var ox = board.ox, oy = board.oy, cell = board.cell;

    function at(gx, gy) {
      return { x: ox + (gx + 0.5) * cell, y: oy + (gy + 0.5) * cell };
    }

    if (scene === "move" || scene === "pantry") {
      var len = scene === "pantry" && t > 1.2 ? 3 : 5;
      var body = [];
      for (var i = 0; i < len; i++) body.push({ x: 3 - i, y: 3 });
      FS.drawSnakeBody(ctx, body, "R", FS.COLORS.player, { cell: cell, ox: ox, oy: oy });
      if (FS.drawLarder) FS.drawLarder(ctx, at(7, 3).x, at(7, 3).y, cell, scene === "pantry" ? 0.5 : 0.15);
      ctx.fillStyle = "#eaf3df";
      ctx.font = "13px Segoe UI";
      ctx.textAlign = "center";
      if (scene === "pantry") {
        ctx.fillText("змійка " + (len === 5 ? "7" : "3") + "/9  →  база", at(5, 1).x, at(5, 1).y);
      }
    } else if (scene === "farm") {
      if (FS.drawFarmPlot) {
        FS.drawFarmPlot(ctx, at(3, 2).x, at(3, 2).y, cell, "ready", "berry");
        FS.drawFarmPlot(ctx, at(5, 2).x, at(5, 2).y, cell, "growing", "berry");
      }
      ctx.fillStyle = "rgba(224,116,106,0.45)";
      ctx.fillRect(ox + 7 * cell + 2, oy + 2 * cell + 2, cell - 4, cell - 4);
      ctx.fillStyle = "#eaf3df";
      ctx.font = "12px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("вода — ні", at(7, 4).x, at(7, 4).y);
    } else if (scene === "tree") {
      if (FS.drawTreeSprite) FS.drawTreeSprite(ctx, at(4, 3).x, at(4, 3).y, cell, 1, {});
      if (FS.drawBranchPile) {
        FS.drawBranchPile(ctx, at(5, 3).x, at(5, 3).y, cell);
        FS.drawBranchPile(ctx, at(4, 4).x, at(4, 4).y, cell);
      }
    } else if (scene === "build" || scene === "fence") {
      if (FS.drawFence) {
        FS.drawFence(ctx, at(3, 3).x, at(3, 3).y, cell, 2, 0);
        FS.drawFence(ctx, at(4, 3).x, at(4, 3).y, cell, 10, 0);
        FS.drawFence(ctx, at(5, 3).x, at(5, 3).y, cell, 8, 0);
      }
      if (FS.drawGate) FS.drawGate(ctx, at(4, 4).x, at(4, 4).y, cell, t % 2 < 1, 0, 0);
    } else if (scene === "thief") {
      if (FS.drawFarmPlot) FS.drawFarmPlot(ctx, at(2, 3).x, at(2, 3).y, cell, "ready", "berry");
      FS.drawSnakeBody(ctx, [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }], "L", FS.COLORS.enemyCareful, {
        cell: cell, ox: ox, oy: oy
      });
      FS.drawFruit(ctx, "berry", at(4, 3).x + 10, at(4, 3).y - 12, 0.5, { phase: "ripe", time: t });
    } else if (scene === "scout") {
      if (FS.drawFence) {
        FS.drawFence(ctx, at(3, 2).x, at(3, 2).y, cell, 10, 0);
        FS.drawFence(ctx, at(5, 2).x, at(5, 2).y, cell, 10, 0);
        FS.drawFence(ctx, at(3, 4).x, at(3, 4).y, cell, 10, 0);
        FS.drawFence(ctx, at(5, 4).x, at(5, 4).y, cell, 10, 0);
      }
      if (FS.drawGate) FS.drawGate(ctx, at(4, 2).x, at(4, 2).y, cell, false, 0, 0);
      FS.drawSnakeBody(ctx, [{ x: 7, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 3 }], "L", FS.COLORS.enemyCareful, {
        cell: cell, ox: ox, oy: oy
      });
      ctx.fillStyle = "#eaf3df";
      ctx.font = "12px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("відкриті ворота", at(4, 5).x, at(4, 5).y);
    } else if (scene === "ally") {
      if (FS.drawHut) FS.drawHut(ctx, at(2, 3).x, at(2, 3).y, cell);
      if (FS.drawLarder) FS.drawLarder(ctx, at(7, 3).x, at(7, 3).y, cell, 0.6);
      FS.drawSnakeBody(ctx, [{ x: 4, y: 3 }, { x: 3, y: 3 }], "R", "#c8b878", { cell: cell, ox: ox, oy: oy });
    }
  };
})(window.FoxSerpent);
