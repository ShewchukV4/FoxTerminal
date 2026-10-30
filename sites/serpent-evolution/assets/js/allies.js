/* FOX SERPENT — homes + ally workers (gardener first; physical fruit logistics) */
(function (FS) {
  "use strict";

  FS.HOME_DEFS = {
    hut: { id: "hut", name: "Домівка", cost: 4, capacity: 1, desc: "Один союзник" },
    house: { id: "house", name: "Покращена домівка", cost: 7, capacity: 2, desc: "Два мешканці" }
  };

  FS.ALLY_ROLES = {
    gardener: { id: "gardener", name: "Садівник", cost: 3, color: "#9ccc88", desc: "Збирає стиглі грядки" },
    carrier: { id: "carrier", name: "Носій", cost: 3, color: "#c8b878", desc: "Несе урожай у склад бази" },
    repairer: { id: "repairer", name: "Ремонтник", cost: 4, color: "#c8a070", desc: "Лагодів огорожу за деревину" },
    guard: { id: "guard", name: "Сторож", cost: 4, color: "#a0b878", desc: "Патруль і попередження про ворога" },
    scout: { id: "scout", name: "Розвідник", cost: 4, color: "#88b8c8", desc: "Позначає ресурси на відкритій землі" },
    guide: { id: "guide", name: "Провідник", cost: 4, color: "#b898d0", desc: "Попереджає про небезпеку поруч" }
  };

  FS.ensureAllies = function (state) {
    if (!state.homes) state.homes = [];
    if (!state.allies) state.allies = [];
  };

  FS.homeAt = function (state, x, y) {
    FS.ensureAllies(state);
    for (var i = 0; i < state.homes.length; i++) {
      if (state.homes[i].x === x && state.homes[i].y === y) return state.homes[i];
    }
    return null;
  };

  FS.canPlaceHome = function (state, x, y, type) {
    type = type || "hut";
    var def = FS.HOME_DEFS[type];
    if (!def) return { ok: false, why: "Невідомий тип" };
    var tile = FS.tileAt(state.world, x, y);
    if (!tile || !FS.tileWalkable(tile)) return { ok: false, why: "Непрохідно" };
    if (FS.homeAt(state, x, y) || FS.farmAt(state, x, y)) return { ok: false, why: "Зайнято" };
    if (FS.manhattan({ x: x, y: y }, state.world.nest) > 8) return { ok: false, why: "Задалеко від гнізда (перша домівка ближче)" };
    if (FS.snakeAtCell(state, x, y, false).length) return { ok: false, why: "Тіло змії" };
    return { ok: true, cost: def.cost, def: def };
  };

  FS.purchaseHome = function (state, x, y, type) {
    if (state._homeLock) return { ok: false, why: "Зачекай" };
    var check = FS.canPlaceHome(state, x, y, type || "hut");
    if (!check.ok) return check;
    var prev = FS.previewSpend(state, check.cost);
    if (!prev.ok) return { ok: false, why: "Потрібно " + check.cost + " поживи, є " + prev.now };
    state._homeLock = true;
    try {
      return FS.spendNutrition(state, check.cost, function () {
        FS.ensureAllies(state);
        var home = {
          id: FS.uid(), type: type || "hut", x: x, y: y,
          capacity: check.def.capacity, residents: [], door: { x: x, y: y + 1 }
        };
        // ensure door walkable
        var dt = FS.tileAt(state.world, home.door.x, home.door.y);
        if (!dt || !FS.tileWalkable(dt)) home.door = { x: x + 1, y: y };
        FS.setTile(state.world, x, y, FS.makeTile(x, y, "home_door", { biome: (dt && dt.biome) || "garden" }));
        state.homes.push(home);
        state.tutorial.done.home = true;
        state.ui.toast = "Збудовано: " + check.def.name;
        return { ok: true, home: home };
      }, { reason: "home" });
    } finally {
      state._homeLock = false;
    }
  };

  FS.clearAllyFarmReservation = function (state, ally) {
    if (!ally || !state.farms || !state.farms.list) return;
    state.farms.list.forEach(function (f) {
      if (f.reservedBy === ally.id) f.reservedBy = null;
    });
  };

  FS.hireAlly = function (state, homeId, role) {
    if (state._hireLock) return { ok: false, why: "Зачекай" };
    FS.ensureAllies(state);
    var home = state.homes.filter(function (h) { return h.id === homeId; })[0];
    var rdef = FS.ALLY_ROLES[role];
    if (!home || !rdef) return { ok: false, why: "Немає домівки/ролі" };
    if (home.residents.length >= home.capacity) return { ok: false, why: "Дім повний" };
    var maxAllies = 1 + (state.effects && state.effects.allyCapAdd || 0);
    if (state.allies.length >= Math.min(4, maxAllies)) return { ok: false, why: "Ліміт союзників" };
    if (FS.evaluateSettlementForHire) {
      var ev = FS.evaluateSettlementForHire(state, home, { roleCost: rdef.cost });
      if (!ev.ok) {
        var miss = ev.checks.filter(function (c) { return !c.ok && c.severity !== "warn"; })
          .map(function (c) { return c.label; });
        return { ok: false, why: "Осередок не готовий: " + miss.join("; ") };
      }
      if (ev.busyDoor) return { ok: false, why: "Осередок придатний, очікує вільного виходу" };
    }
    var prev = FS.quoteSettlementSpend
      ? FS.quoteSettlementSpend(state, rdef.cost)
      : FS.previewSpend(state, rdef.cost);
    if (!prev.ok) return { ok: false, why: prev.why || ("Потрібно " + rdef.cost) };
    state._hireLock = true;
    try {
      var spend = FS.spendSettlement || FS.spendNutrition;
      return spend(state, rdef.cost, function () {
        var ally = FS.createSnake({
          id: FS.uid(), kind: "ally", name: rdef.name,
          x: home.x, y: home.y, dir: "D", length: 3,
          stepPeriod: 1 / 3.2, color: rdef.color
        });
        ally.role = role;
        ally.homeId = home.id;
        ally.inside = true;
        ally.cmd = "work";
        ally.task = null;
        ally.carry = null;
        ally.stateAI = "idle";
        ally.standing = true;
        home.residents.push(ally.id);
        state.allies.push(ally);
        state.tutorial.done.ally = true;
        state.ui.toast = "Запрошено: " + rdef.name + " (вийде, коли двері вільні)";
        return { ok: true, ally: ally };
      }, { reason: "hire" });
    } finally {
      state._hireLock = false;
    }
  };

  FS.allyCommand = function (state, allyId, cmd) {
    var a = state.allies.filter(function (x) { return x.id === allyId; })[0];
    if (!a) return { ok: false };
    FS.clearAllyFarmReservation(state, a);
    a.cmd = cmd; // work | home | follow | wait
    if (cmd === "home") a.task = { kind: "go_home" };
    if (cmd === "wait") { a.task = null; a.stateAI = "wait"; }
    if (cmd === "follow") a.task = { kind: "follow" };
    if (cmd === "work") a.task = null;
    return { ok: true };
  };

  FS.doorFree = function (state, home) {
    var d = home.door;
    return FS.snakeAtCell(state, d.x, d.y, false).length === 0 &&
      FS.tileWalkable(FS.tileAt(state.world, d.x, d.y));
  };

  FS.tryExitHome = function (state, ally) {
    if (!ally.inside) return;
    var home = state.homes.filter(function (h) { return h.id === ally.homeId; })[0];
    if (!home) return;
    if (!home.door) home.door = { x: home.x, y: home.y + 1 };
    // Prefer door orientation from home → door vector
    var dirs = ["D", "R", "L", "U"];
    var dx = home.door.x - home.x, dy = home.door.y - home.y;
    if (dy > 0) dirs = ["D", "R", "L", "U"];
    else if (dy < 0) dirs = ["U", "R", "L", "D"];
    else if (dx > 0) dirs = ["R", "D", "U", "L"];
    else if (dx < 0) dirs = ["L", "D", "U", "R"];

    for (var di = 0; di < dirs.length; di++) {
      var dir = dirs[di];
      var v = FS.dirVec(dir);
      var body = [];
      var ok = true;
      for (var i = 0; i < ally.body.length; i++) {
        var cx = home.door.x - v.x * i, cy = home.door.y - v.y * i;
        if (FS.isBlockedCell(state, cx, cy, ally) || FS.snakeAtCell(state, cx, cy, false).length) {
          ok = false;
          break;
        }
        if (FS.treeAt && FS.treeAt(state, cx, cy)) { ok = false; break; }
        body.push({ x: cx, y: cy });
      }
      if (!ok) continue;
      ally.body = body;
      ally.dir = dir;
      ally.requestedDir = dir;
      ally.inside = false;
      ally.standing = false;
      ally.stateAI = "idle";
      return;
    }
    ally.stateAI = "wait_door";
  };

  FS.allyStepToward = function (state, ally, tx, ty) {
    var h = FS.snakeHead(ally);
    var best = null, bestD = 1e9;
    ["U", "D", "L", "R"].forEach(function (d) {
      if (FS.wouldEnterNeck(ally, d)) return;
      var v = FS.dirVec(d);
      var nx = h.x + v.x, ny = h.y + v.y;
      if (FS.isBlockedCell(state, nx, ny, ally)) return;
      // yield to player: don't enter player's next preferred cell / body
      var ph = FS.snakeHead(state.player);
      if (nx === ph.x && ny === ph.y) return;
      if (state.player.body.some(function (c) { return c.x === nx && c.y === ny; })) return;
      // avoid blocking player head path one step
      var pd = state.player.requestedDir || state.player.dir;
      var pv = FS.dirVec(pd);
      if (nx === ph.x + pv.x && ny === ph.y + pv.y && !state.player.standing) return;
      var hits = FS.snakeAtCell(state, nx, ny, true).filter(function (hh) {
        return hh.snake.id !== ally.id && hh.snake.kind !== "ally";
      });
      if (hits.length) return;
      var dist = Math.abs(nx - tx) + Math.abs(ny - ty);
      // slight prefer path tiles
      var t = FS.tileAt(state.world, nx, ny);
      if (t && t.tt === "path") dist -= 0.2;
      if (dist < bestD) { bestD = dist; best = d; }
    });
    return best;
  };

  FS.tickAllies = function (state, dt) {
    if (!state.started || state.paused) return;
    if (state.guide && state.guide.open) return;
    if (typeof document !== "undefined" && document.hidden) return;
    FS.ensureAllies(state);
    FS.ensureFarms(state);

    state.allies.forEach(function (ally) {
      if (ally.dead) return;
      if (ally.inside) {
        FS.tryExitHome(state, ally);
        return;
      }
      if (ally.cmd === "wait") {
        ally.standing = true;
        return;
      }

      // wait_pantry: retry deliver when room appears
      if (ally.stateAI === "wait_pantry" && ally.carry) {
        FS.ensurePantry(state);
        if (state.pantry.food < state.pantry.cap) {
          var pad0 = FS.pantryAccessPoint ? FS.pantryAccessPoint(state) : FS.dropPadCell(state);
          ally.task = { kind: "deliver", x: pad0.x, y: pad0.y };
          ally.stateAI = "deliver";
          ally.standing = false;
        } else {
          ally.standing = true;
          return;
        }
      }

      // gardener + carrier: harvest ripe → deliver to pantry
      if ((ally.role === "gardener" || ally.role === "carrier") && ally.cmd === "work" && !ally.task && !ally.carry) {
        var ready = state.farms.list.filter(function (f) {
          return f.stage === "ready" && f.store.length && !f.reservedBy;
        })[0];
        if (ready) {
          ready.reservedBy = ally.id;
          ally.task = { kind: "harvest", farmId: ready.id };
          ally.stateAI = "to_farm";
        } else {
          ally.stateAI = "idle";
          ally.standing = true;
        }
      }

      // repairer: fix damaged player fence/gate (1 wood)
      if (ally.role === "repairer" && ally.cmd === "work" && !ally.task) {
        var damaged = (state.buildings || []).filter(function (bb) {
          return bb.owner !== "enemy" && (bb.kind === "fence" || bb.kind === "gate") && (bb.dmg | 0) > 0;
        });
        // prefer gates
        damaged.sort(function (a, b) {
          return (b.kind === "gate" ? 1 : 0) - (a.kind === "gate" ? 1 : 0);
        });
        damaged = damaged[0];
        if (damaged && state.wood >= 1) {
          ally.task = { kind: "repair", x: damaged.x, y: damaged.y, bid: damaged.id };
          ally.stateAI = "repair";
        } else {
          ally.stateAI = "idle";
          ally.standing = true;
        }
      }

      // guard: patrol near nest, warn on enemy
      if (ally.role === "guard" && ally.cmd === "work" && !ally.task) {
        var nest = state.world.nest;
        var gx = nest.x + ((ally.id.charCodeAt(0) || 0) % 5) - 2;
        var gy = nest.y + 3;
        ally.task = { kind: "patrol", x: gx, y: gy };
        ally.stateAI = "patrol";
        var nearEnemy = state.enemies.some(function (e) {
          return !e.dead && FS.manhattan(FS.snakeHead(e), nest) <= 10;
        });
        if (nearEnemy && !ally._warned) {
          ally._warned = true;
          state.ui.toast = "Сторож: ворог біля бази!";
          state.ui.raidWarn = 3;
        }
        if (!nearEnemy) ally._warned = false;
      }

      if (ally.cmd === "follow") {
        var ph = FS.snakeHead(state.player);
        ally.task = { kind: "follow", x: ph.x, y: ph.y };
      }
      if (ally.cmd === "home" || (ally.task && ally.task.kind === "go_home")) {
        var home = state.homes.filter(function (h) { return h.id === ally.homeId; })[0];
        if (home) ally.task = { kind: "go_home", x: home.door.x, y: home.door.y };
      }

      ally.stepAcc = (ally.stepAcc || 0) + dt;
      var period = ally.stepPeriod * FS.tileStepMul(state, FS.snakeHead(ally).x, FS.snakeHead(ally).y);
      if (ally.stepAcc < period) return;
      ally.stepAcc -= period;

      var target = null;
      if (ally.task && ally.task.kind === "harvest") {
        var farm = state.farms.list.filter(function (f) { return f.id === ally.task.farmId; })[0];
        if (!farm) { ally.task = null; return; }
        target = { x: farm.x, y: farm.y };
        var h = FS.snakeHead(ally);
        if (FS.manhattan(h, farm) <= 1) {
          // collect one fruit into carry, deliver to drop pad
          if (farm.store.length && !ally.carry) {
            ally.carry = farm.store.shift();
            // One fruit — remove world representation too
            state.world.foods = state.world.foods.filter(function (f) {
              return !(f.x === farm.x && f.y === farm.y && f.fromFarm);
            });
            if (!farm.store.length) {
              farm.stage = "recover";
              farm.t = 0;
              farm.waiting = false;
            }
            farm.reservedBy = null;
            var pad = FS.pantryAccessPoint ? FS.pantryAccessPoint(state) : FS.dropPadCell(state);
            ally.task = { kind: "deliver", x: pad.x, y: pad.y };
            ally.stateAI = "deliver";
            state.tutorial.done.deliver = true;
          } else {
            farm.reservedBy = null;
            ally.task = null;
          }
          ally.standing = true;
          return;
        }
      } else if (ally.task && (ally.task.kind === "deliver" || ally.task.kind === "go_home" ||
          ally.task.kind === "follow" || ally.task.kind === "repair" || ally.task.kind === "patrol")) {
        target = { x: ally.task.x, y: ally.task.y };
        h = FS.snakeHead(ally);
        if (FS.manhattan(h, target) <= 1) {
          if (ally.task.kind === "deliver" && ally.carry) {
            var del = FS.allyDeliverToPantry(state, ally);
            if (!del.ok) {
              ally.standing = true;
              state.ui.toast = del.why || "Склад повний — носій чекає";
              return;
            }
            ally.task = null;
            state.ui.toast = "Носій: +1 на базу (" + state.pantry.food + "/" + state.pantry.cap + ")";
          } else if (ally.task.kind === "repair") {
            var rb = (state.buildings || []).filter(function (bb) { return bb.id === ally.task.bid; })[0];
            if (rb && state.wood >= 1) {
              FS.spendWood(state, 1, function () {
                rb.dmg = 0;
                rb.hp = rb.kind === "block" ? 3 : 2;
                return { ok: true };
              }, { reason: "repair" });
              state.ui.toast = "Ремонтник: огорожу відновлено";
            }
            ally.task = null;
            ally.stateAI = "idle";
          } else if (ally.task.kind === "go_home") {
            ally.inside = true;
            ally.task = null;
            ally.standing = true;
          } else if (ally.task.kind === "patrol") {
            ally.task.x = state.world.nest.x + (ally.task.x > state.world.nest.x ? -3 : 3);
            ally.standing = false;
          } else {
            ally.standing = true;
          }
          return;
        }
      }

      if (!target) {
        ally.standing = true;
        return;
      }
      var dir = FS.allyStepToward(state, ally, target.x, target.y);
      if (!dir) {
        ally.standing = true;
        ally.stateAI = "yield";
        return;
      }
      var hv = FS.dirVec(dir);
      var nh = FS.snakeHead(ally);
      var next = { x: nh.x + hv.x, y: nh.y + hv.y };
      // commit locally (allies move outside enemy collision round for simplicity & player priority)
      var block = FS.isBlockedCell(state, next.x, next.y, ally);
      if (block) { ally.standing = true; return; }
      if (FS.snakeAtCell(state, next.x, next.y, true).some(function (hh) { return hh.snake.kind === "player" || hh.snake.kind === "enemy"; })) {
        ally.standing = true;
        return;
      }
      FS.commitSnakeMove(ally, next, dir);
      ally.standing = false;
    });
  };

  FS.serializeAllies = function (state) {
    FS.ensureAllies(state);
    return {
      homes: state.homes,
      allies: state.allies.map(function (a) {
        return {
          id: a.id, name: a.name, role: a.role, homeId: a.homeId,
          body: a.body, dir: a.dir, inside: a.inside, cmd: a.cmd,
          carry: a.carry, color: a.color, stepPeriod: a.stepPeriod
        };
      })
    };
  };

  FS.applyAllies = function (state, data) {
    FS.ensureAllies(state);
    if (!data) return;
    state.homes = data.homes || [];
    state.allies = (data.allies || []).map(function (a) {
      var s = FS.createSnake(a);
      Object.assign(s, a);
      s.kind = "ally";
      s.dead = false;
      s.requestedDir = s.dir;
      return s;
    });
  };
})(window.FoxSerpent);
