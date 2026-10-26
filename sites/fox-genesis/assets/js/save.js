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
        carrying: state.player.carrying,
        abilityBinds: state.player.abilityBinds || null
      },
      colony: {
        buildings: state.colony.buildings,
        breeds: state.colony.breeds,
        queue: state.colony.queue,
        maxAllies: state.colony.maxAllies,
        storageBonus: state.colony.storageBonus || 0,
        research: state.colony.research || 0
      },
      allies: state.allies.filter(function (a) { return a.hp > 0 && !a.dead; }).map(function (a) {
        return {
          id: a.id, name: a.name, role: a.role, x: a.x, y: a.y, hp: a.hp, body: a.body,
          order: a.order, carrying: a._carry || null
        };
      }),
      world: {
        explored: state.world.explored,
        resources: state.world.resources,
        journal: state.world.journal.slice(0, 20),
        activeEvents: state.world.activeEvents,
        tidePhase: state.world.tidePhase,
        eco: state.world.eco,
        locations: (state.world.locations || []).map(function (l) {
          return { id: l.id, type: l.type, done: !!l.done, claimed: !!l.claimed };
        }),
        eventCd: state.world.eventCd
      },
      enemies: state.enemies.filter(function (e) { return e.hp > 0 && !e.dead; }).map(function (e) {
        return {
          id: e.id, kind: e.kind, arch: e.arch, name: e.name, x: e.x, y: e.y,
          hp: e.hp, hpMax: e.hpMax, speed: e.speed, dmg: e.dmg, armor: e.armor,
          style: e.style, color: e.color, biome: e.biome, boss: e.boss, phase: e.phase,
          homeX: e.homeX, homeY: e.homeY, _rescue: e._rescue
        };
      }),
      enemiesPresent: true,
      progress: state.progress,
      tutorial: state.tutorial,
      settings: state.settings,
      path: state.path || null
    };
  };

  FG.migrateSave = function (data) {
    if (!data || typeof data !== "object") return data;
    if (!data.schema || data.schema < 2) {
      data.schema = FG.SAVE_SCHEMA;
      if (!data.player) data.player = {};
      if (!data.player.abilityBinds) data.player.abilityBinds = null;
      if (!data.world) data.world = {};
      if (!data.world.locations) data.world.locations = [];
      if (data.enemiesPresent == null) data.enemiesPresent = Array.isArray(data.enemies);
    }
    data.schema = FG.SAVE_SCHEMA;
    return data;
  };

  FG.validateSave = function (data) {
    if (!data || typeof data !== "object") return "Порожній файл";
    if (typeof data.schema !== "number") return "Невідома версія схеми";
    if (!data.player || !data.world || !data.resources) return "Неповні дані";
    if (typeof data.seed !== "number" || !isFinite(data.seed)) return "Поганий seed";
    if (!isFinite(data.resources.biomass) || data.resources.biomass < 0) return "Від’ємні ресурси";
    if (!isFinite(data.resources.mineral) || data.resources.mineral < 0) return "Від’ємні ресурси";
    if (data.player.body && data.player.body.organs) {
      for (var i = 0; i < data.player.body.organs.length; i++) {
        if (!FG.ORGANS[data.player.body.organs[i]]) return "Невідомий орган у сейві";
      }
    }
    if (data.enemies && data.enemies.length > 400) return "Занадто багато ворогів";
    if (data.allies && data.allies.length > 40) return "Занадто багато союзників";
    return null;
  };

  FG.readSnapshot = function (raw) {
    if (!raw) return { ok: false, why: "порожньо" };
    try {
      var data = FG.migrateSave(JSON.parse(raw));
      var err = FG.validateSave(data);
      if (err) return { ok: false, why: err };
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, why: "Пошкоджений JSON" };
    }
  };

  FG.loadBestSnapshot = function () {
    var primary = null, bak = null;
    try { primary = localStorage.getItem(KEY); } catch (e1) {}
    try { bak = localStorage.getItem(KEY_BAK); } catch (e2) {}
    var a = FG.readSnapshot(primary);
    var b = FG.readSnapshot(bak);
    if (a.ok && b.ok) {
      return (a.data.rev || 0) >= (b.data.rev || 0) ? a : b;
    }
    if (a.ok) return a;
    if (b.ok) return b;
    if (!primary && !bak) return { ok: false, why: "Немає збереження" };
    return { ok: false, why: a.why || b.why || "Пошкоджене збереження", canImport: true };
  };

  FG.applySave = function (state, data) {
    data = FG.migrateSave(data);
    state.saveRev = data.rev || 1;
    state.generation = data.generation || 1;
    state.deaths = data.deaths || 0;
    state.resources = data.resources;
    state.genes = data.genes || {};
    state.progress = data.progress || { kills: 0, bosses: {} };
    state.tutorial = data.tutorial || { done: {} };
    state.path = data.path || null;
    if (data.settings) state.settings = Object.assign(state.settings, data.settings);

    state.world = FG.generateWorld(data.seed);
    state.world.time = data.time || 0;
    state.world.explored = data.world.explored || state.world.explored;
    state.world.resources = data.world.resources || state.world.resources;
    state.world.journal = data.world.journal || state.world.journal;
    state.world.activeEvents = data.world.activeEvents || [];
    state.world.tidePhase = data.world.tidePhase || 0;
    state.world.eco = data.world.eco || state.world.eco;
    state.world.eventCd = data.world.eventCd != null ? data.world.eventCd : state.world.eventCd;
    if (data.world.locations && state.world.locations) {
      data.world.locations.forEach(function (sl) {
        for (var i = 0; i < state.world.locations.length; i++) {
          if (state.world.locations[i].id === sl.id || state.world.locations[i].type === sl.type) {
            state.world.locations[i].done = !!sl.done;
            state.world.locations[i].claimed = !!sl.claimed;
            break;
          }
        }
      });
    }

    state.player = FG.createPlayer(data.player.x, data.player.y);
    state.player.body = data.player.body;
    state.player.hp = data.player.hp;
    state.player.energy = data.player.energy;
    state.player.carrying = data.player.carrying || { biomass: 0, mineral: 0, sample: 0 };
    state.player.abilityBinds = data.player.abilityBinds || { rmb: null, q: null, e: null };
    FG.refreshCreatureStats(state.player);
    FG.ensureAbilityBinds(state.player);

    state.colony = FG.initColony(state.world.nest);
    state.colony.buildings = data.colony.buildings || state.colony.buildings;
    state.colony.breeds = data.colony.breeds || [];
    state.colony.queue = data.colony.queue || [];
    state.colony.maxAllies = data.colony.maxAllies || 4;
    state.colony.storageBonus = (data.colony && data.colony.storageBonus) || 0;
    state.colony.research = (data.colony && data.colony.research) || 0;

    state.allies = (data.allies || []).map(function (a) {
      var ally = FG.createAlly({ name: a.name, role: a.role, body: a.body }, a.x, a.y);
      ally.id = a.id;
      ally.hp = a.hp;
      ally.order = a.order || { type: "follow" };
      ally._carry = a.carrying || null;
      return ally;
    });

    // Empty enemies array is valid — do NOT reseed (would wipe allies).
    var hadEnemiesField = Object.prototype.hasOwnProperty.call(data, "enemies");
    if (hadEnemiesField) {
      state.enemies = (data.enemies || []).map(function (e) {
        var en = FG.spawnEnemy(e.arch || "pack", e.x, e.y, e.biome);
        Object.assign(en, e);
        en.dead = false;
        return en;
      });
    } else {
      FG.seedCreatures(state);
    }

    state.projectiles = [];
    state.hazards = [];
    state.webs = [];
    state.particles = [];
    state.paused = false;
    state.pauseReasons = { manual: false, panel: false, blur: false };
    state.atNest = FG.atNest(state);
    FG.syncUidFromState(state);
    FG.resetCameraSmooth(state);
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
    var best = FG.loadBestSnapshot();
    if (!best.ok) return best;
    FG.applySave(state, best.data);
    return { ok: true, rev: best.data.rev };
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
        var parsed = FG.readSnapshot(reader.result);
        if (!parsed.ok) { cb({ ok: false, why: parsed.why }); return; }
        FG.saveGame(state, "pre-import");
        FG.applySave(state, parsed.data);
        FG.saveGame(state, "import");
        cb({ ok: true });
      } catch (e) {
        cb({ ok: false, why: "Невірний JSON" });
      }
    };
    reader.readAsText(file);
  };
})(window.FoxGenesis);
