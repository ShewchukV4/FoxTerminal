/* FOX SERPENT — enemy bases, capture, weapons (no HP bars) */
(function (FS) {
  "use strict";

  FS.BASE_MIN_START_CHEB = 3;
  FS.BASE_MIN_SEP_CHEB = 2;

  FS.ensureEnemyBases = function (state) {
    if (!state.enemyBases) state.enemyBases = [];
    if (!state.weapons) {
      state.weapons = {
        equipped: "spear",
        phase: null, // windup|active|recovery|parry
        t: 0, dir: null, attackId: 0, lastHitId: null,
        parryCd: 0
      };
    }
    return state.enemyBases;
  };

  FS.chebyshevChunk = function (ax, ay, bx, by) {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  };

  FS.baseSpawnChance = function (state) {
    if (state.specialization === "raider") return 0.22;
    return (state.effects && state.effects.baseSpawnChance) || 0.12;
  };

  FS.canPlaceEnemyBaseAtChunk = function (state, cx, cy) {
    FS.ensureEnemyBases(state);
    var start = state.world && state.world.nest
      ? { cx: Math.floor(state.world.nest.x / FS.CHUNK), cy: Math.floor(state.world.nest.y / FS.CHUNK) }
      : { cx: 0, cy: 0 };
    if (FS.chebyshevChunk(cx, cy, start.cx, start.cy) < FS.BASE_MIN_START_CHEB) {
      return { ok: false, why: "Занадто близько до старту" };
    }
    for (var i = 0; i < state.enemyBases.length; i++) {
      var b = state.enemyBases[i];
      var footprints = b.chunks || [{ cx: b.cx, cy: b.cy }];
      for (var j = 0; j < footprints.length; j++) {
        if (FS.chebyshevChunk(cx, cy, footprints[j].cx, footprints[j].cy) < FS.BASE_MIN_SEP_CHEB) {
          return { ok: false, why: "Поруч інша база / сайт" };
        }
      }
    }
    return { ok: true };
  };

  FS.trySpawnEnemyBaseOnChunk = function (state, offer) {
    if (!offer) return null;
    FS.ensureEnemyBases(state);
    var gate = FS.canPlaceEnemyBaseAtChunk(state, offer.cx, offer.cy);
    if (!gate.ok) return null;
    var h = FS.hash2(state.world.seed ^ (state.specialization === "raider" ? 77 : 0),
      offer.cx * 9109 + offer.cy * 9173);
    var chance = FS.baseSpawnChance(state);
    // Soft guarantee for raider: after many dry chunks, bump
    if (state.specialization === "raider") {
      state.progress = state.progress || {};
      state.progress.chunksSinceBase = (state.progress.chunksSinceBase || 0) + 1;
      if (state.progress.chunksSinceBase >= 8) chance = Math.min(0.55, chance + 0.2);
    }
    if ((h % 1000) / 1000 >= chance) return null;

    var layouts = ["thieves", "stone_camp", "forest_den", "yard"];
    var layout = layouts[h % layouts.length];
    var ox = offer.cx * FS.CHUNK + 6;
    var oy = offer.cy * FS.CHUNK + 6;
    var siteId = "base_" + offer.cx + "_" + offer.cy;
    if (state.enemyBases.some(function (b) { return b.id === siteId; })) return null;

    var base = {
      id: siteId,
      cx: offer.cx, cy: offer.cy,
      chunks: [{ cx: offer.cx, cy: offer.cy }],
      layout: layout,
      level: 1 + (h % 3),
      owner: "enemy",
      center: { x: ox, y: oy },
      reinforcementBudget: 2 + (h % 3),
      reinforcementBudgetMax: 2 + (h % 3),
      homes: [],
      captured: false,
      rewardGiven: false,
      contest: null
    };

    // Place simple structures on surface world
    var buildings = state.buildings || [];
    function place(kind, x, y, extra) {
      var b = Object.assign({
        id: FS.uid(), kind: kind, x: x, y: y, owner: "enemy",
        worldId: "surface", baseId: siteId
      }, extra || {});
      buildings.push(b);
      return b;
    }
    place("campfire", ox, oy, { light: 1 });
    place("hut", ox + 2, oy, {});
    place("hut", ox - 2, oy + 1, {});
    place("larder", ox, oy + 2, {});
    place("fence", ox + 3, oy - 1, {});
    place("gate", ox + 3, oy, { closed: true });

    base.homes.push({
      id: siteId + "_h0", x: ox + 2, y: oy, capacity: 1,
      residents: [], door: { x: ox + 2, y: oy + 1 }, owner: "enemy"
    });
    base.homes.push({
      id: siteId + "_h1", x: ox - 2, y: oy + 1, capacity: 1,
      residents: [], door: { x: ox - 2, y: oy + 2 }, owner: "enemy"
    });

    // Initial defenders (finite)
    var nDef = 1 + (base.level > 1 ? 1 : 0);
    for (var d = 0; d < nDef; d++) {
      var sn = FS.createSnake({
        id: siteId + "_e" + d,
        kind: "enemy",
        name: "Вартовий",
        arch: "guard",
        x: ox + 1 - d, y: oy - 2,
        dir: "D",
        length: 3
      });
      sn.worldId = "surface";
      sn.home = base.homes[d % base.homes.length];
      sn.baseId = siteId;
      sn.color = "#a05050";
      state.enemies.push(sn);
    }

    state.enemyBases.push(base);
    state.world.landmarks = state.world.landmarks || [];
    state.world.landmarks.push({
      id: siteId + "_lm", kind: "enemy_base", x: ox, y: oy,
      name: "Ворожий табір", baseId: siteId, done: false
    });
    if (state.progress) state.progress.chunksSinceBase = 0;
    return base;
  };

  FS.beginCapture = function (state, base) {
    if (!base || base.captured) return { ok: false, why: "Неможливо" };
    var h = FS.snakeHead(state.player);
    if (FS.manhattan(h, base.center) > 1) return { ok: false, why: "Підійди до центру" };
    // Contest if enemy in zone
    var threat = (state.enemies || []).some(function (e) {
      if (e.dead || e.baseId !== base.id) return false;
      return FS.manhattan(FS.snakeHead(e), base.center) <= 4;
    });
    base.contest = { t: 0, need: 6, interrupted: false, threat: threat };
    state.ui.toast = threat ? "Захоплення… є ворог у зоні!" : "Захоплення центру…";
    return { ok: true };
  };

  FS.tickCapture = function (state, dt) {
    FS.ensureEnemyBases(state);
    state.enemyBases.forEach(function (base) {
      if (!base.contest || base.captured) return;
      var h = FS.snakeHead(state.player);
      if (FS.manhattan(h, base.center) > 1) {
        base.contest = null;
        state.ui.toast = "Захоплення перервано (відійшов)";
        return;
      }
      var threat = (state.enemies || []).some(function (e) {
        if (e.dead || e.baseId !== base.id) return false;
        return FS.manhattan(FS.snakeHead(e), base.center) <= 4;
      });
      if (threat) {
        base.contest.threat = true;
        // Still progresses slowly while contested? Prompt: cannot capture freely with enemy in zone
        return;
      }
      base.contest.t += dt;
      if (base.contest.t >= base.contest.need) {
        FS.completeCapture(state, base);
      }
    });
  };

  FS.completeCapture = function (state, base) {
    if (base.captured) return;
    base.captured = true;
    base.owner = "player";
    base.contest = null;
    base.reinforcementBudget = 0; // stop further spawns
    (state.buildings || []).forEach(function (b) {
      if (b.baseId === base.id) b.owner = "player";
    });
    if (!base.rewardGiven) {
      base.rewardGiven = true;
      FS.gainWood(state, 4);
      if (FS.gainMaterial) {
        FS.gainMaterial(state, "stone", 2);
        FS.gainMaterial(state, "fiber", 1);
      }
      FS.addXp(state, 8);
      state.ui.toast = "Табір захоплено! +деревина/камінь/XP (один раз)";
    } else {
      state.ui.toast = "Табір уже був нагороджений";
    }
    if (FS.saveGame) FS.saveGame(state, "capture");
  };

  // —— Weapons: spear / hook / smoke — one-hit lethal on HEAD only ——
  FS.WEAPON_SPEAR = {
    windup: 0.8, active: 0.12, recovery: 1.2, range: 1
  };
  FS.PARRY_WINDOW = 0.25;
  FS.PARRY_CD = 2.5;

  FS.startAttack = function (state) {
    FS.ensureEnemyBases(state);
    var w = state.weapons;
    if (w.phase) return { ok: false, why: "Зайнято" };
    w.phase = "windup";
    w.t = FS.WEAPON_SPEAR.windup;
    w.dir = state.player.dir;
    w.attackId = (w.attackId || 0) + 1;
    w.lastHitId = null;
    state.player.standing = true;
    if (state.input) FS.clearInput(state.input);
    state.ui.toast = "Замах…";
    return { ok: true };
  };

  FS.startParry = function (state) {
    FS.ensureEnemyBases(state);
    var w = state.weapons;
    if (w.parryCd > 0 || w.phase) return { ok: false };
    w.phase = "parry";
    w.t = FS.PARRY_WINDOW;
    return { ok: true };
  };

  FS.attackCell = function (state) {
    var w = state.weapons;
    if (!w || !w.dir) return null;
    var h = FS.snakeHead(state.player);
    var v = FS.dirVec(w.dir);
    return { x: h.x + v.x, y: h.y + v.y };
  };

  FS.tickWeapons = function (state, dt) {
    if (!state.started || state.paused) return;
    FS.ensureEnemyBases(state);
    var w = state.weapons;
    if (w.parryCd > 0) w.parryCd -= dt;
    if (!w.phase) return;
    w.t -= dt;
    if (w.phase === "windup" && w.t <= 0) {
      w.phase = "active";
      w.t = FS.WEAPON_SPEAR.active;
    } else if (w.phase === "active") {
      var cell = FS.attackCell(state);
      if (cell && w.lastHitId !== w.attackId) {
        var hits = FS.snakeAtCell(state, cell.x, cell.y, false);
        for (var i = 0; i < hits.length; i++) {
          if (hits[i].snake.kind === "player") continue;
          if (hits[i].part !== "head") continue; // body is obstacle only
          // Lethal — no HP
          hits[i].snake.dead = true;
          w.lastHitId = w.attackId;
          state.ui.toast = "Влучання в голову";
          break;
        }
      }
      if (w.t <= 0) {
        w.phase = "recovery";
        w.t = FS.WEAPON_SPEAR.recovery;
      }
    } else if ((w.phase === "recovery" || w.phase === "parry") && w.t <= 0) {
      if (w.phase === "parry") w.parryCd = FS.PARRY_CD;
      w.phase = null;
    }
  };
})(window.FoxSerpent);
