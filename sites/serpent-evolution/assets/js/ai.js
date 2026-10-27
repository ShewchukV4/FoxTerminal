/* FOX SERPENT — honest utility + local BFS AI */
(function (FS) {
  "use strict";

  FS.floodSpace = function (state, start, limit, snakeId) {
    limit = limit || 80;
    var q = [start];
    var seen = Object.create(null);
    seen[FS.key(start.x, start.y)] = 1;
    var count = 0;
    while (q.length && count < limit) {
      var c = q.shift();
      count++;
      var dirs = ["U", "D", "L", "R"];
      for (var i = 0; i < 4; i++) {
        var v = FS.dirVec(dirs[i]);
        var nx = c.x + v.x, ny = c.y + v.y;
        var k = FS.key(nx, ny);
        if (seen[k]) continue;
        if (FS.isBlockedCell(state, nx, ny, { kind: "enemy", id: snakeId })) continue;
        var hits = FS.snakeAtCell(state, nx, ny, true).filter(function (h) {
          return h.snake.id !== snakeId;
        });
        // own body counts as blocked except vacating logic approximated as blocked for flood
        var selfHits = FS.snakeAtCell(state, nx, ny, false).filter(function (h) {
          return h.snake.id === snakeId && h.part !== "tail";
        });
        if (hits.length || selfHits.length) continue;
        seen[k] = 1;
        q.push({ x: nx, y: ny });
      }
    }
    return count;
  };

  FS.aiChooseDir = function (state, snake) {
    var head = FS.snakeHead(snake);
    var dirs = ["U", "D", "L", "R"];
    var best = null;
    var bestScore = -1e9;
    var debug = [];

    var player = state.player;
    var pHead = FS.snakeHead(player);
    var stealth = 1;
    if (player.standing && state.effects.stealthStand) stealth = state.effects.stealthStand;
    var detect = snake.detectRange * (player.standing ? stealth : 1);
    var seesPlayer = FS.manhattan(head, pHead) <= detect;
    // close always sees
    if (FS.manhattan(head, pHead) <= 3) seesPlayer = true;

    var food = null, fd = 1e9;
    state.world.foods.forEach(function (f) {
      var d = FS.manhattan(head, f);
      if (d < fd) { fd = d; food = f; }
    });

    dirs.forEach(function (d) {
      if (FS.wouldEnterNeck(snake, d) || FS.isOpp(snake.dir, d)) {
        debug.push({ dir: d, score: -999, why: "180" });
        return;
      }
      var v = FS.dirVec(d);
      var next = { x: head.x + v.x, y: head.y + v.y };
      if (FS.isBlockedCell(state, next.x, next.y, snake)) {
        debug.push({ dir: d, score: -900, why: "wall" });
        return;
      }

      // would hit something?
      var hits = FS.snakeAtCell(state, next.x, next.y, true);
      var fatal = false;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (h.snake.id === snake.id) {
          if (!(h.part === "tail" && !snake.standing && snake.growthDebt <= 0)) fatal = true;
        } else if (h.snake.kind === "player" && h.snake.standing && h.part !== "head") {
          // suicide into standing body — reject
          fatal = true;
        } else {
          fatal = true;
        }
      }
      if (fatal) {
        debug.push({ dir: d, score: -800, why: "collision" });
        return;
      }

      var space = FS.floodSpace(state, next, 60, snake.id);
      if (space < snake.body.length) {
        debug.push({ dir: d, score: -700 + space, why: "trap space=" + space });
        // still allow if only option later
      }

      var score = space * 3;

      // food
      if (food) {
        var before = FS.manhattan(head, food);
        var after = FS.manhattan(next, food);
        score += (before - after) * 8;
      }

      // Flee with loot → home
      if (snake.loot && snake.home) {
        score += (FS.manhattan(head, snake.home) - FS.manhattan(next, snake.home)) * 14;
      }

      // Raid ripe farms if path exists (no magic protected flag — only walkability)
      if (!snake.loot && state.farms && state.farms.list && snake.raidTarget) {
        var rt = snake.raidTarget;
        score += (FS.manhattan(head, rt) - FS.manhattan(next, rt)) * 12;
      } else if (!snake.loot && state.farms && state.farms.list && snake.knowsFarm) {
        var ripe = null, rd = 1e9;
        state.farms.list.forEach(function (f) {
          if (f.stage !== "ready" || !f.store || !f.store.length) return;
          if (FS.manhattan(head, f) > (snake.detectRange || 8) + 2 && !snake.memoryFarms) return;
          var d0 = FS.manhattan(head, f);
          if (d0 < rd) { rd = d0; ripe = f; }
        });
        if (ripe) {
          snake.raidTarget = { x: ripe.x, y: ripe.y, farmId: ripe.id };
          score += (FS.manhattan(head, ripe) - FS.manhattan(next, ripe)) * 11;
        }
      }

      // arch weights
      if (snake.arch === "careful") {
        score += space * 2;
        if (seesPlayer) score -= (10 - Math.min(10, FS.manhattan(next, pHead))) * 2;
      } else if (snake.arch === "intercept" && seesPlayer) {
        // aim ahead of player visible velocity: if moving, offset by dir; if standing, approach body side not head-on sometimes
        var aim = { x: pHead.x, y: pHead.y };
        if (!player.standing) {
          var pv = FS.dirVec(player.dir);
          aim.x += pv.x * 2;
          aim.y += pv.y * 2;
        } else {
          // approach body segment mid if long
          if (player.body.length > 3) {
            var mid = player.body[Math.floor(player.body.length / 2)];
            aim = mid;
          }
        }
        score += (FS.manhattan(head, aim) - FS.manhattan(next, aim)) * 10;
      } else if (snake.arch === "territory") {
        var homeD = FS.manhattan(next, snake.home);
        score -= homeD * 2;
        if (seesPlayer && FS.manhattan(pHead, snake.home) < 6) {
          score += (FS.manhattan(head, pHead) - FS.manhattan(next, pHead)) * 6;
        }
      } else if (snake.arch === "elder") {
        score += space * 2.5;
        if (seesPlayer) {
          // cut space: prefer moving to reduce player flood if evaluate simple
          score += (FS.manhattan(head, pHead) - FS.manhattan(next, pHead)) * 4;
        }
      }

      // nest safety talent: less head aggression near nest
      if (state.effects.nestSafety && FS.manhattan(pHead, state.world.nest) <= 3) {
        if (FS.cellEq(next, pHead)) score -= 50;
      }

      // stand pressure talent: less direct head rush when player stands on food
      if (state.effects.standPressure && player.standing) {
        score -= (8 - Math.min(8, FS.manhattan(next, pHead)));
      }

      debug.push({ dir: d, score: score, why: "space=" + space });
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    });

    if (!best) {
      // survival fallback: any non-180 non-wall
      for (var j = 0; j < dirs.length; j++) {
        if (FS.isOpp(snake.dir, dirs[j])) continue;
        var vv = FS.dirVec(dirs[j]);
        var nn = { x: head.x + vv.x, y: head.y + vv.y };
        if (!FS.isBlockedCell(state, nn.x, nn.y, snake)) {
          best = dirs[j];
          break;
        }
      }
    }

    // Scout: circle nest perimeter, remember open gates / gaps, report home
    if (snake.arch === "scout" && !snake.loot) {
      snake.intel = snake.intel || { gaps: [], reported: false };
      (state.buildings || []).forEach(function (b) {
        if (b.owner === "enemy") return;
        if (b.kind === "gate" && b.closed === false) {
          snake.intel.gaps.push({ x: b.x, y: b.y, kind: "gate" });
        }
      });
      // Prefer path along player nest ring
      if (state.world && state.world.nest && !snake._scoutDone) {
        var nest = state.world.nest;
        var ring = [
          { x: nest.x + 4, y: nest.y }, { x: nest.x, y: nest.y + 4 },
          { x: nest.x - 4, y: nest.y }, { x: nest.x, y: nest.y - 4 }
        ];
        snake._scoutIdx = snake._scoutIdx || 0;
        var wp = ring[snake._scoutIdx % ring.length];
        if (FS.manhattan(head, wp) <= 1) snake._scoutIdx++;
        else {
          // boost already applied via food/home; set soft target
          snake.raidTarget = null;
          snake._scoutWp = wp;
        }
        if (snake._scoutIdx >= ring.length && snake.home) {
          snake._scoutDone = true;
          snake.stateAI = "report";
        }
      }
      if (snake._scoutDone && snake.home && FS.manhattan(head, snake.home) <= 1) {
        // Share intel with pack after return
        state.enemies.forEach(function (e) {
          if (e.id === snake.id || e.dead) return;
          e.memoryGaps = (snake.intel.gaps || []).slice();
          e.knowsFarm = e.knowsFarm || !!snake.knowsFarm;
          e.memoryFarms = e.memoryFarms || snake.memoryFarms;
        });
        if (snake.intel.gaps.length && !snake.intel.reported) {
          snake.intel.reported = true;
          state.ui.toast = "Базу помітили — зачини ворота!";
          state.ui.raidWarn = 5;
        }
        snake._scoutDone = false;
        snake._scoutIdx = 0;
      }
    }

    // Discover farms in vision → memory for raids (no omniscience)
    if (state.farms && state.farms.list) {
      state.farms.list.forEach(function (f) {
        if (FS.manhattan(head, f) <= (snake.detectRange || 8)) {
          snake.memoryFarms = snake.memoryFarms || {};
          snake.memoryFarms[f.id] = { x: f.x, y: f.y };
          snake.knowsFarm = true;
          if (f.stage === "ready" && f.store && f.store.length && !snake._raidWarned) {
            snake._raidWarned = true;
            state.ui.toast = "Увага: змія помітила твою грядку!";
            state.ui.raidWarn = 4;
          }
        }
      });
    }

    // Use shared gap memory for raids when available
    if (!snake.loot && snake.memoryGaps && snake.memoryGaps.length && !snake.raidTarget) {
      var gap = snake.memoryGaps[0];
      if (gap && !FS.isBlockedCell(state, gap.x, gap.y, snake)) {
        // path through known gap toward nearest remembered farm
        if (snake.memoryFarms) {
          var mf = Object.keys(snake.memoryFarms)[0];
          if (mf) snake.raidTarget = snake.memoryFarms[mf];
        }
      } else if (gap) {
        // gap closed — replan
        snake.memoryGaps.shift();
        snake.raidTarget = null;
      }
    }

    if (snake.loot && snake.home && FS.manhattan(head, snake.home) <= 1) {
      snake.loot = null;
      state.ui.toast = "Злодій сховався з урожаєм";
      snake.stateAI = "patrol";
    }

    // Steal one physical fruit, then flee (cargo = loot, not length)
    if (snake.raidTarget && !snake.loot) {
      var rf = FS.farmAt && FS.farmAt(state, snake.raidTarget.x, snake.raidTarget.y);
      if (rf && head.x === rf.x && head.y === rf.y && rf.stage === "ready") {
        if (rf.store && rf.store.length) {
          snake.loot = rf.store.pop();
          state.ui.toast = "Злодій забрав плід і тікає!";
        }
        state.world.foods = state.world.foods.filter(function (f) {
          return !(f.x === rf.x && f.y === rf.y && f.fromFarm);
        });
        rf.stage = "recover";
        rf.t = 0;
        rf.waiting = false;
        snake.raidTarget = null;
        snake._raidWarned = false;
      } else if (rf && FS.isBlockedCell(state, rf.x, rf.y, snake) && FS.manhattan(head, rf) <= 1) {
        snake.raidTarget = null;
        snake.stateAI = "patrol";
      }
    }

    // Elder raider: damage adjacent fence/gate on cooldown (never enter wall)
    if (snake.arch === "elder" && !snake.loot) {
      snake._breakCd = (snake._breakCd || 0) - 0.05;
      if (snake._breakCd <= 0) {
        var broke = false;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          if (broke) return;
          var bb = FS.buildingAt && FS.buildingAt(state, head.x + d[0], head.y + d[1]);
          if (bb && bb.owner !== "enemy" && (bb.kind === "fence" || bb.kind === "gate")) {
            bb.dmg = (bb.dmg || 0) + 1;
            bb.hp = Math.max(0, (bb.hp || 2) - 1);
            state.ui.toast = "Огорожу пошкоджено!";
            snake._breakCd = 8;
            broke = true;
            if (bb.hp <= 0) {
              state.buildings = state.buildings.filter(function (x) { return x.id !== bb.id; });
              state.ui.toast = "Секцію огорожі зламано!";
            }
          }
        });
      }
    }

    // Scout waypoint preference
    if (snake._scoutWp && snake.arch === "scout" && !snake.loot) {
      var sw = snake._scoutWp;
      var dirs2 = ["U", "D", "L", "R"];
      var bestS = best, bestSS = -1e9;
      dirs2.forEach(function (d) {
        if (FS.wouldEnterNeck(snake, d) || FS.isOpp(snake.dir, d)) return;
        var vv = FS.dirVec(d);
        var nn = { x: head.x + vv.x, y: head.y + vv.y };
        if (FS.isBlockedCell(state, nn.x, nn.y, snake)) return;
        var sc = (FS.manhattan(head, sw) - FS.manhattan(nn, sw)) * 15;
        if (sc > bestSS) { bestSS = sc; bestS = d; }
      });
      if (bestS) best = bestS;
    }

    snake._aiDebug = { options: debug, pick: best, state: snake.stateAI, seesPlayer: seesPlayer };
    if (snake.loot) snake.stateAI = "flee_loot";
    else if (snake.arch === "scout" && !snake._scoutDone) snake.stateAI = "scout";
    else if (snake.raidTarget) snake.stateAI = "raid";
    else if (seesPlayer) snake.stateAI = snake.arch === "careful" ? "avoid" : "intercept";
    else if (food) snake.stateAI = "forage";
    else snake.stateAI = "patrol";

    return best || snake.dir;
  };

  /** Path openness from enemy to farm — for UI inspect. */
  FS.farmRaidOpenings = function (state, farm) {
    if (!farm) return [];
    var openings = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var x = farm.x + d[0], y = farm.y + d[1];
      if (!FS.isBlockedCell(state, x, y, { kind: "enemy" })) {
        openings.push({ x: x, y: y });
      }
    });
    return openings;
  };
})(window.FoxSerpent);
