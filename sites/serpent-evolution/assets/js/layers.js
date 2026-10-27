/* FOX SERPENT — surface / underground layers + FOV memory */
(function (FS) {
  "use strict";

  FS.LAYER_SURFACE = "surface";
  FS.LAYER_CAVE = "cave";

  FS.ensureLayer = function (state) {
    if (!state.layerId) state.layerId = FS.LAYER_SURFACE;
    if (!state.layers) {
      state.layers = {
        surface: { explored: Object.create(null) },
        caves: {} // caveId → { explored, lastSeen, grid meta }
      };
    }
    return state.layerId;
  };

  FS.posKey = function (layerId, x, y) {
    return (layerId || FS.LAYER_SURFACE) + ":" + x + ":" + y;
  };

  FS.sameLayer = function (a, b) {
    return (a.layerId || FS.LAYER_SURFACE) === (b.layerId || FS.LAYER_SURFACE);
  };

  /** LOS ray on current world grid (blocked by non-walkable / trees / solid buildings). */
  FS.hasLineOfSight = function (state, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    var x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      var e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) break;
      if (FS.isBlockedCell(state, x, y, null)) return false;
    }
    return true;
  };

  FS.computeFOV = function (state, ox, oy, radius) {
    radius = radius || FS.visionRadius(state);
    var visible = Object.create(null);
    for (var dy = -radius; dy <= radius; dy++) {
      for (var dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + radius) continue;
        var x = ox + dx, y = oy + dy;
        if (!FS.inBounds(state.world, x, y)) continue;
        if (FS.hasLineOfSight(state, ox, oy, x, y)) {
          visible[FS.key(x, y)] = 1;
        }
      }
    }
    visible[FS.key(ox, oy)] = 1;
    return visible;
  };

  FS.markExplored = function (state, visible) {
    FS.ensureLayer(state);
    var bag = state.layerId === FS.LAYER_CAVE
      ? (state.layers.caves[state.caveId] || (state.layers.caves[state.caveId] = { explored: Object.create(null), lastSeen: Object.create(null) })).explored
      : state.layers.surface.explored;
    Object.keys(visible).forEach(function (k) {
      bag[k] = 1;
    });
  };

  FS.cellVision = function (state, x, y, visible) {
    FS.ensureLayer(state);
    var k = FS.key(x, y);
    if (visible && visible[k]) return "visible";
    var bag = state.layerId === FS.LAYER_CAVE
      ? (state.layers.caves[state.caveId] && state.layers.caves[state.caveId].explored)
      : (state.layers.surface && state.layers.surface.explored);
    if (bag && bag[k]) return "memory";
    // Surface start: no full fog until night/cave — keep surface playable
    if (state.layerId !== FS.LAYER_CAVE && (!state.settlement || state.settlement.phase !== "night")) {
      return "visible";
    }
    if (state.layerId !== FS.LAYER_CAVE) return bag && bag[k] ? "memory" : "visible";
    return "dark";
  };

  FS.tickVision = function (state) {
    FS.ensureLayer(state);
    if (!state.player || state.player.dead) return;
    // Cheap on surface day — no per-frame FOV
    if (state.layerId !== FS.LAYER_CAVE &&
        !(state.settlement && state.settlement.phase === "night")) {
      state._fov = null;
      return;
    }
    var h = FS.snakeHead(state.player);
    var key = state.layerId + ":" + h.x + ":" + h.y + ":" + (state.settlement && state.settlement.phase);
    if (state._fovCell === key && state._fov) return;
    state._fovCell = key;
    var r = FS.visionRadius(state);
    state._fov = FS.computeFOV(state, h.x, h.y, r);
    FS.markExplored(state, state._fov);
  };
})(window.FoxSerpent);
