/* FOX SERPENT — save / backup / export / migration */
(function (FS) {
  "use strict";

  FS.serializeState = function (state) {
    // Keep surface mirrors in sync before pack
    if (FS.ensureWorlds) {
      FS.ensureWorlds(state);
      if (state.worlds.surface) {
        if (state.activeWorldId === "surface" || state.layerId !== "cave") {
          state.worlds.surface.buildings = state.buildings || state.worlds.surface.buildings;
          state.worlds.surface.woodNodes = state.woodNodes || state.worlds.surface.woodNodes;
        }
      } else if (state.world) {
        FS.bindSurfaceWorld(state, state.world);
      }
    }
    var worlds = FS.serializeWorlds ? FS.serializeWorlds(state) : null;
    var surface = worlds && worlds.surface;
    // Legacy `world` field = surface always (never the active cave)
    var worldPack = surface || {
      tiles: state.world.tiles,
      foods: state.world.foods,
      landmarks: state.world.landmarks || [],
      nest: state.world.nest,
      chunks: state.world.chunks,
      minX: state.world.minX, maxX: state.world.maxX,
      minY: state.world.minY, maxY: state.world.maxY,
      openOffers: state.world.openOffers
    };
    return {
      schema: FS.SAVE_SCHEMA,
      migrationVersion: FS.MIGRATION_VERSION,
      rev: (state.saveRev || 0) + 1,
      version: FS.VERSION,
      seed: (surface && surface.seed) || state.world.seed,
      time: state.time,
      nutrition: FS.nutritionOf(state),
      wood: state.wood || 0,
      woodCap: state.woodCap || 12,
      materials: state.materials || null,
      specialization: state.specialization || null,
      buildings: (surface && surface.buildings) || state.buildings || [],
      woodNodes: (surface && surface.woodNodes) || state.woodNodes || [],
      pantry: state.pantry || null,
      settlement: state.settlement || null,
      layerId: state.layerId || "surface",
      caveId: state.caveId || null,
      activeWorldId: state.activeWorldId || "surface",
      cavesMeta: state.caves ? { list: state.caves.list.map(function (c) {
        return {
          id: c.id, theme: c.theme, cx: c.cx, cy: c.cy,
          surface: c.surface, gen: c.gen, knownExits: c.knownExits || 0,
          genVersion: (c.gen && c.gen.genVersion) || FS.CAVE_GEN_VERSION || 2
        };
      }) } : null,
      enemyBases: state.enemyBases || null,
      mine: state.mine || null,
      weapons: state.weapons || null,
      portals: state.portals || null,
      layers: state.layers || null,
      worlds: worlds,
      world: {
        tiles: worldPack.tiles,
        foods: worldPack.foods || [],
        materials: [],
        landmarks: worldPack.landmarks || [],
        nest: worldPack.nest,
        chunks: worldPack.chunks,
        minX: worldPack.minX, maxX: worldPack.maxX,
        minY: worldPack.minY, maxY: worldPack.maxY,
        openOffers: worldPack.openOffers || [],
        seed: worldPack.seed
      },
      foodDirector: FS.serializeFoodDirector ? FS.serializeFoodDirector(state) : null,
      farms: FS.serializeFarms ? FS.serializeFarms(state) : null,
      alliesData: FS.serializeAllies ? FS.serializeAllies(state) : null,
      stations: state.stations || null,
      generatorVersion: (surface && surface.generatorVersion) || state.world.generatorVersion || FS.GENERATOR_VERSION,
      player: {
        body: state.player.body,
        dir: state.player.dir,
        growthDebt: state.player.growthDebt,
        foodsEaten: state.player.foodsEaten
      },
      enemies: state.enemies.filter(function (e) { return !e.dead; }).map(function (e) {
        return {
          id: e.id, name: e.name, arch: e.arch, body: e.body, dir: e.dir,
          growthDebt: e.growthDebt, stepPeriod: e.stepPeriod, color: e.color,
          home: e.home, detectRange: e.detectRange, worldId: e.worldId || "surface",
          loot: e.loot || null,
          raidTarget: e.raidTarget || null,
          knowsFarm: !!e.knowsFarm,
          memoryFarms: e.memoryFarms || null,
          memoryGaps: e.memoryGaps || null,
          intel: e.intel || null,
          _breakCd: e._breakCd || 0,
          stateAI: e.stateAI || null
        };
      }),
      xp: state.xp,
      talentLevel: state.talentLevel,
      talents: state.talents,
      tutorial: state.tutorial,
      progress: state.progress,
      settings: state.settings
    };
  };

  FS.validateSave = function (data) {
    if (!data || typeof data !== "object") return "Порожньо";
    if (data.schema !== 1 && data.schema !== 2) return "Чужа схема";
    if (!data.world || !data.player || !data.talents) return "Неповні дані";
    if (typeof data.seed !== "number") return "Поганий seed";
    if (data.talents.hearts < 0) return "Погані серця";
    return null;
  };

  FS.readSnap = function (raw) {
    if (!raw) return { ok: false, why: "немає" };
    try {
      var data = JSON.parse(raw);
      var err = FS.validateSave(data);
      if (err) return { ok: false, why: err };
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, why: "Пошкоджений JSON" };
    }
  };

  FS.loadBest = function () {
    var a = null, b = null;
    try { a = localStorage.getItem(FS.SAVE_KEY); } catch (e1) {}
    try { b = localStorage.getItem(FS.SAVE_BAK); } catch (e2) {}
    var pa = FS.readSnap(a), pb = FS.readSnap(b);
    if (pa.ok && pb.ok) return (pa.data.rev || 0) >= (pb.data.rev || 0) ? pa : pb;
    if (pa.ok) return pa;
    if (pb.ok) return pb;
    if (!a && !b) return { ok: false, why: "Немає збереження" };
    return { ok: false, why: pa.why || pb.why || "Пошкоджене збереження" };
  };

  FS.applySave = function (state, data) {
    // Backup before migration
    if ((data.migrationVersion || 0) < FS.MIGRATION_VERSION) {
      try {
        localStorage.setItem(FS.SAVE_BAK, JSON.stringify(data));
      } catch (e) {}
      data = FS.migrateEconomy(data);
      if (FS.migrateBases) data = FS.migrateBases(data);
      state.ui.toast = data.migrationNote || "Сейв оновлено";
    }

    state.saveRev = data.rev || 1;
    state.time = data.time || 0;
    state.wood = data.wood != null ? data.wood : 0;
    state.woodCap = data.woodCap || 12;
    state.materials = data.materials || (FS.defaultMaterials ? FS.defaultMaterials() : {});
    if (FS.ensureMaterials) FS.ensureMaterials(state);
    state.specialization = data.specialization || null;
    state.stations = data.stations || [];
    state.enemyBases = data.enemyBases || [];
    state.mine = data.mine || null;
    state.weapons = data.weapons || null;
    state.pantry = data.pantry || { food: 0, cap: 12, level: 1, reserve: 0 };
    state.settlement = data.settlement || null;
    state.portals = data.portals || [];
    state.layers = data.layers || null;
    state.caves = { list: [], byId: Object.create(null) };
    if (data.cavesMeta && data.cavesMeta.list) {
      data.cavesMeta.list.forEach(function (c) {
        state.caves.list.push(c);
        state.caves.byId[c.id] = c;
      });
    } else if (data.caves && data.caves.list) {
      // 1.5 legacy caves object
      data.caves.list.forEach(function (c) {
        state.caves.list.push(c);
        state.caves.byId[c.id] = c;
      });
    }
    // Worlds: prefer multi-world pack; migrate 1.5 cave-stuck saves
    if (data.worlds && data.worlds.surface) {
      FS.applyWorlds(state, data.worlds);
    } else {
      state.world = data.world;
      state.world.seed = data.seed;
      state.world.landmarks = state.world.landmarks || [];
      state.buildings = data.buildings || [];
      state.woodNodes = data.woodNodes || [];
      if (FS.bindSurfaceWorld) FS.bindSurfaceWorld(state, state.world);
      if ((data.layerId === "cave" || data.activeWorldId && data.activeWorldId !== "surface") && !data.worlds) {
        state._surfaceMissing = true;
        state.ui.toast = "Увага: сейв у печері без окремої поверхні — відновлено з доступного знімка";
        // Force surface; player may be misplaced but progress kept
        if (FS.setActiveWorld) FS.setActiveWorld(state, "surface");
      }
    }
    state.layerId = state.layerId || data.layerId || "surface";
    state.caveId = state.caveId || data.caveId || null;
    state.activeWorldId = state.activeWorldId || data.activeWorldId || "surface";
    if (FS.ensureSettlement) FS.ensureSettlement(state);
    if (FS.migrateCampfireIfNeeded) FS.migrateCampfireIfNeeded(state);
    // Rehydrate cave.gen if missing (deterministic from seed+id+theme)
    if (state.caves && state.caves.list && FS.generateCaveGrid) {
      var surfSeed = (state.worlds && state.worlds.surface && state.worlds.surface.seed) || data.seed;
      state.caves.list.forEach(function (c) {
        if (!c.gen && c.theme) {
          c.gen = FS.generateCaveGrid(surfSeed, c.id, c.theme);
        }
        state.caves.byId[c.id] = c;
      });
    }
    state.buildMode = null;
    if (!state.world) state.world = data.world;
    state.player = FS.createPlayerSnake(state.world.nest);
    state.player.body = data.player.body;
    state.player.growthDebt = data.player.growthDebt || 0;
    state.player.foodsEaten = data.player.foodsEaten || 0;
    if (state.player.body && state.player.body.length >= 2) FS.syncDirFromBody(state.player);
    else {
      state.player.dir = data.player.dir || "R";
      state.player.requestedDir = state.player.dir;
    }
    state.player.visualT = 1;
    state.enemies = (data.enemies || []).map(function (e) {
      var s = FS.createSnake(e);
      Object.assign(s, e);
      s.dead = false;
      s.requestedDir = s.dir;
      if (s.body && s.body.length >= 2) FS.syncDirFromBody(s);
      FS.capEnemyLength(s);
      s.visualT = 1;
      return s;
    });
    state.nutrition = data.nutrition != null ? data.nutrition : FS.clamp((data.player.body.length || 3) - 3, 0, 9);
    FS.syncLengthToNutrition(state);
    state.xp = data.xp || 0;
    state.talentLevel = data.talentLevel || 1;
    state.talents = data.talents;
    state.tutorial = data.tutorial || { done: {} };
    state.progress = data.progress || { regionBonus: {} };
    if (data.settings) state.settings = Object.assign(state.settings, data.settings);
    FS.applyFoodDirector(state, data.foodDirector);
    if (FS.applyFarms) FS.applyFarms(state, data.farms);
    if (FS.applyAllies) FS.applyAllies(state, data.alliesData);
    FS.recomputeEffects(state);
    if (FS.applySpecEffects) FS.applySpecEffects(state);
    if (FS.hydrateStationsFromBuildings) FS.hydrateStationsFromBuildings(state);
    if (FS.migrateWoodIfNeeded) FS.migrateWoodIfNeeded(state);
    if (FS.migrateFarmFoodIfNeeded) FS.migrateFarmFoodIfNeeded(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    if (FS.recomputeWoodCap) FS.recomputeWoodCap(state);
    state.paused = false;
    state.pauseReasons = { manual: false, panel: false, blur: false, guide: false };
    // One-time specialization for old saves (defer UI to avoid pause during tests)
    if (!state.specialization && FS.openSpecPicker && typeof document !== "undefined" &&
        document.getElementById && document.getElementById("panel")) {
      state._needSpecPick = true;
    }
  };

  FS.saveGame = function (state, reason) {
    try {
      var snap = FS.serializeState(state);
      var err = FS.validateSave(snap);
      if (err) throw new Error(err);
      var json = JSON.stringify(snap);
      var prev = null;
      try { prev = localStorage.getItem(FS.SAVE_KEY); } catch (e1) {}
      if (prev) {
        try { localStorage.setItem(FS.SAVE_BAK, prev); } catch (e2) {}
      }
      try {
        localStorage.setItem(FS.SAVE_KEY, json);
        state.saveRev = snap.rev;
        state.saveStatus = "ok";
        return { ok: true };
      } catch (e3) {
        state.saveStatus = "unavailable";
        return { ok: false, why: "Сховище недоступне — експорт", data: snap };
      }
    } catch (e) {
      state.saveStatus = "error";
      return { ok: false, why: String(e.message || e) };
    }
  };

  FS.loadGame = function (state) {
    var best = FS.loadBest();
    if (!best.ok) return best;
    FS.applySave(state, best.data);
    return { ok: true, migrated: (best.data.migrationVersion || 0) >= 2 };
  };

  FS.exportSave = function (state) {
    var snap = FS.serializeState(state);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }));
    a.download = "fox-serpent-evolution.json";
    a.click();
  };

  FS.importSave = function (state, file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var parsed = FS.readSnap(r.result);
      if (!parsed.ok) { cb(parsed); return; }
      FS.applySave(state, parsed.data);
      FS.saveGame(state, "import");
      cb({ ok: true });
    };
    r.readAsText(file);
  };
})(window.FoxSerpent);
