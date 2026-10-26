/* FOX SERPENT — wood + cursor build mode (fence/gate/block/plot/hut/shed) */
(function (FS) {
  "use strict";

  FS.WOOD_CAP_BASE = 12;

  FS.ensureWood = function (state) {
    if (state.wood == null) state.wood = 0;
    if (state.woodCap == null) state.woodCap = FS.WOOD_CAP_BASE + ((state.effects && state.effects.woodCapAdd) || 0);
    else state.woodCap = FS.WOOD_CAP_BASE + ((state.effects && state.effects.woodCapAdd) || 0);
    if (!state.buildings) state.buildings = [];
    if (!state.woodNodes) state.woodNodes = [];
  };

  FS.gainWood = function (state, n) {
    FS.ensureWood(state);
    n = Math.max(0, n | 0);
    var room = state.woodCap - state.wood;
    var take = Math.min(n, room);
    state.wood += take;
    if (take < n) state.ui.toast = "Сховище деревини повне (" + state.wood + "/" + state.woodCap + ")";
    return take;
  };

  FS.spendWood = function (state, cost, applyFn, opts) {
    opts = opts || {};
    FS.ensureWood(state);
    if (state._woodLock) return { ok: false, why: "Зачекай" };
    cost = cost | 0;
    if (state.wood < cost) return { ok: false, why: "Потрібно " + cost + " деревини, є " + state.wood };
    state._woodLock = true;
    try {
      state.wood -= cost;
      var r = applyFn ? applyFn(state) : { ok: true };
      if (!r || r.ok === false) {
        state.wood += cost;
        return r || { ok: false, why: "Скасовано" };
      }
      if (opts.save !== false) FS.saveGame(state, opts.reason || "wood");
      return Object.assign({ ok: true, spent: cost }, r);
    } finally {
      state._woodLock = false;
    }
  };

  FS.treeAt = function (state, x, y) {
    FS.ensureWood(state);
    for (var i = 0; i < state.woodNodes.length; i++) {
      var n = state.woodNodes[i];
      if (n.kind === "tree" && n.x === x && n.y === y) return n;
    }
    return null;
  };

  FS.nearTree = function (state, x, y, dist) {
    dist = dist == null ? 1 : dist;
    FS.ensureWood(state);
    for (var i = 0; i < state.woodNodes.length; i++) {
      var n = state.woodNodes[i];
      if (n.kind !== "tree") continue;
      if (FS.manhattan({ x: x, y: y }, n) <= dist) return n;
    }
    return null;
  };

  FS.canPlaceWoodDrop = function (state, x, y) {
    if (!FS.nearTree(state, x, y, 1)) return false;
    if (FS.treeAt(state, x, y)) return false; // trunk cell: F-harvest, not branch pile
    var t = FS.tileAt(state.world, x, y);
    if (!t || !FS.tileWalkable(t)) return false;
    if (FS.farmAt && FS.farmAt(state, x, y)) return false;
    if (FS.buildingAt(state, x, y)) return false;
    if (FS.manhattan({ x: x, y: y }, state.world.nest) < 2) return false;
    return true;
  };

  FS.spawnBranchesForTree = function (state, tree) {
    if (!tree || tree.kind !== "tree") return;
    var dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    var placed = 0;
    dirs.forEach(function (d) {
      if (placed >= (tree.branchSlots || 3)) return;
      var x = tree.x + d[0], y = tree.y + d[1];
      if (!FS.canPlaceWoodDrop(state, x, y)) return;
      var exists = state.woodNodes.some(function (n) {
        return n.kind === "wood" && n.x === x && n.y === y;
      });
      if (exists) return;
      state.woodNodes.push({
        id: FS.uid(), x: x, y: y, kind: "wood",
        amount: 1 + ((x + y) % 2),
        cd: 0, maxCd: 16 + (placed * 2),
        treeId: tree.id
      });
      placed++;
    });
  };

  FS.findTreeSpot = function (state, prefer) {
    var nest = state.world.nest;
    var tries = prefer.concat([]);
    var r, dx, dy;
    for (r = 3; r <= 6; r++) {
      for (dx = -r; dx <= r; dx++) {
        for (dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          tries.push({ x: nest.x + dx, y: nest.y + dy });
        }
      }
    }
    for (var i = 0; i < tries.length; i++) {
      var p = tries[i];
      var t = FS.tileAt(state.world, p.x, p.y);
      if (!t || !FS.tileWalkable(t)) continue;
      if (FS.manhattan(p, nest) < 3) continue;
      if (FS.farmAt && FS.farmAt(state, p.x, p.y)) continue;
      if (FS.treeAt(state, p.x, p.y)) continue;
      if (FS.snakeAtCell(state, p.x, p.y, false).length) continue;
      return p;
    }
    return null;
  };

  /** Дерева + гілки лише коло / під кроною (manhattan ≤ 1). */
  FS.seedWoodNodes = function (state) {
    FS.ensureWood(state);
    state.woodNodes = state.woodNodes.filter(function (n) {
      return n.kind !== "wood" && n.kind !== "stump" && n.kind !== "tree";
    });
    var nest = state.world.nest;
    var prefs = [
      { x: nest.x - 4, y: nest.y + 2 },
      { x: nest.x + 4, y: nest.y - 1 },
      { x: nest.x + 2, y: nest.y + 4 }
    ];
    var treesWanted = 2;
    for (var i = 0; i < treesWanted; i++) {
      var spot = FS.findTreeSpot(state, prefs);
      if (!spot) break;
      var tree = {
        id: FS.uid(), x: spot.x, y: spot.y, kind: "tree",
        amount: 3, cd: 0, maxCd: 24, branchSlots: 3
      };
      state.woodNodes.push(tree);
      FS.spawnBranchesForTree(state, tree);
      prefs = []; // next tree: scan ring only
    }
    if (state.wood < 4) state.wood = 4;
  };

  FS.seedTreeInChunk = function (state, cx, cy) {
    FS.ensureWood(state);
    var baseX = cx * FS.CHUNK + 4, baseY = cy * FS.CHUNK + 4;
    var candidates = [];
    for (var y = 2; y < FS.CHUNK - 2; y++) {
      for (var x = 2; x < FS.CHUNK - 2; x++) {
        candidates.push({ x: baseX - 4 + x, y: baseY - 4 + y });
      }
    }
    for (var i = 0; i < candidates.length; i++) {
      var p = candidates[(i * 7 + cx * 3 + cy * 5) % candidates.length];
      var t = FS.tileAt(state.world, p.x, p.y);
      if (!t || !FS.tileWalkable(t)) continue;
      if (FS.treeAt(state, p.x, p.y)) continue;
      if (FS.farmAt && FS.farmAt(state, p.x, p.y)) continue;
      if (FS.manhattan(p, state.world.nest) < 4) continue;
      var tree = {
        id: FS.uid(), x: p.x, y: p.y, kind: "tree",
        amount: 3, cd: 0, maxCd: 26, branchSlots: 3
      };
      state.woodNodes.push(tree);
      FS.spawnBranchesForTree(state, tree);
      return tree;
    }
    return null;
  };

  FS.migrateWoodIfNeeded = function (state) {
    FS.ensureWood(state);
    state.progress = state.progress || {};
    var hasTree = state.woodNodes.some(function (n) { return n.kind === "tree"; });
    if (!state.progress.woodSeeded || !hasTree) {
      FS.seedWoodNodes(state);
      if (state.wood < 2) state.wood = Math.max(state.wood, 2);
      state.progress.woodSeeded = true;
      state.progress.treesV1 = true;
    } else if (!state.progress.treesV1) {
      // Convert loose branches: keep only near trees; if no trees, reseed
      FS.seedWoodNodes(state);
      state.progress.treesV1 = true;
    }
  };

  /** Old saves: strip wild food, ensure starter farms. */
  FS.migrateFarmFoodIfNeeded = function (state) {
    state.progress = state.progress || {};
    FS.ensureFarms(state);
    if (!state.progress.farmFoodOnly) {
      // remove foods not on a farm cell
      var farmKeys = Object.create(null);
      state.farms.list.forEach(function (f) { farmKeys[f.x + "," + f.y] = f; });
      state.world.foods = (state.world.foods || []).filter(function (f) {
        var farm = farmKeys[f.x + "," + f.y];
        if (!farm) return false;
        f.fromFarm = f.fromFarm || farm.id;
        return true;
      });
      if (state.farms.list.filter(function (f) { return f.type !== "nursery"; }).length < 4) {
        if (FS.seedStartFarms) FS.seedStartFarms(state);
      }
      state.farms.list.forEach(function (f) {
        if (f.stage === "ready" && FS.ensureFarmFruit) FS.ensureFarmFruit(state, f);
      });
      state.progress.farmFoodOnly = true;
    }
  };

  FS.pickupWoodAt = function (state, head) {
    FS.ensureWood(state);
    for (var i = state.woodNodes.length - 1; i >= 0; i--) {
      var n = state.woodNodes[i];
      if (n.kind !== "wood" || n.cd > 0) continue;
      if (n.x === head.x && n.y === head.y) {
        // safety: only under/near a tree
        if (!FS.nearTree(state, n.x, n.y, 1)) {
          state.woodNodes.splice(i, 1);
          continue;
        }
        var got = FS.gainWood(state, n.amount);
        n.cd = n.maxCd;
        if (got) {
          state.ui.toast = "Гілки під деревом +" + got + " деревини";
          state.tutorial.done.wood = true;
        }
        return true;
      }
    }
    return false;
  };

  FS.harvestStump = function (state) {
    FS.ensureWood(state);
    var h = FS.snakeHead(state.player);
    for (var i = 0; i < state.woodNodes.length; i++) {
      var n = state.woodNodes[i];
      if (n.kind !== "tree" && n.kind !== "stump") continue;
      if (FS.manhattan(h, n) > 1) continue;
      if (n.cd > 0) {
        state.ui.toast = (n.kind === "tree" ? "Дерево" : "Пень") +
          " відновлюється (" + Math.ceil(n.cd) + " с)";
        return { ok: false };
      }
      var got = FS.gainWood(state, n.amount || 3);
      n.cd = n.maxCd;
      state.player.standing = true;
      FS.clearInput(state.input);
      state.ui.toast = (n.kind === "tree" ? "Заготівля з дерева" : "Заготівля") + " +" + got + " деревини";
      state.tutorial.done.wood = true;
      // drop a couple fresh branches under canopy after harvest
      if (n.kind === "tree") FS.spawnBranchesForTree(state, n);
      return { ok: true };
    }
    return { ok: false };
  };

  FS.tickWoodNodes = function (state, dt) {
    if (!state.started) return;
    if (state.guide && state.guide.open) return;
    if (state.paused && !(state.buildMode && state.buildMode.on)) return;
    FS.ensureWood(state);
    state.woodNodes.forEach(function (n) {
      if (n.cd > 0) n.cd -= dt;
    });
    // Soft refresh: if a tree has fewer visible branches than slots, respawn after delay
    state.woodNodes.forEach(function (n) {
      if (n.kind !== "tree" || n.cd > 0) return;
      var around = state.woodNodes.filter(function (w) {
        return w.kind === "wood" && w.treeId === n.id && w.cd <= 0;
      }).length;
      if (around < (n.branchSlots || 3)) FS.spawnBranchesForTree(state, n);
    });
  };

  FS.buildingAt = function (state, x, y) {
    FS.ensureWood(state);
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].x === x && state.buildings[i].y === y) return state.buildings[i];
    }
    return null;
  };

  FS.buildingBlocks = function (b) {
    return FS.buildingBlocksFor(b, null);
  };

  FS.enterBuildMode = function (state) {
    if (state.ui.panel) {
      state.ui.panel = null;
      FS.setPauseReason(state, "panel", false);
    }
    state.buildMode = {
      on: true, tool: "fence", rot: 0, hover: null, drag: null,
      demolish: false, msg: "", lastCommit: 0
    };
    FS.clearInput(state.input);
    state.player.standing = true;
    state.ui.toast = "БУДІВНИЦТВО · ЛКМ ставити · ПКМ знести · X знесення · Esc/B вихід";
    FS.mountBuildPalette(state);
  };

  FS.exitBuildMode = function (state) {
    state.buildMode = null;
    FS.clearInput(state.input);
    var pal = document.getElementById("build-palette");
    if (pal) pal.classList.add("hidden");
  };

  FS.mountBuildPalette = function (state) {
    var root = document.getElementById("ui-root");
    var el = document.getElementById("build-palette");
    if (!el) {
      el = document.createElement("div");
      el.id = "build-palette";
      el.className = "build-palette";
      root.appendChild(el);
    }
    el.classList.remove("hidden");
    FS.refreshBuildPalette(state);
  };

  FS.refreshBuildPalette = function (state) {
    var el = document.getElementById("build-palette");
    if (!el || !state.buildMode) return;
    FS.ensureWood(state);
    var bm = state.buildMode;
    var html = '<div class="bp-title">БУДІВНИЦТВО · змія стоїть</div>';
    html += '<div class="bp-wood">Деревина <b>' + state.wood + "</b>/" + state.woodCap +
      " · Пожива <b>" + FS.nutritionOf(state) + "</b>/9</div>";
    html += '<div class="bp-tools">';
    Object.keys(FS.BUILD_COSTS).forEach(function (k) {
      var c = FS.BUILD_COSTS[k];
      var active = !bm.demolish && bm.tool === k;
      html += '<button type="button" class="btn' + (active ? " primary" : "") +
        '" data-btool="' + k + '">' + c.name + " · " + c.wood + "д" +
        (c.nutrition ? "+" + c.nutrition + "п" : "") + "</button>";
    });
    html += '<button type="button" class="btn' + (bm.demolish ? " primary" : " danger") +
      '" data-btool="demo">Знести · ПКМ / X (−50%)</button>';
    html += '<button type="button" class="btn ghost" data-btool="exit">Вихід (B)</button>';
    html += "</div>";
    html += '<p class="tiny">ЛКМ — поставити будь-де на відкритій землі · ПКМ — знести · ' +
      "R обернути · X режим знесення · drag = ряд паркану. Пробіл = пауза (ставити після зняття).</p>";
    if (bm.msg) html += '<p class="bp-msg">' + bm.msg + "</p>";
    el.innerHTML = html;
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-btool]");
      if (!t) return;
      ev.stopPropagation();
      var tool = t.dataset.btool;
      if (tool === "exit") { FS.exitBuildMode(state); return; }
      if (tool === "demo") { bm.demolish = true; bm.tool = null; }
      else { bm.demolish = false; bm.tool = tool; }
      bm.msg = "";
      FS.refreshBuildPalette(state);
    };
  };

  FS.screenToCell = function (state, clientX, clientY) {
    var r = state.renderer;
    var canvas = r.canvas;
    var rect = canvas.getBoundingClientRect();
    var sx = (clientX - rect.left) * (canvas.width / rect.width) / r.dpr;
    var sy = (clientY - rect.top) * (canvas.height / rect.height) / r.dpr;
    var viewW = canvas.width / r.dpr, viewH = canvas.height / r.dpr;
    var wx = (sx - viewW / 2) / r.cam.z + r.cam.x;
    var wy = (sy - viewH / 2) / r.cam.z + r.cam.y;
    return { x: Math.floor(wx / FS.CELL), y: Math.floor(wy / FS.CELL) };
  };

  FS.canBuildAt = function (state, x, y, kind) {
    FS.ensureWood(state);
    // Anywhere on the opened map (no 5-cell radius)
    if (!FS.inBounds(state.world, x, y)) return { ok: false, why: "Поза відкритою картою" };
    var tile = FS.tileAt(state.world, x, y);
    if (!tile) return { ok: false, why: "Клітинка ще не відкрита" };
    if (kind !== "plot" && tile.tt === "deep") return { ok: false, why: "Вода" };
    if (kind !== "plot" && tile.tt === "stone" && tile.block) return { ok: false, why: "Камінь" };
    if (FS.treeAt(state, x, y)) return { ok: false, why: "Дерево" };
    if (FS.buildingAt(state, x, y)) return { ok: false, why: "Вже є споруда" };
    if (FS.farmAt && FS.farmAt(state, x, y) && kind !== "plot") return { ok: false, why: "Ферма" };
    if (FS.snakeAtCell(state, x, y, false).length) return { ok: false, why: "Зайнято змією" };
    if (state.allies) {
      for (var ai = 0; ai < state.allies.length; ai++) {
        if (state.allies[ai].body && state.allies[ai].body.some(function (c) {
          return c.x === x && c.y === y;
        })) return { ok: false, why: "Союзник тут" };
      }
    }
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (e.dead) continue;
      var eh = FS.snakeHead(e);
      if (eh.x === x && eh.y === y) return { ok: false, why: "Ворог тут" };
      var ed = e.intentDir || e.dir;
      var ev = FS.dirVec(ed);
      if (eh.x + ev.x === x && eh.y + ev.y === y) return { ok: false, why: "Наступний крок ворога" };
    }
    if (FS.manhattan({ x: x, y: y }, state.world.nest) < 1 && kind !== "shed") {
      return { ok: false, why: "Гніздо" };
    }
    var cost = FS.BUILD_COSTS[kind];
    if (!cost) return { ok: false, why: "Невідомо" };
    if ((cost.wood || 0) > state.wood) return { ok: false, why: "Потрібно " + cost.wood + " деревини, є " + state.wood };
    if ((cost.nutrition || 0) > FS.nutritionOf(state)) {
      return { ok: false, why: "Потрібно ще " + cost.nutrition + " поживи" };
    }
    if (kind === "plot") {
      var pc = FS.canPlaceFarm(state, x, y, "berry");
      if (!pc.ok) return pc;
    }
    if (kind === "fence" || kind === "block") {
      var open = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = x + d[0], ny = y + d[1];
        var t2 = FS.tileAt(state.world, nx, ny);
        var b2 = FS.buildingAt(state, nx, ny);
        if (t2 && FS.tileWalkable(t2) && !FS.buildingBlocks(b2)) open++;
      });
      if (open < 1) return { ok: false, why: "Перекриє вихід" };
    }
    return { ok: true, cost: cost };
  };

  FS.commitBuild = function (state, x, y, kind) {
    if (state.paused && state.pauseReasons && state.pauseReasons.manual) {
      return { ok: false, why: "Зніми паузу (Пробіл), щоб ставити споруди" };
    }
    var check = FS.canBuildAt(state, x, y, kind);
    if (!check.ok) return check;
    if (FS.snakeAtCell(state, x, y, false).length) return { ok: false, why: "Клітинка зайнялась" };
    var cost = check.cost;

    function place() {
      var b = {
        id: FS.uid(), kind: kind, x: x, y: y,
        rot: (state.buildMode && state.buildMode.rot) || 0,
        closed: kind === "gate" ? true : undefined,
        hp: kind === "block" ? 3 : (kind === "fence" ? 2 : 1),
        owner: "player"
      };
      state.buildings.push(b);
      if (kind === "plot") {
        var fr = FS.placeFarmAt(state, x, y, "berry");
        if (!fr.ok) {
          state.buildings = state.buildings.filter(function (bb) { return bb.id !== b.id; });
          return fr;
        }
      }
      if (kind === "hut") {
        FS.ensureAllies(state);
        state.homes.push({
          id: FS.uid(), type: "hut", x: x, y: y,
          capacity: 1, residents: [], door: { x: x, y: y + 1 }
        });
      }
      if (kind === "shed") {
        state.woodCap = (state.woodCap || FS.WOOD_CAP_BASE) + 8;
      }
      state.tutorial.done.build = true;
      return { ok: true, building: b };
    }

    if (cost.nutrition) {
      var pq = FS.previewSpend(state, cost.nutrition);
      if (!pq.ok) return { ok: false, why: pq.why || "Бракує поживи" };
    }

    return FS.spendWood(state, cost.wood || 0, function () {
      if (cost.nutrition) {
        return FS.spendNutrition(state, cost.nutrition, function () {
          return place();
        }, { save: false, reason: "build" });
      }
      return place();
    }, { reason: "build" });
  };

  FS.demolishAt = function (state, x, y) {
    FS.ensureWood(state);
    FS.ensureFarms(state);
    var b = FS.buildingAt(state, x, y);
    var farm = FS.farmAt && FS.farmAt(state, x, y);
    // Starter farms may have no building entry — still demolishable
    if ((!b || b.owner === "enemy") && !farm) {
      return { ok: false, why: "Немає твоєї споруди / грядки" };
    }
    if (b && b.owner === "enemy") return { ok: false, why: "Чужа споруда" };
    var kind = b ? b.kind : "plot";
    var cost = FS.BUILD_COSTS[kind] || FS.BUILD_COSTS.plot;
    var refund = cost ? Math.floor((cost.wood || 0) * 0.5) : 0;
    if (b) state.buildings = state.buildings.filter(function (bb) { return bb.id !== b.id; });
    if (farm || kind === "plot") {
      state.farms.list = state.farms.list.filter(function (f) { return !(f.x === x && f.y === y); });
      state.world.foods = state.world.foods.filter(function (f) {
        return !(f.x === x && f.y === y && f.fromFarm);
      });
      var tile = FS.tileAt(state.world, x, y);
      if (tile && tile.tt === "plot") {
        FS.setTile(state.world, x, y, FS.makeTile(x, y, "meadow", { biome: tile.biome }));
      }
    }
    if (kind === "hut" && state.homes) {
      state.homes = state.homes.filter(function (h) { return !(h.x === x && h.y === y); });
    }
    if (refund) FS.gainWood(state, refund);
    state.ui.toast = "Знесено" + (refund ? " (+" + refund + " деревини)" : "");
    FS.saveGame(state, "demo");
    return { ok: true, refund: refund };
  };

  FS.toggleGate = function (state, x, y) {
    var b = FS.buildingAt(state, x, y);
    if (!b || b.kind !== "gate") return false;
    b.closed = !b.closed;
    state.ui.toast = b.closed ? "Ворота зачинені" : "Ворота відчинені";
    return true;
  };

  FS.tryInteract = function (state) {
    if (FS.harvestStump(state).ok) return true;
    var h = FS.snakeHead(state.player);
    if (FS.toggleGate(state, h.x, h.y)) return true;
    // pending ruin
    var pend = state.ui.pendingInteract;
    if (pend && pend.kind === "ruin") {
      var lm = (state.world.landmarks || []).filter(function (l) { return l.id === pend.id; })[0];
      if (lm && !lm.done && FS.manhattan(h, lm) <= 1) {
        var cost = pend.cost || 2;
        var r = FS.spendNutrition(state, cost, function () {
          lm.done = true;
          FS.addXp(state, 2);
          [[0, 0], [1, 0], [-1, 0], [0, 1]].forEach(function (d) {
            var t = FS.tileAt(state.world, lm.x + d[0], lm.y + d[1]);
            if (t && t.tt === "stone") FS.setTile(state.world, t.x, t.y, FS.makeTile(t.x, t.y, "soil", { biome: t.biome }));
          });
          state.ui.toast = "Ділянку відновлено";
          state.ui.pendingInteract = null;
          return { ok: true };
        }, { reason: "ruin" });
        return r.ok;
      }
    }
    var farm = FS.farmAt && FS.farmAt(state, h.x, h.y);
    if (farm && farm.stage === "ready" && FS.harvestFarmManual) {
      FS.harvestFarmManual(state, farm);
      return true;
    }
    return false;
  };

  FS.bindBuildInput = function (state, canvas) {
    canvas.addEventListener("pointermove", function (ev) {
      if (!state.buildMode || !state.buildMode.on) return;
      state.buildMode.hover = FS.screenToCell(state, ev.clientX, ev.clientY);
      if (state.buildMode.drag && state.buildMode.tool === "fence") {
        state.buildMode.drag.to = state.buildMode.hover;
      }
    });
    canvas.addEventListener("pointerdown", function (ev) {
      if (!state.buildMode || !state.buildMode.on) return;
      if (ev.target.closest && ev.target.closest("#build-palette")) return;
      var cell = FS.screenToCell(state, ev.clientX, ev.clientY);
      state.buildMode.hover = cell;
      if (ev.button === 2) {
        ev.preventDefault();
        state.buildMode.drag = null;
        var drR = FS.demolishAt(state, cell.x, cell.y);
        state.buildMode.msg = drR.ok ? ("Знесено" + (drR.refund ? " +" + drR.refund + "д" : "")) : drR.why;
        FS.refreshBuildPalette(state);
        return;
      }
      if (ev.button !== 0) return;
      if (state.buildMode.demolish) {
        var dr = FS.demolishAt(state, cell.x, cell.y);
        state.buildMode.msg = dr.ok ? ("Знесено" + (dr.refund ? " +" + dr.refund + "д" : "")) : dr.why;
        FS.refreshBuildPalette(state);
        return;
      }
      if (!state.buildMode.tool) return;
      if (state.buildMode.tool === "fence") {
        state.buildMode.drag = { from: cell, to: cell };
        return;
      }
      var now = performance.now();
      if (now - (state.buildMode.lastCommit || 0) < 180) return;
      var r = FS.commitBuild(state, cell.x, cell.y, state.buildMode.tool);
      state.buildMode.lastCommit = now;
      state.buildMode.msg = r.ok ? "Поставлено" : r.why;
      FS.refreshBuildPalette(state);
    });
    canvas.addEventListener("pointerup", function (ev) {
      if (!state.buildMode || !state.buildMode.on || !state.buildMode.drag) return;
      if (ev.button !== 0) return;
      var drag = state.buildMode.drag;
      state.buildMode.drag = null;
      var cells = FS.lineCells(drag.from, drag.to || drag.from);
      var fail = null, ok = 0, totalWood = 0;
      cells.forEach(function (c) {
        var chk = FS.canBuildAt(state, c.x, c.y, "fence");
        if (chk.ok) totalWood += chk.cost.wood;
        else if (!fail) fail = chk.why;
      });
      if (totalWood > state.wood) {
        state.buildMode.msg = "Ряд: потрібно " + totalWood + " деревини, є " + state.wood;
        FS.refreshBuildPalette(state);
        return;
      }
      cells.forEach(function (c) {
        var r = FS.commitBuild(state, c.x, c.y, "fence");
        if (r.ok) ok++;
        else if (!fail) fail = r.why;
      });
      state.buildMode.msg = ok ? ("Паркан ×" + ok + (fail ? " · " + fail : "")) : (fail || "Нічого");
      FS.refreshBuildPalette(state);
    });
    canvas.addEventListener("contextmenu", function (ev) {
      if (state.buildMode && state.buildMode.on) ev.preventDefault();
    });
  };

  FS.lineCells = function (a, b) {
    var cells = [];
    var dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      var step = dx >= 0 ? 1 : -1;
      for (var x = a.x; x !== b.x + step; x += step) cells.push({ x: x, y: a.y });
    } else {
      var stepy = dy >= 0 ? 1 : -1;
      for (var y = a.y; y !== b.y + stepy; y += stepy) cells.push({ x: a.x, y: y });
    }
    if (!cells.length) cells.push({ x: a.x, y: a.y });
    return cells;
  };
})(window.FoxSerpent);
