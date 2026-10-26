/* FOX GENESIS — Web Audio synth (unlocked after user gesture) */
(function (FG) {
  "use strict";

  FG.initAudio = function (state) {
    state.audio = { ctx: null, unlocked: false, master: null, sfxGain: null };
  };

  FG.unlockAudio = function (state) {
    if (state.audio.unlocked) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      state.audio.ctx = new AC();
      state.audio.master = state.audio.ctx.createGain();
      state.audio.sfxGain = state.audio.ctx.createGain();
      state.audio.sfxGain.connect(state.audio.master);
      state.audio.master.connect(state.audio.ctx.destination);
      state.audio.master.gain.value = state.settings.muted ? 0 : state.settings.volume;
      state.audio.sfxGain.gain.value = state.settings.sfx;
      state.audio.unlocked = true;
    } catch (e) {}
  };

  FG.applyAudioSettings = function (state) {
    if (!state.audio.master) return;
    state.audio.master.gain.value = state.settings.muted ? 0 : state.settings.volume;
    if (state.audio.sfxGain) state.audio.sfxGain.gain.value = state.settings.sfx;
  };

  FG.sfx = function (state, name) {
    if (!state.audio.unlocked || !state.audio.ctx || state.settings.muted) return;
    var ctx = state.audio.ctx;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.connect(g);
    g.connect(state.audio.sfxGain || state.audio.master);
    if (name === "attack") {
      o.type = "triangle"; o.frequency.value = 180;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.13);
    } else if (name === "hurt") {
      o.type = "sawtooth"; o.frequency.value = 90;
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t); o.stop(t + 0.21);
    } else if (name === "mutate") {
      o.type = "sine"; o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(660, t + 0.25);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.31);
    } else if (name === "ability") {
      o.type = "square"; o.frequency.value = 320;
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.16);
    } else if (name === "pickup") {
      o.type = "sine"; o.frequency.value = 520;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.11);
    }
  };
})(window.FoxGenesis);
