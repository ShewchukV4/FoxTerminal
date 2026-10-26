/* FOX GENESIS — healing, next-step objectives, special locations */
(function (FG) {
  "use strict";

  FG.setPauseReason = function (state, reason, on) {
    if (!state.pauseReasons) state.pauseReasons = { manual: false, panel: false, blur: false };
    state.pauseReasons[reason] = !!on;
    state.paused = !!(state.pauseReasons.manual || state.pauseReasons.panel || state.pauseReasons.blur);
  };

  FG.clearInputs = function (state) {
    state.input.keys = Object.create(null);
    state.input.mouse.downL = false;
    state.input.mouse.downR = false;
  };

  FG.refreshAim = function (state) {
    if (!state.renderer) return;
    state.input.aim = state.renderer.screenToWorld(state.input.mouse.x, state.input.mouse.y);
  };

  FG.enemyNear = function (state, x, y, r) {
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!FG.isAlive(e) || e.kind === "neutral") continue;
      if (FG.dist(e.x, e.y, x, y) < r) return e;
    }
    return null;
  };

  FG.healStatus = function (state) {
    var p = state.player;
    var nest = FG.NEST_REST;
    var nearEnemy = FG.enemyNear(state, p.x, p.y, nest.enemyRadius);
    var atNest = FG.atNest(state);
    var cargoBio = p.carrying.biomass || 0;
    var stockBio = state.resources.biomass || 0;
    var field = FG.FIELD_HEAL;
    var fieldReady = (p.fieldHealCd || 0) <= 0 && p.hp < p.hpMax && (cargoBio + stockBio) >= field.biomass;
    var list = [];

    list.push({
      id: "nest",
      name: "Відпочинок біля серця",
      detail: "Поза боєм +" + nest.rate + " HP/с",
      ok: atNest && !nearEnemy && p.hp < p.hpMax,
      why: !atNest ? "Йди до світлого кола гнізда" : (nearEnemy ? "Ворог поруч — відпочинок заблоковано" : (p.hp >= p.hpMax ? "HP повне" : null))
    });
    list.push({
      id: "field",
      name: "Польове лікування (R)",
      detail: "Відновити " + field.hp + " HP · " + field.biomass + " біомаси",
      ok: fieldReady,
      why: p.hp >= p.hpMax ? "HP повне" : ((p.fieldHealCd || 0) > 0 ? "Перезарядка" : ((cargoBio + stockBio) < field.biomass ? "Бракує біомаси (вантаж або колонія)" : null))
    });
    list.push({
      id: "regen",
      name: "Орган регенерації",
      detail: "Активна здібність на призначеній клавіші",
      ok: FG.hasOrgans(p.body, ["regen"]) && state.resources.biomass >= 2 && p.energy >= 10,
      why: !FG.hasOrgans(p.body, ["regen"]) ? "Встанови орган regen" : (state.resources.biomass < 2 ? "Мало біомаси колонії" : null)
    });
    list.push({
      id: "healbay",
      name: "Відновлювальна камера",
      detail: "Прискорене лікування в гнізді",
      ok: FG.hasBuilding(state, "healbay") && atNest,
      why: !FG.hasBuilding(state, "healbay") ? "Збудуй камеру в колонії (C)" : (!atNest ? "Підійди до гнізда" : null)
    });
    return list;
  };

  FG.tryFieldHeal = function (state) {
    if (state.paused) return { ok: false, why: "Пауза" };
    if (!state.started || !FG.isAlive(state.player)) return { ok: false, why: "Неможливо" };
    var p = state.player;
    var field = FG.FIELD_HEAL;
    if (p.hp >= p.hpMax) return { ok: false, why: "HP вже повне" };
    if ((p.fieldHealCd || 0) > 0) return { ok: false, why: "Перезарядка " + p.fieldHealCd.toFixed(1) + "с" };
    var need = field.biomass;
    var fromCargo = Math.min(p.carrying.biomass || 0, need);
    var fromStock = need - fromCargo;
    if ((state.resources.biomass || 0) < fromStock) {
      return { ok: false, why: "Потрібно " + need + " біомаси (вантаж або колонія)" };
    }
    p.carrying.biomass -= fromCargo;
    state.resources.biomass -= fromStock;
    var heal = field.hp * (1 + (p.stats && p.stats.healBonus || 0));
    p.hp = Math.min(p.hpMax, p.hp + heal);
    p.fieldHealCd = field.cd;
    FG.spawnParticles(state, p.x, p.y, FG.COLORS.ally, 12);
    state.ui.toast = "Відновлено +" + Math.round(heal) + " HP";
    if (!state.tutorial.done.heal) state.tutorial.done.heal = true;
    return { ok: true };
  };

  FG.updateNestRest = function (state, dt) {
    var p = state.player;
    var nest = FG.NEST_REST;
    if (!FG.atNest(state) || p.hp >= p.hpMax) {
      p.nestRestT = 0;
      p.nestRestBlocked = null;
      return;
    }
    var foe = FG.enemyNear(state, p.x, p.y, nest.enemyRadius);
    if (foe) {
      p.nestRestT = 0;
      p.nestRestBlocked = "Ворог поруч";
      return;
    }
    p.nestRestBlocked = null;
    p.nestRestT = (p.nestRestT || 0) + dt;
    if (p.nestRestT >= nest.delay) {
      var rate = nest.rate * (1 + (p.stats && p.stats.healBonus || 0));
      if (FG.hasBuilding(state, "healbay")) rate *= 1.8;
      p.hp = Math.min(p.hpMax, p.hp + rate * dt);
      if (!state.tutorial.done.heal) state.tutorial.done.heal = true;
    }
  };

  FG.updateObjectives = function (state) {
    var o = [];
    var t = state.tutorial.done;
    var p = state.player;
    var res = state.resources;

    function mark(id, title, detail, prog, wx, wy) {
      o.push({ id: id, title: title, detail: detail, prog: prog || "", x: wx, y: wy });
    }

    if (!t.food) {
      mark("food", "Збери плід", "Підійди до бурштинової точки · F або автозбір", "вантаж " + (p.carrying.biomass || 0), null, null);
    } else if (!t.hurt && !t.heal) {
      mark("heal", "Віднови HP", "Біля серця гнізда стій спокійно, або натисни R (3 біомаси)", "HP " + Math.ceil(p.hp) + "/" + Math.ceil(p.hpMax), state.world.nest.x, state.world.nest.y);
    } else if (!t.nest) {
      mark("nest", "Здай вантаж", "Повернись у світле коло · F", "вантаж " + (p.carrying.biomass + p.carrying.mineral + p.carrying.sample), state.world.nest.x, state.world.nest.y);
    } else if (!t.install) {
      var need = 10;
      var have = res.biomass || 0;
      mark("install", "Встанови ривкові лапи", "У гнізді M → обери → Встановити", "біомаса колонії " + Math.floor(have) + "/" + need + (p.carrying.biomass ? " · у вантажі " + p.carrying.biomass : ""), state.world.nest.x, state.world.nest.y);
    } else if (!t.ability) {
      mark("ability", "Випробуй здібність", "Shift — ривок (якщо є лапи) або ПКМ/Q/E", "", null, null);
    } else if (!t.path) {
      mark("path", "Обери напрямок", "Мисливець / Вартовий / Колонія — у панелі M або C", "", state.world.nest.x, state.world.nest.y);
    } else if (!t.ally) {
      mark("ally", "Союзник", "C → збережи породу → вирости · обери роль і наказ", "загін " + state.allies.length + "/" + state.colony.maxAllies, state.world.nest.x, state.world.nest.y);
    } else if (!t.poi) {
      var loc = (state.world.locations || []).filter(function (l) { return !l.done; })[0];
      if (loc) mark("poi", loc.name, loc.desc || "Дослідь особливе місце", "", loc.x, loc.y);
      else mark("poi", "Особливе місце", "Знайди кокон або галявину на карті (Tab)", "", null, null);
    } else {
      if (state.path === "hunter") mark("late", "Мисливець", "Здобудь ranged-ген і переможи еліту", "убивств " + (state.progress.kills || 0), null, null);
      else if (state.path === "guardian") mark("late", "Вартовий", "Панцир / щит / камера лікування", "", state.world.nest.x, state.world.nest.y);
      else if (state.path === "colony") mark("late", "Колонія", "Сад, інкубатор, відбий рейд", "будівель " + state.colony.buildings.length, state.world.nest.x, state.world.nest.y);
      else mark("late", "Досліджуй", "Біоми, боси, нове покоління (чесна ціна в C)", "", null, null);
    }
    if (state.colony.raidWarn > 0) {
      o.unshift({ id: "raid", title: "⚠ Напад на гніздо!", detail: "Захисти серце", prog: Math.ceil(state.colony.raidWarn) + "с", x: state.world.nest.x, y: state.world.nest.y });
    }
    state.ui.objectives = o.slice(0, 3);
    state.ui.waypoint = o[0] && o[0].x != null ? { x: o[0].x, y: o[0].y, label: o[0].title } : state.ui.waypoint;
  };

  FG.choosePath = function (state, pathId) {
    if (!FG.PATHS[pathId]) return { ok: false, why: "Невідомий шлях" };
    state.path = pathId;
    state.tutorial.done.path = true;
    FG.addJournal(state.world, "Обрано напрямок: " + FG.PATHS[pathId].name);
    state.ui.toast = "Шлях: " + FG.PATHS[pathId].name;
    // Guaranteed unlocks for path
    if (pathId === "hunter") FG.unlockGene(state, "needles", "шлях");
    if (pathId === "guardian") FG.unlockGene(state, "carapace", "шлях");
    if (pathId === "colony") FG.unlockGene(state, "pheromone", "шлях");
    return { ok: true };
  };

  FG.interactLocation = function (state) {
    var locs = state.world.locations || [];
    for (var i = 0; i < locs.length; i++) {
      var l = locs[i];
      if (l.done) continue;
      if (FG.dist(state.player.x, state.player.y, l.x, l.y) > (l.r || 50)) continue;
      if (l.type === "cocoon") {
        if (l.reward) FG.unlockGene(state, l.reward, l.name);
        state.resources.biomass += 8;
        l.done = true;
        state.tutorial.done.poi = true;
        state.ui.toast = "Кокон: ген «" + (FG.ORGANS[l.reward] || {}).name + "»";
        return true;
      }
      if (l.type === "garden_risk") {
        FG.dealDamage(state, state.player, 12, null, { bypassInvuln: true });
        state.player.carrying.biomass += 12;
        if (l.reward) FG.unlockGene(state, l.reward, l.name);
        l.done = true;
        state.tutorial.done.poi = true;
        state.ui.toast = "Сад: багато їжі, але боляче";
        return true;
      }
      if (l.type === "hunt_ground") {
        if (!l._spawned) {
          var elite = FG.spawnEnemy(l.elite || "dasher", l.x + 40, l.y, l.biome);
          elite.hp *= 1.6; elite.hpMax = elite.hp; elite.name = "Елітний " + elite.name; elite.dmg += 3;
          state.enemies.push(elite);
          l._spawned = true;
          state.ui.toast = "Еліта пробудилась!";
          return true;
        }
        if (l.reward) FG.unlockGene(state, l.reward, l.name);
        l.done = true;
        state.tutorial.done.poi = true;
        return true;
      }
      if (l.type === "mineral_rift") {
        state.resources.mineral += l.rewardMineral || 10;
        l.done = true;
        state.tutorial.done.poi = true;
        state.ui.toast = "Мінерали з ущелини";
        return true;
      }
      if (l.type === "sleeper") {
        if (l.reward) FG.unlockGene(state, l.reward, l.name);
        state.resources.sample += 1;
        l.done = true;
        state.tutorial.done.poi = true;
        state.ui.toast = "Організм поділився знанням";
        return true;
      }
      if (l.type === "outpost") {
        if (!FG.canAfford(state.resources, { biomass: 20, mineral: 8 })) {
          state.ui.toast = "Форпост: 20 біо / 8 мін";
          return true;
        }
        FG.pay(state.resources, { biomass: 20, mineral: 8 });
        state.colony.buildings.push({
          id: FG.uid(), type: "turret", x: l.x, y: l.y, hp: 100, hpMax: 100, outpost: true
        });
        l.done = true; l.claimed = true;
        state.tutorial.done.poi = true;
        state.ui.toast = "Форпост захоплено";
        return true;
      }
    }
    return false;
  };
})(window.FoxGenesis);
