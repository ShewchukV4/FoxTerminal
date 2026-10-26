/* FOX SERPENT — world, expansion quotes, landmarks */
(function (FS) {
  "use strict";

  FS.inBounds = function (world, x, y) {
    return x >= world.minX && x <= world.maxX && y >= world.minY && y <= world.maxY;
  };

  FS.tileAt = function (world, x, y) {
    return world.tiles[FS.key(x, y)] || null;
  };

  FS.setTile = function (world, x, y, tile) {
    world.tiles[FS.key(x, y)] = tile;
  };

  FS.createEmptyWorld = function (seed) {
    return {
      seed: seed >>> 0,
      generatorVersion: FS.GENERATOR_VERSION || 3,
      tiles: Object.create(null),
      foods: [],
      materials: [],
      landmarks: [],
      nest: { x: 5, y: 5 },
      chunks: {},
      minX: 0, maxX: FS.CHUNK - 1,
      minY: 0, maxY: FS.CHUNK - 1,
      openOffers: [],
      enemySpawns: []
    };
  };

  FS.buildStartWorld = function (seed) {
    seed = (seed >>> 0) || ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    var world = FS.createEmptyWorld(seed);
    world.nest = { x: 5, y: 5 };
    FS.applyGeneratedChunk(world, 0, 0, "garden", true);
    world.openOffers = FS.computeExpandOffers(world);
    return world;
  };

  FS.offerId = function (cx, cy) {
    return "offer:" + cx + ":" + cy;
  };

  FS.computeExpandOffers = function (world) {
    var open = Object.keys(world.chunks);
    var neigh = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    var offers = [];
    var seen = Object.create(null);
    var nOpen = open.length;
    open.forEach(function (id) {
      var ch = world.chunks[id];
      neigh.forEach(function (n) {
        var cx = ch.cx + n.dx, cy = ch.cy + n.dy;
        var nid = cx + ":" + cy;
        if (world.chunks[nid] || seen[nid]) return;
        seen[nid] = 1;
        var pick = FS.pickRegionType(world.seed, cx, cy, nOpen, offers.length, false);
        var costIdx = Math.min(Math.max(0, nOpen - 1), FS.EXPAND_COSTS.length - 1);
        // first expansion always uses EXPAND_COSTS[0]=3
        if (nOpen === 1) costIdx = 0;
        else costIdx = Math.min(nOpen - 1 + Math.min(offers.length, 1), FS.EXPAND_COSTS.length - 1);
        var baseCost = FS.EXPAND_COSTS[costIdx];
        offers.push({
          id: FS.offerId(cx, cy),
          cx: cx, cy: cy, type: pick,
          name: FS.REGION_TYPES[pick].name,
          desc: FS.REGION_TYPES[pick].desc,
          danger: FS.REGION_TYPES[pick].danger,
          baseCost: baseCost,
          spawnsEnemy: FS.REGION_TYPES[pick].danger >= 1
        });
      });
    });
    // Ensure at least one early affordable safe-ish option
    if (nOpen === 1 && offers.length) {
      var safe = offers.filter(function (o) { return o.danger === 0; })[0] || offers[0];
      safe.baseCost = FS.EXPAND_COSTS[0];
      if (safe.danger > 1) {
        safe.type = "meadow";
        safe.name = FS.REGION_TYPES.meadow.name;
        safe.desc = FS.REGION_TYPES.meadow.desc;
        safe.danger = 0;
        safe.spawnsEnemy = false;
      }
    }
    return offers.slice(0, 3);
  };

  /** Single source of truth for expansion price UI + purchase. */
  FS.getExpansionQuote = function (state, offerOrId) {
    var offer = typeof offerOrId === "string"
      ? (state.world.openOffers || []).filter(function (o) { return o.id === offerOrId; })[0]
      : offerOrId;
    if (!offer) return { ok: false, why: "Пропозиція застаріла — відкрий карту знову" };
    if (state.world.chunks[offer.cx + ":" + offer.cy]) {
      return { ok: false, why: "Ділянка вже відкрита" };
    }
    var discount = (state.effects && state.effects.expandDiscount) || 0;
    var cost = Math.max(2, (offer.baseCost != null ? offer.baseCost : offer.cost) - discount);
    var prev = FS.previewSpend(state, cost);
    return {
      ok: prev.ok,
      offer: offer,
      cost: cost,
      now: prev.now,
      after: prev.after,
      lenNow: prev.lenNow,
      lenAfter: prev.lenAfter,
      why: prev.ok ? null : ("Потрібно " + cost + " поживи, є " + prev.now),
      source: "Пожива (довжина = 3 + пожива)",
      spawnsEnemy: !!offer.spawnsEnemy,
      label: offer.name + " (" + offer.cx + "," + offer.cy + ")"
    };
  };

  FS.purchaseExpansion = function (state, offerId) {
    if (state._expandLock) return { ok: false, why: "Покупка вже виконується", code: "busy" };
    var quote = FS.getExpansionQuote(state, offerId);
    if (!quote.ok) {
      return Object.assign({ code: quote.why && quote.why.indexOf("застаріл") >= 0 ? "stale" : "funds" }, quote);
    }
    var offer = quote.offer;
    state._expandLock = true;
    try {
      var snap = {
        offers: state.world.openOffers.slice(),
        tiles: Object.assign({}, state.world.tiles),
        chunks: Object.assign({}, state.world.chunks),
        landmarks: (state.world.landmarks || []).slice(),
        foods: (state.world.foods || []).slice(),
        enemies: state.enemies.slice(),
        minX: state.world.minX, maxX: state.world.maxX,
        minY: state.world.minY, maxY: state.world.maxY,
        regionTypes: Object.assign({}, state.progress.regionTypes || {}),
        tutorialExpand: !!state.tutorial.done.expand
      };
      function rollbackWorld() {
        state.world.openOffers = snap.offers;
        state.world.tiles = snap.tiles;
        state.world.chunks = snap.chunks;
        state.world.landmarks = snap.landmarks;
        state.world.foods = snap.foods;
        state.world.minX = snap.minX; state.world.maxX = snap.maxX;
        state.world.minY = snap.minY; state.world.maxY = snap.maxY;
        state.enemies = snap.enemies;
        state.progress.regionTypes = snap.regionTypes;
        state.tutorial.done.expand = snap.tutorialExpand;
      }
      var result = FS.spendNutrition(state, quote.cost, function () {
        try {
          FS.applyGeneratedChunk(state.world, offer.cx, offer.cy, offer.type, false);
          state.world.openOffers = FS.computeExpandOffers(state.world);
          state.tutorial.done.expand = true;
          state.progress.regionTypes = state.progress.regionTypes || {};
          state.progress.regionTypes[offer.type] = true;
          if (state.effects && state.effects.expandXp) FS.addXp(state, state.effects.expandXp);
          if (offer.spawnsEnemy) FS.spawnExpandEnemy(state, offer);
          if (offer.danger >= 2 && FS.spawnEnemyBase) FS.spawnEnemyBase(state, offer);
          if (FS.seedTreeInChunk) FS.seedTreeInChunk(state, offer.cx, offer.cy);
          if (FS.ensureDirector) FS.ensureDirector(state);
          state.ui.toast = "Відкрито: " + offer.name + " (−" + quote.cost + " поживи)";
          return { ok: true };
        } catch (err) {
          rollbackWorld();
          return { ok: false, why: "Помилка генерації: " + (err.message || err), code: "gen" };
        }
      }, { reason: "expand", save: true });

      if (!result.ok) rollbackWorld();
      return result;
    } finally {
      state._expandLock = false;
    }
  };

  FS.spawnEnemyBase = function (state, offer) {
    var cx = offer.cx * FS.CHUNK + 8;
    var cy = offer.cy * FS.CHUNK + 8;
    var t = FS.tileAt(state.world, cx, cy);
    if (!t || !FS.tileWalkable(t)) return;
    state.world.landmarks = state.world.landmarks || [];
    state.world.landmarks.push({
      id: FS.uid(), kind: "enemy_nest", chunkId: offer.cx + ":" + offer.cy,
      x: cx, y: cy, name: "Чуже гніздо", done: false
    });
    if (FS.ensureWood) FS.ensureWood(state);
    // light fence ring with a gap (entrance)
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (d, i) {
      if (i === 0) return; // gap north = entrance
      var bx = cx + d[0], by = cy + d[1];
      if (FS.buildingAt(state, bx, by)) return;
      var bt = FS.tileAt(state.world, bx, by);
      if (!bt || !FS.tileWalkable(bt)) return;
      state.buildings.push({
        id: FS.uid(), kind: "fence", x: bx, y: by, rot: 0, hp: 2, owner: "enemy"
      });
    });
  };

  // Back-compat alias
  FS.expandChunk = function (state, offer) {
    if (!offer) return { ok: false, why: "Немає пропозиції" };
    if (!offer.id) offer.id = FS.offerId(offer.cx, offer.cy);
    return FS.purchaseExpansion(state, offer.id);
  };

  FS.spawnExpandEnemy = function (state, offer) {
    var baseX = offer.cx * FS.CHUNK + 6;
    var baseY = offer.cy * FS.CHUNK + 6;
    var archs = ["careful", "intercept", "territory", "elder"];
    var arch = offer.type === "elder" ? "elder" : archs[Math.min(offer.danger, 3)];
    var colors = {
      careful: FS.COLORS.enemyCareful,
      intercept: FS.COLORS.enemyIntercept,
      territory: FS.COLORS.enemyTerritory,
      elder: FS.COLORS.enemyElder
    };
    var enemy = FS.createSnake({
      kind: "enemy",
      name: arch === "elder" ? "Доросла змія" : "Дика змія",
      arch: arch,
      x: baseX, y: baseY,
      dir: "L",
      length: Math.min(FS.MAX_LENGTH, arch === "elder" ? 8 : 5),
      stepPeriod: arch === "intercept" ? 1 / 4.2 : FS.ENEMY_STEP_BASE,
      color: colors[arch],
      detectRange: arch === "elder" ? 11 : 8
    });
    var ph = FS.snakeHead(state.player);
    var tries = 0;
    while (tries < 30) {
      var overlap = enemy.body.some(function (c) {
        return state.player.body.some(function (p) { return p.x === c.x && p.y === c.y; }) ||
          (c.x === ph.x && c.y === ph.y);
      });
      var blocked = enemy.body.some(function (c) { return FS.isBlockedCell(state, c.x, c.y); });
      if (!overlap && !blocked) break;
      enemy.body.forEach(function (c) { c.x += 1; });
      tries++;
    }
    state.enemies.push(enemy);
    state.ui.toast = "Увага: на новій території з’явилась змія!";
    state.tutorial.done.enemyWarn = true;
  };

  FS.tryLandmark = function (state) {
    var h = FS.snakeHead(state.player);
    var list = state.world.landmarks || [];
    for (var i = 0; i < list.length; i++) {
      var lm = list[i];
      if (lm.x !== h.x || lm.y !== h.y) continue;
      if (lm.kind === "bush") { state.tutorial.done.bush = true; continue; }
      if (lm.kind === "drop_pad") continue;
      if (lm.done && lm.kind !== "spring") continue;
      if (lm.kind === "ruin" && !lm.done) {
        var cost = lm.cost || 2;
        state.ui.pendingInteract = { kind: "ruin", id: lm.id, cost: cost };
        state.ui.toast = "Покинута ділянка · F — відновити за " + cost + " поживи";
        if (!state.tutorial.done.poiHint) {
          state.tutorial.done.poiHint = true;
          state.ui.toast = "Жовтий об’єкт — місце інтересу. F підтверджує (не списує саме по собі).";
        }
        return { ok: false, pending: true };
      }
      if (lm.kind === "reward_glade" && !lm.done) {
        lm.done = true;
        FS.addXp(state, 3);
        state.ui.toast = "Галявина: +3 XP";
        FS.saveGame(state, "landmark");
        return { ok: true };
      }
      if (lm.kind === "spring" && !lm.done) {
        lm.done = true;
        state.progress.spring = true;
        state.ui.toast = "Джерело: сусідні ферми ростуть швидше";
        FS.saveGame(state, "landmark");
        return { ok: true };
      }
      if (lm.kind === "fertile_garden" && !lm.done) {
        lm.done = true;
        state.ui.toast = "Родючий сад — місце під першу грядку";
        return { ok: true };
      }
    }
    // Manual farm harvest if standing on ready farm
    var farm = FS.farmAt && FS.farmAt(state, h.x, h.y);
    if (farm && farm.stage === "ready") {
      return FS.harvestFarmManual(state, farm);
    }
    return null;
  };

  FS.pickupAt = function (state, head) {
    for (var i = state.world.foods.length - 1; i >= 0; i--) {
      var f = state.world.foods[i];
      if (f.phase === "bud") continue;
      if (f.x === head.x && f.y === head.y) {
        state.world.foods.splice(i, 1);
        return { kind: "food", item: f };
      }
    }
    return null;
  };

  FS.atNest = function (state) {
    var h = FS.snakeHead(state.player);
    return FS.manhattan(h, state.world.nest) <= 1;
  };
})(window.FoxSerpent);
