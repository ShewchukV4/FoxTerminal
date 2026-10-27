/* FOX SERPENT — base food pantry (carried 0–9 vs base stock) */
(function (FS) {
  "use strict";

  FS.PANTRY_BASE_CAP = 12;
  FS.PANTRY_PER_LARDER = 8;

  FS.ensurePantry = function (state) {
    if (!state.pantry) {
      state.pantry = { food: 0, cap: FS.PANTRY_BASE_CAP, level: 1, reserve: 0 };
    }
    if (state.pantry.food == null || !isFinite(state.pantry.food)) state.pantry.food = 0;
    if (state.pantry.food < 0) state.pantry.food = 0;
    state.pantry.food = Math.floor(state.pantry.food);
    FS.recomputePantryCap(state);
  };

  FS.countLarders = function (state) {
    if (!state.buildings) return 0;
    var n = 0;
    for (var i = 0; i < state.buildings.length; i++) {
      if (state.buildings[i].kind === "larder" && state.buildings[i].owner !== "enemy") n++;
    }
    return n;
  };

  FS.recomputePantryCap = function (state) {
    if (!state.pantry) {
      state.pantry = { food: 0, cap: FS.PANTRY_BASE_CAP, level: 1, reserve: 0 };
    }
    var add = FS.countLarders(state) * FS.PANTRY_PER_LARDER;
    var talent = (state.effects && state.effects.pantryCapAdd) || 0;
    var levelBonus = Math.max(0, ((state.pantry.level || 1) - 1) * 4);
    state.pantry.cap = FS.PANTRY_BASE_CAP + add + talent + levelBonus;
    // Never destroy overflow on recompute — clamp only when depositing
  };

  FS.pantryAccessPoint = function (state) {
    FS.ensureWood(state);
    // Prefer food larder building; else nest
    var best = null;
    (state.buildings || []).forEach(function (b) {
      if (b.kind === "larder" && b.owner !== "enemy") {
        if (!best) best = b;
      }
    });
    if (best) return { x: best.x, y: best.y, kind: "larder" };
    return { x: state.world.nest.x, y: state.world.nest.y, kind: "nest" };
  };

  FS.nearPantry = function (state) {
    var h = FS.snakeHead(state.player);
    var p = FS.pantryAccessPoint(state);
    return FS.manhattan(h, p) <= 1;
  };

  FS.previewPantryDeposit = function (state, n) {
    FS.ensurePantry(state);
    n = Math.floor(+n || 0);
    if (n < 0 || !isFinite(n)) return { ok: false, why: "Погана кількість" };
    var carried = FS.nutritionOf(state);
    var room = Math.max(0, state.pantry.cap - state.pantry.food);
    var take = Math.min(n, carried, room);
    return {
      ok: take > 0 || n === 0,
      ask: n,
      take: take,
      carried: carried,
      carriedAfter: carried - take,
      lenNow: FS.targetLength(carried),
      lenAfter: FS.targetLength(carried - take),
      pantry: state.pantry.food,
      pantryAfter: state.pantry.food + take,
      pantryCap: state.pantry.cap,
      why: take < n
        ? (carried < n && room < n
          ? "Обмежено поживою й місцем"
          : (carried < n ? "На змійці лише " + carried : "У складі місце на " + room))
        : null
    };
  };

  FS.previewPantryWithdraw = function (state, n) {
    FS.ensurePantry(state);
    n = Math.floor(+n || 0);
    if (n < 0 || !isFinite(n)) return { ok: false, why: "Погана кількість" };
    var carried = FS.nutritionOf(state);
    var room = FS.MAX_NUTRITION - carried;
    var available = Math.max(0, state.pantry.food - (state.pantry.reserve || 0));
    var take = Math.min(n, available, room);
    return {
      ok: take > 0 || n === 0,
      ask: n,
      take: take,
      carried: carried,
      carriedAfter: carried + take,
      lenNow: FS.targetLength(carried),
      lenAfter: FS.targetLength(carried + take),
      pantry: state.pantry.food,
      pantryAfter: state.pantry.food - take,
      pantryCap: state.pantry.cap,
      why: take < n
        ? (available < n && room < n
          ? "Обмежено складом і лімітом 9"
          : (available < n ? "У складі доступно " + available : "Carried повний (" + carried + "/9)"))
        : null
    };
  };

  /**
   * Atomic transfer. No XP. Preserves sum carried+pantry.
   * Deposit shortens via syncLengthToNutrition.
   */
  FS.pantryTransfer = function (state, dir, n) {
    if (state._pantryLock) return { ok: false, why: "Зачекай" };
    if (!FS.nearPantry(state)) return { ok: false, why: "Підійди до складу / гнізда (F)" };
    FS.ensurePantry(state);
    n = Math.floor(+n || 0);
    if (n <= 0 || !isFinite(n)) return { ok: false, why: "Вкажи кількість ≥ 1" };

    var prevCarried = FS.nutritionOf(state);
    var prevPantry = state.pantry.food;
    var prevBody = FS.cloneBody(state.player);
    var prevDebt = state.player.growthDebt | 0;

    state._pantryLock = true;
    try {
      var prev;
      if (dir === "deposit") {
        prev = FS.previewPantryDeposit(state, n);
        if (!prev.take) return { ok: false, why: prev.why || "Нічого скласти" };
        state.nutrition = prevCarried - prev.take;
        state.pantry.food = prevPantry + prev.take;
        FS.syncLengthToNutrition(state);
      } else if (dir === "withdraw") {
        prev = FS.previewPantryWithdraw(state, n);
        if (!prev.take) return { ok: false, why: prev.why || "Нічого взяти" };
        state.nutrition = prevCarried + prev.take;
        state.pantry.food = prevPantry - prev.take;
        FS.syncLengthToNutrition(state);
      } else {
        return { ok: false, why: "Невідома дія" };
      }

      // Invariant: sum preserved
      if (FS.nutritionOf(state) + state.pantry.food !== prevCarried + prevPantry) {
        state.nutrition = prevCarried;
        state.pantry.food = prevPantry;
        state.player.body = prevBody;
        state.player.growthDebt = prevDebt;
        return { ok: false, why: "Помилка інваріанту — скасовано" };
      }

      state.tutorial.done.pantry = true;
      FS.saveGame(state, "pantry");
      return {
        ok: true,
        dir: dir,
        moved: prev.take,
        preview: prev
      };
    } catch (err) {
      state.nutrition = prevCarried;
      state.pantry.food = prevPantry;
      state.player.body = prevBody;
      state.player.growthDebt = prevDebt;
      return { ok: false, why: "Помилка: " + (err.message || err) };
    } finally {
      state._pantryLock = false;
    }
  };

  FS.openPantryPanel = function (state) {
    if (!FS.nearPantry(state)) {
      state.ui.toast = "Підійди до складу або гнізда";
      return;
    }
    state.ui.panel = "pantry";
    state.ui.panelDirty = true;
    FS.setPauseReason(state, "panel", true);
  };

  FS.htmlPantry = function (state) {
    FS.ensurePantry(state);
    var d1 = FS.previewPantryDeposit(state, 1);
    var dAll = FS.previewPantryDeposit(state, FS.nutritionOf(state));
    var w1 = FS.previewPantryWithdraw(state, 1);
    var wMax = FS.previewPantryWithdraw(state, FS.MAX_NUTRITION);
    var html = '<div class="panel-head"><h2>Склад їжі</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p>На змійці: <b>' + d1.carried + '</b>/9 · довжина ' + d1.lenNow +
      ' · На базі: <b>' + state.pantry.food + '</b>/' + state.pantry.cap + "</p>";
    html += '<p class="tiny">Перекладання не дає XP. Скласти — хвіст коротшає. Взяти — тіло росте на кроках.</p>';
    html += '<div class="offer"><b>Скласти</b>';
    html += '<p class="tiny">1 → carried ' + d1.carried + '→' + d1.carriedAfter +
      ', довжина ' + d1.lenNow + '→' + d1.lenAfter + ', база ' + d1.pantry + '→' + d1.pantryAfter + "</p>";
    html += '<button class="btn primary" data-pantry="deposit:1"' + (d1.take ? "" : " disabled") + ">Скласти 1</button> ";
    html += '<button class="btn" data-pantry="deposit:' + dAll.take + '"' + (dAll.take ? "" : " disabled") +
      ">Скласти все (" + dAll.take + ")</button></div>";
    html += '<div class="offer"><b>Взяти</b>';
    html += '<p class="tiny">1 → carried ' + w1.carried + '→' + w1.carriedAfter +
      ', довжина ' + w1.lenNow + '→' + w1.lenAfter + "</p>";
    html += '<button class="btn primary" data-pantry="withdraw:1"' + (w1.take ? "" : " disabled") + ">Взяти 1</button> ";
    html += '<button class="btn" data-pantry="withdraw:' + wMax.take + '"' + (wMax.take ? "" : " disabled") +
      ">Взяти до ліміту (" + wMax.take + ")</button></div>";
    return html;
  };

  /** Spend from base pantry without changing length. */
  FS.spendPantryFood = function (state, cost, applyFn, opts) {
    opts = opts || {};
    FS.ensurePantry(state);
    cost = Math.floor(+cost || 0);
    if (cost < 0 || !isFinite(cost)) return { ok: false, why: "Погана ціна" };
    if (state.pantry.food < cost) return { ok: false, why: "У складі " + state.pantry.food + "/" + cost };
    var prev = state.pantry.food;
    state.pantry.food -= cost;
    try {
      var r = applyFn ? applyFn(state) : { ok: true };
      if (!r || r.ok === false) {
        state.pantry.food = prev;
        return r || { ok: false, why: "Скасовано" };
      }
      if (opts.save !== false) FS.saveGame(state, opts.reason || "pantry_spend");
      return Object.assign({ ok: true, spent: cost, source: "pantry" }, r);
    } catch (e) {
      state.pantry.food = prev;
      return { ok: false, why: String(e.message || e) };
    }
  };

  FS.allyDeliverToPantry = function (state, ally) {
    FS.ensurePantry(state);
    if (!ally || !ally.carry) return { ok: false };
    if (state.pantry.food >= state.pantry.cap) {
      ally.stateAI = "wait_pantry";
      return { ok: false, why: "Склад повний" };
    }
    // Physical fruit already "rewarded" when harvested into carry — no XP
    state.pantry.food += 1;
    ally.carry = null;
    ally.stateAI = "idle";
    return { ok: true };
  };
})(window.FoxSerpent);
