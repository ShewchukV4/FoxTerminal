/* FOX SERPENT — nutrition wallet ↔ length 3..12 (single source of truth) */
(function (FS) {
  "use strict";

  FS.MIN_LENGTH = 3;
  FS.MAX_NUTRITION = 9;
  FS.MAX_LENGTH = FS.MIN_LENGTH + FS.MAX_NUTRITION; // 12

  FS.targetLength = function (nutrition) {
    return FS.MIN_LENGTH + FS.clamp(nutrition | 0, 0, FS.MAX_NUTRITION);
  };

  FS.nutritionOf = function (state) {
    return FS.clamp(state.nutrition | 0, 0, FS.MAX_NUTRITION);
  };

  /** Pending segments still owed by growthDebt (visual/HUD). */
  FS.pendingGrowth = function (snake) {
    return Math.max(0, snake.growthDebt | 0);
  };

  /**
   * Align body + growthDebt to target length from nutrition.
   * Grow: only via growthDebt (tail kept on future steps) — never teleport head.
   * Shrink: cancel pending growth first, then pop tail cells.
   */
  FS.syncLengthToNutrition = function (state) {
    var snake = state.player;
    if (!snake || snake.dead) return;
    var target = FS.targetLength(FS.nutritionOf(state));
    var current = snake.body.length;
    var pending = FS.pendingGrowth(snake);
    var effective = current + pending;

    if (effective < target) {
      snake.growthDebt = pending + (target - effective);
      return;
    }
    if (effective > target) {
      var needCut = effective - target;
      // Cancel uncommitted growth first
      if (snake.growthDebt > 0) {
        var cancel = Math.min(snake.growthDebt, needCut);
        snake.growthDebt -= cancel;
        needCut -= cancel;
      }
      while (needCut > 0 && snake.body.length > FS.MIN_LENGTH) {
        snake.body.pop();
        needCut--;
      }
      // Never below min even if wallet says so — wallet already clamped
      while (snake.body.length > target && snake.body.length > FS.MIN_LENGTH) {
        snake.body.pop();
      }
    }
  };

  FS.initNutrition = function (state, n) {
    state.nutrition = FS.clamp(n | 0, 0, FS.MAX_NUTRITION);
    if (state.player) {
      state.player.growthDebt = 0;
      FS.ensureBodyLengthExact(state.player, FS.targetLength(state.nutrition));
    }
  };

  /** Force exact body length without moving head (pad/pop tail along last segment). */
  FS.ensureBodyLengthExact = function (snake, len) {
    len = FS.clamp(len, FS.MIN_LENGTH, FS.MAX_LENGTH);
    snake.growthDebt = 0;
    while (snake.body.length > len) snake.body.pop();
    while (snake.body.length < len) {
      var tail = snake.body[snake.body.length - 1];
      var prev = snake.body[snake.body.length - 2] || tail;
      var dx = tail.x - prev.x, dy = tail.y - prev.y;
      if (dx === 0 && dy === 0) dx = -1;
      snake.body.push({ x: tail.x + (dx || 0), y: tail.y + (dy || 0) });
    }
  };

  /**
   * Gain nutrition from food. Returns { nutritionGain, xpBonus, capped }.
   * Never exceeds wallet 9 or length 12.
   */
  FS.gainNutrition = function (state, amount, xpBase) {
    amount = Math.max(0, amount | 0);
    xpBase = xpBase || 1;
    var before = FS.nutritionOf(state);
    var room = FS.MAX_NUTRITION - before;
    var take = Math.min(amount, room);
    var overflow = amount - take;
    state.nutrition = before + take;
    FS.syncLengthToNutrition(state);
    var xp = xpBase;
    if (overflow > 0) {
      xp += overflow * 2; // excess nutrition → XP only
      state.ui.toast = "Пожива повна · їжа дає лише досвід";
    } else if (take > 0 && state.nutrition >= FS.MAX_NUTRITION) {
      state.ui.toast = "Пожива повна · їжа дає лише досвід";
    }
    return { nutritionGain: take, xpBonus: xp, capped: overflow > 0 || before >= FS.MAX_NUTRITION };
  };

  FS.previewSpend = function (state, cost) {
    cost = cost | 0;
    var now = FS.nutritionOf(state);
    var after = Math.max(0, now - cost);
    return {
      cost: cost,
      now: now,
      after: after,
      lenNow: FS.targetLength(now),
      lenAfter: FS.targetLength(after),
      ok: now >= cost && cost >= 0
    };
  };

  /**
   * Atomic spend: check → debit → sync body → apply(fn) → save.
   * If apply returns { ok:false }, rollback nutrition/body.
   */
  FS.spendNutrition = function (state, cost, applyFn, opts) {
    opts = opts || {};
    if (state._spendLock) return { ok: false, why: "Зачекай" };
    cost = cost | 0;
    if (cost < 0) return { ok: false, why: "Погана ціна" };
    var prevN = FS.nutritionOf(state);
    var prevBody = FS.cloneBody(state.player);
    var prevDebt = state.player.growthDebt | 0;
    if (prevN < cost) return { ok: false, why: "Бракує поживи (" + prevN + "/" + cost + ")" };

    state._spendLock = true;
    try {
      state.nutrition = prevN - cost;
      FS.syncLengthToNutrition(state);
      var result = applyFn ? applyFn(state) : { ok: true };
      if (!result || result.ok === false) {
        state.nutrition = prevN;
        state.player.body = prevBody;
        state.player.growthDebt = prevDebt;
        return result || { ok: false, why: "Скасовано" };
      }
      if (opts.save !== false) FS.saveGame(state, opts.reason || "spend");
      return Object.assign({ ok: true, spent: cost, preview: FS.previewSpend(state, 0) }, result);
    } finally {
      state._spendLock = false;
    }
  };

  /** Enemy length cap (same soft max). */
  FS.capEnemyLength = function (snake) {
    while (snake.body.length > FS.MAX_LENGTH) snake.body.pop();
    if (snake.growthDebt && snake.body.length + snake.growthDebt > FS.MAX_LENGTH) {
      snake.growthDebt = Math.max(0, FS.MAX_LENGTH - snake.body.length);
    }
  };

  /**
   * Migrate old save (cargo / nestMaterials / unlimited growth) → nutrition.
   * Preserves talents, heartsSpent, chunks.
   */
  FS.migrateEconomy = function (data) {
    if (!data || data.migrationVersion >= 2) return data;
    var backup = FS.deepClone(data);
    data._migrationBackup = {
      cargo: data.cargo,
      nestMaterials: data.nestMaterials,
      bodyLen: data.player && data.player.body ? data.player.body.length : 0
    };
    var mat = (data.nestMaterials || 0) + (data.cargo || 0);
    var bodyLen = (data.player && data.player.body && data.player.body.length) || FS.MIN_LENGTH;
    // Prefer body-implied nutrition, blend a little from materials (capped)
    var fromBody = FS.clamp(bodyLen - FS.MIN_LENGTH, 0, FS.MAX_NUTRITION);
    var fromMat = FS.clamp(Math.floor(mat / 3), 0, FS.MAX_NUTRITION);
    data.nutrition = Math.max(fromBody, Math.min(FS.MAX_NUTRITION, fromMat || fromBody));
    data.cargo = 0;
    data.nestMaterials = 0;
    if (data.player && data.player.body) {
      var target = FS.targetLength(data.nutrition);
      while (data.player.body.length > target) data.player.body.pop();
      // growthDebt cleared — no hidden wallet
      data.player.growthDebt = 0;
      while (data.player.body.length < target && data.player.body.length > 0) {
        var t = data.player.body[data.player.body.length - 1];
        var p = data.player.body[data.player.body.length - 2] || t;
        data.player.body.push({
          x: t.x + (t.x === p.x ? 0 : (t.x > p.x ? 1 : -1)),
          y: t.y + (t.y === p.y ? 0 : (t.y > p.y ? 1 : -1))
        });
      }
    }
    if (data.world) data.world.materials = [];
    data.migrationVersion = 2;
    data.migrationNote = "Матеріали → пожива (довжина 3–12). Таланти й карта збережені.";
    data._preMigration = backup;
    return data;
  };
})(window.FoxSerpent);
