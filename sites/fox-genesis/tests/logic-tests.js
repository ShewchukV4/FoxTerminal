/* Logic regressions for FOX GENESIS upgrade */
(function () {
  var FG = window.FoxGenesis;
  var out = [];
  var failed = 0;

  function assert(name, cond, detail) {
    if (cond) out.push("OK  " + name);
    else {
      failed++;
      out.push("FAIL " + name + (detail ? " — " + detail : ""));
    }
  }

  function mockState() {
    var world = FG.generateWorld(12345);
    var state = {
      world: world,
      player: FG.createPlayer(world.nest.x, world.nest.y + 40),
      colony: FG.initColony(world.nest),
      resources: { biomass: 50, mineral: 20, sample: 5 },
      genes: { dashlegs: { unlocked: true }, regen: { unlocked: true }, membrane: { unlocked: true } },
      allies: [],
      enemies: [],
      projectiles: [],
      hazards: [],
      webs: [],
      particles: [],
      progress: { kills: 0, bosses: {} },
      tutorial: { done: {} },
      settings: { quality: "medium" },
      ui: { toast: "" },
      input: { aim: { x: 0, y: 0 } },
      audio: false,
      generation: 1,
      deaths: 0,
      saveRev: 0
    };
    state.player.body.organs = ["dashlegs", "regen", "membrane"];
    state.player.abilityBinds = { rmb: null, q: null, e: null };
    FG.refreshCreatureStats(state.player);
    FG.ensureAbilityBinds(state.player);
    return state;
  }

  // 1. Acid DoT death → onDeath once
  (function () {
    var state = mockState();
    var en = FG.spawnEnemy("pack", state.player.x + 20, state.player.y, "grove");
    en.hp = 0.05;
    en.hpMax = 28;
    state.enemies.push(en);
    var dropsBefore = state.world.resources.length;
    FG.dealDamage(state, en, 1, state.player, { bypassInvuln: true, dtype: "acid" });
    assert("acid death marks dead", en.dead === true);
    assert("acid death hp 0", en.hp === 0);
    var drops = state.world.resources.length > dropsBefore;
    assert("acid death drops loot", drops);
    var kills = state.progress.kills;
    FG.dealDamage(state, en, 5, state.player, { bypassInvuln: true });
    assert("no double kill credit", state.progress.kills === kills);
  })();

  // 2. Ability energy gate — electric needs 14
  (function () {
    var state = mockState();
    state.player.body.organs = ["electric"];
    state.player.abilityBinds = { rmb: "electric", q: null, e: null };
    state.player.energy = 8;
    state.player.abilityCd = { lmb: 0, rmb: 0, q: 0, e: 0 };
    FG.useOrganAbility(state, "electric", "rmb");
    assert("electric blocked at 8 energy", state.player.energy === 8 && state.player.abilityCd.rmb === 0);
    state.player.energy = 20;
    FG.useOrganAbility(state, "electric", "rmb");
    assert("electric spends 14", Math.abs(state.player.energy - 6) < 0.01);
  })();

  // 3. Regen without biomass — no spend
  (function () {
    var state = mockState();
    state.resources.biomass = 0;
    state.player.energy = 50;
    state.player.hp = 20;
    state.player.abilityCd = { lmb: 0, rmb: 0, q: 0, e: 0 };
    state.player.abilityBinds.e = "regen";
    FG.useOrganAbility(state, "regen", "e");
    assert("regen blocked without biomass", state.player.energy === 50 && state.player.abilityCd.e === 0 && state.player.hp === 20);
  })();

  // 4. Bindings: membrane passive does not steal E from regen
  (function () {
    var state = mockState();
    FG.ensureAbilityBinds(state.player);
    var binds = [state.player.abilityBinds.rmb, state.player.abilityBinds.q, state.player.abilityBinds.e];
    assert("membrane not bound", binds.indexOf("membrane") < 0);
    assert("regen is bound", binds.indexOf("regen") >= 0);
  })();

  // 5. Biome landmarks match
  (function () {
    [1, 12345, 99999, 42, 7].forEach(function (seed) {
      var r = FG.verifyBiomeLandmarks(seed);
      assert("biome landmarks seed " + seed, r.ok, JSON.stringify(r.bad));
    });
  })();

  // 6. Save: empty enemies keeps allies
  (function () {
    var state = mockState();
    var ally = FG.createAlly({ name: "A", role: "hunter", body: FG.defaultBody("mobile") }, state.world.nest.x, state.world.nest.y);
    state.allies = [ally];
    state.enemies = [];
    var snap = FG.serializeState(state);
    assert("serialize empty enemies", Array.isArray(snap.enemies) && snap.enemies.length === 0);
    var state2 = mockState();
    state2.allies = [];
    FG.applySave(state2, snap);
    assert("load keeps ally", state2.allies.length === 1);
    assert("load does not reseed enemies", state2.enemies.length === 0);
  })();

  // 7. Generation requires confirm + cost
  (function () {
    var state = mockState();
    state.world.time = 200;
    state.progress.kills = 5;
    state.atNest = true;
    state.resources = { biomass: 100, mineral: 50, sample: 5 };
    // monkey atNest
    var old = FG.atNest;
    FG.atNest = function () { return true; };
    var g = FG.startNewGeneration(state, "mobile", "tough", { confirmed: false });
    assert("generation needs confirm", g.needConfirm === true);
    var g2 = FG.startNewGeneration(state, "mobile", "tough", { confirmed: true });
    assert("generation pays and advances", g2.ok && state.generation === 2);
    assert("heritage applied", state.player.body.heritage === "tough");
    FG.atNest = old;
  })();

  // 8. Field heal cost
  (function () {
    var state = mockState();
    state.paused = false;
    state.started = true;
    state.player.hp = 10;
    state.player.carrying.biomass = 3;
    state.resources.biomass = 0;
    var r = FG.tryFieldHeal(state);
    assert("field heal ok", r.ok && state.player.hp > 10);
    assert("field heal spent cargo", state.player.carrying.biomass === 0);
  })();

  // 9. bodyStats levels matter
  (function () {
    var body = FG.defaultBody("mobile");
    body.organs = ["carapace"];
    body.levels = { carapace: 1 };
    var a = FG.bodyStats(body).armor;
    body.levels.carapace = 3;
    var b = FG.bodyStats(body).armor;
    assert("organ level raises armor", b > a);
  })();

  document.getElementById("out").innerHTML = out.map(function (line) {
    return '<div class="' + (line.indexOf("FAIL") === 0 ? "fail" : "ok") + '">' + line + "</div>";
  }).join("") + "<p>" + (failed ? failed + " failed" : "All passed") + "</p>";
  document.title = (failed ? "FAIL" : "OK") + " — FOX GENESIS tests";
})();
