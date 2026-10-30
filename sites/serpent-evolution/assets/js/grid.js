/* FOX SERPENT — occupancy & simultaneous collision resolution */
(function (FS) {
  "use strict";

  /** Active snakes on the current world layer (allies inside homes occupy nothing outdoors). */
  FS.iterActiveSnakes = function (state, fn) {
    var wid = state.activeWorldId || FS.WORLD_SURFACE || "surface";
    if (state.player) fn(state.player);
    (state.enemies || []).forEach(function (e) {
      if (!e || e.dead) return;
      var ew = e.worldId || FS.WORLD_SURFACE || "surface";
      // Surface snakes do not collide while player is in a cave
      if (wid !== (FS.WORLD_SURFACE || "surface") && ew === (FS.WORLD_SURFACE || "surface")) return;
      if (ew !== wid && ew !== "any") return;
      fn(e);
    });
    (state.allies || []).forEach(function (a) {
      if (!a || a.inside) return;
      var aw = a.worldId || FS.WORLD_SURFACE || "surface";
      if (aw !== wid && aw !== "any") return;
      fn(a);
    });
  };

  FS.buildOccupancy = function (state) {
    var map = Object.create(null);
    function mark(snake) {
      if (!snake || snake.dead) return;
      if (snake.kind === "ally" && snake.inside) return;
      for (var i = 0; i < snake.body.length; i++) {
        var c = snake.body[i];
        var isTail = i === snake.body.length - 1;
        if (isTail && snake._willVacateTail) continue;
        var k = FS.key(c.x, c.y);
        if (!map[k]) map[k] = [];
        map[k].push({ snakeId: snake.id, part: i === 0 ? "head" : (isTail ? "tail" : "body"), index: i });
      }
    }
    FS.iterActiveSnakes(state, mark);
    return map;
  };

  /**
   * @param mover optional snake — gates: player/ally always pass; enemies only if open.
   * Without mover, closed gates block (strict / enemy pathing).
   */
  FS.isBlockedCell = function (state, x, y, mover) {
    if (!FS.inBounds(state.world, x, y)) return "edge";
    var t = FS.tileAt(state.world, x, y);
    if (!t) return "wall";
    if (typeof FS.tileWalkable === "function") {
      if (!FS.tileWalkable(t)) return t.tt === "deep" ? "water" : "wall";
    } else if (t.block) return "wall";
    if (FS.treeAt && FS.treeAt(state, x, y)) return "wall";
    if (FS.buildingAt) {
      var b = FS.buildingAt(state, x, y);
      if (b && FS.buildingBlocksFor(b, mover)) return "wall";
    }
    return null;
  };

  FS.buildingBlocksFor = function (b, mover) {
    if (!b) return false;
    // Campfire / stations / plots are walkable interaction cells
    if (b.kind === "campfire" || b.kind === "plot" || b.kind === "larder" ||
        b.kind === "workbench" || b.kind === "loom" || b.kind === "mason" ||
        b.kind === "kiln" || b.kind === "forge" || b.kind === "alchemy" ||
        b.kind === "hydro" || b.kind === "geo") return false;
    if (b.kind === "fence" || b.kind === "block" || b.kind === "shed" || b.kind === "hut" ||
        b.kind === "support") return true;
    if (b.kind === "gate") {
      var friendly = mover && (mover.kind === "player" || mover.kind === "ally");
      if (friendly) return false;
      return b.closed !== false;
    }
    return false;
  };

  FS.snakeAtCell = function (state, x, y, ignoreMovingTails) {
    var hits = [];
    function scan(s) {
      if (!s || s.dead) return;
      if (s.kind === "ally" && s.inside) return;
      for (var i = 0; i < s.body.length; i++) {
        var c = s.body[i];
        if (c.x === x && c.y === y) {
          var isTail = i === s.body.length - 1;
          if (ignoreMovingTails && isTail && s._willVacateTail) continue;
          hits.push({ snake: s, part: i === 0 ? "head" : (isTail ? "tail" : "body"), index: i });
        }
      }
    }
    FS.iterActiveSnakes(state, scan);
    return hits;
  };

  /** Shared safety filter for AI/player step candidates. */
  FS.stepWouldCollideSnake = function (state, snake, next, ignoreMovingTails) {
    var hits = FS.snakeAtCell(state, next.x, next.y, ignoreMovingTails !== false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.snake.id === snake.id) {
        if (!(h.part === "tail" && !snake.standing && snake.growthDebt <= 0)) return true;
      } else {
        return true;
      }
    }
    return false;
  };

  /**
   * movers: [{ snake, dir, next }]
   * dir = accepted step direction (committed only after successful commit).
   * Returns final { deaths, commits } — snakes in deaths never appear in commits.
   */
  FS.resolveMoveRound = function (state, movers) {
    movers = movers.slice().sort(function (a, b) {
      return a.snake.id < b.snake.id ? -1 : (a.snake.id > b.snake.id ? 1 : 0);
    });

    movers.forEach(function (m) {
      var s = m.snake;
      // Tail vacates only on a real step without growth, and snake not standing
      s._willVacateTail = !s.standing && s.growthDebt <= 0 && s.body.length > 0;
    });

    var deadIds = Object.create(null);
    var deaths = [];

    function kill(snake, reason, cell) {
      if (!snake || deadIds[snake.id]) return;
      deadIds[snake.id] = true;
      snake._dying = true;
      deaths.push({ snake: snake, reason: reason, cell: cell });
    }

    // Same-cell head collisions
    var headTargets = Object.create(null);
    movers.forEach(function (m) {
      if (deadIds[m.snake.id]) return;
      var k = FS.key(m.next.x, m.next.y);
      if (!headTargets[k]) headTargets[k] = [];
      headTargets[k].push(m);
    });
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
        if (deadIds[a.snake.id] || deadIds[b.snake.id]) continue;
        if (FS.cellEq(a.next, b.snake.body[0]) && FS.cellEq(b.next, a.snake.body[0])) {
          kill(a.snake, "Зіткнення голів (розворот)", a.next);
          kill(b.snake, "Зіткнення голів (розворот)", b.next);
        }
      }
    }

    var commits = [];
    movers.forEach(function (m) {
      if (deadIds[m.snake.id]) return;
      var s = m.snake;
      var n = m.next;

      // Neck geometry (length >= 2)
      if (FS.wouldEnterNeck(s, m.dir)) {
        // Should not be scheduled; treat as no-op reject (not death)
        return;
      }

      var block = FS.isBlockedCell(state, n.x, n.y, m.snake);
      if (block) {
        kill(s, block === "edge" ? "Закрита межа" : "Стіна / камінь", n);
        return;
      }

      for (var bi = 0; bi < s.body.length; bi++) {
        var c = s.body[bi];
        if (c.x === n.x && c.y === n.y) {
          var isTail = bi === s.body.length - 1;
          if (isTail && s._willVacateTail) continue;
          if (s.phaseSelf && bi > 0) {
            s.phaseSelf = false;
            continue;
          }
          kill(s, "Голова врізалася у власне тіло", n);
          return;
        }
      }

      var hits = FS.snakeAtCell(state, n.x, n.y, true);
      for (var h = 0; h < hits.length; h++) {
        var hit = hits[h];
        if (hit.snake.id === s.id) continue;
        if (deadIds[hit.snake.id] && hit.part === "tail") {
          // dead snake body still blocks except we already skipped vacating; keep solid
        }
        if (hit.part === "head") {
          kill(s, "Зіткнення голів", n);
          kill(hit.snake, "Зіткнення голів", n);
          return;
        }
        if (hit.snake.kind === "player" && hit.snake.standing && hit.part !== "head") {
          kill(s, "Врізався в тіло гравця", n);
          return;
        }
        kill(s, "Зіткнення з іншою змією", n);
        return;
      }

      if (!deadIds[s.id]) commits.push(m);
    });

    // Final filter: no overlap between deaths and commits
    commits = commits.filter(function (m) { return !deadIds[m.snake.id]; });

    movers.forEach(function (m) { m.snake._willVacateTail = false; });

    return { deaths: deaths, commits: commits, deadIds: deadIds };
  };

  /** Commit move and set committed direction to the mover's accepted dir. */
  FS.commitSnakeMove = function (snake, next, moveDir) {
    snake.body.unshift({ x: next.x, y: next.y });
    if (snake.growthDebt > 0) {
      snake.growthDebt -= 1;
    } else {
      snake.body.pop();
    }
    if (moveDir) {
      snake.dir = moveDir;
      snake.requestedDir = moveDir;
    }
    snake.visualFrom = snake.body[1] ? { x: snake.body[1].x, y: snake.body[1].y } : next;
    snake.visualT = 0;
  };
})(window.FoxSerpent);
