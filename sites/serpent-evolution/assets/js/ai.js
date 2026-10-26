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
        if (FS.isBlockedCell(state, nx, ny)) continue;
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
      if (FS.isBlockedCell(state, next.x, next.y)) {
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
        if (!FS.isBlockedCell(state, nn.x, nn.y)) {
          best = dirs[j];
          break;
        }
      }
    }

    snake._aiDebug = { options: debug, pick: best, state: snake.stateAI, seesPlayer: seesPlayer };
    if (seesPlayer) snake.stateAI = snake.arch === "careful" ? "avoid" : "intercept";
    else if (food) snake.stateAI = "forage";
    else snake.stateAI = "patrol";

    return best || snake.dir;
  };
})(window.FoxSerpent);
