/* FOX GENESIS — seeded world, biomes, fog, landmarks, POIs */
(function (FG) {
  "use strict";

  FG.biomeCenters = function () {
    var nestX = FG.WORLD_W * 0.5, nestY = FG.WORLD_H * 0.5;
    return [
      { biome: "grove", x: nestX, y: nestY, w: 0.92 },
      { biome: "swamp", x: nestX - 1100, y: nestY - 200, w: 1 },
      { biome: "crystal", x: nestX + 1100, y: nestY - 150, w: 1 },
      { biome: "roots", x: nestX - 200, y: nestY + 1150, w: 1 },
      { biome: "tide", x: nestX + 250, y: nestY - 1150, w: 1 }
    ];
  };

  /** One geography model for land, landmarks, enemies, water, hazards. */
  function biomeAt(x, y, seed) {
    var centers = FG.biomeCenters();
    var nest = centers[0];
    if (FG.dist(x, y, nest.x, nest.y) < 400) return "grove";
    var n = FG.hash2(Math.floor(x / 96), Math.floor(y / 96), seed);
    var best = "grove", bestD = Infinity;
    for (var i = 0; i < centers.length; i++) {
      var c = centers[i];
      var d = FG.dist(x, y, c.x, c.y) * c.w;
      d *= 0.9 + n * 0.2;
      if (c.biome === "grove") d *= 0.78;
      if (d < bestD) { bestD = d; best = c.biome; }
    }
    return best;
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
    var locations = [];
    var decor = [];

    landmarks.push({ id: "nest_heart", kind: "nest", x: nest.x, y: nest.y, r: 90, name: "Серце гнізда" });

    var biomeCenters = FG.biomeCenters();
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
      dens.push({
        id: "den_" + bc.biome,
        biome: bc.biome,
        x: bc.x + (rng() - 0.5) * 160,
        y: bc.y + (rng() - 0.5) * 160,
        boss: FG.BOSSES.filter(function (b) { return b.biome === bc.biome; })[0]
      });
    }

    // Stable decorative clusters (independent of render quality)
    for (var d = 0; d < 220; d++) {
      var dx = rng() * w, dy = rng() * h;
      var db = biomeAt(dx, dy, seed);
      decor.push({
        id: "d" + d, x: dx, y: dy, biome: db,
        kind: db === "grove" ? "tree" : (db === "swamp" ? "mushroom" : (db === "crystal" ? "crystal" : (db === "roots" ? "root" : "reed"))),
        n: rng(), scale: 0.7 + rng() * 0.8
      });
    }

    // food near start
    for (var f = 0; f < 14; f++) {
      var ang = rng() * Math.PI * 2;
      var rad = 80 + rng() * 220;
      resources.push({
        id: FG.uid(), kind: "fruit",
        x: nest.x + Math.cos(ang) * rad, y: nest.y + Math.sin(ang) * rad,
        amount: 4 + Math.floor(rng() * 4), biome: "grove"
      });
    }
    // First gene is biolume nearby — dashlegs unlocked at birth, not a duplicate quest sample
    resources.push({
      id: FG.uid(), kind: "gene_sample", gene: "biolume",
      x: nest.x + 180, y: nest.y - 120, amount: 1, biome: "grove"
    });
    resources.push({
      id: FG.uid(), kind: "gene_sample", gene: "needles",
      x: nest.x - 200, y: nest.y + 90, amount: 1, biome: "grove"
    });
    resources.push({
      id: FG.uid(), kind: "gene_sample", gene: "regen",
      x: nest.x + 40, y: nest.y + 210, amount: 1, biome: "grove"
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
        id: FG.uid(), kind: kind, gene: gene, x: rx, y: ry,
        amount: kind === "mineral" ? 2 + Math.floor(rng() * 4) : 3 + Math.floor(rng() * 5),
        biome: bio
      });
    }

    // Barriers with visible footprints — leave clear corridors from nest
    for (var b = 0; b < 36; b++) {
      var bx = rng() * w, by = rng() * h;
      if (FG.dist(bx, by, nest.x, nest.y) < 380) continue;
      var bb = biomeAt(bx, by, seed);
      if (bb === "roots" || bb === "crystal") {
        barriers.push({
          id: FG.uid(),
          kind: bb === "roots" ? "soil" : "rock",
          x: bx, y: by,
          w: 44 + rng() * 48, h: 26 + rng() * 28,
          needs: bb === "roots" ? "diggers" : "climbers"
        });
      }
    }

    // Water near tide landmark
    var tideC = biomeCenters.filter(function (c) { return c.biome === "tide"; })[0];
    for (var t = 0; t < 28; t++) {
      water.push({
        id: FG.uid(),
        x: tideC.x + (rng() - 0.5) * 700,
        y: tideC.y + (rng() - 0.5) * 550,
        r: 40 + rng() * 70,
        current: (rng() - 0.5) * 40
      });
    }
    // swamp pools
    var swampC = biomeCenters.filter(function (c) { return c.biome === "swamp"; })[0];
    for (var sw = 0; sw < 10; sw++) {
      water.push({
        id: FG.uid(),
        x: swampC.x + (rng() - 0.5) * 500,
        y: swampC.y + (rng() - 0.5) * 500,
        r: 30 + rng() * 40,
        current: 0,
        murky: true
      });
    }

    // Special locations (6 types)
    locations.push({
      id: FG.uid(), type: "cocoon", name: "Покинутий кокон",
      x: nest.x + 520, y: nest.y - 280, r: 55, biome: "grove",
      done: false, reward: "jaws", desc: "Обери один гарантований ген."
    });
    locations.push({
      id: FG.uid(), type: "garden_risk", name: "Заражений сад",
      x: swampC.x + 80, y: swampC.y - 120, r: 70, biome: "swamp",
      done: false, reward: "filter", risk: true, desc: "Багато їжі, але спори шкодять."
    });
    locations.push({
      id: FG.uid(), type: "hunt_ground", name: "Мисливська територія",
      x: nest.x - 600, y: nest.y + 100, r: 80, biome: "grove",
      done: false, elite: "dasher", reward: "spikes", desc: "Елітний хижак охороняє здобич."
    });
    var crystalC = biomeCenters.filter(function (c) { return c.biome === "crystal"; })[0];
    locations.push({
      id: FG.uid(), type: "mineral_rift", name: "Мінеральна ущелина",
      x: crystalC.x - 100, y: crystalC.y + 80, r: 60, biome: "crystal",
      done: false, rewardMineral: 14, desc: "Альтернативний шлях за мінералами."
    });
    var rootsC = biomeCenters.filter(function (c) { return c.biome === "roots"; })[0];
    locations.push({
      id: FG.uid(), type: "sleeper", name: "Сплячий організм",
      x: rootsC.x + 60, y: rootsC.y - 90, r: 65, biome: "roots",
      done: false, reward: "vibesense", desc: "F — обережно розбудити / вивчити."
    });
    locations.push({
      id: FG.uid(), type: "outpost", name: "Захоплювана галявина",
      x: nest.x + 380, y: nest.y + 520, r: 90, biome: "grove",
      done: false, claimable: true, desc: "Другий форпост для колонії."
    });

    var explored = Object.create(null);
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
      locations: locations,
      decor: decor,
      explored: explored,
      fogTile: tile,
      time: 0,
      eventCd: 90,
      activeEvents: [],
      tidePhase: 0,
      eco: { herb: 40, pred: 18, plants: 60 },
      journal: [{ t: 0, text: "Ти прокинувся в Світному лісі. Світ дихає." }]
    };
  };

  FG.biomeAtWorld = function (world, x, y) {
    return biomeAt(x, y, world.seed);
  };

  FG.verifyBiomeLandmarks = function (seed) {
    var world = FG.generateWorld(seed);
    var bad = [];
    world.landmarks.forEach(function (l) {
      if (l.kind !== "landmark" || !l.biome) return;
      var at = biomeAt(l.x, l.y, seed);
      if (at !== l.biome) bad.push({ id: l.id, expect: l.biome, got: at });
    });
    return { ok: bad.length === 0, bad: bad, seed: seed };
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

  /** Currently visible around a point (not the same as map memory). */
  FG.isVisibleNow = function (state, x, y, radius) {
    radius = radius || 220;
    return FG.dist(x, y, state.player.x, state.player.y) < radius + (state.player._lume > 0 ? 100 : 0);
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
    return true;
  };

  FG.addJournal = function (world, text) {
    world.journal.unshift({ t: world.time, text: text });
    if (world.journal.length > 40) world.journal.length = 40;
  };
})(window.FoxGenesis);
