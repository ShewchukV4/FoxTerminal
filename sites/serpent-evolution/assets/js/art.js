/* FOX SERPENT — local procedural sprites (no CDN). Cached per seed/variant. */
(function (FS) {
  "use strict";

  var _cache = Object.create(null);

  FS.artCacheKey = function () {
    return Array.prototype.join.call(arguments, "|");
  };

  FS.artGet = function (key, w, h, drawFn) {
    if (_cache[key]) return _cache[key];
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    drawFn(ctx, w, h);
    _cache[key] = c;
    return c;
  };

  FS.artClearCache = function () { _cache = Object.create(null); };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** 3 tree variants from seed — layered canopy, trunk footprint, soft shadow. */
  FS.drawTreeSprite = function (ctx, ox, oy, cell, variant, opts) {
    opts = opts || {};
    var faded = opts.faded ? 0.42 : 1;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha *= faded;
    // soft ground shadow
    ctx.fillStyle = "rgba(18,36,22,0.4)";
    ctx.beginPath();
    ctx.ellipse(1, cell * 0.3, cell * 0.44, cell * 0.15, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // trunk with taper + bark highlight
    var tw = 5.5 + (variant % 3) * 0.8;
    ctx.fillStyle = variant === 1 ? "#5a3e2a" : (variant === 2 ? "#684832" : "#4a3626");
    ctx.beginPath();
    ctx.moveTo(-tw / 2, cell * 0.32);
    ctx.lineTo(-tw / 2 + 1, -cell * 0.08);
    ctx.lineTo(tw / 2 - 1, -cell * 0.08);
    ctx.lineTo(tw / 2, cell * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(30,18,10,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, cell * 0.28);
    ctx.quadraticCurveTo(0, cell * 0.1, -0.5, -cell * 0.05);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,220,160,0.18)";
    ctx.fillRect(-tw / 2 + 1.5, 0, 1.8, cell * 0.26);
    // canopy masses (dark → mid → light)
    var greens = ["#254a30", "#2f5a38", "#3d6e44", "#4a7d4f", "#5a8f5c", "#6b9e68"];
    var masses = [
      { x: 0, y: -cell * 0.34, r: cell * 0.36 },
      { x: -cell * 0.24, y: -cell * 0.2, r: cell * 0.27 },
      { x: cell * 0.26, y: -cell * 0.22, r: cell * 0.29 },
      { x: -cell * 0.1, y: -cell * 0.44, r: cell * 0.21 },
      { x: cell * 0.12, y: -cell * 0.4, r: cell * 0.19 }
    ];
    if (variant === 1) { masses[3].x -= 5; masses[0].r *= 0.95; }
    if (variant === 2) { masses[1].r *= 1.12; masses[2].y -= 4; masses[4].x += 3; }
    masses.forEach(function (m, i) {
      ctx.fillStyle = greens[(i + variant) % greens.length];
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    });
    // rim light on canopy
    ctx.strokeStyle = "rgba(180,220,140,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cell * 0.08, -cell * 0.36, cell * 0.3, -1.2, 0.4);
    ctx.stroke();
    // light leaf speckles
    ctx.fillStyle = "rgba(210,235,175,0.4)";
    [[-6, -14], [8, -18], [0, -28], [-12, -8], [14, -10], [4, -22], [-4, -32]].forEach(function (p, i) {
      if ((i + variant) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(p[0], p[1] - cell * 0.12, 2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  };

  FS.drawBranchPile = function (ctx, ox, oy, cell) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = "rgba(40,30,15,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    var sticks = [
      { a: -0.4, len: 16 }, { a: 0.35, len: 14 }, { a: 0.05, len: 12 }, { a: -0.7, len: 10 }
    ];
    sticks.forEach(function (s, i) {
      ctx.strokeStyle = i % 2 ? "#8a6a40" : "#6e5530";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(s.a) * -s.len * 0.4, Math.sin(s.a) * 2);
      ctx.lineTo(Math.cos(s.a) * s.len * 0.5, Math.sin(s.a) * 3 - 2);
      ctx.stroke();
    });
    ctx.restore();
  };

  /** Fence bitmask: N=1 E=2 S=4 W=8 */
  FS.fenceMask = function (state, x, y) {
    var m = 0;
    function link(dx, dy, bit) {
      var b = FS.buildingAt(state, x + dx, y + dy);
      if (b && (b.kind === "fence" || b.kind === "gate")) m |= bit;
    }
    link(0, -1, 1); link(1, 0, 2); link(0, 1, 4); link(-1, 0, 8);
    return m;
  };

  FS.drawFence = function (ctx, ox, oy, cell, mask, dmg) {
    ctx.save();
    ctx.translate(ox, oy);
    var post = "#6a4e32";
    var rail = dmg >= 2 ? "#7a6048" : "#8a6840";
    var rail2 = "#a07848";
    function postAt(px, py) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(px - 2, py + 6, 5, 3);
      ctx.fillStyle = post;
      ctx.fillRect(px - 2, py - 8, 4, 16);
      ctx.fillStyle = "rgba(255,220,160,0.15)";
      ctx.fillRect(px - 1, py - 7, 1.5, 12);
    }
    function railH(y0) {
      ctx.fillStyle = rail;
      ctx.fillRect(-cell * 0.42, y0, cell * 0.84, 3.5);
      ctx.fillStyle = rail2;
      ctx.fillRect(-cell * 0.42, y0 + 5, cell * 0.84, 3);
    }
    function railV(x0) {
      ctx.fillStyle = rail;
      ctx.fillRect(x0, -cell * 0.38, 3.5, cell * 0.76);
      ctx.fillStyle = rail2;
      ctx.fillRect(x0 + 5, -cell * 0.38, 3, cell * 0.76);
    }
    var n = mask & 1, e = mask & 2, s = mask & 4, w = mask & 8;
    if (!mask) {
      postAt(-6, 0); postAt(6, 0);
      railH(-2);
    } else {
      if (e || w) railH(-2);
      if (n || s) railV(-2);
      if (n || w) postAt(-cell * 0.32, -cell * 0.28);
      if (n || e) postAt(cell * 0.32, -cell * 0.28);
      if (s || w) postAt(-cell * 0.32, cell * 0.28);
      if (s || e) postAt(cell * 0.32, cell * 0.28);
      if (!(n || e || s || w)) { postAt(-6, 0); postAt(6, 0); }
    }
    if (dmg >= 1) {
      ctx.strokeStyle = "rgba(40,20,10,0.35)";
      ctx.beginPath();
      ctx.moveTo(-8, -4); ctx.lineTo(6, 6);
      ctx.stroke();
    }
    ctx.restore();
  };

  FS.drawGate = function (ctx, ox, oy, cell, closed, rot, dmg) {
    ctx.save();
    ctx.translate(ox, oy);
    // posts
    ctx.fillStyle = "#5a4028";
    ctx.fillRect(-cell * 0.38, -cell * 0.4, 5, cell * 0.8);
    ctx.fillRect(cell * 0.38 - 5, -cell * 0.4, 5, cell * 0.8);
    ctx.fillStyle = "#8a6840";
    var openAng = closed ? 0 : (rot % 2 === 0 ? 0.9 : -0.9);
    ctx.save();
    ctx.translate(-cell * 0.3, 0);
    ctx.rotate(openAng);
    ctx.fillRect(0, -cell * 0.32, cell * 0.55, 5);
    ctx.fillRect(0, cell * 0.18, cell * 0.55, 5);
    ctx.fillRect(cell * 0.45, -cell * 0.32, 4, cell * 0.55);
    ctx.restore();
    if (!closed) {
      ctx.strokeStyle = "rgba(105,224,190,0.5)";
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-cell * 0.2, -cell * 0.2, cell * 0.4, cell * 0.4);
      ctx.setLineDash([]);
    }
    if (dmg) {
      ctx.fillStyle = "rgba(80,40,20,0.3)";
      ctx.fillRect(-4, -10, 8, 20);
    }
    ctx.restore();
  };

  FS.drawFarmPlot = function (ctx, ox, oy, cell, stage, kind) {
    ctx.save();
    ctx.translate(ox, oy);
    // soil bed
    ctx.fillStyle = "#4a3a28";
    roundRect(ctx, -cell * 0.38, -cell * 0.34, cell * 0.76, cell * 0.68, 4);
    ctx.fill();
    ctx.strokeStyle = "#6a5a40";
    ctx.lineWidth = 2;
    ctx.stroke();
    // furrows
    ctx.strokeStyle = "rgba(30,20,10,0.35)";
    ctx.lineWidth = 1;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-cell * 0.3, i * 5);
      ctx.lineTo(cell * 0.3, i * 5);
      ctx.stroke();
    }
    if (stage === "planted") {
      ctx.fillStyle = "#6a8a50";
      [[-8, 2], [0, 0], [8, 3]].forEach(function (p) {
        ctx.fillRect(p[0], p[1], 2, 5);
      });
    } else if (stage === "growing" || stage === "recover") {
      ctx.fillStyle = "#5a9a48";
      [[-8, -2], [0, -6], [8, -1]].forEach(function (p) {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1] + 8);
        ctx.quadraticCurveTo(p[0] - 4, p[1], p[0], p[1] - 4);
        ctx.quadraticCurveTo(p[0] + 4, p[1], p[0], p[1] + 8);
        ctx.fill();
      });
    } else if (stage === "ready") {
      // leaves + fruit drawn separately via drawFruit on cell
      ctx.fillStyle = "#4a8a40";
      [[-6, -4], [6, -2], [0, -8]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  };

  FS.drawHut = function (ctx, ox, oy, cell) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, cell * 0.28, cell * 0.35, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a5a40";
    ctx.fillRect(-cell * 0.28, -cell * 0.05, cell * 0.56, cell * 0.38);
    ctx.fillStyle = "#5a3828";
    ctx.beginPath();
    ctx.moveTo(-cell * 0.36, 0);
    ctx.lineTo(0, -cell * 0.42);
    ctx.lineTo(cell * 0.36, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(-5, cell * 0.08, 10, cell * 0.22);
    ctx.restore();
  };

  FS.drawLarder = function (ctx, ox, oy, cell, fill01) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = "#6a5538";
    roundRect(ctx, -cell * 0.32, -cell * 0.2, cell * 0.64, cell * 0.48, 3);
    ctx.fill();
    ctx.strokeStyle = "#8a7048";
    ctx.stroke();
    // baskets fill
    var h = Math.max(2, cell * 0.35 * Math.min(1, Math.max(0, fill01)));
    ctx.fillStyle = fill01 > 0.7 ? "#d4a060" : (fill01 > 0.35 ? "#c09050" : "#a07840");
    ctx.fillRect(-cell * 0.26, cell * 0.22 - h, cell * 0.52, h);
    ctx.fillStyle = "#e8c080";
    if (fill01 > 0.2) {
      ctx.beginPath();
      ctx.arc(-6, cell * 0.05, 3, 0, Math.PI * 2);
      ctx.arc(5, cell * 0.02, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  FS.drawWoodShed = function (ctx, ox, oy, cell, fill01) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = "#5a4a30";
    ctx.fillRect(-cell * 0.3, -cell * 0.1, cell * 0.6, cell * 0.4);
    ctx.fillStyle = "#4a3820";
    ctx.beginPath();
    ctx.moveTo(-cell * 0.34, -cell * 0.08);
    ctx.lineTo(0, -cell * 0.36);
    ctx.lineTo(cell * 0.34, -cell * 0.08);
    ctx.fill();
    var logs = Math.round(fill01 * 4);
    for (var i = 0; i < logs; i++) {
      ctx.fillStyle = i % 2 ? "#8a6840" : "#6e5530";
      ctx.fillRect(-cell * 0.22 + i * 2, cell * 0.05, cell * 0.4, 4);
    }
    ctx.restore();
  };

  FS.drawBlock = function (ctx, ox, oy, cell, dmg) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = dmg >= 2 ? "#5a6068" : "#6a7078";
    roundRect(ctx, -cell * 0.32, -cell * 0.32, cell * 0.64, cell * 0.64, 5);
    ctx.fill();
    ctx.strokeStyle = "#8a9098";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(-cell * 0.28, -cell * 0.28, cell * 0.5, 6);
    ctx.restore();
  };
})(window.FoxSerpent);
