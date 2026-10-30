/* FOX SERPENT — materials, stations, recipes */
(function (FS) {
  "use strict";

  FS.defaultMaterials = function () {
    return {
      stone: 0, fiber: 0, resin: 0, clay: 0,
      copper_ore: 0, copper_ingot: 0, mycelium: 0,
      planks: 0, rope: 0, coal: 0, crystal: 0
    };
  };

  FS.ensureMaterials = function (state) {
    if (!state.materials) state.materials = FS.defaultMaterials();
    var d = FS.defaultMaterials();
    Object.keys(d).forEach(function (k) {
      if (state.materials[k] == null) state.materials[k] = 0;
    });
    return state.materials;
  };

  FS.materialLabel = function (id) {
    return (FS.MATERIAL_NAMES && FS.MATERIAL_NAMES[id]) || id;
  };

  FS.gainMaterial = function (state, id, n) {
    FS.ensureMaterials(state);
    n = Math.floor(+n || 0);
    if (n <= 0 || state.materials[id] == null) return 0;
    state.materials[id] += n;
    return n;
  };

  FS.spendMaterials = function (state, costs) {
    FS.ensureMaterials(state);
    var k;
    for (k in costs) {
      if (!Object.prototype.hasOwnProperty.call(costs, k)) continue;
      if ((state.materials[k] || 0) < costs[k]) {
        return { ok: false, why: "Бракує: " + FS.materialLabel(k) };
      }
    }
    for (k in costs) {
      if (!Object.prototype.hasOwnProperty.call(costs, k)) continue;
      state.materials[k] -= costs[k];
    }
    return { ok: true };
  };

  /** Surface loose stones near start — gather with F. */
  FS.seedSurfaceStones = function (state) {
    FS.ensureMaterials(state);
    var nest = state.world && state.world.nest;
    if (!nest) return;
    state.world.landmarks = state.world.landmarks || [];
    var spots = [
      { x: nest.x + 2, y: nest.y + 2 },
      { x: nest.x - 3, y: nest.y + 1 },
      { x: nest.x + 4, y: nest.y - 2 },
      { x: nest.x - 1, y: nest.y + 4 }
    ];
    spots.forEach(function (s, i) {
      var t = FS.tileAt(state.world, s.x, s.y);
      if (!t || !FS.tileWalkable(t)) return;
      if (FS.buildingAt && FS.buildingAt(state, s.x, s.y)) return;
      state.world.landmarks.push({
        id: "stone_" + i + "_" + state.world.seed,
        kind: "loose_stone", x: s.x, y: s.y,
        amount: 1, name: "Камінь", worldId: "surface"
      });
    });
  };

  FS.RECIPES = {
    planks: {
      id: "planks", name: "Дошки", station: "workbench",
      in: { wood: 2 }, out: { planks: 2 }, time: 2
    },
    rope: {
      id: "rope", name: "Мотузка", station: "loom",
      in: { fiber: 3 }, out: { rope: 1 }, time: 2
    },
    copper_ingot: {
      id: "copper_ingot", name: "Мідний злиток", station: "kiln",
      in: { copper_ore: 2, coal: 1 }, out: { copper_ingot: 1 }, time: 4
    },
    copper_ingot_wood: {
      id: "copper_ingot_wood", name: "Злиток (на дровах)", station: "kiln",
      in: { copper_ore: 2, wood: 2 }, out: { copper_ingot: 1 }, time: 5
    },
    parts: {
      id: "parts", name: "Мідні деталі", station: "workbench",
      in: { copper_ingot: 1 }, out: { /* stored as materials later */ }, time: 3,
      // First pass: give rope-slot as «parts» via progress flag
      special: "parts"
    },
    lantern: {
      id: "lantern", name: "Ліхтар", station: "workbench",
      in: { planks: 1, resin: 1 }, out: {}, time: 3, special: "lantern"
    }
  };

  FS.ensureStations = function (state) {
    if (!state.stations) state.stations = [];
    return state.stations;
  };

  FS.registerStation = function (state, building) {
    FS.ensureStations(state);
    var st = {
      id: building.id,
      kind: building.kind,
      x: building.x, y: building.y,
      worldId: building.worldId || state.activeWorldId || "surface",
      queue: [],
      bufferIn: {},
      bufferOut: {},
      busyT: 0,
      current: null
    };
    state.stations.push(st);
    return st;
  };

  FS.stationAt = function (state, x, y) {
    FS.ensureStations(state);
    for (var i = 0; i < state.stations.length; i++) {
      var s = state.stations[i];
      if (s.x === x && s.y === y &&
          (s.worldId || "surface") === (state.activeWorldId || "surface")) return s;
    }
    return null;
  };

  FS.recipesForStation = function (kind) {
    var list = [];
    Object.keys(FS.RECIPES).forEach(function (id) {
      if (FS.RECIPES[id].station === kind) list.push(FS.RECIPES[id]);
    });
    return list;
  };

  FS.canCraft = function (state, recipeId) {
    FS.ensureMaterials(state);
    var r = FS.RECIPES[recipeId];
    if (!r) return { ok: false, why: "Немає рецепта" };
    var need = r.in || {};
    if (need.wood && state.wood < need.wood) {
      return { ok: false, why: "Потрібно " + need.wood + " деревини" };
    }
    for (var k in need) {
      if (k === "wood") continue;
      if ((state.materials[k] || 0) < need[k]) {
        return { ok: false, why: "Бракує: " + FS.materialLabel(k) };
      }
    }
    return { ok: true, recipe: r };
  };

  FS.startCraft = function (state, station, recipeId) {
    var check = FS.canCraft(state, recipeId);
    if (!check.ok) return check;
    if (!station) return { ok: false, why: "Немає станції" };
    if (station.current) return { ok: false, why: "Станція зайнята" };
    var r = check.recipe;
    // Reserve / spend inputs atomically
    if (r.in.wood) {
      if (state.wood < r.in.wood) return { ok: false, why: "Бракує деревини" };
      state.wood -= r.in.wood;
    }
    var matSpend = {};
    Object.keys(r.in).forEach(function (k) {
      if (k !== "wood") matSpend[k] = r.in[k];
    });
    var sp = FS.spendMaterials(state, matSpend);
    if (!sp.ok) {
      if (r.in.wood) state.wood += r.in.wood;
      return sp;
    }
    station.current = { recipeId: recipeId, t: r.time, total: r.time };
    state.ui.toast = "Крафт: " + r.name;
    return { ok: true };
  };

  FS.tickStations = function (state, dt) {
    if (!state.started || state.paused) return;
    FS.ensureStations(state);
    state.stations.forEach(function (st) {
      if (!st.current) return;
      st.current.t -= dt;
      if (st.current.t > 0) return;
      var r = FS.RECIPES[st.current.recipeId];
      st.current = null;
      if (!r) return;
      FS.ensureMaterials(state);
      Object.keys(r.out || {}).forEach(function (k) {
        state.materials[k] = (state.materials[k] || 0) + r.out[k];
      });
      if (r.special === "lantern") {
        state.effects = state.effects || {};
        state.effects.lanternAdd = (state.effects.lanternAdd || 0) + 1;
        state.ui.toast = "Ліхтар готовий — кращий огляд у печері";
      } else if (r.special === "parts") {
        state.progress = state.progress || {};
        state.progress.copperParts = (state.progress.copperParts || 0) + 2;
        state.ui.toast = "Мідні деталі ×2";
      } else {
        state.ui.toast = "Готово: " + r.name;
      }
    });
  };

  FS.tryGatherLandmark = function (state) {
    var h = FS.snakeHead(state.player);
    var lms = (state.world.landmarks || []);
    for (var i = 0; i < lms.length; i++) {
      var lm = lms[i];
      if (lm.done || !lm.amount) continue;
      if (FS.manhattan(h, lm) > 1) continue;
      if (lm.kind === "loose_stone" || lm.kind === "stone") {
        var got = lm.amount || 1;
        FS.gainMaterial(state, "stone", got);
        lm.done = true;
        lm.amount = 0;
        state.ui.toast = "+" + got + " камінь";
        return { ok: true };
      }
      if (lm.kind === "copper_ore") {
        FS.gainMaterial(state, "copper_ore", lm.amount || 1);
        lm.done = true;
        state.ui.toast = "+" + (lm.amount || 1) + " мідна руда";
        return { ok: true };
      }
      if (lm.kind === "mycelium") {
        FS.gainMaterial(state, "mycelium", lm.amount || 1);
        lm.done = true;
        state.ui.toast = "+" + (lm.amount || 1) + " грибниця";
        return { ok: true };
      }
      if (lm.kind === "fiber_tuft") {
        FS.gainMaterial(state, "fiber", lm.amount || 1);
        lm.done = true;
        state.ui.toast = "+" + (lm.amount || 1) + " волокно";
        return { ok: true };
      }
    }
    return { ok: false };
  };

  FS.openStationPanel = function (state, station) {
    state.ui.panel = "station";
    state.ui.stationId = station.id;
    state.ui.panelDirty = true;
    FS.setPauseReason(state, "panel", true);
  };

  FS.htmlStation = function (state) {
    FS.ensureMaterials(state);
    var st = null;
    for (var i = 0; i < (state.stations || []).length; i++) {
      if (state.stations[i].id === state.ui.stationId) st = state.stations[i];
    }
    if (!st) return '<p>Станцію не знайдено</p><button class="btn" data-act="close">Закрити</button>';
    var html = '<div class="panel-head"><h2>' +
      ((FS.BUILD_COSTS[st.kind] && FS.BUILD_COSTS[st.kind].name) || st.kind) +
      '</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p class="tiny">Матеріали: камінь ' + state.materials.stone +
      " · волокно " + state.materials.fiber +
      " · дошки " + state.materials.planks +
      " · руда " + state.materials.copper_ore +
      " · злитки " + state.materials.copper_ingot + "</p>";
    if (st.current) {
      html += "<p>У роботі: <b>" + (FS.RECIPES[st.current.recipeId] || {}).name +
        "</b> (" + st.current.t.toFixed(1) + " с)</p>";
    }
    FS.recipesForStation(st.kind).forEach(function (r) {
      var c = FS.canCraft(state, r.id);
      var need = Object.keys(r.in).map(function (k) {
        return r.in[k] + "×" + (k === "wood" ? "деревина" : FS.materialLabel(k));
      }).join(", ");
      html += '<button class="btn' + (c.ok && !st.current ? " primary" : "") +
        '" data-craft="' + r.id + '"' + (c.ok && !st.current ? "" : " disabled") + ">" +
        r.name + " (" + need + ")</button> ";
    });
    return html;
  };

  FS.hydrateStationsFromBuildings = function (state) {
    FS.ensureStations(state);
    var kinds = { workbench: 1, loom: 1, mason: 1, kiln: 1 };
    var list = state.buildings || [];
    list.forEach(function (b) {
      if (!kinds[b.kind]) return;
      if (state.stations.some(function (s) { return s.id === b.id; })) return;
      FS.registerStation(state, b);
    });
  };
})(window.FoxSerpent);
