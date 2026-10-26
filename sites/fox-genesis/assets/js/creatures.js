/* FOX GENESIS — player, allies, enemies */
(function (FG) {
  "use strict";

  FG.createPlayer = function (x, y) {
    var body = FG.defaultBody("mobile");
    var c = {
      id: "player",
      kind: "player",
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      angle: 0,
      body: body,
      hp: 80,
      energy: 100,
      invuln: 0,
      camouflage: 0,
      carrying: { biomass: 0, mineral: 0, sample: 0 },
      capacity: 40,
      segmentPhase: 0,
      dashCd: 0,
      abilityCd: { lmb: 0, rmb: 0, q: 0, e: 0 },
      abilityBinds: { rmb: null, q: null, e: null },
      filmCharges: 1,
      filmCd: 0,
      fieldHealCd: 0,
      nestRestT: 0,
      controlledId: null,
      controlT: 0,
      dead: false
    };
    FG.refreshCreatureStats(c);
    return c;
  };

  FG.createAlly = function (breed, x, y) {
    var body = FG.deepClone(breed.body);
    var c = {
      id: FG.uid(),
      kind: "ally",
      role: breed.role || "hunter",
      name: breed.name || "Союзник",
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      angle: 0,
      body: body,
      order: { type: "follow" },
      hp: 60,
      energy: 80,
      invuln: 0,
      homeX: x,
      homeY: y,
      state: "idle",
      targetId: null,
      stuck: 0,
      lastX: x,
      lastY: y
    };
    FG.refreshCreatureStats(c);
    c.hp = c.hpMax;
    return c;
  };

  FG.spawnEnemy = function (archId, x, y, biome) {
    var a = null;
    for (var i = 0; i < FG.ENEMY_ARCHETYPES.length; i++) {
      if (FG.ENEMY_ARCHETYPES[i].id === archId) { a = FG.ENEMY_ARCHETYPES[i]; break; }
    }
    if (!a) a = FG.ENEMY_ARCHETYPES[0];
    return {
      id: FG.uid(),
      kind: "enemy",
      arch: a.id,
      name: a.name,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: a.hp,
      hpMax: a.hp,
      speed: a.speed,
      dmg: a.dmg,
      armor: a.armor || 0,
      style: a.style,
      color: a.color,
      biome: biome || "grove",
      telegraph: null,
      cd: 0.5 + Math.random(),
      state: "wander",
      alert: 0,
      homeX: x,
      homeY: y,
      invuln: 0
    };
  };

  FG.seedCreatures = function (state) {
    var world = state.world;
    var nest = world.nest;
    var rng = FG.mulberry32(world.seed ^ 0xC0FFEE);
    state.enemies = [];
    state.allies = [];
    state.projectiles = [];
    state.hazards = [];
    state.particles = [];
    state.webs = [];

    // pack near edge of grove — not on player
    for (var i = 0; i < 5; i++) {
      var ang = rng() * Math.PI * 2;
      var r = 420 + rng() * 180;
      state.enemies.push(FG.spawnEnemy("pack", nest.x + Math.cos(ang) * r, nest.y + Math.sin(ang) * r, "grove"));
    }
    state.enemies.push(FG.spawnEnemy("armorherb", nest.x + 520, nest.y + 80, "grove"));
    state.enemies.push(FG.spawnEnemy("dasher", nest.x - 480, nest.y + 200, "grove"));

    var places = [
      { b: "grove", x: nest.x + 700, y: nest.y - 400, arch: ["pack", "dasher", "scout"] },
      { b: "swamp", x: nest.x - 1100, y: nest.y - 200, arch: ["spore", "acidshot", "pack"] },
      { b: "crystal", x: nest.x + 1100, y: nest.y - 150, arch: ["spark", "armorherb", "scout"] },
      { b: "roots", x: nest.x - 200, y: nest.y + 1150, arch: ["digger", "parasite", "pack"] },
      { b: "tide", x: nest.x + 250, y: nest.y - 1150, arch: ["tideambush", "support", "pack"] }
    ];
    for (var p = 0; p < places.length; p++) {
      var pl = places[p];
      var count = pl.b === "grove" ? 4 : 6;
      for (var k = 0; k < count; k++) {
        var ax = pl.x + (rng() - 0.5) * 500;
        var ay = pl.y + (rng() - 0.5) * 500;
        var arch = pl.arch[Math.floor(rng() * pl.arch.length)];
        state.enemies.push(FG.spawnEnemy(arch, ax, ay, pl.b));
      }
    }
    // All declared bosses (including grove)
    for (var di = 0; di < world.dens.length; di++) {
      var den = world.dens[di];
      if (!den.boss) continue;
      if (den.biome === "grove" && FG.dist(den.x, den.y, nest.x, nest.y) < 500) {
        den.x = nest.x + 720; den.y = nest.y - 420;
      }
      var boss = FG.spawnEnemy("nestguard", den.x, den.y, den.biome);
      boss.boss = den.boss.id;
      boss.name = den.boss.name;
      boss.hp = den.boss.hp;
      boss.hpMax = den.boss.hp;
      boss.dmg = 14;
      boss.color = FG.BIOMES[den.biome].accent;
      boss.phase = 1;
      boss.style = den.biome === "roots" ? "burrow" : (den.biome === "tide" ? "ambush" : "guard");
      state.enemies.push(boss);
    }

    // herbivores
    for (var h = 0; h < 18; h++) {
      var hx = nest.x + (rng() - 0.5) * 1600;
      var hy = nest.y + (rng() - 0.5) * 1600;
      var herb = FG.spawnEnemy("armorherb", hx, hy, FG.biomeAtWorld(world, hx, hy));
      herb.kind = "neutral";
      herb.name = "Спокійний травоїдний";
      herb.hp = 40;
      herb.hpMax = 40;
      herb.dmg = 3;
      herb.color = "#7A9A78";
      state.enemies.push(herb);
    }
  };

  FG.moveCreature = function (state, c, dx, dy, dt, isPlayer) {
    var len = FG.len(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    var spd = c.speed || 100;
    if (c.camouflage > 0 && isPlayer) spd *= 0.55;
    if (FG.hasOrgans(c.body || { organs: [] }, ["dashlegs"]) && isPlayer) spd *= 1.08;
    var nx = c.x + dx * spd * dt;
    var ny = c.y + dy * spd * dt;
    nx = FG.clamp(nx, 40, FG.WORLD_W - 40);
    ny = FG.clamp(ny, 40, FG.WORLD_H - 40);
    var pass = FG.passable(state.world, c.body || { organs: [] }, nx, ny);
    if (pass === false) return;
    if (pass === "slow") { nx = c.x + dx * spd * 0.45 * dt; ny = c.y + dy * spd * 0.45 * dt; }
    if (pass === "toxic" && isPlayer && !(c._filter > 0)) {
      FG.dealDamage(state, c, 3 * dt, null, { bypassInvuln: true, dtype: "toxic" });
      if (!c._toxicWarn || state.world.time - c._toxicWarn > 4) {
        c._toxicWarn = state.world.time;
        state.ui.toast = "Спори шкодять. Потрібен фільтр.";
      }
    }
    // tide current
    if (FG.biomeAtWorld(state.world, nx, ny) === "tide" && !FG.hasOrgans(c.body || { organs: [] }, ["membrane"])) {
      for (var i = 0; i < state.world.water.length; i++) {
        var wt = state.world.water[i];
        if (FG.dist(nx, ny, wt.x, wt.y) < wt.r) {
          nx += wt.current * dt * 0.4;
          break;
        }
      }
    }
    c.x = nx;
    c.y = ny;
    if (dx || dy) c.angle = Math.atan2(dy, dx);
    c.segmentPhase = (c.segmentPhase || 0) + dt * spd * 0.08;
  };

  FG.updateAllyAI = function (state, ally, dt) {
    var order = ally.order || { type: "follow" };
    var player = state.player;
    var tx = player.x, ty = player.y;
    var speedMul = 1;

    if (ally.hp < ally.hpMax * 0.28) {
      ally.state = "flee";
      tx = state.world.nest.x;
      ty = state.world.nest.y;
    } else if (order.type === "hold") {
      tx = order.x; ty = order.y;
      if (FG.dist(ally.x, ally.y, tx, ty) < 18) return;
    } else if (order.type === "attack" && order.targetId) {
      var t = FG.findById(state, order.targetId);
      if (t && t.hp > 0) { tx = t.x; ty = t.y; ally.targetId = t.id; }
      else ally.order = { type: "follow" };
    } else if (order.type === "gather") {
      var best = null, bestD = 1e9;
      for (var i = 0; i < state.world.resources.length; i++) {
        var r = state.world.resources[i];
        if (r.kind !== "fruit" && r.kind !== "mineral") continue;
        if (order.area && FG.dist(r.x, r.y, order.x, order.y) > (order.r || 220)) continue;
        var d = FG.dist(ally.x, ally.y, r.x, r.y);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (best) {
        ally._gatherArea = { x: order.x, y: order.y, r: order.r || 260 };
        if (bestD < 28) {
          FG.collectResource(state, best, ally, true);
          ally.order = { type: "nest" };
        } else { tx = best.x; ty = best.y; }
      } else if (ally._carry && ((ally._carry.biomass || 0) + (ally._carry.mineral || 0)) > 0) {
        ally.order = { type: "nest" };
      } else {
        // wait in area, do not drop to follow
        tx = order.x; ty = order.y;
        if (FG.dist(ally.x, ally.y, tx, ty) < 24) return;
      }
    } else if (order.type === "nest") {
      tx = state.world.nest.x; ty = state.world.nest.y;
      if (FG.dist(ally.x, ally.y, tx, ty) < 50) {
        if (ally._carry) {
          state.resources.biomass += ally._carry.biomass || 0;
          state.resources.mineral += ally._carry.mineral || 0;
          ally._carry = null;
        }
        // gatherers resume gather cycle; others follow
        if (ally.role === "gatherer" && ally._gatherArea) {
          ally.order = { type: "gather", x: ally._gatherArea.x, y: ally._gatherArea.y, r: ally._gatherArea.r || 260, area: true };
        } else {
          ally.order = { type: "follow" };
        }
      }
    } else if (order.type === "defend") {
      tx = order.x != null ? order.x : state.world.nest.x;
      ty = order.y != null ? order.y : state.world.nest.y;
      var threat = FG.nearestEnemy(state, tx, ty, 220);
      if (threat) { tx = threat.x; ty = threat.y; ally.targetId = threat.id; }
    } else {
      // follow with leash
      var dist = FG.dist(ally.x, ally.y, player.x, player.y);
      if (dist < 70) return;
      if (dist > 420) speedMul = 1.35;
    }

    if (ally.role === "support") {
      var ang = FG.ang(player.x, player.y, tx, ty);
      tx = player.x - Math.cos(ang) * 50;
      ty = player.y - Math.sin(ang) * 50;
      if ((!ally._healCd || ally._healCd <= 0) && player.hp < player.hpMax * 0.85 && state.resources.biomass >= 1) {
        if (FG.dist(ally.x, ally.y, player.x, player.y) < 90) {
          state.resources.biomass -= 1;
          player.hp = Math.min(player.hpMax, player.hp + 10);
          ally._healCd = 5;
          FG.spawnParticles(state, player.x, player.y, FG.COLORS.ally, 6);
        }
      }
      if (ally._healCd > 0) ally._healCd -= dt;
    }
    if (ally.role === "scout") {
      FG.revealFog(state.world, ally.x, ally.y, 260);
    }

    var dx = tx - ally.x, dy = ty - ally.y;
    FG.moveCreature(state, ally, dx, dy, dt * speedMul, false);

    if ((ally.role === "hunter" || ally.role === "guard") && ally.hp > ally.hpMax * 0.3) {
      var near = FG.nearestEnemy(state, ally.x, ally.y, ally.role === "guard" ? 140 : 180);
      if (near && (!ally._atkCd || ally._atkCd <= 0)) {
        if (ally.role === "guard" && FG.dist(near.x, near.y, player.x, player.y) > 220 && FG.dist(near.x, near.y, state.world.nest.x, state.world.nest.y) > 200) {
          /* ignore far threats when guarding player */
        } else {
          var range = FG.hasOrgans(ally.body, ["needles"]) ? 140 : 48;
          var dNear = FG.dist(near.x, near.y, ally.x, ally.y);
          if (dNear < range) {
            if (range > 50) {
              state.projectiles.push({
                id: FG.uid(), x: ally.x, y: ally.y,
                vx: (near.x - ally.x) / dNear * 280, vy: (near.y - ally.y) / dNear * 280,
                life: 0.7, dmg: 5, from: "player", color: FG.COLORS.mint, style: "needle"
              });
            } else {
              FG.dealDamage(state, near, 6 + (ally.stats ? ally.stats.armor * 0.2 : 0), ally);
            }
            ally._atkCd = 0.7;
          } else {
            tx = near.x; ty = near.y;
          }
        }
      }
    }
    if (ally._atkCd > 0) ally._atkCd -= dt;

    if (FG.dist(ally.x, ally.y, ally.lastX, ally.lastY) < 2 * dt) ally.stuck += dt;
    else ally.stuck = 0;
    ally.lastX = ally.x; ally.lastY = ally.y;
    if (ally.stuck > 1.2) {
      // repath offset — not wall-clip teleport
      var ang2 = Math.random() * Math.PI * 2;
      FG.moveCreature(state, ally, Math.cos(ang2), Math.sin(ang2), 0.35, false);
      ally.stuck = 0;
    }
  };

  FG.updateEnemyAI = function (state, e, dt) {
    if (e.hp <= 0) return;
    if (e.invuln > 0) e.invuln -= dt;
    if (e.cd > 0) e.cd -= dt;
    if (e.kind === "neutral") {
      // wander / flee if hurt
      if (e.hp < e.hpMax) {
        var away = FG.norm(e.x - state.player.x, e.y - state.player.y);
        FG.moveCreature(state, e, away.x, away.y, dt, false);
      } else if (Math.random() < 0.02) {
        e._wx = e.homeX + (Math.random() - 0.5) * 160;
        e._wy = e.homeY + (Math.random() - 0.5) * 160;
      }
      if (e._wx != null) FG.moveCreature(state, e, e._wx - e.x, e._wy - e.y, dt * 0.5, false);
      return;
    }

    var player = state.player;
    var d = FG.dist(e.x, e.y, player.x, player.y);
    var detect = 220;
    if (player.camouflage > 0) detect *= 0.45;
    if (FG.hasOrgans(player.body, ["biolume"])) detect *= 1.25;
    if (d < detect) e.alert = Math.min(3, e.alert + dt);
    else e.alert = Math.max(0, e.alert - dt * 0.5);

    if (e.alert <= 0 && d > 80) {
      if (Math.random() < 0.015) {
        e._wx = e.homeX + (Math.random() - 0.5) * 200;
        e._wy = e.homeY + (Math.random() - 0.5) * 200;
      }
      if (e._wx != null) FG.moveCreature(state, e, e._wx - e.x, e._wy - e.y, dt * 0.4, false);
      return;
    }

    // telegraph then attack
    if (e.telegraph) {
      e.telegraph.t -= dt;
      if (e.telegraph.t <= 0) {
        FG.resolveEnemyAttack(state, e);
        e.telegraph = null;
        e.cd = e.style === "dash" ? 1.4 : 1.0;
      }
      return;
    }

    if (e.style === "flee" || (e.arch === "scout" && e.hp < e.hpMax * 0.5)) {
      var fl = FG.norm(e.x - player.x, e.y - player.y);
      FG.moveCreature(state, e, fl.x, fl.y, dt, false);
      return;
    }

    if (e.style === "burrow") {
      e._burrowT = (e._burrowT || 0) - dt;
      if (e._burrowT <= 0 && d < 220 && e.cd <= 0) {
        e._burrowT = 2.2;
        e.invuln = 0.9;
        e.x = player.x + (Math.random() - 0.5) * 60;
        e.y = player.y + (Math.random() - 0.5) * 60;
        e.telegraph = { type: "melee", t: 0.4, ang: FG.ang(e.x, e.y, player.x, player.y) };
        e.cd = 1.6;
        return;
      }
    }

    if (e.style === "buff" || e.arch === "support") {
      var mate = null, md = 160;
      for (var mi = 0; mi < state.enemies.length; mi++) {
        var m = state.enemies[mi];
        if (m === e || !FG.isAlive(m) || m.kind === "neutral") continue;
        var dm = FG.dist(e.x, e.y, m.x, m.y);
        if (dm < md) { md = dm; mate = m; }
      }
      if (mate && e.cd <= 0) {
        mate.armor = (mate.armor || 0) + 2;
        mate._buffed = 4;
        e.cd = 3;
        FG.spawnParticles(state, mate.x, mate.y, FG.COLORS.lilac, 5);
      }
      if (d < 140) FG.moveCreature(state, e, e.x - player.x, e.y - player.y, dt, false);
      else if (mate) FG.moveCreature(state, e, mate.x - e.x, mate.y - e.y, dt * 0.7, false);
      return;
    }

    if (e.style === "ambush") {
      if (d > 200) {
        e.camouflage = 1;
        return;
      }
      e.camouflage = 0;
      if (e.cd <= 0 && d < 160) {
        e.telegraph = { type: "dash", t: 0.35, ang: FG.ang(e.x, e.y, player.x, player.y) };
        return;
      }
    }

    // buildings as raid targets
    if (state.colony.raidWarn > 0 || e._raid) {
      var heart = state.colony.buildings[0];
      if (heart) {
        FG.moveCreature(state, e, heart.x - e.x, heart.y - e.y, dt, false);
        if (FG.dist(e.x, e.y, heart.x, heart.y) < 40 && e.cd <= 0) {
          heart.hp -= e.dmg;
          e.cd = 1;
          if (heart.hp <= 0) {
            state.ui.toast = "Серце гнізда пошкоджено!";
            heart.hp = 1;
          }
        }
        return;
      }
    }

    if (e.style === "ranged" || e.style === "cloud" || e.style === "chain") {
      if (d > 180) FG.moveCreature(state, e, player.x - e.x, player.y - e.y, dt, false);
      else if (d < 100) FG.moveCreature(state, e, e.x - player.x, e.y - player.y, dt, false);
      if (e.cd <= 0 && d < 260) {
        e.telegraph = { type: e.style, t: 0.55, ang: FG.ang(e.x, e.y, player.x, player.y), x: player.x, y: player.y };
      }
      return;
    }

    if (e.style === "dash" && e.cd <= 0 && d < 200 && d > 60) {
      e.telegraph = { type: "dash", t: 0.45, ang: FG.ang(e.x, e.y, player.x, player.y), x: player.x, y: player.y };
      return;
    }

    FG.moveCreature(state, e, player.x - e.x, player.y - e.y, dt, false);
    if (e.cd <= 0 && d < 42) {
      e.telegraph = { type: "melee", t: 0.35, ang: FG.ang(e.x, e.y, player.x, player.y) };
    }

    // boss phase
    if (e.boss && e.hp < e.hpMax * 0.45 && e.phase === 1) {
      e.phase = 2;
      e.speed *= 1.15;
      e.dmg *= 1.2;
      FG.addJournal(state.world, e.name + " змінює фазу!");
      state.ui.toast = "Фаза 2: " + e.name;
    }
  };

  FG.findById = function (state, id) {
    if (state.player.id === id) return state.player;
    for (var i = 0; i < state.allies.length; i++) if (state.allies[i].id === id) return state.allies[i];
    for (var j = 0; j < state.enemies.length; j++) if (state.enemies[j].id === id) return state.enemies[j];
    return null;
  };

  FG.nearestEnemy = function (state, x, y, r) {
    var best = null, bd = r || 200;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (e.hp <= 0 || e.kind === "neutral") continue;
      var d = FG.dist(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
})(window.FoxGenesis);
