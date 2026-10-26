/* FOX SERPENT logic regressions */
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
      cargo: 0,
      nestMaterials: 20,
      xp: 0,
      talentLevel: 1,
      talents: FS.defaultTalents(),
      tutorial: { done: {} },
      progress: { regionBonus: {} },
      time: 0,
      settings: { quality: "medium", muted: true },
      ui: { toast: "" },
      input: FS.createInput(),
      effects: {},
      pauseReasons: { manual: false, panel: false, blur: false },
      paused: false,
      started: true,
      saveRev: 0
    };
    state.player = FS.createPlayerSnake(state.world.nest);
    FS.recomputeEffects(state);
    return state;
  }

  // Tap one step
  (function () {
    var s = fresh();
    var x0 = FS.snakeHead(s.player).x;
    FS.onKeyDown(s, "KeyD", false);
    FS.fixedUpdate(s, 1 / 60);
    assert("tap one step", FS.snakeHead(s.player).x === x0 + 1);
    FS.onKeyUp(s, "KeyD");
    var x1 = FS.snakeHead(s.player).x;
    FS.fixedUpdate(s, 1 / 60);
    FS.fixedUpdate(s, 1 / 60);
    assert("release stops", FS.snakeHead(s.player).x === x1 && s.player.standing);
  })();

  // 180 ignored
  (function () {
    var s = fresh();
    s.player.dir = "R";
    FS.onKeyDown(s, "KeyA", false); // opposite
    var x0 = FS.snakeHead(s.player).x;
    FS.fixedUpdate(s, 1 / 60);
    assert("180 ignored", FS.snakeHead(s.player).x === x0);
  })();

  // AI moves while player stands
  (function () {
    var s = fresh();
    var e = FS.createSnake({ x: 8, y: 5, dir: "L", length: 4, arch: "careful" });
    s.enemies.push(e);
    var x0 = FS.snakeHead(e).x;
    for (var i = 0; i < 40; i++) FS.fixedUpdate(s, 1 / 60);
    assert("AI moves while player stands", FS.snakeHead(e).x !== x0 || e.dir !== "L");
  })();

  // Pause stops AI
  (function () {
    var s = fresh();
    var e = FS.createSnake({ x: 8, y: 5, dir: "L", length: 4 });
    s.enemies.push(e);
    s.paused = true;
    var x0 = FS.snakeHead(e).x;
    for (var i = 0; i < 40; i++) FS.fixedUpdate(s, 1 / 60);
    assert("pause freezes AI", FS.snakeHead(e).x === x0);
  })();

  // Head into wall death / heart
  (function () {
    var s = fresh();
    s.talents.hearts = 1;
    // push player to edge
    s.player.body = [{ x: s.world.minX, y: 5 }, { x: s.world.minX + 1, y: 5 }, { x: s.world.minX + 2, y: 5 }];
    s.player.dir = "L";
    s.input.tapPending = "L";
    FS.fixedUpdate(s, 1 / 60);
    assert("heart spent once", s.talents.hearts === 0 && s.talents.heartsSpent === 1 && !s.player.dead);
  })();

  // Fork A blocks B
  (function () {
    var s = fresh();
    s.talents.points = 10;
    // unlock path to fork_maneuver
    ["turn_buffer", "hold_pace", "length_sense"].forEach(function (id) {
      s.talents.unlocked[id] = true;
    });
    var r = FS.unlockTalent(s, "fork_maneuver", "A");
    assert("fork A ok", r.ok && s.talents.forkPicks.fork_maneuver === "A");
    assert("phase skill", !!s.effects.skills.phaseSelf);
    assert("no heart from A", s.talents.hearts === 0);
  })();

  // Fork B gives heart
  (function () {
    var s = fresh();
    s.talents.points = 10;
    ["turn_buffer", "hold_pace", "length_sense"].forEach(function (id) {
      s.talents.unlocked[id] = true;
    });
    FS.unlockTalent(s, "fork_maneuver", "B");
    assert("fork B heart", s.talents.hearts === 1);
  })();

  // Enemy into standing body dies
  (function () {
    var s = fresh();
    s.player.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }];
    s.player.standing = true;
    s.player.dir = "R";
    var e = FS.createSnake({ x: 4, y: 4, dir: "D", length: 3 });
    // force move into body cell (4,5)
    var movers = [{ snake: e, dir: "D", next: { x: 4, y: 5 } }];
    var res = FS.resolveMoveRound(s, movers);
    assert("enemy dies on standing body", res.deaths.some(function (d) { return d.snake === e; }));
  })();

  // Head-on both die
  (function () {
    var s = fresh();
    var a = s.player;
    a.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
    var e = FS.createSnake({ x: 6, y: 5, dir: "L", length: 2 });
    s.enemies.push(e);
    var res = FS.resolveMoveRound(s, [
      { snake: a, dir: "R", next: { x: 6, y: 5 } },
      { snake: e, dir: "L", next: { x: 5, y: 5 } }
    ]);
    assert("head swap both die", res.deaths.length >= 2);
  })();

  // Order independence
  (function () {
    var s1 = fresh();
    var s2 = fresh();
    function setup(st) {
      st.player.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }];
      var e = FS.createSnake({ id: "e1", x: 6, y: 5, dir: "L", length: 2 });
      st.enemies = [e];
      return e;
    }
    var e1 = setup(s1), e2 = setup(s2);
    var r1 = FS.resolveMoveRound(s1, [
      { snake: s1.player, dir: "R", next: { x: 6, y: 5 } },
      { snake: e1, dir: "L", next: { x: 5, y: 5 } }
    ]);
    var r2 = FS.resolveMoveRound(s2, [
      { snake: e2, dir: "L", next: { x: 5, y: 5 } },
      { snake: s2.player, dir: "R", next: { x: 6, y: 5 } }
    ]);
    assert("order independent death count", r1.deaths.length === r2.deaths.length);
  })();

  // Save hearts spent
  (function () {
    var s = fresh();
    s.talents.hearts = 0;
    s.talents.heartsSpent = 2;
    var snap = FS.serializeState(s);
    var s2 = fresh();
    FS.applySave(s2, snap);
    assert("hearts spent persist", s2.talents.heartsSpent === 2 && s2.talents.hearts === 0);
  })();

  // Start no enemies
  (function () {
    var s = fresh();
    assert("start no enemies", s.enemies.length === 0);
  })();

  // Expand keeps nest coords
  (function () {
    var s = fresh();
    s.nestMaterials = 100;
    var nest = { x: s.world.nest.x, y: s.world.nest.y };
    var offer = s.world.openOffers[0];
    FS.expandChunk(s, offer);
    assert("nest stable", s.world.nest.x === nest.x && s.world.nest.y === nest.y);
    assert("chunk added", Object.keys(s.world.chunks).length >= 2);
  })();

  var el = document.getElementById("out");
  if (el) {
    el.innerHTML = out.map(function (l) {
      return '<div class="' + (l.indexOf("FAIL") === 0 ? "fail" : "ok") + '">' + l + "</div>";
    }).join("") + "<p>" + (failed ? failed + " failed" : "All passed") + "</p>";
  } else {
    out.forEach(function (l) { console.log(l); });
    console.log(failed ? failed + " failed" : "ALL PASSED");
  }
  if (typeof process !== "undefined") process.exitCode = failed ? 1 : 0;
})();
