/* FOX SERPENT — underground caves, portals, transitions */
(function (FS) {
  "use strict";

  FS.CAVE_THEMES = ["roots", "mushroom", "mine", "stream", "ruins", "lair"];

  FS.ensureCaves = function (state) {
    if (!state.caves) state.caves = { list: [], byId: Object.create(null) };
    if (!state.portals) state.portals = [];
    return state.caves;
  };

  FS.pickCaveTheme = function (seed, cx, cy) {
    var h = FS.hash2(seed, cx * 997 + cy * 991);
    return FS.CAVE_THEMES[h % FS.CAVE_THEMES.length];
  };

  /** Generate a compact cave grid (CHUNK*2 style pocket) with turn room for length-12. */
  FS.generateCaveGrid = function (seed, caveId, theme) {
    var rng = FS.mulberry32(FS.hash2(seed, FS.hash2(caveId.length, theme.length * 13)));
    var w = 24, h = 18;
    var grid = [];
    var j, i;
    for (j = 0; j < h; j++) {
      grid[j] = [];
      for (i = 0; i < w; i++) grid[j][i] = "cave_wall";
    }
    // Carve rooms + corridors
    function carveRoom(cx, cy, rw, rh) {
      for (var y = cy - rh; y <= cy + rh; y++) {
        for (var x = cx - rw; x <= cx + rw; x++) {
          if (x > 1 && y > 1 && x < w - 2 && y < h - 2) grid[y][x] = "cave_floor";
        }
      }
    }
    function carveTunnel(x0, y0, x1, y1) {
      var x = x0, y = y0, guard = 120;
      while ((x !== x1 || y !== y1) && guard--) {
        grid[y][x] = "cave_floor";
        if (rng() < 0.3) grid[y][Math.min(w - 2, x + 1)] = "cave_floor";
        if (x !== x1 && (Math.abs(x - x1) >= Math.abs(y - y1) || y === y1)) x += x1 > x ? 1 : -1;
        else if (y !== y1) y += y1 > y ? 1 : -1;
      }
      grid[y1][x1] = "cave_floor";
    }
    var rooms = [
      { x: 5, y: 5, rw: 3, rh: 3 },
      { x: 12, y: 8, rw: 4, rh: 3 },
      { x: 18, y: 5, rw: 3, rh: 3 }
    ];
    if (theme === "mushroom") rooms.push({ x: 12, y: 14, rw: 4, rh: 2 });
    if (theme === "mine") rooms.push({ x: 18, y: 13, rw: 3, rh: 2 });
    rooms.forEach(function (r) { carveRoom(r.x, r.y, r.rw, r.rh); });
    for (i = 0; i < rooms.length - 1; i++) {
      carveTunnel(rooms[i].x, rooms[i].y, rooms[i + 1].x, rooms[i + 1].y);
    }
    // Turn plaza for length-12
    carveRoom(12, 8, 5, 4);

    var floors = [];
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) if (grid[j][i] === "cave_floor") floors.push({ x: i, y: j });
    }
    // Resources by theme
    var resources = [];
    if (theme === "mushroom" || theme === "roots") {
      for (i = 0; i < 4; i++) {
        var f = floors[Math.floor(rng() * floors.length)];
        if (f) resources.push({ x: f.x, y: f.y, kind: "mycelium", amount: 2 + (rng() * 2 | 0) });
      }
    }
    if (theme === "mine" || theme === "ruins") {
      for (i = 0; i < 3; i++) {
        var f2 = floors[Math.floor(rng() * floors.length)];
        if (f2) resources.push({ x: f2.x, y: f2.y, kind: "copper_ore", amount: 1 + (rng() * 2 | 0) });
      }
    }
    // Entrance pads (1–3)
    var nExits = 1 + (FS.hash2(seed, caveId.charCodeAt(0) || 1) % 3);
    var exits = [];
    for (i = 0; i < nExits; i++) {
      var e = floors[Math.floor(rng() * floors.length)];
      if (e) {
        exits.push({ x: e.x, y: e.y, id: caveId + "_e" + i });
        grid[e.y][e.x] = "cave_exit";
      }
    }
    return { w: w, h: h, grid: grid, theme: theme, exits: exits, resources: resources, rooms: rooms };
  };

  FS.spawnCaveEntranceOnChunk = function (state, offer) {
    FS.ensureCaves(state);
    if (!offer || offer.danger < 1) return null;
    var h = FS.hash2(state.world.seed, offer.cx * 3331 + offer.cy * 3343);
    if (h % 100 > 42) return null; // ~42% chunks get an entrance
    var theme = FS.pickCaveTheme(state.world.seed, offer.cx, offer.cy);
    var caveId = "cave_" + offer.cx + "_" + offer.cy;
    if (state.caves.byId[caveId]) return state.caves.byId[caveId];

    var gen = FS.generateCaveGrid(state.world.seed, caveId, theme);
    var sx = offer.cx * FS.CHUNK + 4 + (h % 4);
    var sy = offer.cy * FS.CHUNK + 4 + ((h >>> 4) % 4);
    // Find walkable surface cell
    var placed = null;
    for (var t = 0; t < 20; t++) {
      var tx = sx + (t % 5), ty = sy + ((t / 5) | 0);
      var tile = FS.tileAt(state.world, tx, ty);
      if (tile && FS.tileWalkable(tile) && !FS.buildingAt(state, tx, ty) && !(FS.treeAt && FS.treeAt(state, tx, ty))) {
        placed = { x: tx, y: ty };
        break;
      }
    }
    if (!placed) return null;

    var cave = {
      id: caveId, theme: theme, cx: offer.cx, cy: offer.cy,
      surface: [placed],
      gen: gen,
      knownExits: 0
    };
    state.caves.list.push(cave);
    state.caves.byId[caveId] = cave;
    state.portals.push({
      id: caveId + "_p0", caveId: caveId, exitId: gen.exits[0] && gen.exits[0].id,
      surface: placed,
      cavePos: gen.exits[0] ? { x: gen.exits[0].x, y: gen.exits[0].y } : { x: 5, y: 5 },
      sealed: false
    });
    state.world.landmarks = state.world.landmarks || [];
    state.world.landmarks.push({
      id: FS.uid(), kind: "cave_entrance", x: placed.x, y: placed.y,
      caveId: caveId, name: "Вхід у печеру", done: false
    });
    return cave;
  };

  FS.portalAt = function (state, x, y) {
    FS.ensureCaves(state);
    for (var i = 0; i < state.portals.length; i++) {
      var p = state.portals[i];
      if (state.layerId === FS.LAYER_CAVE) {
        if (p.caveId === state.caveId && p.cavePos && p.cavePos.x === x && p.cavePos.y === y) return p;
      } else if (p.surface && p.surface.x === x && p.surface.y === y) return p;
    }
    return null;
  };

  FS.tryEnterPortal = function (state) {
    FS.ensureLayer(state);
    FS.ensureCaves(state);
    var h = FS.snakeHead(state.player);
    var p = FS.portalAt(state, h.x, h.y);
    if (!p) {
      // adjacent
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        if (p) return;
        p = FS.portalAt(state, h.x + d[0], h.y + d[1]);
      });
    }
    if (!p) return { ok: false, why: "Немає входу" };
    if (p.sealed) return { ok: false, why: "Завал — відкрий територію зверху" };

    if (state.layerId !== FS.LAYER_CAVE) {
      return FS.enterCave(state, p);
    }
    return FS.exitCave(state, p);
  };

  /** Walkable cave cell (floor or exit) before world swap. */
  FS.caveCellWalkable = function (gen, x, y) {
    if (!gen || x < 0 || y < 0 || x >= gen.w || y >= gen.h) return false;
    var tt = gen.grid[y][x];
    return tt === "cave_floor" || tt === "cave_exit";
  };

  /**
   * Find head+body footprint of `len` on cave grid.
   * Prefer portal pad, then room centers, then any floor run.
   */
  FS.findCaveSpawn = function (gen, prefer, len) {
    len = Math.max(3, len | 0);
    var dirs = [
      { dir: "R", dx: -1, dy: 0 },
      { dir: "L", dx: 1, dy: 0 },
      { dir: "D", dx: 0, dy: -1 },
      { dir: "U", dx: 0, dy: 1 }
    ];
    function tryAt(hx, hy) {
      for (var d = 0; d < dirs.length; d++) {
        var body = [];
        var ok = true;
        for (var i = 0; i < len; i++) {
          var x = hx + dirs[d].dx * i;
          var y = hy + dirs[d].dy * i;
          if (!FS.caveCellWalkable(gen, x, y)) { ok = false; break; }
          body.push({ x: x, y: y });
        }
        if (ok) return { body: body, dir: dirs[d].dir, head: { x: hx, y: hy } };
      }
      return null;
    }
    var candidates = [];
    if (prefer) candidates.push(prefer);
    (gen.rooms || []).forEach(function (r) {
      candidates.push({ x: r.x, y: r.y });
    });
    candidates.push({ x: 12, y: 8 });
    for (var c = 0; c < candidates.length; c++) {
      var spot = tryAt(candidates[c].x, candidates[c].y);
      if (spot) return spot;
    }
    // brute floor scan (plaza first by y~8)
    for (var y = 0; y < gen.h; y++) {
      for (var x = 0; x < gen.w; x++) {
        if (!FS.caveCellWalkable(gen, x, y)) continue;
        var s2 = tryAt(x, y);
        if (s2) return s2;
      }
    }
    return null;
  };

  FS.getOrBuildCaveWorld = function (state, cave) {
    if (cave._worldCache) return cave._worldCache;
    cave._worldCache = FS.caveWorldFromGen(state, cave);
    return cave._worldCache;
  };

  FS.enterCave = function (state, portal) {
    var cave = state.caves.byId[portal.caveId];
    if (!cave || !cave.gen) return { ok: false, why: "Печеру не знайдено" };

    var spawn = FS.findCaveSpawn(cave.gen, portal.cavePos, state.player.body.length);
    if (!spawn) return { ok: false, why: "Немає місця для тіла в печері" };

    // Snapshot surface — only after spawn is known (no wasted rebuild / lag)
    state._surfaceSnap = {
      body: FS.cloneBody(state.player),
      dir: state.player.dir,
      requestedDir: state.player.requestedDir,
      layerId: state.layerId || FS.LAYER_SURFACE
    };
    state._caveWorld = state.world;
    state.layerId = FS.LAYER_CAVE;
    state.caveId = portal.caveId;
    state.world = FS.getOrBuildCaveWorld(state, cave);

    state.player.body = spawn.body;
    state.player.dir = spawn.dir;
    state.player.requestedDir = spawn.dir;
    state.player.standing = true;
    state.player.stepAcc = 0;
    if (state.input) FS.clearInput(state.input);

    state.ui.toast = "Ти в печері («" + cave.theme + "»). Огляд обмежений. F — вихід.";
    state.tutorial.done.cave = true;
    state._fovCell = null;
    if (FS.tickVision) FS.tickVision(state);
    // Defer save — sync stringify was hitching on enter
    state._saveTimer = 20;
    return { ok: true };
  };

  FS.exitCave = function (state, portal) {
    if (!state._caveWorld) return { ok: false, why: "Немає поверхні" };
    var dest = (portal && portal.surface) || (state._surfaceSnap && state._surfaceSnap.body && state._surfaceSnap.body[0]);
    if (!dest) return { ok: false, why: "Немає точки виходу" };

    var len = state.player.body.length;
    var body = [];
    var dirs = [
      { dir: "R", dx: -1, dy: 0 },
      { dir: "L", dx: 1, dy: 0 },
      { dir: "D", dx: 0, dy: -1 },
      { dir: "U", dx: 0, dy: 1 }
    ];
    var chosen = null;
    for (var d = 0; d < dirs.length && !chosen; d++) {
      var ok = true;
      var trial = [];
      for (var i = 0; i < len; i++) {
        var x = dest.x + dirs[d].dx * i;
        var y = dest.y + dirs[d].dy * i;
        trial.push({ x: x, y: y });
      }
      var surf = state._caveWorld;
      for (i = 0; i < trial.length; i++) {
        var t = FS.tileAt(surf, trial[i].x, trial[i].y);
        if (!t || !FS.tileWalkable(t)) { ok = false; break; }
        if (FS.buildingAt && state.buildings) {
          var bHit = false;
          for (var bi = 0; bi < state.buildings.length; bi++) {
            var bb = state.buildings[bi];
            if (bb.x === trial[i].x && bb.y === trial[i].y &&
                FS.buildingBlocksFor(bb, state.player)) { bHit = true; break; }
          }
          if (bHit) { ok = false; break; }
        }
      }
      if (ok) chosen = { body: trial, dir: dirs[d].dir };
    }
    if (!chosen) {
      // fallback: head only on dest, body stacked west if free else just teleport head chain clipped
      chosen = { body: [{ x: dest.x, y: dest.y }], dir: "R" };
      for (i = 1; i < len; i++) {
        chosen.body.push({ x: dest.x - i, y: dest.y });
      }
    }

    // Enemy overlap on surface?
    var enemyHit = false;
    (state.enemies || []).forEach(function (e) {
      if (e.dead || enemyHit) return;
      chosen.body.forEach(function (c) {
        if (e.body && e.body.some(function (b) { return b.x === c.x && b.y === c.y; })) enemyHit = true;
      });
    });
    if (enemyHit) return { ok: false, why: "На поверхні ворог — зачекай" };

    state.world = state._caveWorld;
    state.layerId = FS.LAYER_SURFACE;
    state.caveId = null;
    state.player.body = chosen.body;
    state.player.dir = chosen.dir;
    state.player.requestedDir = chosen.dir;
    state.player.standing = true;
    state.ui.toast = "Повернення на поверхню";
    state._fovCell = null;
    state._saveTimer = 20;
    return { ok: true };
  };

  FS.caveWorldFromGen = function (state, cave) {
    var gen = cave.gen;
    var chunks = Object.create(null);
    var flat = Object.create(null);
    for (var y = 0; y < gen.h; y++) {
      for (var x = 0; x < gen.w; x++) {
        var tt = gen.grid[y][x];
        flat[FS.key(x, y)] = FS.makeTile(x, y, tt === "cave_wall" ? "cave_wall" : (tt === "cave_exit" ? "cave_exit" : "cave_floor"), {
          biome: cave.theme
        });
      }
    }
    chunks["0:0"] = { cx: 0, cy: 0, tiles: flat, type: "cave" };
    var world = {
      seed: state._caveWorld ? state._caveWorld.seed : state.world.seed,
      nest: { x: gen.exits[0] ? gen.exits[0].x : 5, y: gen.exits[0] ? gen.exits[0].y : 5 },
      chunks: chunks,
      tiles: flat,
      foods: [],
      landmarks: [],
      openOffers: [],
      generatorVersion: FS.GENERATOR_VERSION,
      caveId: cave.id,
      isCave: true,
      minX: 0, maxX: gen.w - 1,
      minY: 0, maxY: gen.h - 1
    };
    (gen.resources || []).forEach(function (r) {
      world.landmarks.push({
        id: FS.uid(), kind: r.kind, x: r.x, y: r.y, amount: r.amount, name: r.kind
      });
    });
    return world;
  };
})(window.FoxSerpent);
