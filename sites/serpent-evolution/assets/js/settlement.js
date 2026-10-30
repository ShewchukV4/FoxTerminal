/* FOX SERPENT — settlement pay, campfire buildings, hire readiness */
(function (FS) {
  "use strict";

  FS.DAY_CYCLE_SEC = 480; // ~8 min: dawn/day/dusk/night
  FS.SETTLEMENT_HIRE_RANGE_FIRE = 6;
  FS.SETTLEMENT_HIRE_RANGE_WORK = 8;
  FS.SETTLEMENT_HIRE_RANGE_PANTRY = 10;

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
    return state.settlement;
  };

  /** Find player campfire building in active (or given) world — never invents one. */
  FS.findCampfireBuilding = function (state, worldId) {
    var wid = worldId || state.activeWorldId || "surface";
    var list = FS.buildingsOf ? FS.buildingsOf(state, wid) : (state.buildings || []);
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === "campfire" && list[i].owner !== "enemy") return list[i];
    }
    return null;
  };

  /**
   * Migrate legacy nest campfire tile / settlement.campfire into a real building (free).
   * Does NOT create a campfire when none existed.
   */
  FS.migrateCampfireIfNeeded = function (state) {
    FS.ensureSettlement(state);
    if (FS.findCampfireBuilding(state, "surface")) {
      var existing = FS.findCampfireBuilding(state, "surface");
      state.settlement.campfire = {
        x: existing.x, y: existing.y, fuelBonus: existing.fuelBonus || 0,
        light: existing.light || 1, kind: "campfire", buildingId: existing.id
      };
      return existing;
    }
    var legacy = state.settlement.campfire;
    var nest = state.worlds && state.worlds.surface
      ? state.worlds.surface.nest
      : (state.world && state.world.nest);
    var sx = legacy ? legacy.x : (nest && nest.x);
    var sy = legacy ? legacy.y : (nest && nest.y);
    if (sx == null || sy == null) return null;
    var surf = (state.worlds && state.worlds.surface) || state.world;
    if (!surf) return null;
    var tile = FS.tileAt(surf, sx, sy);
    // Only migrate if there was an actual campfire marker from old saves
    if (!legacy && (!tile || (tile.tt !== "campfire" && tile.tt !== "campfire_site"))) return null;
    if (!legacy && tile && tile.tt === "campfire_site") return null; // new game site — player must build
    var b = {
      id: FS.uid(), kind: "campfire", x: sx, y: sy, rot: 0,
      owner: "player", worldId: "surface", fuelBonus: (legacy && legacy.fuelBonus) || 0, light: 1,
      migrated: true
    };
    if (!surf.buildings) surf.buildings = [];
    surf.buildings.push(b);
    if (state.activeWorldId === "surface" || !state.activeWorldId) {
      state.buildings = surf.buildings;
    }
    FS.setTile(surf, sx, sy, FS.makeTile(sx, sy, "campfire", {
      biome: (tile && tile.biome) || "garden"
    }));
    state.settlement.campfire = {
      x: sx, y: sy, fuelBonus: b.fuelBonus, light: 1, kind: "campfire", buildingId: b.id
    };
    return b;
  };

  /** @deprecated — use findCampfireBuilding / migrateCampfireIfNeeded. Never auto-spawns. */
  FS.ensureCampfire = function (state) {
    FS.ensureSettlement(state);
    var b = FS.findCampfireBuilding(state);
    if (b) {
      state.settlement.campfire = {
        x: b.x, y: b.y, fuelBonus: b.fuelBonus || 0, light: b.light || 1,
        kind: "campfire", buildingId: b.id
      };
      return state.settlement.campfire;
    }
    return state.settlement.campfire || null;
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
    if (state.specialization === "explorer") base += 1;
    return base;
  };

  FS.pantryAvailable = function (state) {
    if (FS.ensurePantry) FS.ensurePantry(state);
    return Math.max(0, state.pantry.food - (state.pantry.reserve || 0));
  };

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

  /**
   * BFS by route length (manhattan-ish steps), not visit-count.
   * maxDist = max steps from start; returns steps or -1.
   */
  FS.routeSteps = function (state, a, b, maxDist, opts) {
    opts = opts || {};
    maxDist = maxDist == null ? 24 : maxDist;
    if (!a || !b) return -1;
    if (a.x === b.x && a.y === b.y) return 0;
    var q = [{ x: a.x, y: a.y, d: 0 }];
    var seen = Object.create(null);
    seen[FS.key(a.x, a.y)] = 1;
    var ignoreSnakes = opts.ignoreSnakes !== false;
    while (q.length) {
      var c = q.shift();
      if (c.d >= maxDist) continue;
      var dirs = ["U", "D", "L", "R"];
      for (var i = 0; i < 4; i++) {
        var v = FS.dirVec(dirs[i]);
        var nx = c.x + v.x, ny = c.y + v.y;
        var k = FS.key(nx, ny);
        if (seen[k]) continue;
        if (FS.isBlockedCell(state, nx, ny, { kind: "ally" })) continue;
        if (!ignoreSnakes && FS.snakeAtCell(state, nx, ny, false).length) continue;
        if (nx === b.x && ny === b.y) return c.d + 1;
        seen[k] = 1;
        q.push({ x: nx, y: ny, d: c.d + 1 });
      }
    }
    return -1;
  };

  FS.cellsConnected = function (state, a, b, limit) {
    var maxDist = typeof limit === "number" ? Math.min(40, Math.max(8, limit)) : 24;
    return FS.routeSteps(state, a, b, maxDist, { ignoreSnakes: true }) >= 0;
  };

  /** Can a length-3 snake exit through door into three linked free cells? */
  FS.doorExitFootprintOk = function (state, home) {
    if (!home || !home.door) return { ok: false, why: "Немає дверей", cells: [] };
    var door = home.door;
    var hx = home.x, hy = home.y;
    var dx = door.x - hx, dy = door.y - hy;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return { ok: false, why: "Двері не суміжні з домом", cells: [door] };
    }
    // Body: head at door, then two cells continuing outward
    var cells = [
      { x: door.x, y: door.y },
      { x: door.x + dx, y: door.y + dy },
      { x: door.x + dx * 2, y: door.y + dy * 2 }
    ];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var block = FS.isBlockedCell(state, c.x, c.y, { kind: "ally" });
      if (block) {
        return {
          ok: false,
          why: block === "water" ? "Вихід у воду" : (block === "wall" ? "Двері виходять у камінь/стіну" : "Вихід заблоковано"),
          cells: cells,
          blockedAt: c
        };
      }
    }
    // Temporary occupancy is yellow, not structural failure
    var busy = false;
    for (i = 0; i < cells.length; i++) {
      if (FS.snakeAtCell(state, cells[i].x, cells[i].y, false).length) { busy = true; break; }
    }
    return { ok: true, why: busy ? "Осередок придатний, очікує вільного виходу" : null, cells: cells, busy: busy };
  };

  FS.campfireAccessSide = function (state, fire) {
    if (!fire) return null;
    var sides = [
      { x: fire.x, y: fire.y + 1 },
      { x: fire.x, y: fire.y - 1 },
      { x: fire.x + 1, y: fire.y },
      { x: fire.x - 1, y: fire.y }
    ];
    for (var i = 0; i < sides.length; i++) {
      if (!FS.isBlockedCell(state, sides[i].x, sides[i].y, { kind: "player" })) return sides[i];
    }
    return null;
  };

  FS.evaluateSettlementForHire = function (state, home, opts) {
    opts = opts || {};
    FS.ensureSettlement(state);
    if (FS.ensurePantry) FS.ensurePantry(state);
    // Never call ensureCampfire that invents — only look up
    var fireB = FS.findCampfireBuilding(state, home && home.worldId);
    if (fireB) {
      state.settlement.campfire = {
        x: fireB.x, y: fireB.y, fuelBonus: fireB.fuelBonus || 0,
        light: fireB.light || 1, kind: "campfire", buildingId: fireB.id
      };
    }
    var checks = [];
    function add(id, ok, label, cell, severity) {
      checks.push({
        id: id, ok: !!ok, label: label, cell: cell || null,
        severity: severity || (ok ? "ok" : "bad")
      });
    }

    var homeWorld = (home && home.worldId) || state.activeWorldId || "surface";
    add("home", !!home, home ? "Вільний будинок з місцем мешканця" : "Потрібен вільний будинок",
      home ? { x: home.x, y: home.y } : null);

    var doorFoot = home ? FS.doorExitFootprintOk(state, home) : { ok: false, why: "Немає дому", cells: [] };
    if (home && doorFoot.ok && doorFoot.busy) {
      add("door", true, "Вихід для тіла×3 OK (зараз зайнятий — очікує)", doorFoot.cells[0], "warn");
    } else {
      add("door", !!(home && doorFoot.ok), doorFoot.why || "Вихід з дому для тіла×3",
        doorFoot.cells && doorFoot.cells[0] ? doorFoot.cells[0] : null);
    }

    var fire = fireB || state.settlement.campfire;
    var fireAccess = fire ? FS.campfireAccessSide(state, fire) : null;
    var fireDist = -1;
    if (home && fire && home.door) {
      fireDist = FS.routeSteps(state, home.door, fireAccess || fire, FS.SETTLEMENT_HIRE_RANGE_FIRE + 4);
    }
    var fireOk = !!(fire && fireAccess && fireDist >= 0 && fireDist <= FS.SETTLEMENT_HIRE_RANGE_FIRE);
    add("fire", fireOk,
      fire ? (fireAccess
        ? (fireOk ? "Багаття в межах ~" + FS.SETTLEMENT_HIRE_RANGE_FIRE + " кроків" : "Багаття занадто далеко або без шляху")
        : "Немає доступної сторони багаття")
        : "Потрібно збудувати багаття (B)",
      fire || null);

    var pantryPt = FS.pantryAccessPoint ? FS.pantryAccessPoint(state) : null;
    var pantryReach = false;
    if (home && home.door && pantryPt) {
      pantryReach = FS.routeSteps(state, home.door, pantryPt, FS.SETTLEMENT_HIRE_RANGE_PANTRY) >= 0;
    }
    add("pantry_access", !!(pantryPt && pantryReach),
      pantryPt ? (pantryReach ? "Доступ до складу/кошика їжі" : "Немає шляху до складу") : "Немає пункту видачі їжі",
      pantryPt);

    var roleCost = opts.roleCost != null ? opts.roleCost : 2;
    var quote = FS.quoteSettlementSpend(state, roleCost);
    add("food_pay", quote.ok,
      quote.ok
        ? ("Їжі вистачить на запрошення (−" + roleCost + ", лишиться " + quote.pantryAfter + " на складі)")
        : (quote.why || "Бракує їжі на оплату"),
      pantryPt);

    // Best reachable work plot within range (not first in array)
    var work = null;
    var workDist = 999;
    if (home && home.door && state.farms && state.farms.list) {
      for (var i = 0; i < state.farms.list.length; i++) {
        var f = state.farms.list[i];
        if ((f.worldId || "surface") !== homeWorld) continue;
        var d = FS.routeSteps(state, home.door, f, FS.SETTLEMENT_HIRE_RANGE_WORK);
        if (d >= 0 && d < workDist) {
          workDist = d;
          work = f;
        }
      }
    }
    add("work", !!work,
      work ? ("Робоче місце за " + workDist + " кроків") : ("Грядка/робота в межах ~" + FS.SETTLEMENT_HIRE_RANGE_WORK + " кроків шляху"),
      work);

    var capOk = true;
    if (home && home.residents && home.residents.length >= (home.capacity || 1)) {
      capOk = false;
    }
    add("capacity", capOk, capOk ? "Є вільне місце в домі" : "Дім зайнятий", home ? { x: home.x, y: home.y } : null);

    var raidBusy = !!(home && home._raidContest);
    add("safe", !raidBusy, raidBusy ? "Осередок під захопленням" : "Немає активного захоплення зони", null);

    var structural = checks.filter(function (c) {
      return c.id !== "door" || c.severity !== "warn";
    });
    // Door busy (warn) still counts as structurally ok
    var allOk = checks.every(function (c) {
      return c.ok || c.severity === "warn";
    }) && doorFoot.ok;
    return {
      ok: allOk,
      checks: checks,
      home: home,
      fire: fire,
      work: work,
      doorFoot: doorFoot,
      quote: quote,
      busyDoor: !!(doorFoot && doorFoot.busy)
    };
  };

  FS.nearCampfire = function (state) {
    var b = FS.findCampfireBuilding(state);
    if (!b) return false;
    var h = FS.snakeHead(state.player);
    return FS.manhattan(h, b) <= 1;
  };

  FS.openCampfirePanel = function (state) {
    if (!FS.nearCampfire(state)) {
      state.ui.toast = FS.findCampfireBuilding(state)
        ? "Підійди до багаття"
        : "Спочатку збудуй багаття (B)";
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
      " · резерв " + ((state.pantry && state.pantry.reserve) || 0) +
      " · доступно " + FS.pantryAvailable(state) + "</p>";
    html += '<p class="tiny">Покупки зі складу працюють здалеку. Доплата з змійки: ' +
      (s.allowCarriedPay !== false ? "увімкнена" : "вимкнена") + ".</p>";
    html += '<button class="btn" data-settle="toggle-carry">' +
      (s.allowCarriedPay !== false ? "Вимкнути доплату з змійки" : "Увімкнути доплату з змійки") + "</button>";
    html += '<div class="offer"><b>Запросити союзника</b>';
    FS.ensureAllies(state);
    var freeHome = (state.homes || []).filter(function (h) {
      return h.residents.length < h.capacity &&
        (h.worldId || "surface") === (state.activeWorldId || "surface");
    })[0];
    html += '<button class="btn ghost" data-settle="inspect-home"' +
      (freeHome ? ' data-home="' + freeHome.id + '"' : " disabled") + ">Перевірити житло</button>";
    var roleCost = 2;
    var ev = FS.evaluateSettlementForHire(state, freeHome, { roleCost: roleCost });
    ev.checks.forEach(function (c) {
      var col = c.ok ? (c.severity === "warn" ? "#E0C06A" : "#69E0BE") : "#E0746A";
      html += '<p class="tiny" style="color:' + col + '">' +
        (c.ok ? (c.severity === "warn" ? "… " : "✓ ") : "✗ ") + c.label + "</p>";
    });
    if (freeHome) {
      Object.keys(FS.ALLY_ROLES).forEach(function (role) {
        var def = FS.ALLY_ROLES[role];
        var evR = FS.evaluateSettlementForHire(state, freeHome, { roleCost: def.cost });
        var q = FS.quoteSettlementSpend(state, def.cost);
        html += '<button class="btn' + (evR.ok && q.ok ? " primary" : "") +
          '" data-invite="' + freeHome.id + ":" + role + '"' +
          (evR.ok && q.ok ? "" : " disabled") + ">" + def.name + " (−" + def.cost +
          (q.ok ? ", склад " + q.fromPantry + (q.fromCarried ? "+змійка " + q.fromCarried : "") : "") +
          ")</button> ";
      });
    } else {
      html += '<p class="tiny">Побудуй вільну домівку (B → хатина) і багаття.</p>';
    }
    html += "</div>";
    return html;
  };
})(window.FoxSerpent);
