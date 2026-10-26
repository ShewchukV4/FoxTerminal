/* FOX SERPENT — talent tree & hearts */
(function (FS) {
  "use strict";

  FS.defaultTalents = function () {
    return {
      unlocked: { root: true },
      forkPicks: {}, // forkId -> "A" | "B"
      hearts: 0,
      heartsSpent: 0,
      points: 0,
      history: []
    };
  };

  FS.recomputeEffects = function (state) {
    var e = {
      turnBuffer: 2,
      playerRate: 5.5,
      foodPreview: false,
      spaceHud: false,
      vision: 0,
      xpMul: 1,
      regionIntel: false,
      cargo: FS.CARGO_BASE,
      firstDeliveryBonus: 0,
      deathLoss: 1,
      stealthStand: 1,
      pauseGrid: false,
      standPressure: false,
      bodyWallHint: false,
      enemyLabel: false,
      foresight: false,
      heartGrace: 0.6,
      materialGlow: false,
      nestSafety: false,
      killXp: 0,
      skipGrowEvery: 0,
      expandDiscount: 0,
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

    state.effects = e;
    state.player.stepPeriod = 1 / e.playerRate;
    state.cargoMax = e.cargo;
  };

  function applyEffect(e, fx, state) {
    if (!fx || !fx.kind || fx.kind === "none") return;
    if (fx.kind === "turnBuffer") e.turnBuffer = fx.value;
    if (fx.kind === "playerRate") e.playerRate += fx.add || 0;
    if (fx.kind === "foodPreview") e.foodPreview = true;
    if (fx.kind === "spaceHud") e.spaceHud = true;
    if (fx.kind === "vision") e.vision += fx.add || 0;
    if (fx.kind === "xpMul") e.xpMul *= fx.mul || 1;
    if (fx.kind === "regionIntel") e.regionIntel = true;
    if (fx.kind === "cargo") {
      e.cargo += fx.add || 0;
      e.firstDeliveryBonus = fx.firstDeliveryBonus || 0;
    }
    if (fx.kind === "deathLoss") e.deathLoss = fx.mul;
    if (fx.kind === "stealthStand") e.stealthStand = fx.mul;
    if (fx.kind === "pauseGrid") e.pauseGrid = true;
    if (fx.kind === "standPressure") e.standPressure = true;
    if (fx.kind === "bodyWallHint") e.bodyWallHint = true;
    if (fx.kind === "enemyLabel") e.enemyLabel = true;
    if (fx.kind === "foresight") e.foresight = true;
    if (fx.kind === "heartGrace") e.heartGrace += fx.add || 0;
    if (fx.kind === "materialGlow") e.materialGlow = true;
    if (fx.kind === "nestSafety") e.nestSafety = true;
    if (fx.kind === "killXp") e.killXp = fx.value;
    if (fx.kind === "skipGrowEvery") e.skipGrowEvery = fx.n;
    if (fx.kind === "expandDiscount") e.expandDiscount = fx.value;
    if (fx.kind === "heart") {
      // hearts granted only at unlock time, not recomputed
    }
    if (fx.kind === "phaseSelf") e.skills.phaseSelf = { cd: fx.cd, t: 0 };
    if (fx.kind === "shed") e.skills.shed = { amount: fx.amount, cd: fx.cd, minLen: fx.minLen, t: 0 };
    if (fx.kind === "coldBlood") e.skills.coldBlood = { radius: fx.radius, dur: fx.dur, cd: fx.cd, slowMul: fx.slowMul, t: 0 };
  }

  FS.canUnlock = function (state, id) {
    var node = FS.TALENTS[id];
    if (!node) return { ok: false, why: "Невідомий вузол" };
    if (state.talents.unlocked[id]) return { ok: false, why: "Вже відкрито" };
    for (var i = 0; i < node.prereq.length; i++) {
      if (!state.talents.unlocked[node.prereq[i]]) return { ok: false, why: "Потрібен попередній вузол" };
      // fork prereq counts as unlocked when picked
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
    // restore last safe body if available
    if (state.player._safeBody) {
      state.player.body = FS.deepClone(state.player._safeBody);
      state.player.dir = state.player._safeDir || state.player.dir;
    }
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
    FS.shrinkSnake(state.player, sk.amount, sk.minLen);
    sk.t = sk.cd;
    state.ui.toast = "Линяння: довжина " + state.player.body.length;
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
})(window.FoxSerpent);
