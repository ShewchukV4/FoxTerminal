/* FOX GENESIS — seeded world, biomes, fog, landmarks */
(function (FG) {
  "use strict";

  function biomeAt(x, y, seed) {
    var nx = x / FG.WORLD_W;
    var ny = y / FG.WORLD_H;
    var cx = 0.5, cy = 0.5;
    var d = Math.sqrt((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy));
    var a = Math.atan2(ny - cy, nx - cx);
    var n = FG.hash2(Math.floor(x / 90), Math.floor(y / 90), seed);
    if (d < 0.22 + n * 0.04) return "grove";
    var sector = ((a + Math.PI) / (Math.PI * 2)) * 4;
    var idx = Math.floor(sector) % 4;
    var ids = ["swamp", "crystal", "roots", "tide"];
    if (d > 0.72 && n > 0.55) return ids[(idx + 1) % 4];
    return ids[idx];
  }

  FG.generateWorld = function (seed) {
    seed = (seed >>> 0) || (Date.now() >>> 0);
    var rng = FG.mulberry32(seed);
    var w = FG.WORLD_W, h = FG.WORLD_H;
    var nest = { x: w * 0.5, y: h * 0.5 };
    var landmarks = [];
    var resources = [];
    var barriers = [];
    var water = [];
    var dens = [];

    landmarks.push({ id: "nest_heart", kind: "nest", x: nest.x, y: nest.y, r: 90, name: "Серце гнізда" });

    var biomeCenters = [
      { biome: "grove", x: nest.x, y: nest.y },
      { biome: "swamp", x: nest.x - 1100, y: nest.y - 200 },
      { biome: "crystal", x: nest.x + 1100, y: nest.y - 150 },
      { biome: "roots", x: nest.x - 200, y: nest.y + 1150 },
      { biome: "tide", x: nest.x + 250, y: nest.y - 1150 }
    ];

    for (var i = 0; i < biomeCenters.length; i++) {
      var bc = biomeCenters[i];
      landmarks.push({
        id: "mark_" + bc.biome,
        kind: "landmark",
        biome: bc.biome,
        x: bc.x,
        y: bc.y,
        r: 40,
        name: FG.BIOMES[bc.biome].name
      });
      if (bc.biome !== "grove") {
        dens.push({
          id: "den_" + bc.biome,
          biome: bc.biome,
          x: bc.x + (rng() - 0.5) * 200,
          y: bc.y + (rng() - 0.5) * 200,
          boss: FG.BOSSES.filter(function (b) { return b.biome === bc.biome; })[0]
        });
      }
    }

    // food near start (tutorial guarantee)
    for (var f = 0; f < 14; f++) {
      var ang = rng() * Math.PI * 2;
      var rad = 80 + rng() * 220;
      resources.push({
        id: FG.uid(),
        kind: "fruit",
        x: nest.x + Math.cos(ang) * rad,
        y: nest.y + Math.sin(ang) * rad,
        amount: 4 + Math.floor(rng() * 4),
        biome: "grove"
      });
    }
    // first mutation sample nearby
    resources.push({
      id: FG.uid(),
      kind: "gene_sample",
      gene: "dashlegs",
      x: nest.x + 180,
      y: nest.y - 120,
      amount: 1,
      biome: "grove"
    });
    resources.push({
      id: FG.uid(),
      kind: "gene_sample",
      gene: "biolume",
      x: nest.x - 160,
      y: nest.y + 140,
      amount: 1,
      biome: "grove"
    });

    for (var r = 0; r < 120; r++) {
      var rx = rng() * w, ry = rng() * h;
      if (FG.dist(rx, ry, nest.x, nest.y) < 260) continue;
      var bio = biomeAt(rx, ry, seed);
      var kind = rng() < 0.12 ? "mineral" : (rng() < 0.08 ? "gene_sample" : "fruit");
      var gene = null;
      if (kind === "gene_sample") {
        var pool = Object.keys(FG.ORGANS).filter(function (k) {
          var o = FG.ORGANS[k];
          return !o.late && !o.starter;
        });
        gene = pool[Math.floor(rng() * pool.length)];
      }
      resources.push({
        id: FG.uid(),
        kind: kind,
        gene: gene,
        x: rx,
        y: ry,
        amount: kind === "mineral" ? 2 + Math.floor(rng() * 4) : 3 + Math.floor(rng() * 5),
        biome: bio
      });
    }

    for (var b = 0; b < 40; b++) {
      var bx = rng() * w, by = rng() * h;
      if (FG.dist(bx, by, nest.x, nest.y) < 320) continue;
      var bb = biomeAt(bx, by, seed);
      if (bb === "roots" || bb === "crystal") {
        barriers.push({
          id: FG.uid(),
          kind: bb === "roots" ? "soil" : "rock",
          x: bx,
          y: by,
          w: 40 + rng() * 50,
          h: 24 + rng() * 30,
          needs: bb === "roots" ? "diggers" : "climbers"
        });
      }
    }

    for (var t = 0; t < 25; t++) {
      water.push({
        id: FG.uid(),
        x: nest.x + 250 + (rng() - 0.5) * 2200,
        y: nest.y - 1150 + (rng() - 0.5) * 500,
        r: 40 + rng() * 70,
        current: (rng() - 0.5) * 40
      });
    }

    var explored = Object.create(null);
    // reveal nest area
    var tile = 64;
    for (var tx = -8; tx <= 8; tx++) {
      for (var ty = -8; ty <= 8; ty++) {
        explored[Math.floor(nest.x / tile + tx) + "," + Math.floor(nest.y / tile + ty)] = 1;
      }
    }

    return {
      seed: seed,
      nest: nest,
      landmarks: landmarks,
      resources: resources,
      barriers: barriers,
      water: water,
      dens: dens,
      explored: explored,
      fogTile: tile,
      time: 0,
      eventCd: 90,
      activeEvents: [],
      tidePhase: 0,
      journal: [{ t: 0, text: "Ти прокинувся в Світному лісі. Світ дихає." }]
    };
  };

  FG.biomeAtWorld = function (world, x, y) {
    return biomeAt(x, y, world.seed);
  };

  FG.revealFog = function (world, x, y, radius) {
    var tile = world.fogTile;
    var r = Math.ceil((radius || 180) / tile);
    var cx = Math.floor(x / tile), cy = Math.floor(y / tile);
    for (var i = -r; i <= r; i++) {
      for (var j = -r; j <= r; j++) {
        if (i * i + j * j <= r * r + 1) world.explored[cx + i + "," + (cy + j)] = 1;
      }
    }
  };

  FG.isExplored = function (world, x, y) {
    var tile = world.fogTile;
    return !!world.explored[Math.floor(x / tile) + "," + Math.floor(y / tile)];
  };

  FG.passable = function (world, body, x, y) {
    var bio = FG.biomeAtWorld(world, x, y);
    for (var i = 0; i < world.barriers.length; i++) {
      var b = world.barriers[i];
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) {
        if (!FG.hasOrgans(body, [b.needs])) return false;
      }
    }
    if (bio === "tide") {
      var inWater = false;
      for (var w = 0; w < world.water.length; w++) {
        var wt = world.water[w];
        if (FG.dist(x, y, wt.x, wt.y) < wt.r) { inWater = true; break; }
      }
      if (inWater && !FG.hasOrgans(body, ["membrane"]) && world.tidePhase > 0.55) {
        return "slow";
      }
    }
    if (bio === "swamp" && !FG.hasOrgans(body, ["filter"])) {
      var n = FG.hash2(Math.floor(x / 60), Math.floor(y / 60), world.seed + 9);
      if (n > 0.82) return "toxic";
    }
    // filter organ or temporary filter buff skips toxin via hasOrgans above
    return true;
  };

  FG.addJournal = function (world, text) {
    world.journal.unshift({ t: world.time, text: text });
    if (world.journal.length > 40) world.journal.length = 40;
  };
})(window.FoxGenesis);
