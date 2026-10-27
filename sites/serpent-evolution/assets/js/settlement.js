/* FOX SERPENT — settlement pay, campfire, day/night, hire readiness */
(function (FS) {
  "use strict";

  FS.DAY_CYCLE_SEC = 480; // ~8 min: dawn/day/dusk/night
  FS.SETTLEMENT_HIRE_RANGE_FIRE = 6;
  FS.SETTLEMENT_HIRE_RANGE_WORK = 8;

  FS.ensureSettlement = function (state) {
    if (!state.settlement) {
      state.settlement = {
        allowCarriedPay: true,
        dayT: 0,
        phase: "day",
        campfire: null,
        objectives: []
      };
    }
    if (!state.settlement.campfire && state.world && state.world.nest) {
      var nest0 = state.world.nest;
      state.settlement.campfire = {
        x: nest0.x, y: nest0.y, fuelBonus: 0, light: 1, kind: "campfire"
      };
    }
    return state.settlement;
  };

  FS.ensureCampfire = function (state) {
    if (!state.settlement) {
      state.settlement = {
        allowCarriedPay: true, dayT: 0, phase: "day", campfire: null, objectives: []
      };
    }
    var nest = state.world && state.world.nest;
    if (!nest) return null;
    if (!state.settlement.campfire) {
      state.settlement.campfire = {
        x: nest.x, y: nest.y, fuelBonus: 0, light: 1, kind: "campfire"
      };
    }
    // Nest cell is campfire marker (walkable) — snake spawns on adjacent path
    var tile = FS.tileAt(state.world, nest.x, nest.y);
    if (tile && tile.tt !== "campfire") {
      FS.setTile(state.world, nest.x, nest.y, FS.makeTile(nest.x, nest.y, "campfire", {
        biome: (tile && tile.biome) || "garden"
      }));
    }
    return state.settlement.campfire;
  };

  FS.dayPhaseOf = function (t) {
    var c = FS.DAY_CYCLE_SEC;
    var u = ((t % c) + c) % c / c;
    if (u < 0.2) return "dawn";
    if (u < 0.55) return "day";
    if (u < 0.7) return "dusk";
    return "night";
  };

  FS.tickDayNight = function (state, dt) {
    if (!state.started || state.paused) return;
    FS.ensureSettlement(state);
    state.settlement.dayT = (state.settlement.dayT || 0) + dt;
    state.settlement.phase = FS.dayPhaseOf(state.settlement.dayT);
  };

  FS.dayLightMul = function (state) {
    FS.ensureSettlement(state);
    var p = state.settlement.phase;
    if (p === "day") return 1;
    if (p === "dawn") return 0.85;
    if (p === "dusk") return 0.7;
    return 0.45;
  };

  FS.visionRadius = function (state) {
    var base = 9 + ((state.effects && state.effects.vision) || 0);
    var p = state.settlement && state.settlement.phase;
    if (p === "night") base = Math.max(5, base - 3);
    if (p === "dusk") base = Math.max(6, base - 1);
    if (state.layerId === "cave") {
      base = 5 + ((state.effects && state.effects.lanternAdd) || 0);
    }
    return base;
  };

  /** Available pantry food above reserve. */
  FS.pantryAvailable = function (state) {
    if (FS.ensurePantry) FS.ensurePantry(state);
    return Math.max(0, state.pantry.food - (state.pantry.reserve || 0));
  };

  /**
   * Quote settlement purchase: pantry (above reserve) first, then optional carried.
   * Distance to warehouse does not matter.
   */
  FS.quoteSettlementSpend = function (state, cost) {
    FS.ensureSettlement(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    cost = Math.floor(+cost || 0);
    if (cost < 0 || !isFinite(cost)) {
      return { ok: false, why: "Погана ціна", cost: cost };
    }
    var pantryAvail = FS.pantryAvailable(state);
    var carried = FS.nutritionOf(state);
    var allowCarried = state.settlement.allowCarriedPay !== false;
    var fromPantry = Math.min(cost, pantryAvail);
    var need = cost - fromPantry;
    var fromCarried = 0;
    if (need > 0) {
      if (!allowCarried) {
        return {
          ok: false, why: "Бракує " + need + " зі складу (доплата з змійки вимкнена)",
          cost: cost, fromPantry: fromPantry, fromCarried: 0,
          pantryAfter: state.pantry.food - fromPantry,
          carriedAfter: carried,
          lenNow: FS.targetLength(carried),
          lenAfter: FS.targetLength(carried),
          allowCarried: false
        };
      }
      if (carried < need) {
        return {
          ok: false, why: "Бракує " + (need - carried) + " (склад " + pantryAvail + " + змійка " + carried + ")",
          cost: cost, fromPantry: fromPantry, fromCarried: 0,
          pantryAfter: state.pantry.food, carriedAfter: carried,
          lenNow: FS.targetLength(carried), lenAfter: FS.targetLength(carried),
          allowCarried: true
        };
      }
      fromCarried = need;
    }
    return {
      ok: true,
      cost: cost,
      fromPantry: fromPantry,
      fromCarried: fromCarried,
      pantryAfter: state.pantry.food - fromPantry,
      carriedAfter: carried - fromCarried,
      lenNow: FS.targetLength(carried),
      lenAfter: FS.targetLength(carried - fromCarried),
      allowCarried: allowCarried,
      why: null
    };
  };

  FS.spendSettlement = function (state, cost, applyFn, opts) {
    opts = opts || {};
    if (state._settleLock) return { ok: false, why: "Зачекай" };
    var q = FS.quoteSettlementSpend(state, cost);
    if (!q.ok) return q;

    var prevN = FS.nutritionOf(state);
    var prevP = state.pantry.food;
    var prevBody = FS.cloneBody(state.player);
    var prevDebt = state.player.growthDebt | 0;
    state._settleLock = true;
    function rollback() {
      state.nutrition = prevN;
      state.pantry.food = prevP;
      state.player.body = prevBody;
      state.player.growthDebt = prevDebt;
    }
    try {
      state.pantry.food = prevP - q.fromPantry;
      if (q.fromCarried) {
        state.nutrition = prevN - q.fromCarried;
        FS.syncLengthToNutrition(state);
      }
      var result;
      try {
        result = applyFn ? applyFn(state) : { ok: true };
      } catch (err) {
        rollback();
        return { ok: false, why: "Помилка: " + (err && err.message ? err.message : err) };
      }
      if (!result || result.ok === false) {
        rollback();
        return result || { ok: false, why: "Скасовано" };
      }
      if (opts.save !== false) FS.saveGame(state, opts.reason || "settle");
      return Object.assign({ ok: true, quote: q }, result);
    } finally {
      state._settleLock = false;
    }
  };

  /** Path-connected check (BFS, limited). */
  FS.cellsConnected = function (state, a, b, limit) {
    limit = limit || 80;
    if (!a || !b) return false;
    if (a.x === b.x && a.y === b.y) return true;
    var q = [{ x: a.x, y: a.y }];
    var seen = Object.create(null);
    seen[FS.key(a.x, a.y)] = 1;
    var n = 0;
    while (q.length && n < limit) {
      var c = q.shift();
      n++;
      if (c.x === b.x && c.y === b.y) return true;
      ["U", "D", "L", "R"].forEach(function (d) {
        var v = FS.dirVec(d);
        var nx = c.x + v.x, ny = c.y + v.y;
        var k = FS.key(nx, ny);
        if (seen[k]) return;
        if (FS.isBlockedCell(state, nx, ny, { kind: "ally" })) return;
        seen[k] = 1;
        q.push({ x: nx, y: ny });
      });
    }
    return false;
  };

  FS.evaluateSettlementForHire = function (state, home) {
    FS.ensureSettlement(state);
    FS.ensureCampfire(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    var checks = [];
    function add(id, ok, label, cell) {
      checks.push({ id: id, ok: !!ok, label: label, cell: cell || null });
    }

    add("home", !!home, "Вільний будинок", home ? { x: home.x, y: home.y } : null);
    var doorOk = false;
    if (home) {
      var door = home.door || { x: home.x, y: home.y + 1 };
      doorOk = !FS.isBlockedCell(state, door.x, door.y, { kind: "ally" }) &&
        FS.snakeAtCell(state, door.x, door.y, false).length === 0;
      add("door", doorOk, "Вихід з дому вільний для тіла×3", door);
    } else {
      add("door", false, "Вихід з дому", null);
    }

    var fire = state.settlement.campfire;
    var fireNear = home && fire && FS.manhattan(home, fire) <= FS.SETTLEMENT_HIRE_RANGE_FIRE;
    var fireAccess = fire && !FS.isBlockedCell(state, fire.x, fire.y + 1, { kind: "player" });
    add("fire", !!(fireNear && fireAccess), "Багаття в радіусі " + FS.SETTLEMENT_HIRE_RANGE_FIRE, fire);

    var foodOk = FS.pantryAvailable(state) > 0 || state.pantry.cap > 0;
    add("food", foodOk, "Доступ до запасів їжі (склад/кошик)", FS.pantryAccessPoint ? FS.pantryAccessPoint(state) : null);

    var work = null;
    if (home && state.farms && state.farms.list) {
      for (var i = 0; i < state.farms.list.length; i++) {
        var f = state.farms.list[i];
        if (FS.manhattan(home, f) <= FS.SETTLEMENT_HIRE_RANGE_WORK) {
          work = f;
          break;
        }
      }
    }
    add("work", !!work, "Грядка/робота в радіусі " + FS.SETTLEMENT_HIRE_RANGE_WORK, work);

    var routes = true;
    if (home && fire) routes = routes && FS.cellsConnected(state, home.door || home, fire, 60);
    if (home && work) routes = routes && FS.cellsConnected(state, home.door || home, work, 80);
    add("routes", routes, "Прохідні шляхи дім ↔ багаття ↔ робота", null);

    var allOk = checks.every(function (c) { return c.ok; });
    return { ok: allOk, checks: checks, home: home, fire: fire, work: work };
  };

  FS.nearCampfire = function (state) {
    FS.ensureCampfire(state);
    var h = FS.snakeHead(state.player);
    var f = state.settlement.campfire;
    return FS.manhattan(h, f) <= 1;
  };

  FS.openCampfirePanel = function (state) {
    if (!FS.nearCampfire(state)) {
      state.ui.toast = "Підійди до багаття";
      return;
    }
    state.ui.panel = "campfire";
    state.ui.panelDirty = true;
    FS.setPauseReason(state, "panel", true);
  };

  FS.htmlCampfire = function (state) {
    FS.ensureSettlement(state);
    var s = state.settlement;
    var html = '<div class="panel-head"><h2>Багаття поселення</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<p>Фаза: <b>" + s.phase + "</b> · день/ніч ~8 хв (simulationTime)</p>";
    html += "<p>Склад: <b>" + (state.pantry ? state.pantry.food : 0) + "</b>/" + (state.pantry ? state.pantry.cap : 12) +
      " · резерв " + ((state.pantry && state.pantry.reserve) || 0) + "</p>";
    html += '<p class="tiny">Покупки зі складу працюють здалеку. Доплата з змійки: ' +
      (s.allowCarriedPay !== false ? "увімкнена" : "вимкнена") + ".</p>";
    html += '<button class="btn" data-settle="toggle-carry">' +
      (s.allowCarriedPay !== false ? "Вимкнути доплату з змійки" : "Увімкнути доплату з змійки") + "</button>";
    html += '<div class="offer"><b>Запросити союзника</b>';
    FS.ensureAllies(state);
    var freeHome = (state.homes || []).filter(function (h) {
      return h.residents.length < h.capacity;
    })[0];
    var ev = FS.evaluateSettlementForHire(state, freeHome);
    ev.checks.forEach(function (c) {
      html += '<p class="tiny" style="color:' + (c.ok ? "#69E0BE" : "#E0746A") + '">' +
        (c.ok ? "✓ " : "✗ ") + c.label + "</p>";
    });
    if (freeHome) {
      Object.keys(FS.ALLY_ROLES).forEach(function (role) {
        var def = FS.ALLY_ROLES[role];
        var q = FS.quoteSettlementSpend(state, def.cost);
        html += '<button class="btn' + (ev.ok && q.ok ? " primary" : "") +
          '" data-invite="' + freeHome.id + ":" + role + '"' +
          (ev.ok && q.ok ? "" : " disabled") + ">" + def.name + " (−" + def.cost +
          (q.ok ? ", склад " + q.fromPantry + (q.fromCarried ? "+змійка " + q.fromCarried : "") : "") +
          ")</button> ";
      });
    } else {
      html += '<p class="tiny">Побудуй вільну домівку (B → хатина).</p>';
    }
    html += "</div>";
    return html;
  };
})(window.FoxSerpent);
