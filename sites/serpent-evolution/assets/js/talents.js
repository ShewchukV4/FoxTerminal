/* FOX SERPENT — talent tree & hearts */
(function (FS) {
  "use strict";

  FS.defaultTalents = function () {
    return {
      unlocked: { root: true },
      forkPicks: {},
      hearts: 0,
      heartsSpent: 0,
      points: 0,
      history: []
    };
  };

  FS.recomputeEffects = function (state) {
    var prevSkills = (state.effects && state.effects.skills) ? state.effects.skills : {};
    var e = {
      turnBuffer: 2,
      playerRate: 5.5,
      foodPreview: false,
      growthHud: false,
      pauseDanger: false,
      spaceHud: false,
      vision: 0,
      xpMul: 1,
      regionIntel: false,
      expandDiscount: 0,
      expandXp: 0,
      gardenCapAdd: 0,
      ripeSpeedMul: 1,
      ripeHud: false,
      fruitArrow: false,
      nestPath: false,
      nestGlow: false,
      nestSafety: false,
      vistaBonus: false,
      deathLoss: 1,
      stealthStand: 1,
      pauseGrid: false,
      standPressure: false,
      bodyWallHint: false,
      enemyLabel: false,
      foresight: false,
      spawnWarn: false,
      aiStateHud: false,
      heartGrace: 0.6,
      killXp: 0,
      dangerXp: false,
      cosmetics: false,
      skills: {}
    };

    Object.keys(state.talents.unlocked).forEach(function (id) {
      var node = FS.TALENTS[id];
      if (!node) return;
      if (node.fork) {
        var pick = state.talents.forkPicks[id];
        if (!pick) return;
        applyEffect(e, node.choices[pick].effect, state);
      } else if (node.effect) {
        applyEffect(e, node.effect, state);
      }
    });

    // Preserve skill cooldowns
    Object.keys(e.skills).forEach(function (k) {
      if (prevSkills[k] && typeof prevSkills[k].t === "number") {
        e.skills[k].t = prevSkills[k].t;
      }
    });
    if (e.skills.phaseSelf && e.phaseCdCut) {
      e.skills.phaseSelf.cd = Math.max(12, (e.skills.phaseSelf.cd || 26) - e.phaseCdCut);
    }

    state.effects = e;
    if (state.player) {
      state.player.stepPeriod = 1 / Math.max(2.5, e.playerRate);
    }
    if (FS.recomputeWoodCap) FS.recomputeWoodCap(state);
    if (FS.recomputePantryCap) FS.recomputePantryCap(state);
  };

  function applyEffect(e, fx) {
    if (!fx || !fx.kind || fx.kind === "none") return;
    if (fx.kind === "turnBuffer") e.turnBuffer = Math.max(e.turnBuffer, fx.value);
    if (fx.kind === "playerRate") e.playerRate += fx.add || 0;
    if (fx.kind === "foodPreview") e.foodPreview = true;
    if (fx.kind === "growthHud") e.growthHud = true;
    if (fx.kind === "pauseDanger") e.pauseDanger = true;
    if (fx.kind === "spaceHud") e.spaceHud = true;
    if (fx.kind === "vision") e.vision += fx.add || 0;
    if (fx.kind === "xpMul") e.xpMul *= fx.mul || 1;
    if (fx.kind === "regionIntel") e.regionIntel = true;
    if (fx.kind === "expandDiscount") e.expandDiscount += fx.value || 0;
    if (fx.kind === "expandXp") e.expandXp += fx.value || 0;
    if (fx.kind === "gardenCapAdd") e.gardenCapAdd += fx.value || 0;
    if (fx.kind === "ripeSpeedMul") e.ripeSpeedMul *= fx.value || 1;
    if (fx.kind === "ripeHud") e.ripeHud = true;
    if (fx.kind === "fruitArrow") e.fruitArrow = true;
    if (fx.kind === "nestPath") e.nestPath = true;
    if (fx.kind === "nestGlow") e.nestGlow = true;
    if (fx.kind === "nestSafety") e.nestSafety = true;
    if (fx.kind === "vistaBonus") e.vistaBonus = true;
    if (fx.kind === "deathLoss") e.deathLoss = fx.mul;
    if (fx.kind === "stealthStand") e.stealthStand *= fx.mul || 1;
    if (fx.kind === "pauseGrid") e.pauseGrid = true;
    if (fx.kind === "standPressure") e.standPressure = true;
    if (fx.kind === "bodyWallHint") e.bodyWallHint = true;
    if (fx.kind === "enemyLabel") e.enemyLabel = true;
    if (fx.kind === "foresight") e.foresight = true;
    if (fx.kind === "spawnWarn") e.spawnWarn = true;
    if (fx.kind === "aiStateHud") e.aiStateHud = true;
    if (fx.kind === "heartGrace") e.heartGrace += fx.add || 0;
    if (fx.kind === "killXp") e.killXp = Math.max(e.killXp, fx.value || 0);
    if (fx.kind === "dangerXp") e.dangerXp = true;
    if (fx.kind === "cosmetics") e.cosmetics = true;
    if (fx.kind === "phaseCdCut") e.phaseCdCut = (e.phaseCdCut || 0) + (fx.value || 0);
    if (fx.kind === "phaseSelf") e.skills.phaseSelf = { cd: fx.cd, t: 0 };
    if (fx.kind === "shedNutrition") e.skills.shed = { keep: fx.keep || 0, cd: fx.cd, t: 0 };
    if (fx.kind === "selfSlow") e.skills.selfSlow = { dur: fx.dur, cd: fx.cd, mul: fx.mul, t: 0 };
    if (fx.kind === "coldBlood") e.skills.coldBlood = { radius: fx.radius, dur: fx.dur, cd: fx.cd, slowMul: fx.slowMul, t: 0 };
    if (fx.kind === "heart") { /* unlock-time only */ }
    if (fx.kind === "soilFarm") e.soilFarm = true;
    if (fx.kind === "soilIgnore") e.soilIgnore = true;
    if (fx.kind === "buildPreview") e.buildPreview = true;
    if (fx.kind === "gardenerRadius") e.gardenerRadius = fx.value || 8;
    if (fx.kind === "harvestCapAdd") e.harvestCapAdd = (e.harvestCapAdd || 0) + (fx.value || 0);
    if (fx.kind === "pantryCapAdd") e.pantryCapAdd = (e.pantryCapAdd || 0) + (fx.value || 0);
    if (fx.kind === "pathLogistics") e.pathLogistics = true;
    if (fx.kind === "allyCapAdd") e.allyCapAdd = (e.allyCapAdd || 0) + (fx.value || 0);
    if (fx.kind === "allyFlee") e.allyFlee = true;
    if (fx.kind === "allyWarn") e.allyWarn = true;
    if (fx.kind === "farmSpeedMul") e.farmSpeedMul = (e.farmSpeedMul || 1) * (fx.value || 1);
  }

  FS.canUnlock = function (state, id) {
    var node = FS.TALENTS[id];
    if (!node) return { ok: false, why: "Невідомий вузол" };
    if (state.talents.unlocked[id]) return { ok: false, why: "Вже відкрито" };
    for (var i = 0; i < node.prereq.length; i++) {
      if (!state.talents.unlocked[node.prereq[i]]) return { ok: false, why: "Потрібен попередній вузол" };
      if (FS.TALENTS[node.prereq[i]] && FS.TALENTS[node.prereq[i]].fork) {
        if (!state.talents.forkPicks[node.prereq[i]]) return { ok: false, why: "Спочатку зроби вибір на розвилці" };
      }
    }
    if (node.fork) return { ok: true, fork: true };
    if ((state.talents.points || 0) < (node.cost || 0)) return { ok: false, why: "Бракує очок талантів" };
    return { ok: true };
  };

  FS.unlockTalent = function (state, id, forkChoice) {
    var node = FS.TALENTS[id];
    var check = FS.canUnlock(state, id);
    if (!check.ok) return check;
    if (node.fork) {
      if (forkChoice !== "A" && forkChoice !== "B") return { ok: false, why: "Обери A або B", needChoice: true };
      if ((state.talents.points || 0) < (node.cost || 0)) return { ok: false, why: "Бракує очок" };
      state.talents.points -= node.cost;
      state.talents.unlocked[id] = true;
      state.talents.forkPicks[id] = forkChoice;
      var choice = node.choices[forkChoice];
      state.talents.unlocked[choice.id] = true;
      if (choice.effect.kind === "heart") {
        state.talents.hearts += choice.effect.value || 1;
        state.ui.toast = "Отримано серце. Воно рятує один раз.";
      } else {
        state.ui.toast = "Талант: " + choice.name;
      }
      state.talents.history.push({ fork: id, pick: forkChoice, t: state.time });
      FS.recomputeEffects(state);
      return { ok: true };
    }
    state.talents.points -= node.cost || 0;
    state.talents.unlocked[id] = true;
    FS.recomputeEffects(state);
    state.ui.toast = "Відкрито: " + node.name;
    return { ok: true };
  };

  FS.tryUseHeart = function (state, reason, cell) {
    if (state.talents.hearts <= 0) return { ok: false };
    state.talents.hearts -= 1;
    state.talents.heartsSpent += 1;
    state.heartPauseT = 0.85;
    state.heartGraceT = state.effects.heartGrace || 0.6;
    state.ui.heartBreak = { reason: reason, cell: cell, t: 0.85 };
    state.ui.toast = "Серце врятувало: " + reason;
    if (state.player._safeBody) {
      state.player.body = FS.deepClone(state.player._safeBody);
      if (state.player.body.length >= 2) FS.syncDirFromBody(state.player);
      else {
        state.player.dir = state.player._safeDir || state.player.dir;
        state.player.requestedDir = state.player.dir;
      }
    } else {
      FS.syncDirFromBody(state.player);
    }
    // Keep nutrition on heart save
    FS.syncLengthToNutrition(state);
    state.player.visualT = 1;
    FS.clearInput(state.input);
    state.player.standing = true;
    state.player._dying = false;
    state.player.dead = false;
    FS.saveGame(state, "heart");
    return { ok: true };
  };

  FS.tickSkills = function (state, dt) {
    var sk = state.effects.skills || {};
    Object.keys(sk).forEach(function (k) {
      if (sk[k].t > 0) sk[k].t -= dt;
    });
    if (state.player.slowT > 0) {
      state.player.slowT -= dt;
      if (state.player.slowT <= 0) state.player.slowMul = 1;
    }
    state.enemies.forEach(function (e) {
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowMul = 1;
      }
    });
    if (state.effects.dangerXp && state.enemies.length) {
      state._dangerXpAcc = (state._dangerXpAcc || 0) + dt;
      if (state._dangerXpAcc > 45) {
        state._dangerXpAcc = 0;
        FS.addXp(state, 1);
      }
    }
  };

  FS.activatePhaseSelf = function (state) {
    var sk = state.effects.skills.phaseSelf;
    if (!sk) return { ok: false, why: "Немає навички" };
    if (sk.t > 0) return { ok: false, why: "Перезарядка" };
    state.player.phaseSelf = true;
    sk.t = sk.cd;
    state.ui.toast = "Вчасний маневр готовий для наступного кроку";
    return { ok: true };
  };

  FS.activateShed = function (state) {
    var sk = state.effects.skills.shed;
    if (!sk) return { ok: false, why: "Немає навички" };
    if (sk.t > 0) return { ok: false, why: "Перезарядка" };
    var keep = sk.keep | 0;
    var cost = FS.nutritionOf(state) - keep;
    if (cost <= 0) {
      state.ui.toast = "Немає поживи для линяння";
      return { ok: false, why: "Порожньо" };
    }
    var r = FS.spendNutrition(state, cost, function () {
      sk.t = sk.cd;
      return { ok: true };
    }, { reason: "shed" });
    if (r.ok) state.ui.toast = "Линяння: пожива " + FS.nutritionOf(state) + " · довжина " + state.player.body.length;
    return r;
  };

  FS.activateSelfSlow = function (state) {
    var sk = state.effects.skills.selfSlow;
    if (!sk) return { ok: false, why: "Немає навички" };
    if (sk.t > 0) return { ok: false, why: "Перезарядка" };
    state.player.slowMul = sk.mul;
    state.player.slowT = sk.dur;
    sk.t = sk.cd;
    state.ui.toast = "М’яке гальмо";
    return { ok: true };
  };

  FS.activateColdBlood = function (state) {
    var sk = state.effects.skills.coldBlood;
    if (!sk) return { ok: false, why: "Немає навички" };
    if (sk.t > 0) return { ok: false, why: "Перезарядка" };
    var h = FS.snakeHead(state.player);
    state.enemies.forEach(function (e) {
      if (FS.manhattan(h, FS.snakeHead(e)) <= sk.radius) {
        e.slowMul = sk.slowMul;
        e.slowT = sk.dur;
      }
    });
    sk.t = sk.cd;
    state.ui.toast = "Холодна кров";
    return { ok: true };
  };

  /** Table for QA: node → effect → consumer */
  FS.TALENT_CONSUMERS = {
    turnBuffer: "input queue max",
    playerRate: "player.stepPeriod",
    pauseDanger: "renderer pause overlay",
    growthHud: "HUD pending growth",
    phaseSelf: "activatePhaseSelf / grid phase",
    spaceHud: "HUD flood",
    selfSlow: "activateSelfSlow",
    phaseCdCut: "recompute phase cd",
    shedNutrition: "activateShed → spendNutrition",
    heartGrace: "tryUseHeart",
    nestGlow: "renderer nest",
    vision: "camera follow",
    xpMul: "addXp",
    ripeHud: "foodHudInfo",
    fruitArrow: "renderer arrow",
    regionIntel: "map panel",
    expandXp: "expandChunk",
    expandDiscount: "expand cost",
    gardenCapAdd: "chunkFoodCapacity",
    ripeSpeedMul: "onFoodEaten delay",
    nestPath: "renderer nest path",
    nestSafety: "AI weights",
    vistaBonus: "landmark vista",
    pauseGrid: "renderer",
    standPressure: "AI",
    bodyWallHint: "HUD",
    stealthStand: "AI detect",
    coldBlood: "activateColdBlood",
    enemyLabel: "HUD",
    spawnWarn: "expand confirm",
    foresight: "renderer",
    killXp: "enemy death",
    dangerXp: "tickSkills",
    cosmetics: "progress patterns",
    aiStateHud: "HUD",
    heart: "unlockTalent grant",
    soilFarm: "canPlaceFarm meadow",
    soilIgnore: "farm soilMul",
    buildPreview: "build panel reasons",
    gardenerRadius: "ally gardener range",
    harvestCapAdd: "farms.dropCap",
    pantryCapAdd: "pantry.cap",
    pathLogistics: "ally path prefer",
    allyCapAdd: "hireAlly cap",
    allyFlee: "ally flee home",
    allyWarn: "ally warn enemy",
    farmSpeedMul: "tickFarms speed"
  };
})(window.FoxSerpent);
