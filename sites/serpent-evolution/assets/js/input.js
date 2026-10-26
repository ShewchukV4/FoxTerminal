/* FOX SERPENT — tap / hold / stop (OS key-repeat ignored for pace) */
(function (FS) {
  "use strict";

  FS.createInput = function () {
    return {
      held: Object.create(null),
      lastDir: null,
      queue: [],
      tapPending: null,
      /** Dir consumed by a tap this tick — must not also come from queue */
      tapConsumedDir: null
    };
  };

  FS.clearInput = function (input) {
    input.held = Object.create(null);
    input.lastDir = null;
    input.queue = [];
    input.tapPending = null;
    input.tapConsumedDir = null;
  };

  FS.onKeyDown = function (state, code, repeat) {
    var dir = FS.DIR_KEYS[code];
    if (!dir) return false;
    if (repeat) {
      state.input.held[dir] = true;
      state.input.lastDir = dir;
      return true;
    }
    var alreadyHeld = FS.anyMoveHeld(state.input);
    state.input.held[dir] = true;
    state.input.lastDir = dir;

    var committed = state.player.dir;
    // Queue only valid non-neck turns relative to committed facing
    if (!FS.wouldEnterNeck(state.player, dir) && !FS.isOpp(committed, dir)) {
      var maxQ = state.effects.turnBuffer || 2;
      if (state.input.queue.length < maxQ) {
        if (state.input.queue[state.input.queue.length - 1] !== dir) {
          state.input.queue.push(dir);
        }
      } else {
        state.input.queue[state.input.queue.length - 1] = dir;
      }
      state.player.requestedDir = dir;
    }
    // Fresh press (not while already holding another move key) → one tap step
    if (!alreadyHeld) state.input.tapPending = dir;
    return true;
  };

  FS.onKeyUp = function (state, code) {
    var dir = FS.DIR_KEYS[code];
    if (!dir) return;
    delete state.input.held[dir];
    var keys = Object.keys(state.input.held);
    state.input.lastDir = keys.length ? keys[keys.length - 1] : null;
  };

  FS.anyMoveHeld = function (input) {
    return Object.keys(input.held).length > 0;
  };

  /**
   * Single source of truth for the next player move attempt.
   * Returns { dir, fromTap } or null (stand / ignore reverse).
   * Does NOT mutate committed snake.dir.
   */
  FS.consumePlayerStepIntent = function (state, opts) {
    opts = opts || {};
    var input = state.input;
    var snake = state.player;
    var dir = null;
    var fromTap = false;

    if (opts.allowTap && input.tapPending) {
      dir = input.tapPending;
      input.tapPending = null;
      fromTap = true;
      input.tapConsumedDir = dir;
      // Tap already expressed this dir — drop matching queue head to avoid double step
      if (input.queue[0] === dir) input.queue.shift();
    } else if (FS.anyMoveHeld(input)) {
      dir = input.lastDir;
      if (input.queue.length) {
        var q = input.queue[0];
        // Don't reuse the same dir just consumed by tap on this hold tick
        if (q === input.tapConsumedDir) {
          input.queue.shift();
        } else if (!FS.wouldEnterNeck(snake, q)) {
          dir = q;
          input.queue.shift();
        } else {
          input.queue.shift();
        }
      }
    } else {
      input.queue = [];
      input.tapConsumedDir = null;
      return null;
    }

    if (!dir) return null;

    // Forbidden reverse into neck: no step, no death, no visual turn
    if (FS.wouldEnterNeck(snake, dir) || FS.isOpp(snake.dir, dir)) {
      // If another held key is valid, try it
      if (FS.anyMoveHeld(input)) {
        var alts = Object.keys(input.held);
        for (var i = alts.length - 1; i >= 0; i--) {
          var a = alts[i];
          if (!FS.wouldEnterNeck(snake, a) && !FS.isOpp(snake.dir, a)) {
            snake.requestedDir = a;
            return { dir: a, fromTap: false };
          }
        }
      }
      return null;
    }

    snake.requestedDir = dir;
    return { dir: dir, fromTap: fromTap };
  };
})(window.FoxSerpent);
