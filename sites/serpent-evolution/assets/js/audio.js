/* FOX SERPENT — minimal WebAudio */
(function (FS) {
  "use strict";

  FS.initAudio = function (state) {
    state.audio = { ctx: null, unlocked: false };
  };

  FS.unlockAudio = function (state) {
    if (!state.audio) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!state.audio.ctx) state.audio.ctx = new AC();
      if (state.audio.ctx.state === "suspended") state.audio.ctx.resume();
      state.audio.unlocked = true;
    } catch (e) {}
  };

  FS.sfx = function (state, name) {
    if (!state.audio || !state.audio.unlocked || state.settings.muted) return;
    var ctx = state.audio.ctx;
    if (!ctx) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    var now = ctx.currentTime;
    var f = name === "eat" ? 520 : name === "deposit" ? 340 : name === "die" ? 120 : 400;
    o.frequency.value = f;
    g.gain.value = 0.04 * (state.settings.sfx || 0.8);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.start(now); o.stop(now + 0.13);
  };

  FS.applyAudioSettings = function () {};
})(window.FoxSerpent);
