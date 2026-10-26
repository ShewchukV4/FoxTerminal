/* FOX GENESIS — math, RNG, spatial hash, utils */
(function (FG) {
  "use strict";

  FG.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  FG.lerp = function (a, b, t) { return a + (b - a) * t; };
  FG.dist = function (ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  };
  FG.ang = function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); };
  FG.len = function (x, y) { return Math.sqrt(x * x + y * y); };
  FG.norm = function (x, y) {
    var l = FG.len(x, y) || 1;
    return { x: x / l, y: y / l };
  };

  FG.mulberry32 = function (a) {
    return function () {
      var t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  FG.hash2 = function (x, y, seed) {
    var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + (seed | 0);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };

  FG.SpatialHash = function (cell) {
    this.cell = cell || 96;
    this.map = Object.create(null);
  };
  FG.SpatialHash.prototype.key = function (x, y) {
    return (Math.floor(x / this.cell)) + "," + (Math.floor(y / this.cell));
  };
  FG.SpatialHash.prototype.clear = function () { this.map = Object.create(null); };
  FG.SpatialHash.prototype.insert = function (obj) {
    var k = this.key(obj.x, obj.y);
    if (!this.map[k]) this.map[k] = [];
    this.map[k].push(obj);
  };
  FG.SpatialHash.prototype.query = function (x, y, r) {
    var c = this.cell;
    var x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    var y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    var out = [], seen = Object.create(null);
    for (var ix = x0; ix <= x1; ix++) {
      for (var iy = y0; iy <= y1; iy++) {
        var bucket = this.map[ix + "," + iy];
        if (!bucket) continue;
        for (var i = 0; i < bucket.length; i++) {
          var o = bucket[i];
          if (seen[o.id]) continue;
          seen[o.id] = 1;
          out.push(o);
        }
      }
    }
    return out;
  };

  FG.uid = function () {
    FG._uid = (FG._uid || 1000) + 1;
    return "e" + FG._uid;
  };

  FG.syncUidFromState = function (state) {
    var max = FG._uid || 1000;
    function note(id) {
      if (!id || typeof id !== "string") return;
      var m = /^e(\d+)$/.exec(id);
      if (m) max = Math.max(max, +m[1]);
    }
    note(state.player && state.player.id);
    (state.allies || []).forEach(function (a) { note(a.id); });
    (state.enemies || []).forEach(function (e) { note(e.id); });
    (state.colony && state.colony.buildings || []).forEach(function (b) { note(b.id); });
    (state.colony && state.colony.breeds || []).forEach(function (b) { note(b.id); });
    (state.world && state.world.resources || []).forEach(function (r) { note(r.id); });
    FG._uid = max;
  };

  FG.deepClone = function (o) { return JSON.parse(JSON.stringify(o)); };

  FG.hasOrgans = function (body, ids) {
    if (!body || !body.organs) return false;
    for (var i = 0; i < ids.length; i++) {
      if (body.organs.indexOf(ids[i]) < 0) return false;
    }
    return true;
  };

  FG.activeSynergies = function (body) {
    var list = [];
    for (var i = 0; i < FG.SYNERGIES.length; i++) {
      var s = FG.SYNERGIES[i];
      if (FG.hasOrgans(body, s.needs)) list.push(s);
    }
    return list;
  };

  FG.bodyStats = function (body) {
    var form = FG.FORMS[body.form] || FG.FORMS.mobile;
    var load = 0, mass = 0, armor = 4 * form.armor;
    var organs = body.organs || [];
    var levels = body.levels || {};
    var heritage = body.heritage || null;
    var healBonus = 0, atkBonus = 0, speedBonus = 0;
    for (var i = 0; i < organs.length; i++) {
      var oid = organs[i];
      var o = FG.ORGANS[oid];
      if (!o) continue;
      var lv = levels[oid] || 1;
      var lvMul = 1 + (lv - 1) * 0.12;
      load += (o.load || 0) * (lv > 1 ? 1 + (lv - 1) * 0.05 : 1);
      mass += (o.mass || 0) * lvMul;
      if (o.id === "carapace") armor += 6 + (lv - 1) * 2;
      if (o.id === "filmshield") armor += 2 + (lv - 1);
      if (o.id === "regen") healBonus += 0.15 * lv;
      if (o.slot === "attack") atkBonus += (lv - 1) * 1.5;
      if (o.id === "dashlegs" || o.id === "climbers" || o.id === "gasbags") speedBonus += 0.035 * lv;
    }
    if (heritage === "tough") { armor += 3; mass += 4; }
    if (heritage === "swift") speedBonus += 0.08;
    if (heritage === "vital") healBonus += 0.2;
    var speed = 110 * form.speed * (1 - Math.min(0.35, mass / 80)) * (1 + speedBonus);
    var energyMax = 100 + Math.max(0, 20 - load) + (heritage === "vital" ? 10 : 0);
    var hpMax = 80 + mass * 1.2 + (form.armor > 1 ? 20 : 0) + (heritage === "tough" ? 15 : 0);
    return {
      load: load,
      mass: mass,
      armor: armor,
      speed: speed,
      energyMax: energyMax,
      hpMax: hpMax,
      form: form,
      healBonus: healBonus,
      atkBonus: atkBonus,
      synergies: FG.activeSynergies(body)
    };
  };

  FG.canAfford = function (res, cost) {
    if (!cost) return true;
    if ((cost.biomass || 0) > (res.biomass || 0)) return false;
    if ((cost.mineral || 0) > (res.mineral || 0)) return false;
    if ((cost.sample || 0) > (res.sample || 0)) return false;
    return true;
  };

  FG.pay = function (res, cost) {
    if (!cost) return;
    res.biomass -= cost.biomass || 0;
    res.mineral -= cost.mineral || 0;
    res.sample -= cost.sample || 0;
  };
})(window.FoxGenesis);
