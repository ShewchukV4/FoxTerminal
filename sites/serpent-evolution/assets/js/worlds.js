/* FOX SERPENT — multi-world model: surface + caves (no surface loss on save) */
(function (FS) {
  "use strict";

  FS.WORLD_SURFACE = "surface";

  FS.ensureWorlds = function (state) {
    if (!state.worlds) {
      state.worlds = { surface: null, caves: Object.create(null) };
    }
    if (!state.worlds.caves) state.worlds.caves = Object.create(null);
    if (!state.activeWorldId) state.activeWorldId = FS.WORLD_SURFACE;
    // Bind active pointer
    if (state.world && !state.worlds.surface && state.activeWorldId === FS.WORLD_SURFACE) {
      state.worlds.surface = state.world;
      state.world.worldId = FS.WORLD_SURFACE;
    }
    return state.worlds;
  };

  FS.activeWorld = function (state) {
    FS.ensureWorlds(state);
    if (state.activeWorldId === FS.WORLD_SURFACE) {
      return state.worlds.surface || state.world;
    }
    return state.worlds.caves[state.activeWorldId] || state.world;
  };

  FS.setActiveWorld = function (state, worldId) {
    FS.ensureWorlds(state);
    var w;
    if (worldId === FS.WORLD_SURFACE || !worldId) {
      w = state.worlds.surface;
      state.activeWorldId = FS.WORLD_SURFACE;
      state.layerId = FS.LAYER_SURFACE || "surface";
      state.caveId = null;
    } else {
      w = state.worlds.caves[worldId];
      if (!w) return { ok: false, why: "Світ не знайдено: " + worldId };
      state.activeWorldId = worldId;
      state.layerId = FS.LAYER_CAVE || "cave";
      state.caveId = worldId;
    }
    if (!w) return { ok: false, why: "Порожній світ" };
    state.world = w;
    state._fovCell = null;
    state._fov = null;
    return { ok: true, world: w };
  };

  FS.bindSurfaceWorld = function (state, world) {
    FS.ensureWorlds(state);
    world.worldId = FS.WORLD_SURFACE;
    if (!world.buildings) world.buildings = state.buildings || [];
    if (!world.woodNodes) world.woodNodes = state.woodNodes || [];
    state.worlds.surface = world;
    state.world = world;
    state.activeWorldId = FS.WORLD_SURFACE;
    // Compat mirrors used by older systems
    state.buildings = world.buildings;
    state.woodNodes = world.woodNodes;
    return world;
  };

  FS.registerCaveWorld = function (state, caveId, world) {
    FS.ensureWorlds(state);
    world.worldId = caveId;
    world.isCave = true;
    world.caveId = caveId;
    if (!world.buildings) world.buildings = [];
    if (!world.woodNodes) world.woodNodes = [];
    if (!world.landmarks) world.landmarks = [];
    state.worlds.caves[caveId] = world;
    return world;
  };

  FS.buildingsOf = function (state, worldId) {
    FS.ensureWorlds(state);
    var id = worldId || state.activeWorldId || FS.WORLD_SURFACE;
    if (id === FS.WORLD_SURFACE) {
      var s = state.worlds.surface;
      return (s && s.buildings) || state.buildings || [];
    }
    var c = state.worlds.caves[id];
    return (c && c.buildings) || [];
  };

  /** Serialize worlds without runtime caches. */
  FS.serializeWorlds = function (state) {
    FS.ensureWorlds(state);
    function pack(w) {
      if (!w) return null;
      return {
        worldId: w.worldId,
        seed: w.seed,
        tiles: w.tiles,
        foods: w.foods || [],
        landmarks: w.landmarks || [],
        nest: w.nest,
        chunks: w.chunks,
        minX: w.minX, maxX: w.maxX,
        minY: w.minY, maxY: w.maxY,
        openOffers: w.openOffers || [],
        buildings: w.buildings || [],
        woodNodes: w.woodNodes || [],
        generatorVersion: w.generatorVersion || FS.GENERATOR_VERSION,
        isCave: !!w.isCave,
        caveId: w.caveId || null,
        theme: w.theme || null
      };
    }
    var caves = {};
    Object.keys(state.worlds.caves).forEach(function (id) {
      caves[id] = pack(state.worlds.caves[id]);
    });
    return {
      surface: pack(state.worlds.surface || state.world),
      caves: caves,
      activeWorldId: state.activeWorldId || FS.WORLD_SURFACE
    };
  };

  FS.applyWorlds = function (state, data) {
    FS.ensureWorlds(state);
    if (!data || !data.surface) {
      // Legacy: single world blob may be cave-only — keep as surface fallback with warning
      if (state.world) FS.bindSurfaceWorld(state, state.world);
      state._surfaceMissing = !!(data && data.activeWorldId && data.activeWorldId !== FS.WORLD_SURFACE);
      return;
    }
    function unpack(p) {
      if (!p) return null;
      var w = {
        worldId: p.worldId,
        seed: p.seed,
        tiles: p.tiles || Object.create(null),
        foods: p.foods || [],
        landmarks: p.landmarks || [],
        nest: p.nest,
        chunks: p.chunks || {},
        minX: p.minX, maxX: p.maxX,
        minY: p.minY, maxY: p.maxY,
        openOffers: p.openOffers || [],
        buildings: p.buildings || [],
        woodNodes: p.woodNodes || [],
        generatorVersion: p.generatorVersion || FS.GENERATOR_VERSION,
        isCave: !!p.isCave,
        caveId: p.caveId || null,
        theme: p.theme || null
      };
      return w;
    }
    state.worlds.surface = unpack(data.surface);
    state.worlds.caves = Object.create(null);
    Object.keys(data.caves || {}).forEach(function (id) {
      state.worlds.caves[id] = unpack(data.caves[id]);
    });
    var aid = data.activeWorldId || FS.WORLD_SURFACE;
    FS.setActiveWorld(state, aid);
    state.buildings = FS.buildingsOf(state, FS.WORLD_SURFACE);
    state.woodNodes = (state.worlds.surface && state.worlds.surface.woodNodes) || [];
    state._surfaceMissing = false;
  };

  FS.clearWorldRuntime = function (state) {
    state._caveWorld = null;
    state._surfaceSnap = null;
    state._fov = null;
    state._fovCell = null;
    state._lmCell = null;
    state.activeWorldId = FS.WORLD_SURFACE;
    state.layerId = FS.LAYER_SURFACE || "surface";
    state.caveId = null;
  };
})(window.FoxSerpent);
