/* FOX GENESIS — autosave, export/import, backup revision */
(function (FG) {
  "use strict";

  var KEY = "fox_genesis_save_v1";
  var KEY_BAK = "fox_genesis_save_bak_v1";

  FG.serializeState = function (state) {
    return {
      schema: FG.SAVE_SCHEMA,
      rev: (state.saveRev || 0) + 1,
      version: FG.VERSION,
      seed: state.world.seed,
      time: state.world.time,
      generation: state.generation,
      deaths: state.deaths || 0,
      resources: state.resources,
      genes: state.genes,
      player: {
        x: state.player.x,
        y: state.player.y,
        hp: state.player.hp,
        energy: state.player.energy,
        body: state.player.body,
        carrying: state.player.carrying
      },
      colony: {
        buildings: state.colony.buildings,
        breeds: state.colony.breeds,
        queue: state.colony.queue,
        maxAllies: state.colony.maxAllies
      },
      allies: state.allies.filter(function (a) { return a.hp > 0; }).map(function (a) {
        return { id: a.id, name: a.name, role: a.role, x: a.x, y: a.y, hp: a.hp, body: a.body, order: a.order };
      }),
      world: {
        explored: state.world.explored,
        resources: state.world.resources,
        journal: state.world.journal.slice(0, 20),
        activeEvents: state.world.activeEvents,
        tidePhase: state.world.tidePhase,
        eco: state.world.eco
      },
      enemies: state.enemies.filter(function (e) { return e.hp > 0; }).map(function (e) {
        return {
          id: e.id, kind: e.kind, arch: e.arch, name: e.name, x: e.x, y: e.y,
          hp: e.hp, hpMax: e.hpMax, speed: e.speed, dmg: e.dmg, armor: e.armor,
          style: e.style, color: e.color, biome: e.biome, boss: e.boss, phase: e.phase,
          homeX: e.homeX, homeY: e.homeY
        };
      }),
      progress: state.progress,
      tutorial: state.tutorial,
      settings: state.settings
    };
  };

  FG.validateSave = function (data) {
    if (!data || typeof data !== "object") return "Порожній файл";
    if (data.schema !== FG.SAVE_SCHEMA) return "Невідома версія схеми";
    if (!data.player || !data.world || !data.resources) return "Неповні дані";
    if (typeof data.seed !== "number") return "Поганий seed";
    if (data.resources.biomass < 0 || data.resources.mineral < 0) return "Від’ємні ресурси";
    return null;
  };

  FG.applySave = function (state, data) {
    state.saveRev = data.rev || 1;
    state.generation = data.generation || 1;
    state.deaths = data.deaths || 0;
    state.resources = data.resources;
    state.genes = data.genes || {};
    state.progress = data.progress || { kills: 0, bosses: {} };
    state.tutorial = data.tutorial || state.tutorial;
    if (data.settings) state.settings = Object.assign(state.settings, data.settings);

    state.world = FG.generateWorld(data.seed);
    state.world.time = data.time || 0;
    state.world.explored = data.world.explored || state.world.explored;
    state.world.resources = data.world.resources || state.world.resources;
    state.world.journal = data.world.journal || state.world.journal;
    state.world.activeEvents = data.world.activeEvents || [];
    state.world.tidePhase = data.world.tidePhase || 0;
    state.world.eco = data.world.eco || state.world.eco;

    state.player = FG.createPlayer(data.player.x, data.player.y);
    state.player.body = data.player.body;
    state.player.hp = data.player.hp;
    state.player.energy = data.player.energy;
    state.player.carrying = data.player.carrying || { biomass: 0, mineral: 0, sample: 0 };
    FG.refreshCreatureStats(state.player);

    state.colony = FG.initColony(state.world.nest);
    state.colony.buildings = data.colony.buildings || state.colony.buildings;
    state.colony.breeds = data.colony.breeds || [];
    state.colony.queue = data.colony.queue || [];
    state.colony.maxAllies = data.colony.maxAllies || 4;

    state.allies = (data.allies || []).map(function (a) {
      var ally = FG.createAlly({ name: a.name, role: a.role, body: a.body }, a.x, a.y);
      ally.id = a.id;
      ally.hp = a.hp;
      ally.order = a.order || { type: "follow" };
      return ally;
    });

    state.enemies = (data.enemies || []).map(function (e) {
      var en = FG.spawnEnemy(e.arch || "pack", e.x, e.y, e.biome);
      Object.assign(en, e);
      return en;
    });
    if (!state.enemies.length) FG.seedCreatures(state);

    state.projectiles = [];
    state.hazards = [];
    state.webs = [];
    state.particles = [];
    state.paused = false;
    state.atNest = FG.atNest(state);
  };

  FG.saveGame = function (state, reason) {
    try {
      var snap = FG.serializeState(state);
      var err = FG.validateSave(snap);
      if (err) throw new Error(err);
      var json = JSON.stringify(snap);
      var prev = null;
      try { prev = localStorage.getItem(KEY); } catch (e1) {}
      if (prev) {
        try { localStorage.setItem(KEY_BAK, prev); } catch (e2) {}
      }
      try {
        localStorage.setItem(KEY, json);
        state.saveRev = snap.rev;
        state.saveStatus = "ok";
        state.lastSaveReason = reason || "auto";
        return { ok: true };
      } catch (e3) {
        state.saveStatus = "unavailable";
        return { ok: false, why: "Сховище недоступне — скористайся експортом.", data: snap };
      }
    } catch (e) {
      state.saveStatus = "error";
      return { ok: false, why: String(e.message || e) };
    }
  };

  FG.loadGame = function (state) {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) raw = localStorage.getItem(KEY_BAK);
      if (!raw) return { ok: false, why: "Немає збереження" };
      var data = JSON.parse(raw);
      var err = FG.validateSave(data);
      if (err) {
        var bak = localStorage.getItem(KEY_BAK);
        if (bak) {
          data = JSON.parse(bak);
          err = FG.validateSave(data);
        }
        if (err) return { ok: false, why: err };
      }
      FG.applySave(state, data);
      return { ok: true };
    } catch (e) {
      return { ok: false, why: "Пошкоджене збереження" };
    }
  };

  FG.exportSave = function (state) {
    var snap = FG.serializeState(state);
    var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fox-genesis-save.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };

  FG.importSave = function (state, file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var err = FG.validateSave(data);
        if (err) { cb({ ok: false, why: err }); return; }
        // keep current as backup in memory path
        FG.saveGame(state, "pre-import");
        FG.applySave(state, data);
        FG.saveGame(state, "import");
        cb({ ok: true });
      } catch (e) {
        cb({ ok: false, why: "Невірний JSON" });
      }
    };
    reader.readAsText(file);
  };
})(window.FoxGenesis);
