/* FOX GENESIS — bootstrap, input, loop */
(function (FG) {
  "use strict";

  FG.newGame = function (state, seed) {
    seed = seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    state.world = FG.generateWorld(seed);
    state.player = FG.createPlayer(state.world.nest.x, state.world.nest.y + 60);
    state.colony = FG.initColony(state.world.nest);
    state.resources = { biomass: 8, mineral: 2, sample: 0 };
    state.genes = {};
    state.generation = 1;
    state.deaths = 0;
    state.progress = { kills: 0, bosses: {} };
    state.tutorial = { done: {} };
    state.path = null;
    FG.seedCreatures(state);
    state.projectiles = [];
    state.hazards = [];
    state.webs = [];
    state.particles = [];
    state.started = true;
    state.pauseReasons = { manual: false, panel: false, blur: false };
    state.paused = false;
    state.atNest = false;
    state.saveRev = 0;
    state.ui.panel = null;
    state.ui.toast = "Збери плід. Біля серця можна відпочити. R — лікування в полі.";
    FG.unlockGene(state, "dashlegs", "народження");
    state.player.abilityBinds = { rmb: null, q: null, e: null };
    FG.resetCameraSmooth(state);
    FG.saveGame(state, "new");
  };

  FG.createState = function (canvas) {
    var state = {
      started: false,
      paused: true,
      pauseReasons: { manual: true, panel: false, blur: false },
      atNest: false,
      settings: {
        volume: 0.7,
        sfx: 0.8,
        muted: false,
        quality: "high",
        reducedMotion: false,
        showNames: false,
        camShake: false
      },
      input: {
        keys: Object.create(null),
        mouse: { x: 0, y: 0, downL: false, downR: false },
        aim: { x: 0, y: 0 }
      },
      renderer: new FG.Renderer(canvas),
      _acc: 0,
      _dt: 0.016,
      _saveTimer: 0
    };
    FG.initAudio(state);
    FG.bindUI(state);
    state.renderer.resize(state.settings.quality);
    return state;
  };

  FG.bindInput = function (state, canvas) {
    window.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
      if (e.repeat) {
        // movement keys still held; ignore toggles
        if (["Space", "Escape", "KeyM", "KeyC", "Tab", "KeyH", "KeyF", "KeyR", "KeyQ", "KeyE"].indexOf(e.code) >= 0) return;
      }
      state.input.keys[e.code] = true;
      FG.unlockAudio(state);
      if (!state.started) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!state.ui.panel) FG.setPauseReason(state, "manual", !state.pauseReasons.manual);
      }
      if (e.code === "Escape") {
        if (state.ui.buildGhost) { state.ui.buildGhost = null; return; }
        if (state.ui.panel) FG.togglePanel(state, state.ui.panel);
        else FG.togglePanel(state, "menu");
      }
      if (e.code === "KeyM") FG.togglePanel(state, "evolve");
      if (e.code === "KeyC") FG.togglePanel(state, "colony");
      if (e.code === "Tab") { e.preventDefault(); FG.togglePanel(state, "map"); }
      if (e.code === "KeyH") FG.togglePanel(state, "help");
      if (e.code === "KeyF") FG.interact(state);
      if (e.code === "KeyR") {
        var hr = FG.tryFieldHeal(state);
        if (!hr.ok && hr.why) state.ui.toast = hr.why;
      }
    });
    window.addEventListener("keyup", function (e) {
      state.input.keys[e.code] = false;
    });
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      state.input.mouse.x = e.clientX - rect.left;
      state.input.mouse.y = e.clientY - rect.top;
      FG.refreshAim(state);
      if (state.ui.buildGhost) {
        state.ui.buildGhost.x = state.input.aim.x;
        state.ui.buildGhost.y = state.input.aim.y;
      }
    });
    canvas.addEventListener("mousedown", function (e) {
      FG.unlockAudio(state);
      if (e.button === 0) state.input.mouse.downL = true;
      if (e.button === 2) state.input.mouse.downR = true;
      if (!state.started || state.paused) return;
      if (e.button === 0 && state.ui.buildGhost) {
        var r = FG.placeBuilding(state, state.ui.buildGhost.type, state.ui.buildGhost.x, state.ui.buildGhost.y);
        if (!r.ok) state.ui.toast = r.why;
        e.preventDefault();
        return;
      }
      if (e.button === 0) FG.playerAttack(state, "lmb");
      if (e.button === 2) { e.preventDefault(); FG.playerAttack(state, "rmb"); }
    });
    function up(e) {
      if (e.button === 0) state.input.mouse.downL = false;
      if (e.button === 2) state.input.mouse.downR = false;
    }
    canvas.addEventListener("mouseup", up);
    window.addEventListener("mouseup", up);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      var z = state.renderer.cam.z * (e.deltaY > 0 ? 0.92 : 1.08);
      state.renderer.cam.z = FG.clamp(z, 0.55, 1.6);
      FG.refreshAim(state);
    }, { passive: false });

    window.addEventListener("blur", function () {
      if (state.started) {
        FG.setPauseReason(state, "blur", true);
        FG.clearInputs(state);
      }
    });
    window.addEventListener("focus", function () {
      FG.setPauseReason(state, "blur", false);
      FG.clearInputs(state);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state.started) {
        FG.setPauseReason(state, "blur", true);
        FG.clearInputs(state);
      } else if (!document.hidden) {
        FG.setPauseReason(state, "blur", false);
      }
    });
    window.addEventListener("resize", function () {
      state.renderer.resize(state.settings.quality);
    });
  };

  FG.interact = function (state) {
    if (state.paused) return;
    state.atNest = FG.atNest(state);
    if (state.atNest) {
      FG.depositCargo(state);
      state.tutorial.done.nest = true;
    }
    if (FG.interactLocation(state)) return;

    var best = null, bd = 64;
    for (var i = 0; i < state.world.resources.length; i++) {
      var r = state.world.resources[i];
      var d = FG.dist(state.player.x, state.player.y, r.x, r.y);
      if (d < bd) { bd = d; best = r; }
    }
    if (best) {
      FG.collectResource(state, best, state.player, false);
      if (state.audio) FG.sfx(state, "pickup");
      return;
    }
    for (var j = 0; j < state.enemies.length; j++) {
      var e = state.enemies[j];
      if (e._rescue && FG.isAlive(e) && FG.dist(state.player.x, state.player.y, e.x, e.y) < 40) {
        e.hp = e.hpMax;
        e._rescue = false;
        FG.unlockGene(state, "filmshield", "порятунок");
        state.resources.biomass += 6;
        state.ui.toast = "Істоту врятовано";
        FG.addJournal(state.world, "Порятунок дав ген плівкового щита.");
        return;
      }
    }
  };

  FG.updatePlayer = function (state, dt) {
    var p = state.player;
    if (p.fieldHealCd > 0) p.fieldHealCd -= dt;

    var dx = 0, dy = 0;
    if (state.input.keys["KeyW"] || state.input.keys["ArrowUp"]) dy -= 1;
    if (state.input.keys["KeyS"] || state.input.keys["ArrowDown"]) dy += 1;
    if (state.input.keys["KeyA"] || state.input.keys["ArrowLeft"]) dx -= 1;
    if (state.input.keys["KeyD"] || state.input.keys["ArrowRight"]) dx += 1;

    if (state.input.keys["ShiftLeft"] || state.input.keys["ShiftRight"]) {
      if (p.dashCd <= 0 && (dx || dy) && FG.hasOrgans(p.body, ["dashlegs"])) {
        if (p.energy < 8) {
          state.ui.toast = "Мало енергії для ривка";
        } else {
          p.dashCd = 1.1;
          p.energy -= 8;
          FG.moveCreature(state, p, dx, dy, 0.22, true);
          FG.spawnParticles(state, p.x, p.y, FG.COLORS.mint, 6);
          if (!state.tutorial.done.ability) state.tutorial.done.ability = true;
        }
      }
    }

    if (p._hover > 0) p._hover -= dt;
    if (p._burrow > 0) p._burrow -= dt;
    if (p._lume > 0) p._lume -= dt;
    if (p._vibe > 0) p._vibe -= dt;
    if (p._filter > 0) p._filter -= dt;
    if (p._phero > 0) p._phero -= dt;
    if (p.camouflage > 0) p.camouflage -= dt;
    if (p.controlT > 0) {
      p.controlT -= dt;
      var ctrl = FG.findById(state, p.controlledId);
      if (ctrl && FG.isAlive(ctrl)) {
        FG.moveCreature(state, ctrl, state.input.aim.x - ctrl.x, state.input.aim.y - ctrl.y, dt, false);
      }
      if (p.controlT <= 0) p.controlledId = null;
    }

    FG.moveCreature(state, p, dx, dy, dt, true);
    p.angle = Math.atan2(state.input.aim.y - p.y, state.input.aim.x - p.x);

    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.filmCd > 0) {
      p.filmCd -= dt;
      if (p.filmCd <= 0) p.filmCharges = 1;
    }
    ["lmb", "rmb", "q", "e"].forEach(function (k) {
      if (p.abilityCd[k] > 0) p.abilityCd[k] -= dt;
    });

    p.energy = Math.min(p.energyMax, p.energy + 6 * dt);

    // Passive regen organ out of combat
    if (FG.hasOrgans(p.body, ["regen"]) && !FG.enemyNear(state, p.x, p.y, 120) && p.hp < p.hpMax) {
      var pr = 2.5 * (1 + (p.stats && p.stats.healBonus || 0));
      if (p.body.specs.regen === "field") pr *= 0.7;
      p.hp = Math.min(p.hpMax, p.hp + pr * dt);
    }

    FG.updateNestRest(state, dt);

    // Controlled soft injury for tutorial heal step
    if (state.tutorial.done.food && !state.tutorial.done.hurt && !state.tutorial.done.heal && state.world.time > 8) {
      if (p.hp > p.hpMax * 0.72) {
        FG.dealDamage(state, p, 8, null, { bypassInvuln: true });
        state.tutorial.done.hurt = true;
        state.ui.toast = "Ти поранений. Біля серця гнізда відпочинь або натисни R.";
      }
    }

    if (state.input.keys["KeyQ"]) { FG.playerAttack(state, "q"); state.input.keys["KeyQ"] = false; if (!state.tutorial.done.ability) state.tutorial.done.ability = true; }
    if (state.input.keys["KeyE"]) { FG.playerAttack(state, "e"); state.input.keys["KeyE"] = false; if (!state.tutorial.done.ability) state.tutorial.done.ability = true; }

    FG.revealFog(state.world, p.x, p.y, 200 + (p._lume > 0 ? 120 : 0));
    state.atNest = FG.atNest(state);

    for (var ri = state.world.resources.length - 1; ri >= 0; ri--) {
      var res = state.world.resources[ri];
      if (FG.dist(p.x, p.y, res.x, res.y) < 32) {
        FG.collectResource(state, res, p, false);
        if (state.audio) FG.sfx(state, "pickup");
        break;
      }
    }

    if (p._sym) {
      p._sym.t -= dt;
      if (p._sym.mode === "support" && p._sym.t > 0) p.hp = Math.min(p.hpMax, p.hp + 2 * dt);
      if (p._sym.t <= 0) p._sym = null;
    }

    // Ally pheromone buff
    for (var ai = 0; ai < state.allies.length; ai++) {
      var al = state.allies[ai];
      if (al._buff > 0) {
        al._buff -= dt;
        al.speed = (al.stats ? al.stats.speed : 100) * 1.12;
        al.armor = (al.stats ? al.stats.armor : 4) + 2;
      }
    }
  };

  FG.fixedUpdate = function (state, dt) {
    if (!state.started || state.paused) return;
    FG.updatePlayer(state, dt);
    FG.updateColony(state, dt);
    FG.updateEcosystem(state, dt);

    for (var i = 0; i < state.allies.length; i++) {
      if (FG.isAlive(state.allies[i])) FG.updateAllyAI(state, state.allies[i], dt);
    }
    for (var j = 0; j < state.enemies.length; j++) {
      var e = state.enemies[j];
      if (!FG.isAlive(e)) continue;
      if (e._slow) { FG.updateEnemyAI(state, e, dt * e._slow); e._slow = null; }
      else FG.updateEnemyAI(state, e, dt);
      if (e.hp < e.hpMax * 0.9) state._lastBigFight = state.world.time;
    }
    state.enemies = state.enemies.filter(function (e) { return FG.isAlive(e); });
    state.allies = state.allies.filter(function (a) { return FG.isAlive(a); });

    FG.updateProjectiles(state, dt);
    FG.updateHazards(state, dt);
    FG.updateParticles(state, dt);

    if (state.atNest && state.genes.dashlegs && state.player.body.organs.indexOf("dashlegs") < 0 && !state.tutorial.done.install) {
      if (!state._hintInstall) {
        state._hintInstall = true;
        state.ui.toast = "У гнізді M — встанови ривкові лапи (кнопка «Встановити»)";
      }
    }
  };

  FG.frame = function (state, now) {
    if (!state._last) state._last = now;
    var frameDt = Math.min(0.05, (now - state._last) / 1000);
    state._last = now;
    state._dt = frameDt;

    state._acc += frameDt;
    var steps = 0;
    while (state._acc >= 1 / 60 && steps < 5) {
      FG.fixedUpdate(state, 1 / 60);
      state._acc -= 1 / 60;
      steps++;
    }
    if (steps >= 5) state._acc = 0;

    if (state.started) {
      state.renderer.follow(state.player, state.input.aim, frameDt);
      FG.refreshAim(state);
      state.renderer.draw(state);
      FG.renderHUD(state);
      state._saveTimer += frameDt;
      if (state._saveTimer > 20) {
        state._saveTimer = 0;
        if (!state.paused) FG.saveGame(state, "interval");
      }
    } else {
      state.renderer.cam.x = FG.WORLD_W / 2;
      state.renderer.cam.y = FG.WORLD_H / 2;
      if (!state.world) state.world = FG.generateWorld(1);
      if (!state.player) state.player = FG.createPlayer(state.world.nest.x, state.world.nest.y);
      if (!state.colony) state.colony = FG.initColony(state.world.nest);
      if (!state.enemies) { state.enemies = []; state.allies = []; state.projectiles = []; state.hazards = []; state.webs = []; state.particles = []; }
      if (!state.resources) state.resources = { biomass: 0, mineral: 0, sample: 0 };
      if (!state.genes) state.genes = {};
      if (!state.progress) state.progress = { kills: 0, bosses: {} };
      if (!state.tutorial) state.tutorial = { done: {} };
      state.renderer.draw(state);
    }

    requestAnimationFrame(function (t) { FG.frame(state, t); });
  };

  FG.boot = function () {
    var canvas = document.getElementById("game");
    var state = FG.createState(canvas);
    FG.bindInput(state, canvas);
    try {
      var best = FG.loadBestSnapshot();
      var btn = document.getElementById("btn-continue");
      if (best.ok) btn.textContent = "Продовжити";
      else btn.textContent = "Немає сейву";
    } catch (e) {
      document.getElementById("btn-continue").title = "localStorage недоступний — використай експорт";
    }
    requestAnimationFrame(function (t) { FG.frame(state, t); });
    window.FoxGenesisState = state;
  };

  document.addEventListener("DOMContentLoaded", FG.boot);
})(window.FoxGenesis);
