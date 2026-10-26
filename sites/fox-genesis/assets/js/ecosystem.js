/* FOX GENESIS — local ecosystem + event director */
(function (FG) {
  "use strict";

  FG.updateEcosystem = function (state, dt) {
    var world = state.world;
    world.time += dt;
    world.tidePhase = (Math.sin(world.time * 0.05) + 1) * 0.5;

    // aggregate distant populations
    world.eco = world.eco || {
      herb: 40, pred: 18, plants: 60
    };
    var nearPred = 0, nearHerb = 0;
    var px = state.player.x, py = state.player.y;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (e.hp <= 0) continue;
      if (FG.dist(e.x, e.y, px, py) > 700) continue;
      if (e.kind === "neutral") nearHerb++;
      else nearPred++;
    }
    world.eco.pred = FG.lerp(world.eco.pred, 10 + nearPred * 2, dt * 0.05);
    world.eco.herb = FG.lerp(world.eco.herb, 20 + nearHerb * 3, dt * 0.05);
    world.eco.plants += (world.eco.herb < 25 ? 2 : -world.eco.herb * 0.02) * dt;
    world.eco.plants = FG.clamp(world.eco.plants, 10, 100);

    if (world.eco.plants < 20 && Math.random() < dt * 0.02) {
      FG.addJournal(world, "Спостереження: рослини рідшають — травоїдні тиснуть на галявини.");
    }
    if (world.eco.pred < 8 && Math.random() < dt * 0.015) {
      // soft recovery migration
      var nest = world.nest;
      var ang = Math.random() * Math.PI * 2;
      state.enemies.push(FG.spawnEnemy("pack", nest.x + Math.cos(ang) * 900, nest.y + Math.sin(ang) * 900, "grove"));
      FG.addJournal(world, "Спостереження: нова зграя мігрує з межі світу.");
    }

    // respawn some fruit slowly
    state._fruitAcc = (state._fruitAcc || 0) + dt;
    if (state._fruitAcc > 14 && world.resources.filter(function (r) { return r.kind === "fruit"; }).length < 80) {
      state._fruitAcc = 0;
      var rx = px + (Math.random() - 0.5) * 800;
      var ry = py + (Math.random() - 0.5) * 800;
      world.resources.push({
        id: FG.uid(), kind: "fruit", x: FG.clamp(rx, 50, FG.WORLD_W - 50),
        y: FG.clamp(ry, 50, FG.WORLD_H - 50), amount: 4, biome: FG.biomeAtWorld(world, rx, ry)
      });
    }

    FG.updateEventDirector(state, dt);
  };

  FG.updateEventDirector = function (state, dt) {
    var world = state.world;
    world.eventCd -= dt;
    // clean finished
    for (var i = world.activeEvents.length - 1; i >= 0; i--) {
      world.activeEvents[i].t -= dt;
      if (world.activeEvents[i].t <= 0) {
        FG.endEvent(state, world.activeEvents[i]);
        world.activeEvents.splice(i, 1);
      }
    }
    if (world.eventCd > 0) return;
    if (world.activeEvents.length >= 2) return;
    if (state.world.time - (state._lastBigFight || 0) < 25) return;

    var pool = FG.EVENTS.filter(function (ev) {
      return !world.activeEvents.some(function (a) { return a.id === ev.id; });
    });
    if (!pool.length) return;
    // bias: early game softer events
    if (world.time < 180) {
      pool = pool.filter(function (e) {
        return ["rareprey", "wounded", "bloom", "migration"].indexOf(e.id) >= 0;
      });
      if (!pool.length) pool = FG.EVENTS.slice(0, 4);
    }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    FG.startEvent(state, pick);
    world.eventCd = pick.cd * (0.7 + Math.random() * 0.5);
  };

  FG.startEvent = function (state, ev) {
    var e = { id: ev.id, name: ev.name, t: 45 + Math.random() * 30 };
    state.world.activeEvents.push(e);
    state.ui.toast = ev.warn;
    FG.addJournal(state.world, "Подія: " + ev.name + " — " + ev.warn);
    if (ev.id === "raid") {
      state.colony.raidWarn = 20;
      for (var i = 0; i < 4; i++) {
        var ang = Math.random() * Math.PI * 2;
        var r = 380;
        state.enemies.push(FG.spawnEnemy("pack",
          state.world.nest.x + Math.cos(ang) * r,
          state.world.nest.y + Math.sin(ang) * r, "grove"));
      }
    }
    if (ev.id === "bloom") {
      for (var b = 0; b < 8; b++) {
        state.world.resources.push({
          id: FG.uid(), kind: "fruit",
          x: state.player.x + (Math.random() - 0.5) * 300,
          y: state.player.y + (Math.random() - 0.5) * 300,
          amount: 6, biome: "grove"
        });
      }
    }
    if (ev.id === "wounded") {
      var w = FG.spawnEnemy("pack", state.player.x + 120, state.player.y - 80, "grove");
      w.kind = "neutral";
      w.name = "Поранена істота";
      w.hp = 12;
      w.hpMax = 40;
      w._rescue = true;
      state.enemies.push(w);
    }
    if (ev.id === "sporefog") state._sporefog = e.t;
    if (ev.id === "drought") state._drought = e.t;
  };

  FG.endEvent = function (state, e) {
    if (e.id === "sporefog") state._sporefog = 0;
    if (e.id === "drought") state._drought = 0;
    FG.addJournal(state.world, "Подія завершилась: " + e.name);
  };
})(window.FoxGenesis);
