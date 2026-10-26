/* FOX SERPENT — tap / hold / stop (OS key-repeat ignored for pace) */
(function (FS) {
  "use strict";

  FS.createInput = function () {
    return {
      held: Object.create(null), // dir -> true
      lastDir: null,
      queue: [], // buffered turns, max small
      tapPending: null, // dir that must produce exactly one step
      steppedForHold: Object.create(null)
    };
  };

  FS.clearInput = function (input) {
    input.held = Object.create(null);
    input.lastDir = null;
    input.queue = [];
    input.tapPending = null;
    input.steppedForHold = Object.create(null);
  };

  FS.onKeyDown = function (state, code, repeat) {
    var dir = FS.DIR_KEYS[code];
    if (!dir) return false;
    if (repeat) {
      // OS repeat must NOT pace movement — only mark held
      state.input.held[dir] = true;
      state.input.lastDir = dir;
      return true;
    }
    state.input.held[dir] = true;
    state.input.lastDir = dir;
    // Buffer turn if different from current facing
    var snake = state.player;
    if (!FS.isOpp(snake.dir, dir)) {
      if (state.input.queue.length < (state.effects.turnBuffer || 2)) {
        if (state.input.queue[state.input.queue.length - 1] !== dir) {
          state.input.queue.push(dir);
        }
      } else {
        state.input.queue[state.input.queue.length - 1] = dir;
      }
    }
    // Guaranteed single step on tap even if shorter than tick
    state.input.tapPending = dir;
    state.input.steppedForHold[dir] = false;
    return true;
  };

  FS.onKeyUp = function (state, code) {
    var dir = FS.DIR_KEYS[code];
    if (!dir) return;
    delete state.input.held[dir];
    // recompute lastDir from remaining
    var keys = Object.keys(state.input.held);
    state.input.lastDir = keys.length ? keys[keys.length - 1] : null;
  };

  FS.anyMoveHeld = function (input) {
    return Object.keys(input.held).length > 0;
  };

  /**
   * Decide player intent for this sim moment.
   * Returns dir or null (standing).
   */
  FS.playerIntentDir = function (state) {
    var snake = state.player;
    var input = state.input;
    var dir = null;

    if (input.tapPending) {
      dir = input.tapPending;
      input.tapPending = null;
      input.steppedForHold[dir] = true;
    } else if (FS.anyMoveHeld(input)) {
      dir = input.lastDir;
      // apply buffered turn if valid
      if (input.queue.length) {
        var q = input.queue[0];
        if (!FS.isOpp(snake.dir, q)) {
          dir = q;
          input.queue.shift();
        } else {
          input.queue.shift();
        }
      }
    } else {
      input.queue = [];
      return null;
    }

    if (FS.isOpp(snake.dir, dir)) {
      // ignore 180 into neck — not death
      if (FS.anyMoveHeld(input)) {
        // keep current dir if holding something else invalid
        return snake.dir;
      }
      return null;
    }
    return dir || snake.dir;
  };
})(window.FoxSerpent);
