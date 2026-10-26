/* FOX SERPENT — chunked grid world */
(function (FS) {
  "use strict";

  FS.inBounds = function (world, x, y) {
    return x >= world.minX && x <= world.maxX && y >= world.minY && y <= world.maxY;
  };

  FS.tileAt = function (world, x, y) {
    return world.tiles[FS.key(x, y)] || null;
  };

  FS.setTile = function (world, x, y, tile) {
    world.tiles[FS.key(x, y)] = tile;
  };

  FS.createEmptyWorld = function (seed) {
    return {
      seed: seed,
      tiles: Object.create(null),
      foods: [],
      materials: [],
      nest: { x: 5, y: 5 },
      chunks: {},
      minX: 0, maxX: FS.CHUNK - 1,
      minY: 0, maxY: FS.CHUNK - 1,
      openOffers: [],
      enemySpawns: []
    };
  };

  FS.generateChunk = function (world, cx, cy, typeId, rng, isStart) {
    var type = FS.REGION_TYPES[typeId] || FS.REGION_TYPES.garden;
    var baseX = cx * FS.CHUNK;
    var baseY = cy * FS.CHUNK;
    var id = cx + ":" + cy;
    if (world.chunks[id]) return world.chunks[id];

    var chunk = {
      id: id, cx: cx, cy: cy, type: typeId, name: type.name,
      danger: type.danger, opened: true
    };

    for (var y = 0; y < FS.CHUNK; y++) {
      for (var x = 0; x < FS.CHUNK; x++) {
        var wx = baseX + x, wy = baseY + y;
        var edge = x === 0 || y === 0 || x === FS.CHUNK - 1 || y === FS.CHUNK - 1;
        var block = false;
        // Soft decorative moss — stones are real blocks
        if (!isStart && rng() < type.stones) {
          // leave corridors: avoid blocking entire rows
          if (!(x % 4 === 2 || y % 4 === 2)) block = true;
        }
        if (isStart && rng() < 0.08 && !edge && !(wx === world.nest.x && wy === world.nest.y)) {
          if (x > 2 && y > 2 && x < FS.CHUNK - 3 && y < FS.CHUNK - 3) block = rng() < 0.5;
        }
        // nest clear
        if (Math.abs(wx - world.nest.x) + Math.abs(wy - world.nest.y) < 2) block = false;
        FS.setTile(world, wx, wy, {
          x: wx, y: wy, block: block,
          biome: typeId, moss: rng(),
          edgeGate: edge && !isStart
        });
      }
    }

    // Ensure nest walkable ring for start
    if (isStart) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var t = FS.tileAt(world, world.nest.x + dx, world.nest.y + dy);
          if (t) t.block = false;
        }
      }
    }

    // Food
    var foodN = Math.floor(5 * type.food) + (isStart ? 4 : 2);
    for (var f = 0; f < foodN; f++) {
      var fx = baseX + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      var fy = baseY + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      if (FS.isBlockedCell({ world: world }, fx, fy)) continue;
      if (FS.manhattan({ x: fx, y: fy }, world.nest) < 2 && isStart) continue;
      var kinds = ["berry", "fruit", "seed"];
      world.foods.push({
        id: FS.uid(), x: fx, y: fy,
        kind: kinds[Math.floor(rng() * kinds.length)],
        xp: 1, grow: 1
      });
    }

    // Materials
    var matN = Math.floor(4 * type.material) + (isStart ? 6 : 1);
    for (var m = 0; m < matN; m++) {
      var mx = baseX + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      var my = baseY + 1 + Math.floor(rng() * (FS.CHUNK - 2));
      if (FS.isBlockedCell({ world: world }, mx, my)) continue;
      world.materials.push({ id: FS.uid(), x: mx, y: my, amount: 1 });
    }

    // Connectivity: clear a ring path around center
    var mid = Math.floor(FS.CHUNK / 2);
    for (var i = 1; i < FS.CHUNK - 1; i++) {
      var a = FS.tileAt(world, baseX + i, baseY + mid);
      var b = FS.tileAt(world, baseX + mid, baseY + i);
      if (a) a.block = false;
      if (b) b.block = false;
    }

    world.chunks[id] = chunk;
    world.minX = Math.min(world.minX, baseX);
    world.maxX = Math.max(world.maxX, baseX + FS.CHUNK - 1);
    world.minY = Math.min(world.minY, baseY);
    world.maxY = Math.max(world.maxY, baseY + FS.CHUNK - 1);
    return chunk;
  };

  FS.buildStartWorld = function (seed) {
    seed = (seed >>> 0) || (Date.now() >>> 0);
    var rng = FS.mulberry32(seed);
    var world = FS.createEmptyWorld(seed);
    world.nest = { x: 5, y: 5 };
    FS.generateChunk(world, 0, 0, "garden", rng, true);
    world.openOffers = FS.computeExpandOffers(world);
    return world;
  };

  FS.computeExpandOffers = function (world) {
    var open = Object.keys(world.chunks);
    var neigh = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    var offers = [];
    var seen = Object.create(null);
    open.forEach(function (id) {
      var ch = world.chunks[id];
      neigh.forEach(function (n) {
        var cx = ch.cx + n.dx, cy = ch.cy + n.dy;
        var nid = cx + ":" + cy;
        if (world.chunks[nid] || seen[nid]) return;
        seen[nid] = 1;
        var types = Object.keys(FS.REGION_TYPES);
        // deterministic pick from seed+coords
        var pick = types[Math.abs(cx * 31 + cy * 17 + world.seed) % types.length];
        if (offers.length === 0) pick = "thicket"; // first expand safer-ish with warning
        if (offers.length === 1) pick = "rocky";
        if (offers.length === 2) pick = "elder";
        var cost = FS.FIRST_EXPAND_COST + offers.length * 6 + (FS.REGION_TYPES[pick].danger * 4);
        offers.push({
          cx: cx, cy: cy, type: pick,
          name: FS.REGION_TYPES[pick].name,
          desc: FS.REGION_TYPES[pick].desc,
          danger: FS.REGION_TYPES[pick].danger,
          cost: cost,
          spawnsEnemy: FS.REGION_TYPES[pick].danger >= 1
        });
      });
    });
    return offers.slice(0, 3);
  };

  FS.expandChunk = function (state, offer) {
    var discount = state.effects.expandDiscount || 0;
    var cost = Math.max(4, offer.cost - discount);
    if (state.nestMaterials < cost) return { ok: false, why: "Бракує матеріалу в гнізді (" + state.nestMaterials + "/" + cost + ")" };
    state.nestMaterials -= cost;
    var rng = FS.mulberry32(state.world.seed ^ (offer.cx * 10007) ^ (offer.cy * 10009));
    FS.generateChunk(state.world, offer.cx, offer.cy, offer.type, rng, false);
    state.world.openOffers = FS.computeExpandOffers(state.world);
    state.tutorial.done.expand = true;
    state.ui.toast = "Відкрито: " + offer.name;

    if (offer.spawnsEnemy) {
      var baseX = offer.cx * FS.CHUNK + 6;
      var baseY = offer.cy * FS.CHUNK + 6;
      // spawn far from player
      var archs = ["careful", "intercept", "territory", "elder"];
      var arch = offer.type === "elder" ? "elder" : archs[Math.min(offer.danger, 3)];
      var colors = {
        careful: FS.COLORS.enemyCareful,
        intercept: FS.COLORS.enemyIntercept,
        territory: FS.COLORS.enemyTerritory,
        elder: FS.COLORS.enemyElder
      };
      var enemy = FS.createSnake({
        kind: "enemy",
        name: arch === "elder" ? "Доросла змія" : "Дика змія",
        arch: arch,
        x: baseX, y: baseY,
        dir: "L",
        length: arch === "elder" ? 8 : 5,
        stepPeriod: arch === "intercept" ? 1 / 4.2 : FS.ENEMY_STEP_BASE,
        color: colors[arch],
        detectRange: arch === "elder" ? 11 : 8
      });
      // ensure empty
      var tries = 0;
      while (tries < 20 && FS.snakeAtCell(state, enemy.body[0].x, enemy.body[0].y).length) {
        enemy.body.forEach(function (c) { c.x += 1; });
        tries++;
      }
      state.enemies.push(enemy);
      state.ui.toast = "Увага: на новій території з’явилась змія!";
      state.tutorial.done.enemyWarn = true;
    }
    if (state.effects.firstDeliveryBonus && !state.progress.regionBonus[offer.cx + ":" + offer.cy]) {
      state.progress.pendingRegionBonus = offer.cx + ":" + offer.cy;
    }
    FS.saveGame(state, "expand");
    return { ok: true };
  };

  FS.pickupAt = function (state, head) {
    for (var i = state.world.foods.length - 1; i >= 0; i--) {
      var f = state.world.foods[i];
      if (f.x === head.x && f.y === head.y) {
        state.world.foods.splice(i, 1);
        return { kind: "food", item: f };
      }
    }
    for (var j = state.world.materials.length - 1; j >= 0; j--) {
      var m = state.world.materials[j];
      if (m.x === head.x && m.y === head.y) {
        state.world.materials.splice(j, 1);
        return { kind: "material", item: m };
      }
    }
    return null;
  };

  FS.atNest = function (state) {
    var h = FS.snakeHead(state.player);
    return FS.manhattan(h, state.world.nest) <= 1;
  };
})(window.FoxSerpent);
