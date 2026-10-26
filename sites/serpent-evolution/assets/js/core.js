/* FOX SERPENT — utils */
(function (FS) {
  "use strict";

  FS.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  FS.lerp = function (a, b, t) { return a + (b - a) * t; };
  FS.key = function (x, y) { return x + "," + y; };
  FS.parseKey = function (k) {
    var p = k.split(",");
    return { x: +p[0], y: +p[1] };
  };

  FS.mulberry32 = function (a) {
    return function () {
      var t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  FS.uid = function () {
    FS._uid = (FS._uid || 100) + 1;
    return "s" + FS._uid;
  };

  FS.dirVec = function (d) { return FS.DIRS[d] || FS.DIRS.R; };

  FS.isOpp = function (a, b) {
    if (!a || !b) return false;
    return FS.DIRS[a].opp === b;
  };

  FS.cellEq = function (a, b) {
    return a && b && a.x === b.x && a.y === b.y;
  };

  FS.manhattan = function (a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };

  FS.deepClone = function (o) { return JSON.parse(JSON.stringify(o)); };
})(window.FoxSerpent);
