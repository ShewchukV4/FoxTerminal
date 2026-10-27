/* FOX SERPENT — save / backup / export / migration */
(function (FS) {
  "use strict";

  FS.serializeState = function (state) {
    return {
      schema: FS.SAVE_SCHEMA,
      migrationVersion: FS.MIGRATION_VERSION,
      rev: (state.saveRev || 0) + 1,
      version: FS.VERSION,
      seed: state.world.seed,
      time: state.time,
      nutrition: FS.nutritionOf(state),
      wood: state.wood || 0,
      woodCap: state.woodCap || 12,
      buildings: state.buildings || [],
      woodNodes: state.woodNodes || [],
      pantry: state.pantry || null,
      world: {
        tiles: state.world.tiles,
        foods: state.world.foods,
        materials: [],
        landmarks: state.world.landmarks || [],
        nest: state.world.nest,
        chunks: state.world.chunks,
        minX: state.world.minX, maxX: state.world.maxX,
        minY: state.world.minY, maxY: state.world.maxY,
        openOffers: state.world.openOffers
      },
      foodDirector: FS.serializeFoodDirector ? FS.serializeFoodDirector(state) : null,
      farms: FS.serializeFarms ? FS.serializeFarms(state) : null,
      alliesData: FS.serializeAllies ? FS.serializeAllies(state) : null,
      generatorVersion: state.world.generatorVersion || FS.GENERATOR_VERSION,
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
          home: e.home, detectRange: e.detectRange
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
    state.world = data.world;
    state.world.seed = data.seed;
    state.world.landmarks = state.world.landmarks || [];
    state.world.materials = [];
    state.wood = data.wood != null ? data.wood : 0;
    state.woodCap = data.woodCap || 12;
    state.buildings = data.buildings || [];
    state.woodNodes = data.woodNodes || [];
    state.pantry = data.pantry || { food: 0, cap: 12, level: 1, reserve: 0 };
    state.buildMode = null;
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
    if (FS.migrateWoodIfNeeded) FS.migrateWoodIfNeeded(state);
    if (FS.migrateFarmFoodIfNeeded) FS.migrateFarmFoodIfNeeded(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    if (FS.recomputeWoodCap) FS.recomputeWoodCap(state);
    state.paused = false;
    state.pauseReasons = { manual: false, panel: false, blur: false, guide: false };
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
