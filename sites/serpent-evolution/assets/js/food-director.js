/* FOX SERPENT — FoodDirector: їжа лише на грядках (фермах) */
(function (FS) {
  "use strict";

  FS.FOOD_RESPAWN_MIN = 8;
  FS.FOOD_RESPAWN_MAX = 12;
  FS.FOOD_BUD_TIME = 1.0;
  FS.FOOD_HEAD_CLEAR = 2;

  FS.FOOD_DEFS = {
    apple: { id: "apple", name: "Яблуко", nutrition: 1, xp: 1, rare: false },
    berry: { id: "berry", name: "Ягоди", nutrition: 1, xp: 1, rare: false },
    pear: { id: "pear", name: "Груша", nutrition: 1, xp: 2, rare: false },
    seed: { id: "seed", name: "Насіння", nutrition: 1, xp: 1, rare: false },
    golden: { id: "golden", name: "Золотий плід", nutrition: 2, xp: 3, rare: true }
  };

  FS.createFoodDirector = function (world) {
    return {
      slots: Object.create(null),
      globalCap: 48,
      farmOnly: true,
      queue: []
    };
  };

  FS.chunkFoodCapacity = function (chunk, state) {
    // Capacity = number of berry/orchard farms in chunk
    if (!state || !state.farms || !state.farms.list) return 0;
    var n = 0;
    var baseX = chunk.cx * FS.CHUNK, baseY = chunk.cy * FS.CHUNK;
    state.farms.list.forEach(function (f) {
      if (f.type === "nursery") return;
      if (f.x >= baseX && f.x < baseX + FS.CHUNK && f.y >= baseY && f.y < baseY + FS.CHUNK) n++;
    });
    return n;
  };

  FS.foodKindPick = function (rng, chunk) {
    var r = rng();
    if (r > 0.94) return "golden";
    if (chunk && chunk.type === "meadow") return r > 0.5 ? "berry" : "apple";
    if (chunk && chunk.type === "shore") return r > 0.55 ? "pear" : "seed";
    var pool = ["apple", "berry", "pear", "seed"];
    return pool[Math.floor(rng() * pool.length)];
  };

  FS.countRipeInChunk = function (state, chunkId) {
    var ch = state.world.chunks[chunkId];
    if (!ch) return 0;
    var baseX = ch.cx * FS.CHUNK, baseY = ch.cy * FS.CHUNK;
    var n = 0;
    state.world.foods.forEach(function (f) {
      if (f.phase === "bud") return;
      if (f.x >= baseX && f.x < baseX + FS.CHUNK && f.y >= baseY && f.y < baseY + FS.CHUNK) n++;
    });
    return n;
  };

  FS.foodCellFree = function (state, x, y) {
    if (!FS.inBounds(state.world, x, y)) return false;
    if (FS.isBlockedCell(state, x, y)) return false;
    if (FS.manhattan({ x: x, y: y }, state.world.nest) < 1) return false;
    var foods = state.world.foods;
    for (var i = 0; i < foods.length; i++) {
      if (foods[i].x === x && foods[i].y === y) return false;
    }
    function onSnake(s) {
      if (!s || s.dead) return false;
      for (var j = 0; j < s.body.length; j++) {
        if (s.body[j].x === x && s.body[j].y === y) return true;
      }
      return false;
    }
    if (onSnake(state.player)) return false;
    for (var e = 0; e < state.enemies.length; e++) if (onSnake(state.enemies[e])) return false;
    return true;
  };

  /** Only farm plot cells may receive food. */
  FS.pickFoodCell = function (state, chunk, rng) {
    FS.ensureFarms(state);
    var baseX = chunk.cx * FS.CHUNK, baseY = chunk.cy * FS.CHUNK;
    var candidates = [];
    state.farms.list.forEach(function (f) {
      if (f.type === "nursery") return;
      if (f.x < baseX || f.x >= baseX + FS.CHUNK || f.y < baseY || f.y >= baseY + FS.CHUNK) return;
      var occupied = state.world.foods.some(function (food) {
        return food.x === f.x && food.y === f.y;
      });
      if (!occupied) candidates.push({ x: f.x, y: f.y, farm: f });
    });
    if (!candidates.length) return null;
    return candidates[Math.floor(rng() * candidates.length)];
  };

  FS.ensureDirector = function (state) {
    if (!state.foodDirector) state.foodDirector = FS.createFoodDirector(state.world);
    state.foodDirector.farmOnly = true;
    Object.keys(state.world.chunks).forEach(function (id) {
      if (!state.foodDirector.slots[id]) {
        state.foodDirector.slots[id] = {
          capacity: FS.chunkFoodCapacity(state.world.chunks[id], state),
          pending: []
        };
      } else {
        state.foodDirector.slots[id].capacity = FS.chunkFoodCapacity(state.world.chunks[id], state);
        // Drop wild pending that was for random meadow cells
        state.foodDirector.slots[id].pending = [];
      }
    });
  };

  /** Start: 4 грядки з плодами на них (не дика їжа на лузі). */
  FS.seedStartFood = function (state) {
    FS.ensureDirector(state);
    state.world.foods = [];
    if (FS.seedStartFarms) FS.seedStartFarms(state);
    // guarantee at least some fruit if farm placement partially failed
    if (state.world.foods.length < 1 && state.farms && state.farms.list.length) {
      state.farms.list.forEach(function (f) { FS.ensureFarmFruit(state, f); });
    }
  };

  FS.onFoodEaten = function (state, food) {
    if (food && food.fromFarm && FS.onFarmFoodTaken) {
      FS.onFarmFoodTaken(state, food);
      return;
    }
    // Legacy / enemy ate unmarked food on a farm cell
    if (food && FS.farmAt) {
      var farm = FS.farmAt(state, food.x, food.y);
      if (farm) {
        food.fromFarm = farm.id;
        if (FS.onFarmFoodTaken) FS.onFarmFoodTaken(state, food);
      }
    }
    // No wild meadow respawn
  };

  FS.foodHudInfo = function (state) {
    FS.ensureFarms(state);
    var farms = state.farms.list.filter(function (f) { return f.type !== "nursery"; });
    var ripe = state.world.foods.filter(function (f) { return f.phase !== "bud"; }).length;
    var growing = farms.filter(function (f) {
      return f.stage === "planted" || f.stage === "growing" || f.stage === "recover";
    }).length;
    var next = null;
    farms.forEach(function (f) {
      if (f.stage === "ready") return;
      var need = f.stage === "recover" ? f.cycle * 0.35 : f.cycle;
      var left = Math.max(0, need - (f.t || 0));
      if (next == null || left < next) next = left;
    });
    return {
      chunkId: "farms",
      ripe: ripe,
      capacity: farms.length,
      next: next,
      growing: growing
    };
  };

  FS.tickFoodDirector = function (state, dt) {
    if (!state.started || state.paused) return;
    if (state.guide && state.guide.open) return;
    if (typeof document !== "undefined" && document.hidden) return;
    FS.ensureDirector(state);
    // Buds on farm cells (if any) still ripen; no wild spawn
    state.world.foods.forEach(function (f) {
      if (f.phase === "bud") {
        f.age = (f.age || 0) + dt;
        if (f.age >= FS.FOOD_BUD_TIME) {
          f.phase = "ripe";
          f.age = 0;
        }
      }
    });
    // Clear any legacy pending wild queues
    Object.keys(state.foodDirector.slots).forEach(function (id) {
      state.foodDirector.slots[id].pending = [];
      state.foodDirector.slots[id].capacity = FS.chunkFoodCapacity(state.world.chunks[id], state);
    });
  };

  FS.serializeFoodDirector = function (state) {
    FS.ensureDirector(state);
    return {
      slots: state.foodDirector.slots,
      globalCap: state.foodDirector.globalCap,
      farmOnly: true
    };
  };

  FS.applyFoodDirector = function (state, data) {
    state.foodDirector = data || FS.createFoodDirector(state.world);
    state.foodDirector.farmOnly = true;
    FS.ensureDirector(state);
  };
})(window.FoxSerpent);
