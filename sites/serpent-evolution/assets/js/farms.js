/* FOX SERPENT — farms: physical fruit production (not wallet printing) */
(function (FS) {
  "use strict";

  FS.FARM_DEFS = {
    berry: {
      id: "berry", name: "Ягідна грядка", cost: 3, cycle: 14, yield: 1, store: 2,
      kind: "berry", desc: "Дешевша, частіший одиночний урожай"
    },
    orchard: {
      id: "orchard", name: "Плодовий сад", cost: 5, cycle: 22, yield: 2, store: 4,
      kind: "apple", desc: "Повільніший цикл, кілька плодів"
    },
    nursery: {
      id: "nursery", name: "Розсадник", cost: 4, cycle: 18, yield: 0, store: 0, boost: 0.85,
      kind: null, desc: "Прискорює сусідні посадки (не друкує валюту)"
    }
  };

  FS.FARM_UPGRADES = {
    speed: { id: "speed", name: "Швидший цикл", cost: 3, mul: 0.8 },
    store: { id: "store", name: "Місткість +1", cost: 2, addStore: 1 },
    soil: { id: "soil", name: "Менша залежність від ґрунту", cost: 3, soilIgnore: true }
  };

  FS.createFarmsState = function () {
    return { list: [], dropQueue: [], dropCap: 4 };
  };

  FS.ensureFarms = function (state) {
    if (!state.farms) state.farms = FS.createFarmsState();
    if (state.effects && state.effects.harvestCapAdd) {
      state.farms.dropCap = 4 + (state.effects.harvestCapAdd || 0);
    }
  };

  FS.farmAt = function (state, x, y) {
    FS.ensureFarms(state);
    for (var i = 0; i < state.farms.list.length; i++) {
      var f = state.farms.list[i];
      if (f.x === x && f.y === y) return f;
    }
    return null;
  };

  FS.canPlaceFarm = function (state, x, y, farmType) {
    var tile = FS.tileAt(state.world, x, y);
    if (!tile) return { ok: false, why: "Поза картою" };
    var def = FS.tileDef(tile);
    // meadow OK for plots (food only grows on farms); fertile/soil preferred via soilMul
    if (!def.farm && def.id !== "meadow" && !(state.effects && state.effects.soilFarm && def.id === "meadow")) {
      return { ok: false, why: "Потрібен ґрунт / луг під грядку" };
    }
    if (FS.farmAt(state, x, y)) return { ok: false, why: "Вже є ферма" };
    if (FS.manhattan({ x: x, y: y }, state.world.nest) < 2) return { ok: false, why: "Занадто близько до гнізда" };
    var hits = FS.snakeAtCell(state, x, y, false);
    if (hits.length) return { ok: false, why: "Клітинка зайнята змією" };
    // keep path: don't block if only corridor
    var open = 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var t = FS.tileAt(state.world, x + d[0], y + d[1]);
      if (t && FS.tileWalkable(t)) open++;
    });
    if (open < 2) return { ok: false, why: "Перекриє єдиний прохід" };
    var fdef = FS.FARM_DEFS[farmType];
    if (!fdef) return { ok: false, why: "Невідомий тип" };
    return { ok: true, cost: fdef.cost, def: fdef, tile: tile };
  };

  /** Place farm without charging (used by wood+nutrition B-build). */
  FS.placeFarmAt = function (state, x, y, farmType) {
    var check = FS.canPlaceFarm(state, x, y, farmType);
    if (!check.ok) return check;
    FS.ensureFarms(state);
    var farm = {
      id: FS.uid(), type: farmType, x: x, y: y,
      stage: "planted", t: 0, cycle: check.def.cycle,
      store: [], storeMax: check.def.store,
      yield: check.def.yield, kind: check.def.kind,
      boost: check.def.boost || 0, upgrades: {},
      waiting: false, reservedBy: null
    };
    var td = FS.tileDef(check.tile);
    farm.soilMul = td.farmMul || 1;
    if (state.effects && state.effects.soilIgnore) farm.soilMul = Math.max(farm.soilMul, 1);
    state.farms.list.push(farm);
    FS.setTile(state.world, x, y, FS.makeTile(x, y, "plot", { biome: check.tile.biome }));
    state.tutorial.done.farm = true;
    return { ok: true, farm: farm };
  };

  FS.purchaseFarm = function (state, x, y, farmType) {
    if (state._farmLock) return { ok: false, why: "Зачекай" };
    var check = FS.canPlaceFarm(state, x, y, farmType);
    if (!check.ok) return check;
    var quote = FS.previewSpend(state, check.cost);
    if (!quote.ok) return { ok: false, why: "Потрібно " + check.cost + " поживи, є " + quote.now };
    state._farmLock = true;
    try {
      return FS.spendNutrition(state, check.cost, function () {
        var placed = FS.placeFarmAt(state, x, y, farmType);
        if (!placed.ok) return placed;
        state.ui.toast = "Посаджено: " + check.def.name;
        return placed;
      }, { reason: "farm" });
    } finally {
      state._farmLock = false;
    }
  };

  FS.upgradeFarm = function (state, farmId, upId) {
    FS.ensureFarms(state);
    var farm = state.farms.list.filter(function (f) { return f.id === farmId; })[0];
    var up = FS.FARM_UPGRADES[upId];
    if (!farm || !up) return { ok: false, why: "Немає" };
    if (farm.upgrades[upId]) return { ok: false, why: "Вже є" };
    var prev = FS.previewSpend(state, up.cost);
    if (!prev.ok) return { ok: false, why: "Потрібно " + up.cost + " поживи, є " + prev.now };
    return FS.spendNutrition(state, up.cost, function () {
      farm.upgrades[upId] = true;
      if (up.mul) farm.cycle = Math.max(8, Math.round(farm.cycle * up.mul));
      if (up.addStore) farm.storeMax += up.addStore;
      if (up.soilIgnore) farm.soilMul = Math.max(farm.soilMul, 1);
      state.ui.toast = "Покращено ферму: " + up.name;
      return { ok: true };
    }, { reason: "farm_up" });
  };

  FS.harvestFarmManual = function (state, farm) {
    if (!farm || farm.stage !== "ready" || !farm.store.length) return { ok: false };
    // spawn physical fruits adjacent if possible, else drop pad
    var spawned = 0;
    while (farm.store.length) {
      var item = farm.store.shift();
      var cell = FS.findDropCell(state, farm.x, farm.y) || FS.dropPadCell(state);
      if (!cell) { farm.store.unshift(item); break; }
      state.world.foods.push({
        id: FS.uid(), x: cell.x, y: cell.y,
        kind: item.kind || "berry", phase: "ripe",
        nutrition: 1, xp: 1, age: 0, fromFarm: farm.id
      });
      spawned++;
    }
    farm.stage = "recover";
    farm.t = 0;
    farm.waiting = false;
    state.tutorial.done.harvest = true;
    return { ok: true, spawned: spawned };
  };

  FS.dropPadCell = function (state) {
    var lm = (state.world.landmarks || []).filter(function (l) { return l.kind === "drop_pad"; })[0];
    if (lm) return { x: lm.x, y: lm.y };
    return { x: state.world.nest.x, y: state.world.nest.y + 1 };
  };

  FS.findDropCell = function (state, nearX, nearY) {
    var dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]];
    for (var i = 0; i < dirs.length; i++) {
      var x = nearX + dirs[i][0], y = nearY + dirs[i][1];
      if (FS.foodCellFree && FS.foodCellFree(state, x, y)) return { x: x, y: y };
      var t = FS.tileAt(state.world, x, y);
      if (t && FS.tileWalkable(t) && !FS.snakeAtCell(state, x, y, false).length) {
        var busy = state.world.foods.some(function (f) { return f.x === x && f.y === y; });
        if (!busy) return { x: x, y: y };
      }
    }
    return null;
  };

  /** Physical fruit sits on the plot cell — only place food grows. */
  FS.ensureFarmFruit = function (state, farm) {
    if (!farm || farm.type === "nursery") return;
    var has = state.world.foods.some(function (f) {
      return f.x === farm.x && f.y === farm.y;
    });
    if (has) return;
    var kind = farm.kind || "berry";
    var def = (FS.FOOD_DEFS && FS.FOOD_DEFS[kind]) || { nutrition: 1, xp: 1 };
    state.world.foods.push({
      id: FS.uid(), x: farm.x, y: farm.y,
      kind: kind, phase: "ripe", age: 0,
      nutrition: def.nutrition || 1, xp: def.xp || 1,
      fromFarm: farm.id
    });
  };

  FS.onFarmFoodTaken = function (state, food) {
    if (!food || !food.fromFarm) return;
    FS.ensureFarms(state);
    var farm = state.farms.list.filter(function (f) { return f.id === food.fromFarm; })[0];
    if (!farm) farm = FS.farmAt(state, food.x, food.y);
    if (!farm) return;
    if (farm.store && farm.store.length) farm.store.pop();
    farm.stage = "recover";
    farm.t = 0;
    farm.waiting = false;
  };

  FS.seedStartFarms = function (state) {
    FS.ensureFarms(state);
    var have = state.farms.list.filter(function (f) { return f.type !== "nursery"; }).length;
    var need = Math.max(0, 4 - have);
    if (need <= 0) {
      state.farms.list.forEach(function (f) {
        if (f.stage === "ready") FS.ensureFarmFruit(state, f);
      });
      return;
    }
    var nest = state.world.nest;
    var spots = [];
    var r, dx, dy, x, y;
    for (r = 2; r <= 7 && spots.length < need; r++) {
      for (dx = -r; dx <= r && spots.length < need; dx++) {
        for (dy = -r; dy <= r && spots.length < need; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          x = nest.x + dx;
          y = nest.y + dy;
          if (spots.some(function (s) { return s.x === x && s.y === y; })) continue;
          if (!FS.canPlaceFarm(state, x, y, "berry").ok) continue;
          spots.push({ x: x, y: y });
        }
      }
    }
    spots.slice(0, need).forEach(function (s) {
      var placed = FS.placeFarmAt(state, s.x, s.y, "berry");
      if (!placed.ok) return;
      var farm = placed.farm;
      farm.stage = "ready";
      farm.t = 0;
      farm.store = [{ kind: "berry" }];
      FS.ensureFarmFruit(state, farm);
    });
    state.tutorial.done.farm = true;
  };

  FS.tickFarms = function (state, dt) {
    if (!state.started || state.paused) return;
    if (state.guide && state.guide.open) return;
    if (typeof document !== "undefined" && document.hidden) return;
    FS.ensureFarms(state);

    var boostAt = Object.create(null);
    state.farms.list.forEach(function (f) {
      if (f.type === "nursery" && f.boost) {
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          boostAt[(f.x + d[0]) + "," + (f.y + d[1])] = f.boost;
        });
      }
    });

    state.farms.list.forEach(function (f) {
      if (f.type === "nursery") {
        f.stage = "idle";
        return;
      }
      var speed = 1 / (f.soilMul || 1);
      var b = boostAt[f.x + "," + f.y];
      if (b) speed *= b;
      if (f.upgrades && f.upgrades.speed) speed *= 0.9;
      if (state.effects && state.effects.farmSpeedMul) speed *= state.effects.farmSpeedMul;

      if (f.stage === "ready") {
        FS.ensureFarmFruit(state, f);
        return;
      }

      if (f.stage === "planted" || f.stage === "growing" || f.stage === "recover") {
        f.t += dt * (1 / Math.max(0.5, speed));
        var need = f.stage === "recover" ? f.cycle * 0.35 : f.cycle;
        if (f.stage === "planted" && f.t >= need * 0.15) { f.stage = "growing"; }
        if (f.t >= need) {
          if (f.stage === "recover") {
            f.stage = "planted";
            f.t = 0;
          } else {
            var space = f.storeMax - f.store.length;
            var n = Math.min(f.yield || 1, Math.max(1, space));
            f.store = [];
            for (var i = 0; i < n; i++) f.store.push({ kind: f.kind || "berry" });
            f.stage = "ready";
            f.waiting = false;
            f.t = 0;
            FS.ensureFarmFruit(state, f);
          }
        }
      }
    });
  };

  FS.serializeFarms = function (state) {
    FS.ensureFarms(state);
    return state.farms;
  };

  FS.applyFarms = function (state, data) {
    state.farms = data || FS.createFarmsState();
  };
})(window.FoxSerpent);
