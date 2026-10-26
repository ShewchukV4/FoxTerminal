/* FOX GENESIS — combat, abilities, telegraphs, damage */
(function (FG) {
  "use strict";

  FG.isAlive = function (t) {
    return t && !t.dead && t.hp > 0;
  };

  /**
   * Unified damage. opts: { bypassInvuln, dtype, owner }
   * Contact invuln does NOT block DoT (bypassInvuln).
   * Death handled exactly once via onDeath.
   */
  FG.dealDamage = function (state, target, amount, source, opts) {
    opts = opts || {};
    if (!target || target.dead || target.hp <= 0) return 0;
    if (!opts.bypassInvuln && target.invuln > 0) return 0;
    var dmg = amount;
    if (target.armor) dmg = Math.max(1, dmg - target.armor * 0.35);
    if (target.kind === "player" && FG.hasOrgans(target.body, ["filmshield"]) && target.filmCharges > 0 && !opts.bypassInvuln) {
      target.filmCharges = 0;
      target.filmCd = 4;
      target.invuln = 0.35;
      FG.spawnParticles(state, target.x, target.y, FG.COLORS.teal, 8);
      state.ui.toast = "Плівковий щит!";
      return 0;
    }
    if (source && source.body && FG.hasOrgans(source.body, ["jaws"])) {
      dmg += Math.min(6, (target.armor || 0) * 0.4);
    }
    if (source && source.stats && source.stats.atkBonus) dmg += source.stats.atkBonus;
    target.hp -= dmg;
    if (!opts.bypassInvuln) target.invuln = 0.28;
    FG.spawnParticles(state, target.x, target.y, FG.COLORS.danger, 6);
    if (state.audio && target.kind === "player") FG.sfx(state, "hurt");
    if (target.hp <= 0) FG.onDeath(state, target, source);
    return dmg;
  };

  FG.onDeath = function (state, target, source) {
    if (target.dead) return;
    target.dead = true;
    target.hp = 0;

    if (target.kind === "enemy" || target.kind === "neutral") {
      var drop = 4 + Math.floor(Math.random() * 5);
      state.world.resources.push({
        id: FG.uid(), kind: "fruit", x: target.x, y: target.y, amount: drop, biome: target.biome || "grove"
      });
      if (Math.random() < 0.35 || target.boss) {
        var genes = Object.keys(FG.ORGANS);
        var g = target.boss
          ? (FG.BOSSES.filter(function (b) { return b.id === target.boss; })[0] || {}).reward
          : null;
        if (!g) {
          var map = { armorherb: "jaws", spore: "sporeburst", spark: "electric", digger: "diggers", acidshot: "acid", tideambush: "tentacle", parasite: "parasite", pack: "spikes", dasher: "tailmace" };
          g = map[target.arch] || genes[Math.floor(Math.random() * 8)];
        }
        if (g && FG.ORGANS[g]) FG.unlockGene(state, g, target.name);
        state.world.resources.push({
          id: FG.uid(), kind: "gene_sample", gene: g, x: target.x + 10, y: target.y + 10, amount: 1, biome: target.biome
        });
      }
      if (target.boss && !state.progress.bosses[target.boss]) {
        FG.addJournal(state.world, "Боса переможено: " + target.name);
        state.progress.bosses[target.boss] = true;
        state.resources.sample += 2;
        state.resources.mineral += 8;
      }
      if (source === state.player) state.progress.kills = (state.progress.kills || 0) + 1;
    }
    if (target.kind === "ally") {
      FG.addJournal(state.world, "Союзник загинув: " + (target.name || ""));
      state.ui.toast = "Союзник загинув";
    }
    if (target.kind === "player") FG.handlePlayerDeath(state);
  };

  FG.handlePlayerDeath = function (state) {
    state.player.carrying = { biomass: 0, mineral: 0, sample: 0 };
    state.deaths = (state.deaths || 0) + 1;
    FG.addJournal(state.world, "Тіло загинуло. Колонія й гени збережені.");
    var live = state.allies.filter(function (a) { return a.hp > 0 && !a.dead; })[0];
    if (live) {
      state.player.x = live.x;
      state.player.y = live.y;
      state.player.hp = state.player.hpMax * 0.55;
      state.player.energy = state.player.energyMax * 0.5;
      state.player.invuln = 1.2;
      state.player.dead = false;
      state.ui.toast = "Ти перейшов у союзника.";
      live.hp = 0;
      FG.onDeath(state, live, null);
      FG.resetCameraSmooth(state);
      return;
    }
    state.player.x = state.world.nest.x;
    state.player.y = state.world.nest.y + 40;
    state.player.hp = state.player.hpMax * 0.7;
    state.player.energy = state.player.energyMax;
    state.player.invuln = 1.5;
    state.player.dead = false;
    state.ui.toast = "Відродження з насіння гнізда.";
    state.resources.biomass = Math.max(5, Math.floor(state.resources.biomass * 0.85));
    FG.resetCameraSmooth(state);
  };

  FG.resetCameraSmooth = function (state) {
    if (!state.renderer) return;
    state.renderer._lx = state.player.x;
    state.renderer._ly = state.player.y;
    state.renderer._svx = 0;
    state.renderer._svy = 0;
    state.renderer.cam.x = state.player.x;
    state.renderer.cam.y = state.player.y;
  };

  FG.resolveEnemyAttack = function (state, e) {
    var tg = e.telegraph;
    if (!tg) return;
    var player = state.player;
    if (tg.type === "dash") {
      e.x += Math.cos(tg.ang) * 90;
      e.y += Math.sin(tg.ang) * 90;
      if (FG.dist(e.x, e.y, player.x, player.y) < 50) FG.dealDamage(state, player, e.dmg * 1.3, e);
      return;
    }
    if (tg.type === "ranged" || tg.type === "cloud" || tg.type === "chain") {
      state.projectiles.push({
        id: FG.uid(), x: e.x, y: e.y,
        vx: Math.cos(tg.ang) * 220, vy: Math.sin(tg.ang) * 220,
        life: 1.2, dmg: e.dmg, from: "enemy", ownerId: e.id, color: e.color, style: tg.type
      });
      return;
    }
    if (FG.dist(e.x, e.y, player.x, player.y) < 52) {
      FG.dealDamage(state, player, e.dmg, e);
      if (FG.hasOrgans(player.body, ["spikes"])) {
        FG.dealDamage(state, e, 5, player);
      }
    }
  };

  FG.ensureAbilityBinds = function (player) {
    if (!player.abilityBinds) player.abilityBinds = { rmb: null, q: null, e: null };
    var organs = player.body.organs || [];
    var used = {};
    ["rmb", "q", "e"].forEach(function (slot) {
      var id = player.abilityBinds[slot];
      if (id && organs.indexOf(id) >= 0 && FG.ABILITY_DEFS[id]) used[id] = 1;
      else player.abilityBinds[slot] = null;
    });
    var actives = organs.filter(function (id) { return FG.ABILITY_DEFS[id] && !used[id]; });
    ["rmb", "q", "e"].forEach(function (slot) {
      if (player.abilityBinds[slot]) return;
      if (!actives.length) return;
      player.abilityBinds[slot] = actives.shift();
    });
  };

  FG.bindAbilitySlot = function (player, slot, organId) {
    if (["rmb", "q", "e"].indexOf(slot) < 0) return false;
    if (organId && !FG.ABILITY_DEFS[organId]) return false;
    if (organId && (player.body.organs || []).indexOf(organId) < 0) return false;
    // clear duplicates
    ["rmb", "q", "e"].forEach(function (s) {
      if (player.abilityBinds[s] === organId) player.abilityBinds[s] = null;
    });
    player.abilityBinds[slot] = organId || null;
    return true;
  };

  FG.playerAttack = function (state, slot) {
    var p = state.player;
    if (p.abilityCd[slot] > 0) return;
    var aim = state.input.aim;
    var ang = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.angle = ang;

    if (slot === "lmb") {
      var hasJaws = FG.hasOrgans(p.body, ["jaws"]);
      var range = hasJaws ? 48 : 38;
      var dmg = hasJaws ? 14 : 8;
      if (p.stats && p.stats.atkBonus) dmg += p.stats.atkBonus;
      if (p.energy < 2) { state.ui.toast = "Мало енергії"; return; }
      p.abilityCd.lmb = hasJaws ? 0.55 : 0.32;
      p.energy -= 2;
      var hit = false;
      for (var i = 0; i < state.enemies.length; i++) {
        var e = state.enemies[i];
        if (!FG.isAlive(e)) continue;
        var d = FG.dist(p.x, p.y, e.x, e.y);
        var a = Math.abs(FG.ang(p.x, p.y, e.x, e.y) - ang);
        if (a > Math.PI) a = Math.PI * 2 - a;
        if (d < range && a < 0.7) {
          FG.dealDamage(state, e, dmg, p);
          hit = true;
        }
      }
      FG.spawnParticles(state, p.x + Math.cos(ang) * 28, p.y + Math.sin(ang) * 28, FG.COLORS.mint, hit ? 8 : 3);
      if (state.audio) FG.sfx(state, "attack");
      return;
    }

    FG.ensureAbilityBinds(p);
    var oid = p.abilityBinds[slot];
    if (!oid) {
      state.ui.toast = "Немає здібності на " + slot.toUpperCase();
      return;
    }
    FG.useOrganAbility(state, oid, slot);
  };

  /**
   * Preflight all costs; on failure nothing is spent.
   * Miss policy for combat attacks: "spend" — cooldown+energy even if no hit
   * (committed cast). "block" — refuse entirely (regen without biomass).
   * "refund_partial" — tentacle still spends if no valid pull target but deals splash none.
   */
  FG.useOrganAbility = function (state, oid, slot) {
    var p = state.player;
    var o = FG.ORGANS[oid];
    var def = FG.ABILITY_DEFS[oid];
    if (!o || !def) return;
    if ((p.body.organs || []).indexOf(oid) < 0) return;
    if (p.abilityCd[slot] > 0) return;

    var needEn = def.energy || 0;
    var needBio = def.biomass || 0;
    if (p.energy < needEn) { state.ui.toast = "Мало енергії (потрібно " + needEn + ")"; return; }
    if (needBio > 0) {
      var bioAvail = (state.resources.biomass || 0);
      if (bioAvail < needBio) {
        if (def.miss === "block") {
          state.ui.toast = "Потрібна біомаса колонії: " + needBio;
          return;
        }
      }
    }

    var ang = Math.atan2(state.input.aim.y - p.y, state.input.aim.x - p.x);
    var syn = p.synergies || [];
    var ok = true;

    if (oid === "regen") {
      if (state.resources.biomass < needBio) {
        state.ui.toast = "Потрібна біомаса для регену";
        return;
      }
      state.resources.biomass -= needBio;
      p.energy -= needEn;
      p.abilityCd[slot] = def.cd;
      var heal = (p.body.specs.regen === "burst") ? 28 : 16;
      heal *= 1 + (p.stats && p.stats.healBonus || 0);
      p.hp = Math.min(p.hpMax, p.hp + heal);
      FG.spawnParticles(state, p.x, p.y, FG.COLORS.ally, 10);
      if (syn.indexOf("phero_regen") >= 0 || p.body.specs.regen === "field") {
        for (var a = 0; a < state.allies.length; a++) {
          if (FG.isAlive(state.allies[a]) && FG.dist(state.allies[a].x, state.allies[a].y, p.x, p.y) < 140) {
            state.allies[a].hp = Math.min(state.allies[a].hpMax, state.allies[a].hp + 8);
          }
        }
      }
      if (state.audio) FG.sfx(state, "ability");
      return;
    }

    // Commit cost for other abilities (spend-on-cast)
    p.energy -= needEn;
    p.abilityCd[slot] = def.cd;

    if (oid === "needles") {
      var n = (p.body.specs.needles === "spread") ? 5 : 3;
      var spread = (p.body.specs.needles === "focus") ? 0.08 : 0.22;
      for (var i = 0; i < n; i++) {
        var a2 = ang + (i - (n - 1) / 2) * spread;
        var pr = {
          id: FG.uid(), x: p.x, y: p.y,
          vx: Math.cos(a2) * 320, vy: Math.sin(a2) * 320,
          life: 0.7, dmg: p.body.specs.needles === "focus" ? 9 : 6,
          from: "player", color: o.color, style: "needle"
        };
        if (syn.indexOf("acid_needles") >= 0) pr.acid = true;
        state.projectiles.push(pr);
      }
    } else if (oid === "acid") {
      state.projectiles.push({
        id: FG.uid(), x: p.x, y: p.y,
        vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260,
        life: 0.9, dmg: 10, from: "player", color: o.color, style: "acid", puddle: true
      });
    } else if (oid === "electric") {
      var jumps = (p.body.specs.electric === "chain") ? 4 : 2;
      var dmg = (p.body.specs.electric === "pulse") ? 18 : 9;
      FG.electricChain(state, p.x, p.y, ang, jumps, dmg, syn);
    } else if (oid === "web") {
      var wr = (p.body.specs.web === "wide") ? 70 : 45;
      state.webs.push({
        id: FG.uid(), x: p.x + Math.cos(ang) * 60, y: p.y + Math.sin(ang) * 60,
        r: wr, life: (p.body.specs.web === "snap") ? 3 : 5, slow: (p.body.specs.web === "snap") ? 0.35 : 0.55,
        conductive: syn.indexOf("web_electric") >= 0
      });
    } else if (oid === "tentacle") {
      var t = FG.nearestEnemy(state, p.x + Math.cos(ang) * 40, p.y + Math.sin(ang) * 40, 120);
      if (t && t.hpMax < 80) {
        t.x = FG.lerp(t.x, p.x, 0.45);
        t.y = FG.lerp(t.y, p.y, 0.45);
        FG.dealDamage(state, t, 6, p);
      }
    } else if (oid === "tailmace") {
      for (var j = 0; j < state.enemies.length; j++) {
        var en = state.enemies[j];
        if (!FG.isAlive(en)) continue;
        if (FG.dist(p.x, p.y, en.x, en.y) < (syn.indexOf("carapace_tail") >= 0 ? 78 : 62)) {
          FG.dealDamage(state, en, 12, p);
          var push = FG.norm(en.x - p.x, en.y - p.y);
          en.x += push.x * 28;
          en.y += push.y * 28;
        }
      }
    } else if (oid === "sporeburst") {
      state.hazards.push({ id: FG.uid(), kind: "spore", x: p.x, y: p.y, r: 70, life: 2.2, friendly: true, ownerId: p.id });
      p.invuln = Math.max(p.invuln, 0.4);
      if (syn.indexOf("lume_spore") >= 0) {
        for (var n2 = 0; n2 < state.enemies.length; n2++) {
          var ne = state.enemies[n2];
          if (ne.kind === "neutral" && FG.dist(ne.x, ne.y, p.x, p.y) < 200) {
            ne._wx = p.x; ne._wy = p.y;
          }
        }
      }
    } else if (oid === "biolume") {
      p._lume = 6;
      FG.revealFog(state.world, p.x, p.y, 320);
    } else if (oid === "camouflage") {
      p.camouflage = 5;
    } else if (oid === "gasbags") {
      p._hover = 1.2;
    } else if (oid === "diggers") {
      p._burrow = 1.0;
      p.invuln = 1.0;
      if (syn.indexOf("dig_vibe") >= 0) FG.revealFog(state.world, p.x, p.y, 260);
      p.x += Math.cos(ang) * 90;
      p.y += Math.sin(ang) * 90;
    } else if (oid === "pheromone") {
      p._phero = 6;
      for (var al = 0; al < state.allies.length; al++) {
        state.allies[al].order = { type: "follow" };
        state.allies[al]._buff = 6;
      }
      state.ui.toast = "Феромон: за мною!";
    } else if (oid === "parasite") {
      var weak = null, wd = 100;
      for (var ei = 0; ei < state.enemies.length; ei++) {
        var we = state.enemies[ei];
        if (!FG.isAlive(we) || we.boss) continue;
        var dd = FG.dist(p.x, p.y, we.x, we.y);
        if (dd < wd && we.hpMax <= 45) { wd = dd; weak = we; }
      }
      if (weak) {
        p.controlledId = weak.id;
        p.controlT = 5;
        if (syn.indexOf("camo_parasite") >= 0) p.camouflage = 0;
        state.ui.toast = "Паразит контролює здобич";
      } else {
        var strong = FG.nearestEnemy(state, p.x, p.y, 90);
        if (strong) { strong.cd = 1.5; strong.alert = 0; state.ui.toast = "Дезорієнтація"; }
      }
    } else if (oid === "vibesense") {
      p._vibe = 4;
      FG.revealFog(state.world, p.x, p.y, 240);
    } else if (oid === "filter") {
      p._filter = 10;
      state.ui.toast = "Фільтр активний";
    } else if (oid === "symbiont") {
      if (!p._sym) {
        p._sym = { mode: "guard", hp: 30, t: 20 };
        state.ui.toast = "Супутник: захист";
      } else {
        p._sym.mode = p._sym.mode === "guard" ? "support" : "guard";
        state.ui.toast = "Супутник: " + (p._sym.mode === "guard" ? "захист" : "підтримка");
      }
    } else if (oid === "splitform") {
      if (!p._split) {
        p._split = { x: p.x - 40, y: p.y, hp: p.hp * 0.5, active: false };
        p.hp *= 0.5;
        state.ui.toast = "Поділ форми";
      } else {
        p.hp = Math.min(p.hpMax, p.hp + p._split.hp);
        p._split = null;
        state.ui.toast = "Форми з’єднано";
      }
    } else {
      ok = false;
    }
    if (ok && state.audio) FG.sfx(state, "ability");
    if (oid !== "camouflage") p.camouflage = Math.max(0, (p.camouflage || 0) - 5);
  };

  FG.electricChain = function (state, x, y, ang, jumps, dmg, syn) {
    var hit = [];
    var cx = x + Math.cos(ang) * 40, cy = y + Math.sin(ang) * 40;
    for (var j = 0; j < jumps; j++) {
      var best = null, bd = 130;
      for (var i = 0; i < state.enemies.length; i++) {
        var e = state.enemies[i];
        if (!FG.isAlive(e) || hit.indexOf(e.id) >= 0) continue;
        var d = FG.dist(cx, cy, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (syn && syn.indexOf("web_electric") >= 0) {
        for (var w = 0; w < state.webs.length; w++) {
          var web = state.webs[w];
          if (!web.conductive) continue;
          for (var i2 = 0; i2 < state.enemies.length; i2++) {
            var e2 = state.enemies[i2];
            if (!FG.isAlive(e2) || hit.indexOf(e2.id) >= 0) continue;
            if (FG.dist(web.x, web.y, e2.x, e2.y) < web.r + 10) {
              FG.dealDamage(state, e2, dmg * 0.7, state.player);
              hit.push(e2.id);
              FG.spawnParticles(state, e2.x, e2.y, FG.COLORS.teal, 5);
            }
          }
        }
      }
      if (!best) break;
      FG.dealDamage(state, best, dmg, state.player);
      hit.push(best.id);
      FG.spawnParticles(state, best.x, best.y, FG.COLORS.teal, 10);
      state.hazards.push({ id: FG.uid(), kind: "spark", x: cx, y: cy, x2: best.x, y2: best.y, life: 0.2 });
      cx = best.x; cy = best.y;
      if (syn && syn.indexOf("membrane_electric") >= 0 && FG.biomeAtWorld(state.world, cx, cy) === "tide") {
        dmg *= 1.15;
        state.hazards.push({
          id: FG.uid(), kind: "waterarc", x: cx, y: cy, r: 55, life: 0.45, dmg: 4,
          ownerId: state.player.id, friendly: true
        });
      }
    }
  };

  FG.updateProjectiles = function (state, dt) {
    for (var i = state.projectiles.length - 1; i >= 0; i--) {
      var pr = state.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      var targets = pr.from === "player" ? state.enemies : [state.player];
      for (var t = 0; t < targets.length; t++) {
        var tg = targets[t];
        if (!FG.isAlive(tg)) continue;
        if (FG.dist(pr.x, pr.y, tg.x, tg.y) < 22) {
          FG.dealDamage(state, tg, pr.dmg, pr.from === "player" ? state.player : FG.findById(state, pr.ownerId));
          if (pr.acid || pr.puddle) {
            state.hazards.push({
              id: FG.uid(), kind: "acid", x: pr.x, y: pr.y, r: 36, life: 2.5, dmg: 4,
              ownerId: pr.from === "player" ? state.player.id : pr.ownerId,
              friendly: pr.from === "player"
            });
          }
          pr.life = 0;
          break;
        }
      }
      if (pr.life <= 0) state.projectiles.splice(i, 1);
    }
  };

  FG.updateHazards = function (state, dt) {
    for (var i = state.hazards.length - 1; i >= 0; i--) {
      var h = state.hazards[i];
      h.life -= dt;
      if (h.kind === "acid" || h.kind === "waterarc") {
        var src = h.ownerId ? FG.findById(state, h.ownerId) : null;
        for (var e = 0; e < state.enemies.length; e++) {
          var en = state.enemies[e];
          if (!FG.isAlive(en)) continue;
          if (FG.dist(h.x, h.y, en.x, en.y) < h.r) {
            FG.dealDamage(state, en, (h.dmg || 3) * dt, src || state.player, { bypassInvuln: true, dtype: h.kind });
          }
        }
        if (!h.friendly && FG.isAlive(state.player) && FG.dist(h.x, h.y, state.player.x, state.player.y) < h.r) {
          FG.dealDamage(state, state.player, (h.dmg || 3) * dt, src, { bypassInvuln: true, dtype: h.kind });
        }
      }
      if (h.kind === "spore" && h.friendly) {
        for (var e2 = 0; e2 < state.enemies.length; e2++) {
          var en2 = state.enemies[e2];
          if (FG.isAlive(en2) && FG.dist(h.x, h.y, en2.x, en2.y) < h.r) {
            en2.cd = Math.max(en2.cd, 0.4);
          }
        }
      }
      if (h.life <= 0) state.hazards.splice(i, 1);
    }
    for (var w = state.webs.length - 1; w >= 0; w--) {
      var web = state.webs[w];
      web.life -= dt;
      for (var j = 0; j < state.enemies.length; j++) {
        var ew = state.enemies[j];
        if (FG.isAlive(ew) && FG.dist(web.x, web.y, ew.x, ew.y) < web.r) {
          ew._slow = web.slow;
        }
      }
      if (web.life <= 0) state.webs.splice(w, 1);
    }
  };

  FG.spawnParticles = function (state, x, y, color, n) {
    if (!state.particles) state.particles = [];
    var budget = state.settings.quality === "low" ? 40 : (state.settings.quality === "high" ? 160 : 90);
    n = Math.min(n, Math.max(0, budget - state.particles.length));
    for (var i = 0; i < n; i++) {
      state.particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.35 + Math.random() * 0.35,
        color: color,
        r: 2 + Math.random() * 3
      });
    }
  };

  FG.updateParticles = function (state, dt) {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  };
})(window.FoxGenesis);
