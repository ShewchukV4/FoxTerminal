/* FOX SERPENT — FoodDirector: capacity, bud → ripe, timers (paused/guide/hidden stop) */
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
      slots: Object.create(null), // chunkId -> { capacity, ripe, pending:[{t,x,y,kind,phase}] }
      globalCap: 48,
      queue: []
    };
  };

  FS.chunkFoodCapacity = function (chunk, state) {
    var type = FS.REGION_TYPES[chunk.type] || FS.REGION_TYPES.garden;
    var base = Math.round(4 * (type.food || 1));
    if (chunk.cx === 0 && chunk.cy === 0) base = 5;
    if (state && state.effects && state.effects.gardenCapAdd) {
      if (chunk.cx === 0 && chunk.cy === 0) base += state.effects.gardenCapAdd;
    }
    if (state && state.world && state.world.landmarks) {
      state.world.landmarks.forEach(function (lm) {
        if (lm.kind === "garden_node" && lm.done && lm.chunkId === chunk.id) base += lm.bonus || 1;
      });
    }
    return FS.clamp(base, 2, 12);
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
    if (state.world.landmarks) {
      for (var L = 0; L < state.world.landmarks.length; L++) {
        var lm = state.world.landmarks[L];
        if (lm.x === x && lm.y === y) return false;
      }
    }
    // not on any snake segment
    function onSnake(s) {
      if (!s || s.dead) return false;
      for (var j = 0; j < s.body.length; j++) {
        if (s.body[j].x === x && s.body[j].y === y) return true;
      }
      return false;
    }
    if (onSnake(state.player)) return false;
    for (var e = 0; e < state.enemies.length; e++) if (onSnake(state.enemies[e])) return false;
    // clear of player head
    if (state.player && !state.player.dead) {
      var h = FS.snakeHead(state.player);
      if (FS.manhattan(h, { x: x, y: y }) < FS.FOOD_HEAD_CLEAR) return false;
    }
    return true;
  };

  FS.pickFoodCell = function (state, chunk, rng) {
    var baseX = chunk.cx * FS.CHUNK, baseY = chunk.cy * FS.CHUNK;
    var tries = 24;
    while (tries--) {
      var x = baseX + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      var y = baseY + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      if (FS.foodCellFree(state, x, y)) return { x: x, y: y };
    }
    return null;
  };

  FS.ensureDirector = function (state) {
    if (!state.foodDirector) state.foodDirector = FS.createFoodDirector(state.world);
    Object.keys(state.world.chunks).forEach(function (id) {
      if (!state.foodDirector.slots[id]) {
        state.foodDirector.slots[id] = {
          capacity: FS.chunkFoodCapacity(state.world.chunks[id], state),
          pending: []
        };
      } else {
        state.foodDirector.slots[id].capacity = FS.chunkFoodCapacity(state.world.chunks[id], state);
      }
    });
  };

  FS.seedStartFood = function (state) {
    FS.ensureDirector(state);
    var rng = FS.mulberry32(state.world.seed ^ 0xF00D);
    var chunk = state.world.chunks["0:0"];
    if (!chunk) return;
    // Clear any random foods from old gen
    state.world.foods = state.world.foods.filter(function (f) {
      return !(f.x >= 0 && f.x < FS.CHUNK && f.y >= 0 && f.y < FS.CHUNK);
    });
    // Guaranteed first fruit near nest east
    var first = { x: state.world.nest.x + 3, y: state.world.nest.y };
    if (!FS.foodCellFree(state, first.x, first.y)) {
      first = FS.pickFoodCell(state, chunk, rng) || first;
    }
    state.world.foods.push({
      id: FS.uid(), x: first.x, y: first.y,
      kind: "apple", phase: "ripe", nutrition: 1, xp: 1, age: 0
    });
    var need = 4;
    var guard = 40;
    while (need > 0 && guard--) {
      var cell = FS.pickFoodCell(state, chunk, rng);
      if (!cell) break;
      var kind = FS.foodKindPick(rng, chunk);
      var def = FS.FOOD_DEFS[kind];
      state.world.foods.push({
        id: FS.uid(), x: cell.x, y: cell.y,
        kind: kind, phase: "ripe",
        nutrition: def.nutrition, xp: def.xp, age: 0
      });
      need--;
    }
  };

  FS.onFoodEaten = function (state, food) {
    FS.ensureDirector(state);
    var cx = Math.floor(food.x / FS.CHUNK);
    var cy = Math.floor(food.y / FS.CHUNK);
    var id = cx + ":" + cy;
    var slot = state.foodDirector.slots[id];
    if (!slot) return;
    var rng = FS.mulberry32((state.world.seed ^ (food.x * 997) ^ (food.y * 991) ^ (state.time * 10)) >>> 0);
    var delay = FS.FOOD_RESPAWN_MIN + rng() * (FS.FOOD_RESPAWN_MAX - FS.FOOD_RESPAWN_MIN);
    if (state.effects && state.effects.ripeSpeedMul) delay *= state.effects.ripeSpeedMul;
    delay = FS.clamp(delay, 5, 16);
    slot.pending.push({
      t: delay,
      kind: FS.foodKindPick(rng, state.world.chunks[id]),
      prefer: { x: food.x, y: food.y }
    });
  };

  FS.foodHudInfo = function (state) {
    FS.ensureDirector(state);
    var h = FS.snakeHead(state.player);
    var id = Math.floor(h.x / FS.CHUNK) + ":" + Math.floor(h.y / FS.CHUNK);
    var slot = state.foodDirector.slots[id];
    if (!slot) return null;
    var ripe = FS.countRipeInChunk(state, id);
    var next = null;
    slot.pending.forEach(function (p) {
      if (next == null || p.t < next) next = p.t;
    });
    // also buds
    state.world.foods.forEach(function (f) {
      if (f.phase === "bud" && Math.floor(f.x / FS.CHUNK) + ":" + Math.floor(f.y / FS.CHUNK) === id) {
        var left = Math.max(0, FS.FOOD_BUD_TIME - (f.age || 0));
        if (next == null || left < next) next = left;
      }
    });
    return {
      chunkId: id,
      ripe: ripe,
      capacity: slot.capacity,
      next: next
    };
  };

  FS.tickFoodDirector = function (state, dt) {
    if (!state.started || state.paused) return;
    if (state.guide && state.guide.open) return;
    if (typeof document !== "undefined" && document.hidden) return;
    FS.ensureDirector(state);

    // Advance buds → ripe
    state.world.foods.forEach(function (f) {
      if (f.phase === "bud") {
        f.age = (f.age || 0) + dt;
        if (f.age >= FS.FOOD_BUD_TIME) {
          f.phase = "ripe";
          f.age = 0;
        }
      }
    });

    var totalRipe = state.world.foods.filter(function (f) { return f.phase !== "bud"; }).length;
    Object.keys(state.foodDirector.slots).forEach(function (id) {
      var slot = state.foodDirector.slots[id];
      var chunk = state.world.chunks[id];
      if (!chunk || !slot) return;
      var ripe = FS.countRipeInChunk(state, id);
      for (var i = slot.pending.length - 1; i >= 0; i--) {
        var p = slot.pending[i];
        p.t -= dt;
        if (p.t > 0) continue;
        if (ripe >= slot.capacity || totalRipe >= state.foodDirector.globalCap) {
          p.t = 2; // retry later
          continue;
        }
        var rng = FS.mulberry32((state.world.seed ^ (p.t * 1000) ^ id.length ^ state.time) >>> 0);
        var cell = null;
        if (p.prefer && FS.foodCellFree(state, p.prefer.x, p.prefer.y)) cell = p.prefer;
        if (!cell) cell = FS.pickFoodCell(state, chunk, rng);
        slot.pending.splice(i, 1);
        if (!cell) continue;
        var def = FS.FOOD_DEFS[p.kind] || FS.FOOD_DEFS.apple;
        state.world.foods.push({
          id: FS.uid(), x: cell.x, y: cell.y,
          kind: p.kind, phase: "bud", age: 0,
          nutrition: def.nutrition, xp: def.xp
        });
        ripe++;
        totalRipe++;
      }
      // Soft top-up if under capacity and no pending
      if (ripe < slot.capacity && slot.pending.length === 0) {
        var rng2 = FS.mulberry32((state.world.seed + ripe * 13 + id.charCodeAt(0)) >>> 0);
        slot.pending.push({
          t: FS.FOOD_RESPAWN_MIN + rng2() * 4,
          kind: FS.foodKindPick(rng2, chunk)
        });
      }
    });
  };

  FS.serializeFoodDirector = function (state) {
    FS.ensureDirector(state);
    return {
      slots: state.foodDirector.slots,
      globalCap: state.foodDirector.globalCap
    };
  };

  FS.applyFoodDirector = function (state, data) {
    state.foodDirector = data || FS.createFoodDirector(state.world);
    FS.ensureDirector(state);
  };
})(window.FoxSerpent);
