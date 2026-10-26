/* FOX GENESIS — nest, buildings, breeds, incubation */
(function (FG) {
  "use strict";

  FG.initColony = function (nest) {
    return {
      buildings: [
        { id: FG.uid(), type: "heart", x: nest.x, y: nest.y, hp: 200, hpMax: 200 }
      ],
      breeds: [],
      queue: [],
      maxAllies: 4,
      alert: 0,
      raidWarn: 0
    };
  };

  FG.atNest = function (state) {
    return FG.dist(state.player.x, state.player.y, state.world.nest.x, state.world.nest.y) < 110;
  };

  FG.tryFoundNest = function (state) {
    if (state.colony.buildings.length) return;
    // already has heart from init
  };

  FG.placeBuilding = function (state, type, x, y) {
    var def = FG.BUILDINGS[type];
    if (!def) return { ok: false, why: "Невідома будівля" };
    if (def.hidden || def.stub) return { ok: false, why: "Ще не реалізовано" };
    if (!FG.atNest(state) && type !== "turret") return { ok: false, why: "Будуй біля гнізда" };
    if (FG.dist(x, y, state.world.nest.x, state.world.nest.y) > 280) {
      return { ok: false, why: "Занадто далеко від серця" };
    }
    // don't block nest center
    if (FG.dist(x, y, state.world.nest.x, state.world.nest.y) < 50 && type !== "heart") {
      return { ok: false, why: "Блокує серце гнізда" };
    }
    for (var i = 0; i < state.colony.buildings.length; i++) {
      if (state.colony.buildings[i].type === type && type !== "turret") {
        return { ok: false, why: "Вже збудовано" };
      }
    }
    if (!FG.canAfford(state.resources, def.cost)) return { ok: false, why: "Бракує ресурсів" };
    FG.pay(state.resources, def.cost);
    state.colony.buildings.push({
      id: FG.uid(), type: type, x: x, y: y, hp: 100, hpMax: 100
    });
    FG.addJournal(state.world, "Збудовано: " + def.name);
    state.ui.toast = def.name;
    state.ui.buildGhost = null;
    return { ok: true };
  };

  FG.saveBreed = function (state, name, role) {
    if (!FG.atNest(state)) return { ok: false, why: "Лише в гнізді" };
    if (!FG.hasBuilding(state, "incubator") && !FG.hasBuilding(state, "archive")) {
      // allow first breed at heart
    }
    var breed = {
      id: FG.uid(),
      name: name || ("Порода " + (state.colony.breeds.length + 1)),
      role: role || "hunter",
      body: FG.deepClone(state.player.body),
      gen: state.generation
    };
    state.colony.breeds.push(breed);
    FG.addJournal(state.world, "Збережено породу: " + breed.name);
    return { ok: true, breed: breed };
  };

  FG.hasBuilding = function (state, type) {
    for (var i = 0; i < state.colony.buildings.length; i++) {
      if (state.colony.buildings[i].type === type && state.colony.buildings[i].hp > 0) return true;
    }
    return false;
  };

  FG.enqueueIncubate = function (state, breedId) {
    if (!FG.hasBuilding(state, "incubator") && state.colony.breeds.length === 0) {
      return { ok: false, why: "Потрібен інкубатор або перша порода" };
    }
    if (!FG.hasBuilding(state, "incubator") && state.colony.breeds.length > 0) {
      // still allow first ally slowly at heart
    }
    if (state.allies.filter(function (a) { return a.hp > 0; }).length + state.colony.queue.length >= state.colony.maxAllies) {
      return { ok: false, why: "Ліміт загону" };
    }
    var breed = null;
    for (var i = 0; i < state.colony.breeds.length; i++) {
      if (state.colony.breeds[i].id === breedId) breed = state.colony.breeds[i];
    }
    if (!breed) return { ok: false, why: "Немає породи" };
    var cost = { biomass: 18, mineral: 3 };
    if (!FG.canAfford(state.resources, cost)) return { ok: false, why: "Бракує ресурсів" };
    FG.pay(state.resources, cost);
    state.colony.queue.push({
      id: FG.uid(), breedId: breedId, t: 0, need: FG.hasBuilding(state, "incubator") ? 12 : 18
    });
    state.ui.toast = "Інкубація…";
    return { ok: true };
  };

  FG.updateColony = function (state, dt) {
    // incubation
    for (var i = state.colony.queue.length - 1; i >= 0; i--) {
      var q = state.colony.queue[i];
      q.t += dt;
      if (q.t >= q.need) {
        var breed = null;
        for (var b = 0; b < state.colony.breeds.length; b++) {
          if (state.colony.breeds[b].id === q.breedId) breed = state.colony.breeds[b];
        }
        if (breed) {
          var ally = FG.createAlly(breed, state.world.nest.x + 40, state.world.nest.y + 30);
          state.allies.push(ally);
          FG.addJournal(state.world, "Народився союзник: " + ally.name);
          state.ui.toast = "Союзник готовий";
          if (!state.tutorial.done.ally) state.tutorial.done.ally = true;
        }
        state.colony.queue.splice(i, 1);
      }
    }

    // garden regen
    if (FG.hasBuilding(state, "garden")) {
      state._gardenAcc = (state._gardenAcc || 0) + dt;
      if (state._gardenAcc > 8) {
        state._gardenAcc = 0;
        state.resources.biomass += 2 + (state._drought ? 0 : 1);
      }
    }

    // archive research — slowly unlocks a guaranteed support gene
    if (FG.hasBuilding(state, "archive")) {
      state.colony.research = (state.colony.research || 0) + dt;
      if (state.colony.research > 90 && !state.genes.regen) {
        FG.unlockGene(state, "regen", "архів");
        state.colony.research = 0;
      }
    }

    // store capacity / logistics
    if (FG.hasBuilding(state, "store")) {
      state.colony.storageBonus = 40;
      state.player.capacity = 40 + state.colony.storageBonus;
    } else {
      state.colony.storageBonus = 0;
      state.player.capacity = 40;
    }

    // healbay
    if (FG.hasBuilding(state, "healbay") && FG.atNest(state)) {
      state.player.hp = Math.min(state.player.hpMax, state.player.hp + 8 * dt);
      for (var a = 0; a < state.allies.length; a++) {
        if (FG.dist(state.allies[a].x, state.allies[a].y, state.world.nest.x, state.world.nest.y) < 120) {
          state.allies[a].hp = Math.min(state.allies[a].hpMax, state.allies[a].hp + 6 * dt);
        }
      }
    }

    // turret
    for (var t = 0; t < state.colony.buildings.length; t++) {
      var bd = state.colony.buildings[t];
      if (bd.type !== "turret" || bd.hp <= 0) continue;
      bd._cd = (bd._cd || 0) - dt;
      if (bd._cd > 0) continue;
      var en = FG.nearestEnemy(state, bd.x, bd.y, FG.BUILDINGS.turret.radius);
      if (en) {
        FG.dealDamage(state, en, 7, null);
        FG.spawnParticles(state, en.x, en.y, FG.COLORS.amber, 4);
        bd._cd = 1.1;
      }
    }

    // raid warning
    if (state.colony.raidWarn > 0) {
      state.colony.raidWarn -= dt;
    }
  };

  FG.canStartGeneration = function (state, formId, trait) {
    if (!FG.atNest(state)) return { ok: false, why: "Лише в гнізді" };
    var cost = FG.GENERATION_COST;
    if ((state.world.time || 0) < cost.minGenTime) {
      return { ok: false, why: "Зарано: ще " + Math.ceil(cost.minGenTime - state.world.time) + "с дослідження" };
    }
    if ((state.progress.kills || 0) < cost.minKills) {
      return { ok: false, why: "Потрібно хоча б " + cost.minKills + " перемог (зараз " + (state.progress.kills || 0) + ")" };
    }
    if (!FG.canAfford(state.resources, cost)) {
      return { ok: false, why: "Ціна: " + cost.biomass + " біо / " + cost.mineral + " мін / " + cost.sample + " зраз" };
    }
    var live = state.allies.filter(function (a) { return a.hp > 0; }).length + state.colony.queue.length;
    var willVeteran = state.player.hp > state.player.hpMax * 0.3;
    if (willVeteran && live >= state.colony.maxAllies) {
      return { ok: false, why: "Ліміт загону — звільни місце або підтвердь без ветерана", needConfirmOverflow: true };
    }
    if (!FG.FORMS[formId || "mobile"]) return { ok: false, why: "Невідома форма" };
    return {
      ok: true,
      cost: cost,
      preview: {
        loseOrgans: (state.player.body.organs || []).slice(),
        keepGenes: Object.keys(state.genes),
        heritage: trait || null,
        veteran: willVeteran && live < state.colony.maxAllies
      }
    };
  };

  FG.startNewGeneration = function (state, formId, trait, opts) {
    opts = opts || {};
    var check = FG.canStartGeneration(state, formId, trait);
    if (!check.ok) {
      if (!(opts.skipVeteran && check.needConfirmOverflow)) return check;
    }
    if (!opts.confirmed) {
      return {
        ok: false, why: "Потрібне підтвердження", needConfirm: true,
        preview: check.preview || null, cost: check.cost || FG.GENERATION_COST
      };
    }
    var cost = FG.GENERATION_COST;
    if (!FG.canAfford(state.resources, cost)) return { ok: false, why: "Бракує ресурсів" };
    FG.pay(state.resources, cost);

    var live = state.allies.filter(function (a) { return a.hp > 0; }).length + state.colony.queue.length;
    if (!opts.skipVeteran && state.player.hp > state.player.hpMax * 0.3 && live < state.colony.maxAllies) {
      var vet = FG.createAlly({
        name: "Ветеран " + state.generation,
        role: "guard",
        body: FG.deepClone(state.player.body)
      }, state.player.x - 30, state.player.y);
      vet.hp = vet.hpMax * 0.6;
      state.allies.push(vet);
    }
    state.generation += 1;
    state.player.body = FG.defaultBody(formId || "mobile");
    if (trait) state.player.body.heritage = trait;
    state.player.abilityBinds = { rmb: null, q: null, e: null };
    FG.refreshCreatureStats(state.player);
    state.player.hp = state.player.hpMax;
    state.player.energy = state.player.energyMax;
    state.player.x = state.world.nest.x;
    state.player.y = state.world.nest.y + 50;
    FG.resetCameraSmooth(state);
    FG.addJournal(state.world, "Покоління " + state.generation + " — форма «" + (FG.FORMS[formId] || FG.FORMS.mobile).name + "».");
    state.ui.toast = "Нове покоління " + state.generation;
    state.ui.panel = null;
    FG.setPauseReason(state, "panel", false);
    return { ok: true };
  };

  FG.collectResource = function (state, res, who, allyCarry) {
    if (!res || res.amount <= 0) return;
    if (res.kind === "gene_sample" && res.gene) {
      FG.unlockGene(state, res.gene, "зразок");
      if (!allyCarry) state.resources.sample += 1;
      res.amount = 0;
    } else if (res.kind === "mineral") {
      var m = Math.min(res.amount, 5);
      if (allyCarry) {
        who._carry = who._carry || { biomass: 0, mineral: 0 };
        who._carry.mineral += m;
      } else {
        var space = who.capacity - (who.carrying.biomass + who.carrying.mineral + who.carrying.sample);
        m = Math.min(m, Math.max(0, space));
        who.carrying.mineral += m;
      }
      res.amount -= m;
    } else {
      var b = Math.min(res.amount, 6);
      if (allyCarry) {
        who._carry = who._carry || { biomass: 0, mineral: 0 };
        who._carry.biomass += b;
      } else {
        var sp = who.capacity - (who.carrying.biomass + who.carrying.mineral + who.carrying.sample);
        b = Math.min(b, Math.max(0, sp));
        who.carrying.biomass += b;
      }
      res.amount -= b;
    }
    if (res.amount <= 0) {
      var idx = state.world.resources.indexOf(res);
      if (idx >= 0) state.world.resources.splice(idx, 1);
    }
    if (!allyCarry && !state.tutorial.done.food && res.kind === "fruit") state.tutorial.done.food = true;
    if (!allyCarry && res.kind === "gene_sample") state.tutorial.done.mutate = true;
  };

  FG.depositCargo = function (state) {
    if (!FG.atNest(state)) return;
    state.resources.biomass += state.player.carrying.biomass;
    state.resources.mineral += state.player.carrying.mineral;
    state.resources.sample += state.player.carrying.sample;
    if (state.player.carrying.biomass + state.player.carrying.mineral > 0) {
      state.ui.toast = "Вантаж здано";
    }
    state.player.carrying = { biomass: 0, mineral: 0, sample: 0 };
  };
})(window.FoxGenesis);
