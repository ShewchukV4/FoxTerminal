/* FOX SERPENT logic regressions — dir + nutrition economy */
(function () {
  var FS = window.FoxSerpent;
  var out = [];
  var failed = 0;
  function assert(name, cond, d) {
    if (cond) out.push("OK  " + name);
    else { failed++; out.push("FAIL " + name + (d ? " — " + d : "")); }
  }

  function fresh() {
    var state = {
      world: FS.buildStartWorld(42),
      enemies: [],
      nutrition: 0,
      xp: 0,
      talentLevel: 1,
      talents: FS.defaultTalents(),
      tutorial: { done: {} },
      progress: { regionBonus: {}, patterns: [], killArch: {}, regionTypes: {} },
      time: 0,
      settings: { quality: "medium", muted: true, reducedMotion: true },
      ui: { toast: "", panel: null },
      input: FS.createInput(),
      effects: {},
      pauseReasons: { manual: false, panel: false, blur: false, guide: false },
      paused: false,
      started: true,
      saveRev: 0
    };
    state.player = FS.createPlayerSnake(state.world.nest);
    state.farms = FS.createFarmsState();
    state.homes = [];
    state.allies = [];
    state.buildings = [];
    state.woodNodes = [];
    state.wood = 0;
    state.woodCap = 12;
    state.pantry = { food: 0, cap: 12, level: 1, reserve: 0 };
    state.buildMode = null;
    FS.recomputeEffects(state);
    FS.initNutrition(state, 0);
    FS.seedStartFood(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    if (FS.ensureWood) FS.ensureWood(state);
    return state;
  }

  // New game: 0 nutrition, length 3, no enemies
  (function () {
    var s = fresh();
    assert("start nutrition 0", FS.nutritionOf(s) === 0);
    assert("start length 3", s.player.body.length === 3);
    assert("start no enemies", s.enemies.length === 0);
    assert("start foods present", s.world.foods.length >= 4);
    assert("start 4 farms", s.farms.list.length >= 4, "n=" + s.farms.list.length);
    assert("food only on farms", s.world.foods.every(function (f) {
      return s.farms.list.some(function (farm) { return farm.x === f.x && farm.y === f.y; });
    }));
  })();

  // Food grows to cap 12; excess no hidden growth
  (function () {
    var s = fresh();
    for (var i = 0; i < 12; i++) {
      FS.onFood(s, { nutrition: 1, xp: 1, x: 0, y: 0, kind: "apple" });
      // flush growth by walking
      while (s.player.growthDebt > 0) {
        var h = FS.snakeHead(s.player);
        FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
      }
    }
    assert("nutrition capped 9", FS.nutritionOf(s) === 9);
    assert("length capped 12", s.player.body.length === 12);
    var debt = s.player.growthDebt;
    FS.onFood(s, { nutrition: 1, xp: 1 });
    assert("no hidden growth past cap", s.player.growthDebt === debt && FS.nutritionOf(s) === 9);
  })();

  // Spend 4 from 9 → 5 / length 8
  (function () {
    var s = fresh();
    FS.initNutrition(s, 9);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    assert("max length 12", s.player.body.length === 12);
    var r = FS.spendNutrition(s, 4, function () { return { ok: true }; }, { save: false });
    assert("spend 4 ok", r.ok && FS.nutritionOf(s) === 5);
    assert("length after spend 8", FS.targetLength(5) === 8 && s.player.body.length === 8);
    FS.spendNutrition(s, 5, function () { return { ok: true }; }, { save: false });
    assert("spend to 0 length 3", FS.nutritionOf(s) === 0 && s.player.body.length === 3);
  })();

  // Pending growth cancelled on spend
  (function () {
    var s = fresh();
    s.nutrition = 5;
    s.player.growthDebt = 2;
    // body still 3, pending 2 → effective 5; spend 2 → target 3+3=6? wait nutrition 5-2=3 → target 6
    // Actually: nutrition 5 target 8; body 3 + debt 2 = 5 effective, need sync first
    FS.syncLengthToNutrition(s);
    assert("pending after sync", s.player.body.length + s.player.growthDebt === 8);
    FS.spendNutrition(s, 3, function () { return { ok: true }; }, { save: false });
    assert("after spend pending+body = target", s.player.body.length + s.player.growthDebt === FS.targetLength(FS.nutritionOf(s)));
  })();

  // Insufficient funds no change
  (function () {
    var s = fresh();
    FS.initNutrition(s, 2);
    var body = FS.cloneBody(s.player);
    var r = FS.spendNutrition(s, 5, function () { return { ok: true }; }, { save: false });
    assert("insufficient rejected", !r.ok && FS.nutritionOf(s) === 2);
    assert("body unchanged", body.length === s.player.body.length);
  })();

  // Double spend lock
  (function () {
    var s = fresh();
    FS.initNutrition(s, 6);
    s._spendLock = true;
    var r = FS.spendNutrition(s, 2, function () { return { ok: true }; }, { save: false });
    assert("spend lock", !r.ok);
    s._spendLock = false;
  })();

  // Dir bug regression W→A
  (function () {
    var s = fresh();
    FS.onKeyDown(s, "KeyW", false);
    FS.fixedUpdate(s, 1 / 60);
    FS.onKeyUp(s, "KeyW");
    assert("after W dir=U", s.player.dir === "U");
    FS.onKeyDown(s, "KeyA", false);
    FS.fixedUpdate(s, 1 / 60);
    FS.onKeyUp(s, "KeyA");
    assert("after A dir=L", s.player.dir === "L");
  })();

  // W→S reverse ignored
  (function () {
    var s = fresh();
    FS.onKeyDown(s, "KeyW", false);
    FS.fixedUpdate(s, 1 / 60);
    FS.onKeyUp(s, "KeyW");
    var h0 = FS.snakeHead(s.player);
    FS.onKeyDown(s, "KeyS", false);
    FS.fixedUpdate(s, 1 / 60);
    assert("S ignored", FS.cellEq(FS.snakeHead(s.player), h0) && s.player.dir === "U");
  })();

  // Tap / release
  (function () {
    var s = fresh();
    var x0 = FS.snakeHead(s.player).x;
    FS.onKeyDown(s, "KeyD", false);
    FS.fixedUpdate(s, 1 / 60);
    assert("tap step", FS.snakeHead(s.player).x === x0 + 1);
    FS.onKeyUp(s, "KeyD");
    var x1 = FS.snakeHead(s.player).x;
    FS.fixedUpdate(s, 1 / 60);
    assert("release stops", FS.snakeHead(s.player).x === x1 && s.player.standing);
  })();

  // First expand: quote == purchase, affordable at 3
  (function () {
    var s = fresh();
    FS.initNutrition(s, 3);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    var offer = s.world.openOffers[0];
    assert("offer has id", !!offer.id);
    var q = FS.getExpansionQuote(s, offer.id);
    assert("first expand cost <=3", q.cost <= 3 && q.ok, "cost=" + q.cost + " " + q.why);
    var before = FS.nutritionOf(s);
    var er = FS.purchaseExpansion(s, offer.id);
    assert("expand ok", er.ok && Object.keys(s.world.chunks).length >= 2);
    assert("quote matched debit", FS.nutritionOf(s) === before - q.cost);
    // double purchase same id fails
    var er2 = FS.purchaseExpansion(s, offer.id);
    assert("no double expand", !er2.ok);
  })();

  // Seeds differ; same seed stable
  (function () {
    var a = FS.generateChunkGrid(1001, 1, 0, "meadow", false);
    var b = FS.generateChunkGrid(1001, 1, 0, "meadow", false);
    var c = FS.generateChunkGrid(1002, 1, 0, "meadow", false);
    assert("same seed stable", a.grid[5][5] === b.grid[5][5] && a.farmSpot.x === b.farmSpot.x);
    var diff = false;
    for (var y = 0; y < 12 && !diff; y++) for (var x = 0; x < 12; x++) if (a.grid[y][x] !== c.grid[y][x]) diff = true;
    assert("different seeds differ", diff);
  })();

  // Farm place + cycle produce store
  (function () {
    var s = fresh();
    FS.initNutrition(s, 5);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    var spot = s.world.chunks["0:0"].farmSpot;
    // move head conceptually — place at farmSpot
    var r = FS.purchaseFarm(s, spot.x, spot.y, "berry");
    assert("farm planted", r.ok, r.why);
    var farm = s.farms.list[0];
    farm.t = 999;
    farm.stage = "growing";
    FS.tickFarms(s, 1);
    assert("farm ready or store", farm.stage === "ready" || farm.store.length > 0);
  })();

  // 50 seeds first expand quote affordable
  (function () {
    var bad = 0;
    for (var seed = 1; seed <= 50; seed++) {
      var w = FS.buildStartWorld(seed);
      var st = { world: w, effects: {}, nutrition: 9, player: { body: [{ x: 5, y: 5 }], growthDebt: 0 } };
      // minimal previewSpend deps
      st.player = FS.createPlayerSnake(w.nest);
      FS.initNutrition(st, 9);
      var o = w.openOffers[0];
      if (!o) { bad++; continue; }
      var q = FS.getExpansionQuote(st, o.id);
      if (!q.ok || q.cost > 9) bad++;
    }
    assert("50 seeds first expand reachable", bad === 0, "bad=" + bad);
  })();

  // Heart keeps nutrition
  (function () {
    var s = fresh();
    FS.initNutrition(s, 4);
    s.talents.hearts = 1;
    s.player.body = [{ x: s.world.minX, y: 5 }, { x: s.world.minX + 1, y: 5 }, { x: s.world.minX + 2, y: 5 }, { x: s.world.minX + 3, y: 5 }, { x: s.world.minX + 4, y: 5 }, { x: s.world.minX + 5, y: 5 }, { x: s.world.minX + 6, y: 5 }];
    FS.syncDirFromBody(s.player);
    FS.storeSafeBody(s);
    s.input.tapPending = "L";
    FS.fixedUpdate(s, 1 / 60);
    assert("heart keeps nutrition", !s.player.dead && FS.nutritionOf(s) === 4 && s.talents.hearts === 0);
  })();

  // Death resets nutrition
  (function () {
    var s = fresh();
    FS.initNutrition(s, 6);
    s.talents.hearts = 0;
    s.player.body = [{ x: s.world.minX, y: 5 }, { x: s.world.minX + 1, y: 5 }, { x: s.world.minX + 2, y: 5 }];
    s.player.dir = "L";
    s.input.tapPending = "L";
    FS.fixedUpdate(s, 1 / 60);
    assert("death nutrition 0", s.player.dead && FS.nutritionOf(s) === 0);
  })();

  // Migrate old save
  (function () {
    var s = fresh();
    FS.initNutrition(s, 0);
    var snap = FS.serializeState(s);
    snap.schema = 1;
    snap.migrationVersion = 1;
    snap.cargo = 6;
    snap.nestMaterials = 9;
    snap.nutrition = undefined;
    snap.player.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }];
    snap.talents.heartsSpent = 1;
    var s2 = fresh();
    FS.applySave(s2, snap);
    assert("migrated nutrition", FS.nutritionOf(s2) >= 0 && FS.nutritionOf(s2) <= 9);
    assert("migrated hearts spent", s2.talents.heartsSpent === 1);
    assert("migrated length ok", s2.player.body.length === FS.targetLength(FS.nutritionOf(s2)));
  })();

  // Food director pause
  (function () {
    var s = fresh();
    FS.ensureDirector(s);
    var id = "0:0";
    s.foodDirector.slots[id].pending = [{ t: 1, kind: "apple" }];
    var before = s.world.foods.length;
    s.paused = true;
    FS.tickFoodDirector(s, 5);
    assert("paused food no tick", s.foodDirector.slots[id].pending[0].t === 1);
    s.paused = false;
    FS.tickFoodDirector(s, 5);
    assert("food director advanced", s.foodDirector.slots[id].pending.length === 0 || s.world.foods.length >= before);
  })();

  // Talent count + consumers
  (function () {
    var nodes = Object.keys(FS.TALENTS).filter(function (id) {
      return FS.TALENTS[id] && !FS.TALENTS[id].fork;
    });
    var forks = Object.keys(FS.TALENTS).filter(function (id) { return FS.TALENTS[id].fork; });
    assert("talents ~40+", nodes.length + forks.length >= 40, "n=" + (nodes.length + forks.length));
    assert("forks >=8", forks.length >= 8, "f=" + forks.length);
    var missing = [];
    Object.keys(FS.TALENTS).forEach(function (id) {
      var n = FS.TALENTS[id];
      var fx = n.fork ? null : n.effect;
      if (n.fork) {
        ["A", "B"].forEach(function (c) {
          var k = n.choices[c].effect.kind;
          if (k !== "none" && k !== "heart" && !FS.TALENT_CONSUMERS[k]) missing.push(k);
        });
      } else if (fx && fx.kind !== "none" && !FS.TALENT_CONSUMERS[fx.kind]) missing.push(fx.kind);
    });
    assert("all effects have consumers", missing.length === 0, missing.join(","));
  })();

  // Talent layout: no rectangle overlap, unique col/row
  (function () {
    var keys = {};
    var dup = 0;
    FS.TALENT_LAYOUT.forEach(function (L) {
      var k = L.col + ":" + L.row;
      if (keys[k]) dup++;
      keys[k] = L.id;
    });
    assert("talent unique slots", dup === 0, "dups=" + dup);
    var hits = FS.talentLayoutOverlaps();
    assert("talent no pixel overlap", hits.length === 0, hits.slice(0, 5).join(","));
    var missing = Object.keys(FS.TALENTS).filter(function (id) {
      return !FS.TALENT_LAYOUT.some(function (L) { return L.id === id; });
    });
    assert("all talents in layout", missing.length === 0, missing.join(","));
  })();

  // Wood ≠ nutrition; branches only near trees
  (function () {
    var s = fresh();
    FS.seedWoodNodes(s);
    var trees = s.woodNodes.filter(function (n) { return n.kind === "tree"; });
    var woods = s.woodNodes.filter(function (n) { return n.kind === "wood"; });
    assert("has trees", trees.length >= 1, "t=" + trees.length);
    assert("branches near trees", woods.length >= 1 && woods.every(function (w) {
      return trees.some(function (t) { return FS.manhattan(w, t) <= 1; });
    }));
    var nut = FS.nutritionOf(s);
    var w0 = s.wood;
    FS.gainWood(s, 2);
    assert("wood gain no nutrition", FS.nutritionOf(s) === nut && s.wood === w0 + 2);
    var spot = { x: s.world.nest.x + 2, y: s.world.nest.y + 2 };
    var br = FS.commitBuild(s, spot.x, spot.y, "fence");
    assert("fence build", br.ok, br.why);
    assert("fence blocks enemy", !!FS.isBlockedCell(s, spot.x, spot.y, { kind: "enemy" }));
    assert("fence blocks player", !!FS.isBlockedCell(s, spot.x, spot.y, s.player));
    var gateSpot = { x: spot.x + 1, y: spot.y };
    s.wood += 2;
    var gr = FS.commitBuild(s, gateSpot.x, gateSpot.y, "gate");
    assert("gate build", gr.ok, gr.why);
    assert("closed gate blocks enemy", !!FS.isBlockedCell(s, gateSpot.x, gateSpot.y, { kind: "enemy" }));
    assert("gate open for player", !FS.isBlockedCell(s, gateSpot.x, gateSpot.y, s.player));
    var lenBefore = s.player.body.length;
    FS.spendWood(s, 1, function () { return { ok: true }; }, { save: false });
    assert("wood spend keeps length", s.player.body.length === lenBefore);
  })();

  // Build mode freezes player; enemies still scheduled
  (function () {
    var s = fresh();
    FS.enterBuildMode(s);
    assert("build mode on", s.buildMode && s.buildMode.on && !s.paused);
    var hx = FS.snakeHead(s.player).x;
    s.input.tapPending = "R";
    FS.fixedUpdate(s, 1 / 60);
    assert("build freezes player", FS.snakeHead(s.player).x === hx && s.player.standing);
    FS.exitBuildMode(s);
    assert("exit clears build", !s.buildMode);
  })();

  // Expand rollback snapshot restores chunks on gen fail (simulated)
  (function () {
    var s = fresh();
    FS.initNutrition(s, 5);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    var offer = s.world.openOffers[0];
    var beforeChunks = Object.keys(s.world.chunks).length;
    var real = FS.applyGeneratedChunk;
    FS.applyGeneratedChunk = function () { throw new Error("boom"); };
    var er = FS.purchaseExpansion(s, offer.id);
    FS.applyGeneratedChunk = real;
    assert("gen fail rolls back", !er.ok && Object.keys(s.world.chunks).length === beforeChunks);
    assert("gen fail refunds nutrition", FS.nutritionOf(s) === 5);
  })();

  // Guide pause resources
  (function () {
    var s = fresh();
    FS.initNutrition(s, 4);
    FS.setPauseReason(s, "manual", true);
    if (document.getElementById("ui-root")) {
      FS.openGuide(s, { firstRun: true });
      assert("guide open", s.guide.open && s.paused);
      FS.closeGuide(s, true);
      assert("guide close keeps nutrition", FS.nutritionOf(s) === 4 && s.pauseReasons.manual);
    } else assert("guide skip", true);
  })();

  // Head-on / order
  (function () {
    var s = fresh();
    s.player.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
    var e = FS.createSnake({ x: 6, y: 5, dir: "L", length: 2 });
    s.enemies.push(e);
    var res = FS.resolveMoveRound(s, [
      { snake: s.player, dir: "R", next: { x: 6, y: 5 } },
      { snake: e, dir: "L", next: { x: 5, y: 5 } }
    ]);
    assert("head swap deaths", res.deaths.length >= 2);
  })();

  // Pantry deposit/withdraw preserves sum; shortens on deposit
  (function () {
    var s = fresh();
    FS.initNutrition(s, 7);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    s.player.body = [
      { x: s.world.nest.x + 1, y: s.world.nest.y },
      { x: s.world.nest.x, y: s.world.nest.y },
      { x: s.world.nest.x - 1, y: s.world.nest.y },
      { x: s.world.nest.x - 2, y: s.world.nest.y },
      { x: s.world.nest.x - 3, y: s.world.nest.y },
      { x: s.world.nest.x - 4, y: s.world.nest.y },
      { x: s.world.nest.x - 5, y: s.world.nest.y },
      { x: s.world.nest.x - 6, y: s.world.nest.y },
      { x: s.world.nest.x - 7, y: s.world.nest.y },
      { x: s.world.nest.x - 8, y: s.world.nest.y }
    ];
    assert("near pantry", FS.nearPantry(s));
    var sum0 = FS.nutritionOf(s) + s.pantry.food;
    var xp0 = s.xp;
    var r = FS.pantryTransfer(s, "deposit", 4);
    assert("deposit ok", r.ok, r.why);
    assert("deposit sum", FS.nutritionOf(s) + s.pantry.food === sum0);
    assert("deposit no xp", s.xp === xp0);
    assert("deposit shortens", FS.targetLength(FS.nutritionOf(s)) === 3 + FS.nutritionOf(s));
    assert("body synced", s.player.body.length + (s.player.growthDebt | 0) === FS.targetLength(FS.nutritionOf(s)));
    var sum1 = FS.nutritionOf(s) + s.pantry.food;
    var w = FS.pantryTransfer(s, "withdraw", 2);
    assert("withdraw ok", w.ok, w.why);
    assert("withdraw sum", FS.nutritionOf(s) + s.pantry.food === sum1);
    assert("withdraw no xp", s.xp === xp0);
    // partial when full pantry
    s.pantry.food = s.pantry.cap - 1;
    FS.initNutrition(s, 5);
    s.player.body = [
      { x: s.world.nest.x + 1, y: s.world.nest.y },
      { x: s.world.nest.x, y: s.world.nest.y },
      { x: s.world.nest.x - 1, y: s.world.nest.y },
      { x: s.world.nest.x - 2, y: s.world.nest.y },
      { x: s.world.nest.x - 3, y: s.world.nest.y },
      { x: s.world.nest.x - 4, y: s.world.nest.y },
      { x: s.world.nest.x - 5, y: s.world.nest.y },
      { x: s.world.nest.x - 6, y: s.world.nest.y }
    ];
    var p = FS.previewPantryDeposit(s, 5);
    assert("partial deposit preview", p.take === 1);
  })();

  // B-build plot must succeed (farm before building entry)
  (function () {
    var s = fresh();
    s.wood = 10;
    FS.initNutrition(s, 2);
    while (s.player.growthDebt > 0) {
      var h = FS.snakeHead(s.player);
      FS.commitSnakeMove(s.player, { x: h.x + 1, y: h.y }, "R");
    }
    var nest = s.world.nest;
    var spot = null;
    for (var dx = 3; dx < 8 && !spot; dx++) {
      for (var dy = -2; dy <= 3; dy++) {
        if (FS.canBuildAt(s, nest.x + dx, nest.y + dy, "plot").ok) {
          spot = { x: nest.x + dx, y: nest.y + dy };
          break;
        }
      }
    }
    assert("plot spot", !!spot);
    var nFarms = s.farms.list.length;
    var r = spot ? FS.commitBuild(s, spot.x, spot.y, "plot") : { ok: false, why: "no spot" };
    assert("plot build ok", r.ok, r.why);
    assert("plot farm added", s.farms.list.length === nFarms + 1);
    assert("plot building entry", !!FS.buildingAt(s, spot.x, spot.y));
  })();

  // Farmable dry land; water/stone blocked
  (function () {
    var s = fresh();
    var nest = s.world.nest;
    var dry = null;
    for (var dx = 3; dx < 8 && !dry; dx++) {
      for (var dy = -2; dy <= 2; dy++) {
        var g = FS.isFarmableGround(s, nest.x + dx, nest.y + dy);
        if (g.ok && !FS.farmAt(s, nest.x + dx, nest.y + dy)) {
          dry = { x: nest.x + dx, y: nest.y + dy };
          break;
        }
      }
    }
    assert("found dry farmable", !!dry);
    if (dry) {
      var c = FS.canPlaceFarm(s, dry.x, dry.y, "berry");
      assert("can place on dry", c.ok, c.why);
    }
    // plant water tile nearby if any
    var waterHit = false;
    for (var x = nest.x - 10; x < nest.x + 10; x++) {
      for (var y = nest.y - 10; y < nest.y + 10; y++) {
        var t = FS.tileAt(s.world, x, y);
        if (t && (t.tt === "shallow" || t.tt === "deep")) {
          var bad = FS.isFarmableGround(s, x, y);
          assert("water not farmable", !bad.ok);
          waterHit = true;
          x = nest.x + 99;
          break;
        }
      }
    }
    if (!waterHit) assert("water check skip", true);
  })();

  // Wood cap derived from sheds; fence row all-or-nothing
  (function () {
    var s = fresh();
    s.wood = 20;
    FS.ensureWood(s);
    var cap0 = s.woodCap;
    var nest = s.world.nest;
    var spot = null;
    for (var dx = 2; dx < 6 && !spot; dx++) {
      for (var dy = 2; dy < 5; dy++) {
        var chk = FS.canBuildAt(s, nest.x + dx, nest.y + dy, "shed");
        if (chk.ok) { spot = { x: nest.x + dx, y: nest.y + dy }; break; }
      }
    }
    assert("shed spot", !!spot);
    var sh = spot ? FS.commitBuild(s, spot.x, spot.y, "shed") : { ok: false };
    assert("shed build", sh.ok, sh.why);
    FS.ensureWood(s);
    assert("shed raises woodCap", s.woodCap === cap0 + FS.WOOD_PER_SHED, "cap=" + s.woodCap);
    // fence row near nest on open cells
    var cells = [];
    for (var fx = nest.x - 2; fx <= nest.x + 2 && cells.length < 3; fx++) {
      var cy = nest.y + 4;
      var fc = FS.canBuildAt(s, fx, cy, "fence");
      if (fc.ok) cells.push({ x: fx, y: cy });
    }
    assert("fence cells", cells.length === 3, "n=" + cells.length);
    function stateBuildCount(st) { return (st.buildings || []).length; }
    s.wood = 2;
    var before = stateBuildCount(s);
    var fr = FS.commitFenceRow(s, cells);
    assert("fence row refuse", !fr.ok);
    assert("fence row no partial", stateBuildCount(s) === before);
    s.wood = 10;
    fr = FS.commitFenceRow(s, cells);
    assert("fence row ok", fr.ok, fr.why);
    assert("fence row all", stateBuildCount(s) === before + 3);
  })();

  // Guide board helper exists
  (function () {
    assert("drawGuideBoard", typeof FS.drawGuideBoard === "function");
    assert("guide has pantry scene", FS.GUIDE_STEPS.some(function (g) { return g.scene === "pantry"; }));
  })();

  // Ally deliver to pantry no XP
  (function () {
    var s = fresh();
    FS.ensurePantry(s);
    var ally = { carry: { kind: "berry" }, stateAI: "deliver" };
    var xp0 = s.xp;
    var food0 = s.pantry.food;
    var r = FS.allyDeliverToPantry(s, ally);
    assert("ally deliver", r.ok && s.pantry.food === food0 + 1 && !ally.carry);
    assert("ally deliver no xp", s.xp === xp0);
    s.pantry.food = s.pantry.cap;
    ally.carry = { kind: "berry" };
    r = FS.allyDeliverToPantry(s, ally);
    assert("ally wait full", !r.ok && ally.carry && ally.stateAI === "wait_pantry");
  })();

  var el = document.getElementById("out");
  if (el) {
    el.innerHTML = out.map(function (l) {
      return '<div class="' + (l.indexOf("FAIL") === 0 ? "fail" : "ok") + '">' + l + "</div>";
    }).join("") + "<p>" + (failed ? failed + " failed" : "All passed") + "</p>";
  }
  if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
})();
