/* FOX SERPENT — snake entities */
(function (FS) {
  "use strict";

  FS.createSnake = function (opts) {
    var x = opts.x, y = opts.y, dir = opts.dir || "R";
    var len = opts.length || FS.START_LENGTH;
    var body = [];
    var v = FS.dirVec(dir);
    for (var i = 0; i < len; i++) {
      body.push({ x: x - v.x * i, y: y - v.y * i });
    }
    return {
      id: opts.id || FS.uid(),
      kind: opts.kind || "enemy",
      name: opts.name || "Змія",
      arch: opts.arch || "careful",
      body: body,
      dir: dir,
      pendingDir: dir,
      growthDebt: 0,
      standing: true,
      dead: false,
      _dying: false,
      stepAcc: 0,
      stepPeriod: opts.stepPeriod || FS.ENEMY_STEP_BASE,
      color: opts.color || FS.COLORS.enemyCareful,
      home: { x: x, y: y },
      stateAI: "forage",
      intentDir: null,
      nextIntent: null,
      phaseSelf: false,
      slowMul: 1,
      slowT: 0,
      detectRange: opts.detectRange || 8,
      visualT: 1,
      foodsEaten: 0
    };
  };

  FS.createPlayerSnake = function (nest) {
    var s = FS.createSnake({
      id: "player",
      kind: "player",
      name: "Ти",
      x: nest.x + 2,
      y: nest.y,
      dir: "R",
      length: FS.START_LENGTH,
      stepPeriod: FS.PLAYER_STEP,
      color: FS.COLORS.player
    });
    return s;
  };

  FS.snakeHead = function (s) { return s.body[0]; };
  FS.snakeLen = function (s) { return s.body.length; };

  FS.setStanding = function (s, standing) {
    s.standing = !!standing;
  };

  FS.growSnake = function (s, n) {
    s.growthDebt += n || 1;
  };

  FS.shrinkSnake = function (s, amount, minLen) {
    minLen = minLen || 3;
    var target = Math.max(minLen, s.body.length - amount);
    while (s.body.length > target) s.body.pop();
    s.growthDebt = 0;
  };

  FS.cloneBody = function (s) {
    return s.body.map(function (c) { return { x: c.x, y: c.y }; });
  };
})(window.FoxSerpent);
