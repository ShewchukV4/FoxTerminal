/* FOX SERPENT — occupancy & simultaneous collision resolution */
(function (FS) {
  "use strict";

  /**
   * Shared timeline step for all snakes that are due to move:
   * intent → occupancy forecast → collisions → commit.
   * Order-independent: resolve by sorted snake ids.
   */
  FS.buildOccupancy = function (state, excludeSnakeId) {
    var map = Object.create(null);
    function mark(snake, solidTail) {
      if (!snake || snake.dead) return;
      for (var i = 0; i < snake.body.length; i++) {
        var c = snake.body[i];
        var isTail = i === snake.body.length - 1;
        // Standing or growing: tail stays occupied
        var occupy = true;
        if (isTail && !solidTail && snake._willVacateTail) occupy = false;
        if (!occupy) continue;
        var k = FS.key(c.x, c.y);
        if (!map[k]) map[k] = [];
        map[k].push({ snakeId: snake.id, part: i === 0 ? "head" : (isTail ? "tail" : "body"), index: i });
      }
    }
    mark(state.player, true);
    for (var i = 0; i < state.enemies.length; i++) mark(state.enemies[i], true);
    return map;
  };

  FS.isBlockedCell = function (state, x, y) {
    if (!FS.inBounds(state.world, x, y)) return "edge";
    var t = FS.tileAt(state.world, x, y);
    if (!t || t.block) return "wall";
    return null;
  };

  FS.snakeAtCell = function (state, x, y, ignoreMovingTails) {
    var hits = [];
    function scan(s) {
      if (!s || s.dead) return;
      for (var i = 0; i < s.body.length; i++) {
        var c = s.body[i];
        if (c.x === x && c.y === y) {
          var isTail = i === s.body.length - 1;
          if (ignoreMovingTails && isTail && s._willVacateTail) continue;
          hits.push({ snake: s, index: i, part: i === 0 ? "head" : (isTail ? "tail" : "body") });
        }
      }
    }
    scan(state.player);
    state.enemies.forEach(scan);
    return hits;
  };

  /**
   * Conservative simultaneous resolution.
   * Each due snake proposes nextHead. We detect:
   * - wall/edge
   * - self body (except allowed phase)
   * - into other body/head
   * - two heads same cell or swap
   * Standing player body kills enemy head (not player head cell).
   */
  FS.resolveMoveRound = function (state, movers) {
    // movers: [{snake, dir, next}]
    movers = movers.slice().sort(function (a, b) { return a.snake.id < b.snake.id ? -1 : 1; });

    // Mark who vacates tail
    movers.forEach(function (m) {
      var s = m.snake;
      s._willVacateTail = !s.standing && s.growthDebt <= 0 && s.body.length > 0;
    });

    var deaths = []; // {snake, reason, cell, savedByHeart?}
    var commits = [];

    function kill(snake, reason, cell) {
      if (snake._dying) return;
      snake._dying = true;
      deaths.push({ snake: snake, reason: reason, cell: cell });
    }

    // Head targets
    var headTargets = Object.create(null);
    movers.forEach(function (m) {
      var n = m.next;
      var k = FS.key(n.x, n.y);
      if (!headTargets[k]) headTargets[k] = [];
      headTargets[k].push(m);
    });

    // Head-on same cell
    Object.keys(headTargets).forEach(function (k) {
      if (headTargets[k].length > 1) {
        headTargets[k].forEach(function (m) {
          kill(m.snake, "Зіткнення голів", m.next);
        });
      }
    });

    // Head swap
    for (var i = 0; i < movers.length; i++) {
      for (var j = i + 1; j < movers.length; j++) {
        var a = movers[i], b = movers[j];
        if (FS.cellEq(a.next, b.snake.body[0]) && FS.cellEq(b.next, a.snake.body[0])) {
          kill(a.snake, "Зіткнення голів (розворот)", a.next);
          kill(b.snake, "Зіткнення голів (розворот)", b.next);
        }
      }
    }

    movers.forEach(function (m) {
      if (m.snake._dying) return;
      var s = m.snake;
      var n = m.next;
      var block = FS.isBlockedCell(state, n.x, n.y);
      if (block) {
        kill(s, block === "edge" ? "Закрита межа" : "Стіна / камінь", n);
        return;
      }

      // Self collision
      for (var bi = 0; bi < s.body.length; bi++) {
        var c = s.body[bi];
        if (c.x === n.x && c.y === n.y) {
          var isTail = bi === s.body.length - 1;
          if (isTail && s._willVacateTail) continue;
          if (s.phaseSelf && bi > 0) {
            // allowed one cell through own body
            s.phaseSelf = false;
            continue;
          }
          kill(s, "Голова врізалася у власне тіло", n);
          return;
        }
      }

      // Other snakes
      var hits = FS.snakeAtCell(state, n.x, n.y, true);
      for (var h = 0; h < hits.length; h++) {
        var hit = hits[h];
        if (hit.snake.id === s.id) continue;
        if (hit.part === "head") {
          // moving into standing/moving head — head collision
          kill(s, "Зіткнення голів", n);
          kill(hit.snake, "Зіткнення голів", n);
          return;
        }
        // Into body/tail of other
        if (hit.snake.kind === "player" && hit.snake.standing && hit.part !== "head") {
          // Enemy hits standing player body → enemy dies
          kill(s, "Врізався в тіло гравця", n);
          return;
        }
        kill(s, "Зіткнення з іншою змією", n);
        return;
      }

      commits.push(m);
    });

    // Clear temp flags
    movers.forEach(function (m) { m.snake._willVacateTail = false; });

    return { deaths: deaths, commits: commits };
  };

  FS.commitSnakeMove = function (snake, next) {
    snake.body.unshift({ x: next.x, y: next.y });
    if (snake.growthDebt > 0) {
      snake.growthDebt -= 1;
    } else {
      snake.body.pop();
    }
    snake.dir = snake.pendingDir || snake.dir;
    snake.visualFrom = snake.body[1] ? { x: snake.body[1].x, y: snake.body[1].y } : next;
    snake.visualT = 0;
  };
})(window.FoxSerpent);
