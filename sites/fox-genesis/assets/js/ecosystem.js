/* FOX GENESIS — local ecosystem + event director */
(function (FG) {
  "use strict";

  FG.updateEcosystem = function (state, dt) {
    var world = state.world;
    world.time += dt;
    world.tidePhase = (Math.sin(world.time * 0.05) + 1) * 0.5;

    world.eco = world.eco || { herb: 40, pred: 18, plants: 60 };
    var nearPred = 0, nearHerb = 0;
    var px = state.player.x, py = state.player.y;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!FG.isAlive(e)) continue;
      if (FG.dist(e.x, e.y, px, py) > 700) continue;
      if (e.kind === "neutral") nearHerb++;
      else nearPred++;
    }
    // Local causal loop: predators eat herbivores → plants recover
    if (nearPred > nearHerb && Math.random() < dt * 0.04) {
      for (var h = 0; h < state.enemies.length; h++) {
        var herb = state.enemies[h];
        if (herb.kind === "neutral" && FG.isAlive(herb) && FG.dist(herb.x, herb.y, px, py) < 700) {
          FG.dealDamage(state, herb, 8, null, { bypassInvuln: true });
          world.eco.plants = Math.min(100, world.eco.plants + 2);
          break;
        }
      }
    }
    world.eco.pred = FG.lerp(world.eco.pred, 10 + nearPred * 2, dt * 0.05);
    world.eco.herb = FG.lerp(world.eco.herb, 20 + nearHerb * 3, dt * 0.05);
    var plantGain = (world.eco.herb < 25 ? 2 : -world.eco.herb * 0.02) * dt;
    if (state._drought > 0) plantGain -= 3 * dt;
    world.eco.plants += plantGain;
    world.eco.plants = FG.clamp(world.eco.plants, 10, 100);

    if (state._drought > 0) {
      state._drought -= dt;
      // Drought: fruit nodes dry — reduce amount slowly
      if (Math.random() < dt * 0.8) {
        for (var r = 0; r < world.resources.length; r++) {
          if (world.resources[r].kind === "fruit" && world.resources[r].amount > 1) {
            world.resources[r].amount -= 1;
            break;
          }
        }
      }
    }
    if (state._sporefog > 0) state._sporefog -= dt;

    if (world.eco.plants < 20 && Math.random() < dt * 0.02) {
      FG.addJournal(world, "Спостереження: рослини рідшають — травоїдні тиснуть на галявини.");
    }
    if (world.eco.pred < 8 && Math.random() < dt * 0.015) {
      var nest = world.nest;
      var ang = Math.random() * Math.PI * 2;
      state.enemies.push(FG.spawnEnemy("pack", nest.x + Math.cos(ang) * 900, nest.y + Math.sin(ang) * 900, "grove"));
      FG.addJournal(world, "Спостереження: нова зграя мігрує з межі світу.");
    }

    // Cap populations near player
    var nearCount = nearPred + nearHerb;
    if (nearCount > 28) {
      for (var c = state.enemies.length - 1; c >= 0 && nearCount > 28; c--) {
        var en = state.enemies[c];
        if (en.boss || !FG.isAlive(en)) continue;
        if (FG.dist(en.x, en.y, px, py) > 500 && en.kind !== "neutral") {
          en.hp = 0; en.dead = true; nearCount--;
        }
      }
    }

    state._fruitAcc = (state._fruitAcc || 0) + dt;
    var fruitCd = state._drought > 0 ? 22 : 14;
    if (state._fruitAcc > fruitCd && world.resources.filter(function (r) { return r.kind === "fruit"; }).length < 80) {
      state._fruitAcc = 0;
      var rx = px + (Math.random() - 0.5) * 800;
      var ry = py + (Math.random() - 0.5) * 800;
      world.resources.push({
        id: FG.uid(), kind: "fruit", x: FG.clamp(rx, 50, FG.WORLD_W - 50),
        y: FG.clamp(ry, 50, FG.WORLD_H - 50), amount: state._drought > 0 ? 2 : 4,
        biome: FG.biomeAtWorld(world, rx, ry)
      });
    }

    FG.updateEventDirector(state, dt);
  };

  FG.updateEventDirector = function (state, dt) {
    var world = state.world;
    world.eventCd -= dt;
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
      state.colony.raidWarn = 28;
      for (var i = 0; i < 5; i++) {
        var ang = Math.random() * Math.PI * 2;
        var raider = FG.spawnEnemy("pack",
          state.world.nest.x + Math.cos(ang) * 400,
          state.world.nest.y + Math.sin(ang) * 400, "grove");
        raider._raid = true;
        state.enemies.push(raider);
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
    if (ev.id === "migration") {
      for (var m = 0; m < state.enemies.length; m++) {
        var en = state.enemies[m];
        if (!FG.isAlive(en) || en.boss) continue;
        en.homeX += (Math.random() - 0.5) * 400;
        en.homeY += (Math.random() - 0.5) * 400;
        en._wx = en.homeX; en._wy = en.homeY;
      }
      FG.addJournal(state.world, "Зграї змінили домівки.");
    }
    if (ev.id === "rareprey") {
      var rare = FG.spawnEnemy("scout", state.player.x + 200, state.player.y - 150, FG.biomeAtWorld(state.world, state.player.x, state.player.y));
      rare.name = "Рідкісна здобич";
      rare.hp = 50; rare.hpMax = 50; rare.color = FG.COLORS.lilac;
      rare._rare = true;
      state.enemies.push(rare);
      state.world.resources.push({
        id: FG.uid(), kind: "gene_sample", gene: "camouflage",
        x: rare.x + 30, y: rare.y, amount: 1, biome: rare.biome
      });
    }
    if (ev.id === "tide") {
      state.world.tidePhase = 0.9;
      e._boostTide = true;
    }
    if (ev.id === "mushroom" || ev.id === "sporefog") {
      state._sporefog = Math.max(state._sporefog || 0, e.t);
    }
    if (ev.id === "incubator") {
      FG.unlockGene(state, "symbiont", "покинутий інкубатор");
      state.resources.sample += 1;
    }
    if (ev.id === "rift") {
      // open a short clear corridor into roots biome from nest direction
      var roots = FG.biomeCenters().filter(function (c) { return c.biome === "roots"; })[0];
      state.world.barriers = state.world.barriers.filter(function (b) {
        return FG.dist(b.x, b.y, roots.x, roots.y) > 180;
      });
      FG.revealFog(state.world, roots.x, roots.y, 200);
      FG.addJournal(state.world, "Тріщина відкрила шлях до коренів.");
    }
    if (ev.id === "war") {
      for (var wi = 0; wi < 3; wi++) {
        var a1 = FG.spawnEnemy("pack", state.player.x + 250 + wi * 20, state.player.y + 80, "grove");
        var a2 = FG.spawnEnemy("pack", state.player.x + 320 + wi * 20, state.player.y + 100, "grove");
        a1._war = a2.id; a2._war = a1.id;
        state.enemies.push(a1); state.enemies.push(a2);
      }
    }
  };

  FG.endEvent = function (state, e) {
    if (e.id === "sporefog") state._sporefog = 0;
    if (e.id === "drought") state._drought = 0;
    if (e.id === "raid") state.colony.raidWarn = 0;
    if (e.id === "rareprey") {
      // reward if rare killed
      for (var i = 0; i < state.enemies.length; i++) {
        if (state.enemies[i]._rare && !FG.isAlive(state.enemies[i])) {
          state.resources.sample += 2;
          break;
        }
      }
    }
    FG.addJournal(state.world, "Подія завершилась: " + e.name);
  };
})(window.FoxGenesis);
