/* FOX SERPENT — digging, supports, simple water reservoirs */
(function (FS) {
  "use strict";

  FS.ensureMine = function (state) {
    if (!state.mine) {
      state.mine = { marks: [], water: [], jobs: [] };
    }
    return state.mine;
  };

  FS.canDig = function (state) {
    return !!(state.specialization === "miner" ||
      (state.effects && state.effects.digUnlocked) ||
      (state.progress && state.progress.digLearned));
  };

  FS.markDig = function (state, x, y) {
    FS.ensureMine(state);
    if (!FS.canDig(state)) return { ok: false, why: "Копання ще не відкрито (гілка Шахтар або навчання)" };
    if (state.layerId !== "cave") return { ok: false, why: "Копати стіни можна в печері" };
    var t = FS.tileAt(state.world, x, y);
    if (!t || t.tt !== "cave_wall") return { ok: false, why: "Тут немає стіни" };
    // Must stand adjacent
    var h = FS.snakeHead(state.player);
    if (FS.manhattan(h, { x: x, y: y }) !== 1) return { ok: false, why: "Стань поруч зі стіною" };
    if (FS.snakeAtCell(state, x, y, false).length) return { ok: false, why: "Клітинка зайнята" };
    var id = FS.key(x, y);
    if (state.mine.marks.some(function (m) { return m.id === id; })) {
      return { ok: false, why: "Вже розмічено" };
    }
    state.mine.marks.push({ id: id, x: x, y: y, progress: 0, need: 2.5, worldId: state.activeWorldId });
    state.ui.toast = "Розмітка тунелю";
    return { ok: true };
  };

  FS.tickMineJobs = function (state, dt) {
    if (!state.started || state.paused) return;
    FS.ensureMine(state);
    var speed = (state.effects && state.effects.mineSpeed) || 1;
    var left = [];
    state.mine.marks.forEach(function (m) {
      if (m.worldId && m.worldId !== state.activeWorldId) {
        left.push(m);
        return;
      }
      var h = FS.snakeHead(state.player);
      if (FS.manhattan(h, m) > 1) {
        left.push(m);
        return;
      }
      // Player must face / stand working — progress while adjacent
      m.progress += dt * speed;
      if (m.progress < m.need) {
        left.push(m);
        return;
      }
      // Complete dig
      var tile = FS.tileAt(state.world, m.x, m.y);
      if (tile && tile.tt === "cave_wall") {
        FS.setTile(state.world, m.x, m.y, FS.makeTile(m.x, m.y, "cave_floor", {
          biome: (tile && tile.biome) || "mine"
        }));
        if (FS.gainMaterial) {
          var drop = 1 + (((state.world.seed || 0) + m.x * 3 + m.y) % 2);
          FS.gainMaterial(state, "stone", drop);
          if (((m.x + m.y) % 5) === 0) FS.gainMaterial(state, "copper_ore", 1);
        }
        state.world._geomRev = (state.world._geomRev || 0) + 1;
        state.ui.toast = "Прохід відкрито";
      }
    });
    state.mine.marks = left;
  };

  FS.canPlaceSupport = function (state, x, y) {
    if (state.layerId !== "cave") return { ok: false, why: "Опори — під землею" };
    var t = FS.tileAt(state.world, x, y);
    if (!t || (t.tt !== "cave_floor" && t.tt !== "cave_exit")) return { ok: false, why: "Потрібна підлога" };
    if (FS.buildingAt(state, x, y)) return { ok: false, why: "Зайнято" };
    return { ok: true };
  };

  /** Pit → lined reservoir → fill from finite source landmark. */
  FS.markPit = function (state, cells) {
    FS.ensureMine(state);
    if (!cells || !cells.length) return { ok: false, why: "Немає клітинок" };
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (FS.snakeAtCell(state, c.x, c.y, false).length) {
        return { ok: false, why: "Не можна яму під змією" };
      }
      var t = FS.tileAt(state.world, c.x, c.y);
      if (!t || !FS.tileWalkable(t)) return { ok: false, why: "Погана клітинка для ями" };
    }
    cells.forEach(function (c) {
      state.mine.water.push({
        x: c.x, y: c.y, stage: "marked", // marked|dug|lined|filled
        worldId: state.activeWorldId
      });
    });
    state.ui.toast = "Яму розмічено (" + cells.length + ")";
    return { ok: true };
  };

  FS.advanceWaterCell = function (state, x, y) {
    FS.ensureMine(state);
    var cell = null;
    for (var i = 0; i < state.mine.water.length; i++) {
      if (state.mine.water[i].x === x && state.mine.water[i].y === y &&
          (state.mine.water[i].worldId || state.activeWorldId) === state.activeWorldId) {
        cell = state.mine.water[i];
        break;
      }
    }
    if (!cell) return { ok: false, why: "Немає розмітки" };
    if (FS.snakeAtCell(state, x, y, false).length) {
      return { ok: false, why: "Спочатку звільни клітинку" };
    }
    if (cell.stage === "marked") {
      cell.stage = "dug";
      FS.setTile(state.world, x, y, FS.makeTile(x, y, "pit", { biome: "mine" }));
      state.ui.toast = "Вирито";
      return { ok: true };
    }
    if (cell.stage === "dug") {
      FS.ensureMaterials(state);
      if ((state.materials.clay || 0) < 1 && (state.materials.stone || 0) < 2) {
        return { ok: false, why: "Потрібно 1 глина або 2 камені для облицювання" };
      }
      if ((state.materials.clay || 0) >= 1) state.materials.clay--;
      else state.materials.stone -= 2;
      cell.stage = "lined";
      FS.setTile(state.world, x, y, FS.makeTile(x, y, "reservoir", { biome: "mine" }));
      state.ui.toast = "Облицьовано";
      return { ok: true };
    }
    if (cell.stage === "lined") {
      // Need a water source landmark nearby or carried bucket (simplified: mycelium cave stream)
      var src = (state.world.landmarks || []).some(function (lm) {
        return !lm.done && (lm.kind === "water_source" || lm.kind === "stream") &&
          FS.manhattan(lm, { x: x, y: y }) <= 6;
      });
      // Also allow if theme is stream
      if (!src && state.world.theme === "stream") src = true;
      if (!src && (state.materials.mycelium || 0) >= 1) {
        state.materials.mycelium--;
        src = true; // temporary "bucket"
      }
      if (!src) return { ok: false, why: "Немає джерела води / відра" };
      cell.stage = "filled";
      FS.setTile(state.world, x, y, FS.makeTile(x, y, "shallow", { biome: "mine" }));
      state.ui.toast = "Воду залито";
      return { ok: true };
    }
    return { ok: false, why: "Вже заповнено" };
  };
})(window.FoxSerpent);
