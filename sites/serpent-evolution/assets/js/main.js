/* FOX SERPENT — bootstrap & simulation loop */
(function (FS) {
  "use strict";

  FS.setPauseReason = function (state, reason, on) {
    if (!state.pauseReasons) state.pauseReasons = { manual: false, panel: false, blur: false };
    state.pauseReasons[reason] = !!on;
    state.paused = !!(state.pauseReasons.manual || state.pauseReasons.panel || state.pauseReasons.blur);
  };

  FS.newGame = function (state, seed) {
    seed = seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    state.world = FS.buildStartWorld(seed);
    state.player = FS.createPlayerSnake(state.world.nest);
    state.enemies = [];
    state.cargo = 0;
    state.cargoMax = FS.CARGO_BASE;
    state.nestMaterials = 0;
    state.xp = 0;
    state.talentLevel = 1;
    state.talents = FS.defaultTalents();
    state.talents.points = 0;
    state.tutorial = { done: {} };
    state.progress = { regionBonus: {} };
    state.time = 0;
    state.started = true;
    state.pauseReasons = { manual: false, panel: false, blur: false };
    state.paused = false;
    state.ui.panel = null;
    state.ui.toast = "Відпусти клавішу — зупинишся. Вороги пізніше продовжать рухатися.";
    state.input = FS.createInput();
    FS.recomputeEffects(state);
    FS.saveGame(state, "new");
  };

  FS.createState = function (canvas) {
    var state = {
      started: false,
      paused: true,
      pauseReasons: { manual: true, panel: false, blur: false },
      settings: {
        muted: false, sfx: 0.8, quality: "high", reducedMotion: false, aiDebug: false
      },
      input: FS.createInput(),
      renderer: new FS.Renderer(canvas),
      ui: { panel: null, toast: "", toastT: 0, objectives: [], panelDirty: true, forkConfirm: null },
      effects: {},
      _acc: 0,
      _saveTimer: 0
    };
    FS.initAudio(state);
    FS.bindUI(state);
    state.renderer.resize(state.settings.quality);
    return state;
  };

  FS.bindInput = function (state, canvas) {
    window.addEventListener("keydown", function (e) {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      FS.unlockAudio(state);
      if (!state.started) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!state.ui.panel) FS.setPauseReason(state, "manual", !state.pauseReasons.manual);
        return;
      }
      if (e.code === "Escape") {
        if (state.ui.panel) FS.togglePanel(state, state.ui.panel);
        else FS.togglePanel(state, "menu");
        return;
      }
      if (e.code === "KeyT") { FS.togglePanel(state, "talents"); return; }
      if (e.code === "Tab") { e.preventDefault(); FS.togglePanel(state, "map"); return; }
      if (e.code === "KeyH") { FS.togglePanel(state, "help"); return; }

      if (state.paused && state.ui.panel) return;

      if (e.code === "KeyF") { FS.activatePhaseSelf(state); return; }
      if (e.code === "KeyG") { FS.activateShed(state); return; }
      if (e.code === "KeyC") { FS.activateColdBlood(state); return; }

      if (FS.onKeyDown(state, e.code, e.repeat)) {
        e.preventDefault();
        if (!state.tutorial.done.move) state.tutorial.done.move = true;
        if (e.repeat && !state.tutorial.done.hold) state.tutorial.done.hold = true;
      }
    });
    window.addEventListener("keyup", function (e) {
      FS.onKeyUp(state, e.code);
      if (!FS.anyMoveHeld(state.input) && state.tutorial.done.move) state.tutorial.done.hold = true;
    });
    window.addEventListener("blur", function () {
      if (state.started) { FS.setPauseReason(state, "blur", true); FS.clearInput(state.input); }
    });
    window.addEventListener("focus", function () {
      FS.setPauseReason(state, "blur", false); FS.clearInput(state.input);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state.started) {
        FS.setPauseReason(state, "blur", true); FS.clearInput(state.input);
      } else FS.setPauseReason(state, "blur", false);
    });
    window.addEventListener("resize", function () {
      state.renderer.resize(state.settings.quality);
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      // zoom only, not game speed
      state.renderer.cam.z = FS.clamp(state.renderer.cam.z * (e.deltaY > 0 ? 0.92 : 1.08), 0.45, 2.2);
    }, { passive: false });
  };

  FS.storeSafeBody = function (state) {
    state.player._safeBody = FS.cloneBody(state.player);
    state.player._safeDir = state.player.dir;
  };

  FS.fixedUpdate = function (state, dt) {
    if (!state.started || state.paused) return;
    if (state.heartPauseT > 0) {
      state.heartPauseT -= dt;
      if (state.ui.heartBreak) state.ui.heartBreak.t = state.heartPauseT;
      return;
    }
    if (state.heartGraceT > 0) state.heartGraceT -= dt;

    state.time += dt;
    FS.tickSkills(state, dt);
    FS.depositCargo(state);

    var movers = [];

    // --- Player ---
    var held = FS.anyMoveHeld(state.input);
    var tap = state.input.tapPending;
    var dir = null;
    if (tap) {
      dir = tap;
      state.input.tapPending = null;
      if (!FS.isOpp(state.player.dir, dir)) {
        // apply queue turn
        state.player.dir = dir;
      } else {
        dir = null; // ignore 180
      }
      if (dir) {
        var th = FS.snakeHead(state.player);
        var tv = FS.dirVec(state.player.dir);
        movers.push({ snake: state.player, dir: state.player.dir, next: { x: th.x + tv.x, y: th.y + tv.y } });
        state.tutorial.done.move = true;
      }
      state.player.stepAcc = 0;
    } else if (held) {
      state.player.stepAcc += dt;
      dir = state.input.lastDir;
      if (state.input.queue.length) {
        var q = state.input.queue[0];
        if (!FS.isOpp(state.player.dir, q)) {
          dir = q;
          state.input.queue.shift();
        } else state.input.queue.shift();
      }
      if (dir && !FS.isOpp(state.player.dir, dir)) state.player.dir = dir;
      if (state.player.stepAcc >= state.player.stepPeriod) {
        state.player.stepAcc -= state.player.stepPeriod;
        var hh = FS.snakeHead(state.player);
        var vv = FS.dirVec(state.player.dir);
        movers.push({ snake: state.player, dir: state.player.dir, next: { x: hh.x + vv.x, y: hh.y + vv.y } });
        state.tutorial.done.hold = true;
      }
    } else {
      state.player.stepAcc = 0;
      state.input.queue = [];
    }
    FS.setStanding(state.player, movers.every(function (m) { return m.snake !== state.player; }));

    // --- Enemies ---
    state.enemies.forEach(function (e) {
      if (e.dead) return;
      e.intentDir = FS.aiChooseDir(state, e);
      if (e.intentDir && !FS.isOpp(e.dir, e.intentDir)) e.dir = e.intentDir;
      e.stepAcc += dt * (e.slowMul || 1);
      var period = e.stepPeriod;
      if (e.stepAcc >= period) {
        e.stepAcc -= period;
        var eh = FS.snakeHead(e);
        var ev = FS.dirVec(e.dir);
        movers.push({ snake: e, dir: e.dir, next: { x: eh.x + ev.x, y: eh.y + ev.y } });
      }
    });

    if (!movers.length) return;

    FS.storeSafeBody(state);
    var result = FS.resolveMoveRound(state, movers);

    // deaths first
    result.deaths.forEach(function (d) {
      d.snake._dying = false;
      FS.handleDeath(state, d.snake, d.reason, d.cell);
    });

    // commits for survivors
    result.commits.forEach(function (m) {
      if (m.snake.dead || m.snake._dying) return;
      if (state.heartGraceT > 0 && m.snake.kind === "player") {
        // during grace: reject moves into danger — already resolved; allow move if committed
      }
      FS.commitSnakeMove(m.snake, m.next);
      if (m.snake.kind === "player") {
        var pick = FS.pickupAt(state, m.next);
        if (pick) {
          if (pick.kind === "food") FS.onFood(state, pick.item);
          else FS.onMaterial(state, pick.item);
        }
      }
    });

    state.enemies = state.enemies.filter(function (e) { return !e.dead; });
  };

  FS.frame = function (state, now) {
    if (!state._last) state._last = now;
    var dt = Math.min(0.05, (now - state._last) / 1000);
    state._last = now;

    state._acc += dt;
    var steps = 0;
    while (state._acc >= 1 / 60 && steps < 5) {
      FS.fixedUpdate(state, 1 / 60);
      state._acc -= 1 / 60;
      steps++;
    }

    if (state.started) {
      state.renderer.follow(state);
      state.renderer.draw(state);
      FS.renderHUD(state);
      state._saveTimer += dt;
      if (state._saveTimer > 25 && !state.paused) {
        state._saveTimer = 0;
        FS.saveGame(state, "interval");
      }
    } else {
      if (!state.world) state.world = FS.buildStartWorld(1);
      if (!state.player) state.player = FS.createPlayerSnake(state.world.nest);
      if (!state.enemies) state.enemies = [];
      state.renderer.cam.x = (state.world.nest.x + 0.5) * FS.CELL;
      state.renderer.cam.y = (state.world.nest.y + 0.5) * FS.CELL;
      state.renderer.draw(state);
    }
    requestAnimationFrame(function (t) { FS.frame(state, t); });
  };

  FS.boot = function () {
    var canvas = document.getElementById("game");
    if (!canvas) return;
    var state = FS.createState(canvas);
    FS.bindInput(state, canvas);
    try {
      var best = FS.loadBest();
      var btn = document.getElementById("btn-continue");
      if (btn) btn.textContent = best.ok ? "Продовжити" : "Немає сейву";
    } catch (e) {}
    requestAnimationFrame(function (t) { FS.frame(state, t); });
    window.FoxSerpentState = state;
  };

  document.addEventListener("DOMContentLoaded", FS.boot);
})(window.FoxSerpent);
