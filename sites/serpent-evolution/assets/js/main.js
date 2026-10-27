/* FOX SERPENT — bootstrap & simulation loop */
(function (FS) {
  "use strict";

  FS.setPauseReason = function (state, reason, on) {
    if (!state.pauseReasons) state.pauseReasons = { manual: false, panel: false, blur: false, guide: false };
    state.pauseReasons[reason] = !!on;
    state.paused = !!(state.pauseReasons.manual || state.pauseReasons.panel ||
      state.pauseReasons.blur || state.pauseReasons.guide);
  };

  FS.newGame = function (state, seed) {
    if (seed == null || seed === "") {
      seed = ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    } else {
      seed = (+seed || FS.hash2(String(seed).length, String(seed).charCodeAt(0) || 1)) >>> 0;
    }
    state.world = FS.buildStartWorld(seed);
    state.player = FS.createPlayerSnake(state.world.nest);
    state.enemies = [];
    state.allies = [];
    state.homes = [];
    state.farms = FS.createFarmsState();
    state.nutrition = 0;
    state.wood = 0;
    state.woodCap = FS.WOOD_CAP_BASE || 12;
    state.buildings = [];
    state.woodNodes = [];
    state.buildMode = null;
    state.pantry = { food: 0, cap: FS.PANTRY_BASE_CAP || 12, level: 1, reserve: 0 };
    state.xp = 0;
    state.talentLevel = 1;
    state.talents = FS.defaultTalents();
    state.talents.points = 0;
    state.tutorial = { done: {} };
    state.progress = { regionBonus: {}, patterns: [], killArch: {}, regionTypes: {}, woodSeeded: true };
    state.time = 0;
    state.started = true;
    state.pauseReasons = { manual: false, panel: false, blur: false, guide: false };
    state.paused = false;
    state.ui.panel = null;
    state.ui.build = null;
    state.ui.expandConfirm = null;
    state.ui.expandError = "";
    state.ui.toast = "Seed " + seed + " · Пожива ≠ деревина · B = будівництво";
    state.input = FS.createInput();
    FS.recomputeEffects(state);
    FS.initNutrition(state, 0);
    FS.seedStartFood(state);
    if (FS.seedWoodNodes) FS.seedWoodNodes(state);
    FS.saveGame(state, "new");
    if (FS.shouldAutoOpenGuide(state)) FS.openGuide(state, { firstRun: true });
  };

  FS.createState = function (canvas) {
    var state = {
      started: false,
      paused: true,
      pauseReasons: { manual: true, panel: false, blur: false, guide: false },
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
      if (state.guide && state.guide.open) {
        if (FS.guideKey(state, e)) e.preventDefault();
        return;
      }
      if (!state.started) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (!state.ui.panel) FS.setPauseReason(state, "manual", !state.pauseReasons.manual);
        return;
      }
      if (e.code === "Escape") {
        if (e.repeat) return;
        if (state.buildMode && state.buildMode.on) { FS.exitBuildMode(state); return; }
        if (state.ui.panel) FS.togglePanel(state, state.ui.panel);
        else FS.togglePanel(state, "menu");
        return;
      }
      if (e.code === "KeyT") {
        if (e.repeat) return;
        FS.togglePanel(state, "talents");
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        if (e.repeat) return;
        FS.togglePanel(state, "map");
        return;
      }
      if (e.code === "KeyH") {
        if (e.repeat) return;
        FS.togglePanel(state, "help");
        return;
      }

      if (state.buildMode && state.buildMode.on) {
        if (e.code === "KeyB") { if (!e.repeat) FS.exitBuildMode(state); return; }
        if (e.code === "KeyR") {
          if (!e.repeat) {
            state.buildMode.rot = ((state.buildMode.rot || 0) + 1) % 4;
            state.buildMode.msg = "Поворот " + state.buildMode.rot;
            if (FS.refreshBuildPalette) FS.refreshBuildPalette(state);
          }
          return;
        }
        if (e.code === "KeyX") {
          if (!e.repeat) {
            state.buildMode.demolish = !state.buildMode.demolish;
            if (state.buildMode.demolish) state.buildMode.tool = null;
            else state.buildMode.tool = state.buildMode.tool || "fence";
            state.buildMode.msg = state.buildMode.demolish ? "Режим знесення (ЛКМ/ПКМ)" : "Режим будівництва";
            if (FS.refreshBuildPalette) FS.refreshBuildPalette(state);
          }
          return;
        }
        // movement blocked while building
        if (FS.DIR_KEYS[e.code]) { e.preventDefault(); FS.clearInput(state.input); return; }
        if (e.code === "Space") {
          e.preventDefault();
          if (!e.repeat) FS.setPauseReason(state, "manual", !state.pauseReasons.manual);
          return;
        }
        return;
      }

      if (state.paused && state.ui.panel) return;

      if (e.code === "KeyF") {
        if (FS.tryInteract && FS.tryInteract(state)) return;
        FS.activatePhaseSelf(state);
        return;
      }
      if (e.code === "KeyG") { FS.activateShed(state); return; }
      if (e.code === "KeyC") { FS.activateColdBlood(state); return; }
      if (e.code === "KeyV") { FS.activateSelfSlow(state); return; }
      if (e.code === "KeyB") {
        if (e.repeat) return;
        if (e.shiftKey) FS.togglePanel(state, "build");
        else FS.enterBuildMode(state);
        return;
      }

      if (FS.onKeyDown(state, e.code, e.repeat)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", function (e) {
      FS.onKeyUp(state, e.code);
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
      if (FS.onGuideVisibility) FS.onGuideVisibility(state);
    });
    window.addEventListener("resize", function () {
      state.renderer.resize(state.settings.quality);
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (!state.renderer.cam.userZoom) state.renderer.cam.userZoom = 1;
      state.renderer.cam.userZoom = FS.clamp(
        state.renderer.cam.userZoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.55, 2.4
      );
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
    FS.tickFoodDirector(state, dt);
    if (FS.tickFarms) FS.tickFarms(state, dt);
    if (FS.tickAllies) FS.tickAllies(state, dt);
    if (FS.tickWoodNodes) FS.tickWoodNodes(state, dt);
    (function () {
      var h = FS.snakeHead(state.player);
      var k = FS.key(h.x, h.y);
      if (state._lmCell !== k) {
        state._lmCell = k;
        FS.tryLandmark(state);
      }
    })();

    var movers = [];
    state.input.tapConsumedDir = null;
    var building = !!(state.buildMode && state.buildMode.on);

    // --- Player: frozen in B-mode (enemies keep moving) ---
    if (building) {
      FS.clearInput(state.input);
      state.player.stepAcc = 0;
      FS.setStanding(state.player, true);
    } else {
    var held = FS.anyMoveHeld(state.input);
    var intent = null;
    var head = FS.snakeHead(state.player);
    var tileMul = FS.tileStepMul ? FS.tileStepMul(state, head.x, head.y) : 1;
    var pPeriod = (state.player.stepPeriod * tileMul) / (state.player.slowMul || 1);
    if (state.input.tapPending) {
      intent = FS.consumePlayerStepIntent(state, { allowTap: true });
      state.player.stepAcc = 0;
      if (intent) {
        var th = FS.snakeHead(state.player);
        var tv = FS.dirVec(intent.dir);
        movers.push({ snake: state.player, dir: intent.dir, next: { x: th.x + tv.x, y: th.y + tv.y } });
        state.tutorial.done.move = true;
      }
    } else if (held) {
      state.player.stepAcc += dt;
      if (state.player.stepAcc >= pPeriod) {
        state.player.stepAcc -= pPeriod;
        intent = FS.consumePlayerStepIntent(state, { allowTap: false });
        if (intent) {
          var hh = FS.snakeHead(state.player);
          var vv = FS.dirVec(intent.dir);
          movers.push({ snake: state.player, dir: intent.dir, next: { x: hh.x + vv.x, y: hh.y + vv.y } });
          if (!intent.fromTap) state.tutorial.done.hold = true;
        }
      }
    } else {
      state.player.stepAcc = 0;
      state.input.queue = [];
      state.input.tapConsumedDir = null;
      if (state.tutorial.done.move && state.tutorial.done.hold) {
        state.tutorial.done.stop = true;
      }
    }
    FS.setStanding(state.player, !movers.some(function (m) { return m.snake === state.player; }));
    }

    // --- Enemies: intent only; commit sets dir ---
    state.enemies.forEach(function (e) {
      if (e.dead) return;
      e.intentDir = FS.aiChooseDir(state, e);
      e.stepAcc += dt * (e.slowMul || 1);
      var period = e.stepPeriod;
      if (e.stepAcc >= period) {
        e.stepAcc -= period;
        var stepDir = e.intentDir || e.dir;
        if (FS.wouldEnterNeck(e, stepDir) || FS.isOpp(e.dir, stepDir)) {
          FS.setStanding(e, true);
          return;
        }
        var eh = FS.snakeHead(e);
        var ev = FS.dirVec(stepDir);
        movers.push({ snake: e, dir: stepDir, next: { x: eh.x + ev.x, y: eh.y + ev.y } });
        FS.setStanding(e, false);
      } else {
        FS.setStanding(e, true);
      }
    });

    if (!movers.length) return;

    FS.storeSafeBody(state);
    var result = FS.resolveMoveRound(state, movers);

    result.deaths.forEach(function (d) {
      FS.handleDeath(state, d.snake, d.reason, d.cell);
    });

    result.commits.forEach(function (m) {
      if (m.snake.dead || result.deadIds[m.snake.id]) return;
      FS.commitSnakeMove(m.snake, m.next, m.dir);
      if (m.snake.kind === "enemy") {
        // enemies may eat ripe food but stay within length cap
        for (var fi = state.world.foods.length - 1; fi >= 0; fi--) {
          var ff = state.world.foods[fi];
          if (ff.phase === "bud") continue;
          if (ff.x === m.next.x && ff.y === m.next.y) {
            state.world.foods.splice(fi, 1);
            if (FS.onFoodEaten) FS.onFoodEaten(state, ff);
            if (m.snake.body.length < FS.MAX_LENGTH) FS.growSnake(m.snake, 1);
            FS.capEnemyLength(m.snake);
            break;
          }
        }
        FS.capEnemyLength(m.snake);
      }
      if (m.snake.kind === "player") {
        var pick = FS.pickupAt(state, m.next);
        if (pick && pick.kind === "food") FS.onFood(state, pick.item);
        if (FS.pickupWoodAt) FS.pickupWoodAt(state, m.next);
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
      if (state.guide && state.guide.open && FS.tickGuide) FS.tickGuide(state, now);
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
    if (FS.bindBuildInput) FS.bindBuildInput(state, canvas);
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
