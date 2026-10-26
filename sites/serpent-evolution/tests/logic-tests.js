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
    FS.recomputeEffects(state);
    FS.initNutrition(state, 0);
    FS.seedStartFood(state);
    return state;
  }

  // New game: 0 nutrition, length 3, no enemies
  (function () {
    var s = fresh();
    assert("start nutrition 0", FS.nutritionOf(s) === 0);
    assert("start length 3", s.player.body.length === 3);
    assert("start no enemies", s.enemies.length === 0);
    assert("start foods present", s.world.foods.length >= 4);
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

  var el = document.getElementById("out");
  if (el) {
    el.innerHTML = out.map(function (l) {
      return '<div class="' + (l.indexOf("FAIL") === 0 ? "fail" : "ok") + '">' + l + "</div>";
    }).join("") + "<p>" + (failed ? failed + " failed" : "All passed") + "</p>";
  }
  if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
})();
