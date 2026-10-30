/* FOX SERPENT — underground caves, portals, transitions (multi-world) */
(function (FS) {
  "use strict";

  FS.CAVE_THEMES = ["roots", "mushroom", "mine", "stream", "ruins", "lair"];
  FS.CAVE_GEN_VERSION = 2;

  FS.ensureCaves = function (state) {
    if (!state.caves) state.caves = { list: [], byId: Object.create(null) };
    if (!state.portals) state.portals = [];
    if (FS.ensureWorlds) FS.ensureWorlds(state);
    return state.caves;
  };

  FS.pickCaveTheme = function (seed, cx, cy) {
    var h = FS.hash2(seed, cx * 997 + cy * 991);
    return FS.CAVE_THEMES[h % FS.CAVE_THEMES.length];
  };

  /** Stable seed from full caveId string + theme + gen version (not string length). */
  FS.caveGenSeed = function (worldSeed, caveId, theme) {
    var h = (worldSeed >>> 0) ^ (FS.CAVE_GEN_VERSION * 0x9e3779b1);
    var s = String(caveId || "") + "|" + String(theme || "");
    for (var i = 0; i < s.length; i++) {
      h = FS.hash2(h, s.charCodeAt(i) * (i + 17));
    }
    return h >>> 0;
  };

  FS.generateCaveGrid = function (seed, caveId, theme) {
    var rng = FS.mulberry32(FS.caveGenSeed(seed, caveId, theme));
    var w = 24, h = 18;
    var grid = [];
    var j, i;
    for (j = 0; j < h; j++) {
      grid[j] = [];
      for (i = 0; i < w; i++) grid[j][i] = "cave_wall";
    }
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
    // Theme offsets so same-length ids still differ
    var ox = (FS.caveGenSeed(seed, caveId, theme) % 3) - 1;
    rooms.forEach(function (r) { carveRoom(r.x + ox, r.y, r.rw, r.rh); });
    for (i = 0; i < rooms.length - 1; i++) {
      carveTunnel(rooms[i].x + ox, rooms[i].y, rooms[i + 1].x + ox, rooms[i + 1].y);
    }
    carveRoom(12 + ox, 8, 5, 4);

    var floors = [];
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) if (grid[j][i] === "cave_floor") floors.push({ x: i, y: j });
    }
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
    var nExits = 1 + (FS.caveGenSeed(seed, caveId + ":exits", theme) % 3);
    var exits = [];
    var used = Object.create(null);
    for (i = 0; i < nExits && floors.length; i++) {
      var e = floors[Math.floor(rng() * floors.length)];
      var ek = e.x + "," + e.y;
      if (used[ek]) continue;
      used[ek] = 1;
      exits.push({ x: e.x, y: e.y, id: caveId + "_e" + i });
      grid[e.y][e.x] = "cave_exit";
    }
    if (!exits.length && floors.length) {
      exits.push({ x: floors[0].x, y: floors[0].y, id: caveId + "_e0" });
      grid[floors[0].y][floors[0].x] = "cave_exit";
    }
    return {
      w: w, h: h, grid: grid, theme: theme, exits: exits, resources: resources,
      rooms: rooms, genVersion: FS.CAVE_GEN_VERSION, caveId: caveId
    };
  };

  FS.spawnCaveEntranceOnChunk = function (state, offer) {
    FS.ensureCaves(state);
    if (!offer || offer.danger < 1) return null;
    var h = FS.hash2(state.world.seed, offer.cx * 3331 + offer.cy * 3343);
    if (h % 100 > 42) return null;
    var theme = FS.pickCaveTheme(state.world.seed, offer.cx, offer.cy);
    var caveId = "cave_" + offer.cx + "_" + offer.cy;
    if (state.caves.byId[caveId]) return state.caves.byId[caveId];

    var gen = FS.generateCaveGrid(state.world.seed, caveId, theme);
    var sx = offer.cx * FS.CHUNK + 4 + (h % 4);
    var sy = offer.cy * FS.CHUNK + 4 + ((h >>> 4) % 4);
    var placed = null;
    for (var t = 0; t < 20; t++) {
      var tx = sx + (t % 5), ty = sy + ((t / 5) | 0);
      var tile = FS.tileAt(state.world, tx, ty);
      if (tile && FS.tileWalkable(tile) && !FS.buildingAt(state, tx, ty) &&
          !(FS.treeAt && FS.treeAt(state, tx, ty))) {
        placed = { x: tx, y: ty };
        break;
      }
    }
    if (!placed) return null;

    var cave = {
      id: caveId, theme: theme, cx: offer.cx, cy: offer.cy,
      surface: [placed], gen: gen, knownExits: 0
    };
    state.caves.list.push(cave);
    state.caves.byId[caveId] = cave;

    // One portal per exit — secondary exits start sealed until linked/found
    (gen.exits || []).forEach(function (ex, idx) {
      state.portals.push({
        id: caveId + "_p" + idx,
        caveId: caveId,
        exitId: ex.id,
        surface: idx === 0 ? placed : null,
        cavePos: { x: ex.x, y: ex.y },
        sealed: idx !== 0,
        known: idx === 0
      });
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
    var inCave = state.layerId === FS.LAYER_CAVE || state.activeWorldId !== FS.WORLD_SURFACE;
    for (var i = 0; i < state.portals.length; i++) {
      var p = state.portals[i];
      if (inCave) {
        if (p.caveId === state.caveId && p.cavePos && p.cavePos.x === x && p.cavePos.y === y) return p;
      } else if (p.surface && p.surface.x === x && p.surface.y === y) {
        return p;
      }
    }
    return null;
  };

  FS.tryEnterPortal = function (state) {
    FS.ensureLayer(state);
    FS.ensureCaves(state);
    var h = FS.snakeHead(state.player);
    var p = FS.portalAt(state, h.x, h.y);
    if (!p) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        if (p) return;
        p = FS.portalAt(state, h.x + d[0], h.y + d[1]);
      });
    }
    if (!p) return { ok: false, why: "Немає входу" };
    if (p.sealed && state.layerId !== FS.LAYER_CAVE) {
      return { ok: false, why: "Завал — відкрий іншу територію або знайди зв’язок зсередини" };
    }
    if (state.layerId !== FS.LAYER_CAVE && state.activeWorldId === FS.WORLD_SURFACE) {
      return FS.enterCave(state, p);
    }
    return FS.exitCave(state, p);
  };

  FS.caveCellWalkable = function (gen, x, y) {
    if (!gen || x < 0 || y < 0 || x >= gen.w || y >= gen.h) return false;
    var tt = gen.grid[y][x];
    return tt === "cave_floor" || tt === "cave_exit";
  };

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
    (gen.rooms || []).forEach(function (r) { candidates.push({ x: r.x, y: r.y }); });
    candidates.push({ x: 12, y: 8 });
    for (var c = 0; c < candidates.length; c++) {
      var spot = tryAt(candidates[c].x, candidates[c].y);
      if (spot) return spot;
    }
    for (var y = 0; y < gen.h; y++) {
      for (var x = 0; x < gen.w; x++) {
        if (!FS.caveCellWalkable(gen, x, y)) continue;
        var s2 = tryAt(x, y);
        if (s2) return s2;
      }
    }
    return null;
  };

  FS.caveWorldFromGen = function (state, cave) {
    var gen = cave.gen;
    var flat = Object.create(null);
    for (var y = 0; y < gen.h; y++) {
      for (var x = 0; x < gen.w; x++) {
        var tt = gen.grid[y][x];
        flat[FS.key(x, y)] = FS.makeTile(x, y,
          tt === "cave_wall" ? "cave_wall" : (tt === "cave_exit" ? "cave_exit" : "cave_floor"),
          { biome: cave.theme });
      }
    }
    var world = {
      worldId: cave.id,
      seed: (state.worlds && state.worlds.surface && state.worlds.surface.seed) ||
        (state.world && state.world.seed) || 0,
      nest: { x: gen.exits[0] ? gen.exits[0].x : 5, y: gen.exits[0] ? gen.exits[0].y : 5 },
      chunks: { "0:0": { cx: 0, cy: 0, tiles: flat, type: "cave" } },
      tiles: flat,
      foods: [],
      landmarks: [],
      openOffers: [],
      buildings: [],
      woodNodes: [],
      generatorVersion: FS.GENERATOR_VERSION,
      caveId: cave.id,
      theme: cave.theme,
      isCave: true,
      minX: 0, maxX: gen.w - 1,
      minY: 0, maxY: gen.h - 1
    };
    (gen.resources || []).forEach(function (r) {
      world.landmarks.push({
        id: FS.uid(), kind: r.kind, x: r.x, y: r.y, amount: r.amount, name: r.kind,
        worldId: cave.id
      });
    });
    return world;
  };

  FS.getOrBuildCaveWorld = function (state, cave) {
    FS.ensureWorlds(state);
    if (state.worlds.caves[cave.id]) return state.worlds.caves[cave.id];
    var w = FS.caveWorldFromGen(state, cave);
    FS.registerCaveWorld(state, cave.id, w);
    return w;
  };

  FS.enterCave = function (state, portal) {
    var t0 = performance.now ? performance.now() : Date.now();
    var cave = state.caves.byId[portal.caveId];
    if (!cave || !cave.gen) return { ok: false, why: "Печеру не знайдено" };

    var spawn = FS.findCaveSpawn(cave.gen, portal.cavePos, state.player.body.length);
    if (!spawn) return { ok: false, why: "Немає місця для тіла в печері" };

    FS.ensureWorlds(state);
    if (!state.worlds.surface) FS.bindSurfaceWorld(state, state.world);

    // Sync surface mirrors before leaving
    state.worlds.surface.buildings = state.buildings || state.worlds.surface.buildings || [];
    state.worlds.surface.woodNodes = state.woodNodes || state.worlds.surface.woodNodes || [];

    state._surfaceSnap = {
      body: FS.cloneBody(state.player),
      dir: state.player.dir,
      requestedDir: state.player.requestedDir
    };

    var caveWorld = FS.getOrBuildCaveWorld(state, cave);
    var sw = FS.setActiveWorld(state, cave.id);
    if (!sw.ok) return sw;

    state.player.body = spawn.body;
    state.player.dir = spawn.dir;
    state.player.requestedDir = spawn.dir;
    state.player.standing = true;
    state.player.stepAcc = 0;
    if (state.input) FS.clearInput(state.input);

    // Compat: buildings pointer for cave (empty usually)
    state.buildings = caveWorld.buildings;
    state.woodNodes = caveWorld.woodNodes;

    state.ui.toast = "Ти в печері («" + cave.theme + "»). F — вихід.";
    state.tutorial.done.cave = true;
    if (FS.tickVision) FS.tickVision(state);
    state._saveTimer = 15;
    if (state.settings && state.settings.devCaveTiming) {
      state.ui.toast += " [" + Math.round((performance.now() - t0)) + "ms]";
    }
    return { ok: true, ms: (performance.now ? performance.now() : Date.now()) - t0 };
  };

  FS.exitCave = function (state, portal) {
    FS.ensureWorlds(state);
    if (!state.worlds.surface) {
      return { ok: false, why: "Немає поверхні (пошкоджений сейв — спробуй резервну копію)" };
    }
    var dest = (portal && portal.surface) || null;
    if (!dest && state.portals) {
      for (var i = 0; i < state.portals.length; i++) {
        if (state.portals[i].caveId === state.caveId && state.portals[i].surface) {
          dest = state.portals[i].surface;
          portal = state.portals[i];
          break;
        }
      }
    }
    if (!dest) return { ok: false, why: "Немає точки виходу на поверхню" };

    var len = state.player.body.length;
    var dirs = [
      { dir: "R", dx: -1, dy: 0 },
      { dir: "L", dx: 1, dy: 0 },
      { dir: "D", dx: 0, dy: -1 },
      { dir: "U", dx: 0, dy: 1 }
    ];
    var surf = state.worlds.surface;
    var chosen = null;
    for (var d = 0; d < dirs.length && !chosen; d++) {
      var trial = [];
      var ok = true;
      for (var i = 0; i < len; i++) {
        trial.push({ x: dest.x + dirs[d].dx * i, y: dest.y + dirs[d].dy * i });
      }
      for (i = 0; i < trial.length; i++) {
        var t = FS.tileAt(surf, trial[i].x, trial[i].y);
        if (!t || !FS.tileWalkable(t)) { ok = false; break; }
        var bHit = (surf.buildings || []).some(function (bb) {
          return bb.x === trial[i].x && bb.y === trial[i].y && FS.buildingBlocksFor(bb, state.player);
        });
        if (bHit) { ok = false; break; }
        var treeHit = (surf.woodNodes || []).some(function (n) {
          return n.kind === "tree" && n.x === trial[i].x && n.y === trial[i].y;
        });
        if (treeHit) { ok = false; break; }
      }
      if (!ok) continue;
      var enemyHit = (state.enemies || []).some(function (e) {
        if (e.dead || e.worldId && e.worldId !== FS.WORLD_SURFACE) return false;
        return e.body && e.body.some(function (c) {
          return trial.some(function (tr) { return tr.x === c.x && tr.y === c.y; });
        });
      });
      var allyHit = (state.allies || []).some(function (a) {
        if (a.dead || a.inside) return false;
        return a.body && a.body.some(function (c) {
          return trial.some(function (tr) { return tr.x === c.x && tr.y === c.y; });
        });
      });
      if (enemyHit || allyHit) continue;
      chosen = { body: trial, dir: dirs[d].dir };
    }
    if (!chosen) return { ok: false, why: "Вихід зайнятий або непрохідний — зачекай / розчисти" };

    FS.setActiveWorld(state, FS.WORLD_SURFACE);
    state.buildings = surf.buildings;
    state.woodNodes = surf.woodNodes;
    state.player.body = chosen.body;
    state.player.dir = chosen.dir;
    state.player.requestedDir = chosen.dir;
    state.player.standing = true;
    state.ui.toast = "Повернення на поверхню";
    state._saveTimer = 15;
    return { ok: true };
  };
})(window.FoxSerpent);
