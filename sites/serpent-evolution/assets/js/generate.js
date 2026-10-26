/* FOX SERPENT — procedural chunk generation (seed + coords → stable base) */
(function (FS) {
  "use strict";

  FS.hash2 = function (a, b) {
    var h = ((a | 0) * 374761393) ^ ((b | 0) * 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  };

  FS.edgeGateHash = function (seed, cx, cy, edge) {
    // Shared edge between neighbors uses min/max so both sides agree
    var ax = cx, ay = cy, bx = cx, by = cy;
    if (edge === "E") { bx = cx + 1; }
    if (edge === "W") { ax = cx - 1; bx = cx; }
    if (edge === "S") { by = cy + 1; }
    if (edge === "N") { ay = cy - 1; by = cy; }
    return FS.hash2(seed, FS.hash2(ax * 31 + ay, bx * 17 + by + edge.charCodeAt(0)));
  };

  FS.pickRegionType = function (seed, cx, cy, nOpen, offerIndex, forceSafe) {
    if (forceSafe || (cx === 0 && cy === 0)) return "garden";
    var rng = FS.mulberry32(FS.hash2(seed, cx * 10007 + cy * 10009 + (offerIndex || 0) * 13));
    var weights = [
      { id: "meadow", w: 22 },
      { id: "thicket", w: 18 },
      { id: "rocky", w: 14 },
      { id: "shore", w: 14 },
      { id: "corridor", w: 10 },
      { id: "elder", w: nOpen > 2 ? 8 : 2 }
    ];
    // Guarantee early option is affordable/safe-ish
    if (nOpen <= 1 && offerIndex === 0) {
      return rng() < 0.55 ? "meadow" : "thicket";
    }
    var total = 0;
    weights.forEach(function (w) { total += w.w; });
    var r = rng() * total, acc = 0;
    for (var i = 0; i < weights.length; i++) {
      acc += weights[i].w;
      if (r <= acc) return weights[i].id;
    }
    return "meadow";
  };

  FS.edgeGates = function (seed, cx, cy) {
    function gates(edge) {
      var h = FS.edgeGateHash(seed, cx, cy, edge);
      var a = 3 + (h % 3);
      var b = 7 + ((h >>> 8) % 3);
      return [a, b];
    }
    return { N: gates("N"), E: gates("E"), S: gates("S"), W: gates("W") };
  };

  FS.carvePath = function (grid, x0, y0, x1, y1, tt) {
    var x = x0, y = y0;
    var guard = 80;
    while ((x !== x1 || y !== y1) && guard--) {
      grid[y][x] = tt || "path";
      if (x !== x1 && (Math.abs(x - x1) >= Math.abs(y - y1) || y === y1)) x += x1 > x ? 1 : -1;
      else if (y !== y1) y += y1 > y ? 1 : -1;
    }
    grid[y1][x1] = tt || "path";
  };

  FS.generateChunkGrid = function (seed, cx, cy, typeId, isStart) {
    var type = FS.REGION_TYPES[typeId] || FS.REGION_TYPES.garden;
    var rng = FS.mulberry32(FS.hash2(seed ^ FS.GENERATOR_VERSION, cx * 7919 + cy * 7537));
    var n = FS.CHUNK;
    var grid = [];
    var i, j;
    for (j = 0; j < n; j++) {
      grid[j] = [];
      for (i = 0; i < n; i++) grid[j][i] = "meadow";
    }

    var gates = FS.edgeGates(seed, cx, cy);
    // Fill base by region
    for (j = 0; j < n; j++) {
      for (i = 0; i < n; i++) {
        var r = rng();
        if (typeId === "shore" && j > n - 4) grid[j][i] = r < 0.55 ? "deep" : "shallow";
        else if (typeId === "rocky" && r < 0.28) grid[j][i] = "stone";
        else if (typeId === "corridor" && j !== 5 && j !== 6 && i > 1 && i < n - 2 && r < 0.5) grid[j][i] = "stone";
        else if (typeId === "thicket" && r < 0.35) grid[j][i] = "thicket";
        else if (r < 0.12) grid[j][i] = "soil";
        else if (r < 0.18) grid[j][i] = "fertile";
        else if (r < 0.22) grid[j][i] = "mud";
        else grid[j][i] = "meadow";
      }
    }

    // Corridor spine + loops
    var mid = Math.floor(n / 2);
    FS.carvePath(grid, gates.W[0], mid, gates.E[0], mid, "path");
    FS.carvePath(grid, mid, gates.N[0], mid, gates.S[0], "path");
    // Extra loop for snake-12
    FS.carvePath(grid, 2, 2, n - 3, 2, "path");
    FS.carvePath(grid, n - 3, 2, n - 3, n - 3, "path");
    FS.carvePath(grid, n - 3, n - 3, 2, n - 3, "path");
    FS.carvePath(grid, 2, n - 3, 2, 2, "path");

    // Open edge gates
    gates.N.forEach(function (g) { grid[0][g] = "path"; grid[1][g] = "path"; });
    gates.S.forEach(function (g) { grid[n - 1][g] = "path"; grid[n - 2][g] = "path"; });
    gates.W.forEach(function (g) { grid[g][0] = "path"; grid[g][1] = "path"; });
    gates.E.forEach(function (g) { grid[g][n - 1] = "path"; grid[g][n - 2] = "path"; });

    // Water pocket + optional bridge site
    if (typeId === "shore" || (!isStart && rng() < 0.35)) {
      var wx = 3 + Math.floor(rng() * 4), wy = 3 + Math.floor(rng() * 4);
      for (j = wy; j < wy + 3; j++) for (i = wx; i < wx + 4; i++) {
        if (i > 0 && j > 0 && i < n - 1 && j < n - 1) grid[j][i] = j === wy + 1 ? "shallow" : "deep";
      }
      grid[wy + 1][wx + 1] = "bridge";
      grid[wy + 1][wx + 2] = "bridge";
    }

    // Fertile clearing for farm
    var fx = 3 + Math.floor(rng() * 5), fy = 3 + Math.floor(rng() * 5);
    if (isStart) { fx = 8; fy = 3; }
    for (j = fy; j < fy + 2; j++) for (i = fx; i < fx + 2; i++) {
      if (i < n - 1 && j < n - 1) grid[j][i] = "fertile";
    }

    if (isStart) {
      // Clear nest ring
      for (j = 4; j <= 6; j++) for (i = 4; i <= 7; i++) grid[j][i] = "path";
      grid[5][5] = "meadow";
      grid[8][3] = "fertile";
      grid[8][4] = "fertile";
      grid[9][3] = "soil";
    }

    // Connectivity repair: flood from center, convert unreachable stones adjacent to path
    var walk = function (tt) {
      var d = FS.TILE_TYPES[tt];
      return d && d.walk;
    };
    var seen = {};
    var q = [[mid, mid]];
    seen[mid + "," + mid] = 1;
    if (!walk(grid[mid][mid])) grid[mid][mid] = "path";
    while (q.length) {
      var c = q.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = c[0] + d[0], ny = c[1] + d[1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) return;
        var k = nx + "," + ny;
        if (seen[k]) return;
        if (!walk(grid[ny][nx])) return;
        seen[k] = 1;
        q.push([nx, ny]);
      });
    }

    var poi = null;
    if (!isStart) {
      var kinds = ["spring", "ruin", "bridge_site", "rival", "reward_glade", "fertile_garden"];
      var pk = kinds[Math.floor(rng() * kinds.length)];
      if (typeId === "elder") pk = "rival";
      if (typeId === "shore") pk = rng() < 0.5 ? "spring" : "bridge_site";
      poi = { kind: pk, lx: fx, ly: fy };
    } else {
      poi = { kind: "fertile_garden", lx: 8, ly: 3 };
    }

    return {
      grid: grid,
      gates: gates,
      poi: poi,
      farmSpot: { x: fx, y: fy },
      typeId: typeId,
      generatorVersion: FS.GENERATOR_VERSION
    };
  };

  FS.applyGeneratedChunk = function (world, cx, cy, typeId, isStart) {
    var baseX = cx * FS.CHUNK, baseY = cy * FS.CHUNK;
    var id = cx + ":" + cy;
    if (world.chunks[id] && world.chunks[id].locked) return world.chunks[id];

    var gen = FS.generateChunkGrid(world.seed, cx, cy, typeId, isStart);
    var type = FS.REGION_TYPES[typeId] || FS.REGION_TYPES.garden;
    var chunk = {
      id: id, cx: cx, cy: cy, type: typeId, name: type.name,
      danger: type.danger, opened: true, palette: type.palette || "warm",
      generatorVersion: gen.generatorVersion,
      farmSpot: { x: baseX + gen.farmSpot.x, y: baseY + gen.farmSpot.y },
      locked: true
    };

    for (var y = 0; y < FS.CHUNK; y++) {
      for (var x = 0; x < FS.CHUNK; x++) {
        var tt = gen.grid[y][x];
        FS.setTile(world, baseX + x, baseY + y, FS.makeTile(baseX + x, baseY + y, tt, {
          biome: typeId, moss: ((x * 13 + y * 7) % 10) / 10
        }));
      }
    }

    world.chunks[id] = chunk;
    world.minX = Math.min(world.minX, baseX);
    world.maxX = Math.max(world.maxX, baseX + FS.CHUNK - 1);
    world.minY = Math.min(world.minY, baseY);
    world.maxY = Math.max(world.maxY, baseY + FS.CHUNK - 1);

    // POI landmark
    if (gen.poi) {
      var names = {
        spring: "Джерело води",
        ruin: "Покинута ділянка",
        bridge_site: "Місце під міст",
        rival: "Територія суперника",
        reward_glade: "Галявина нагороди",
        fertile_garden: "Родючий сад"
      };
      world.landmarks = world.landmarks || [];
      world.landmarks.push({
        id: FS.uid(), kind: gen.poi.kind, chunkId: id,
        x: baseX + gen.poi.lx, y: baseY + gen.poi.ly,
        name: names[gen.poi.kind] || gen.poi.kind,
        done: false, cost: gen.poi.kind === "ruin" ? 2 : 0, xp: 1
      });
    }

    if (isStart) {
      world.landmarks = world.landmarks || [];
      world.landmarks.push({
        id: FS.uid(), kind: "bush", chunkId: id,
        x: world.nest.x + 4, y: world.nest.y + 2,
        name: "Плодовий кущ", done: false
      });
      world.landmarks.push({
        id: FS.uid(), kind: "drop_pad", chunkId: id,
        x: world.nest.x, y: world.nest.y + 1,
        name: "Майданчик видачі", done: false
      });
    }

    return chunk;
  };
})(window.FoxSerpent);
