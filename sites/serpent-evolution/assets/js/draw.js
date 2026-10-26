/* FOX SERPENT — shared canvas draws (game + guide) */
(function (FS) {
  "use strict";

  FS.drawFruit = function (ctx, kind, x, y, scale, opts) {
    opts = opts || {};
    var s = scale || 1;
    var phase = opts.phase || "ripe";
    var reduced = !!opts.reducedMotion;
    var t = opts.time || 0;
    var sway = reduced ? 0 : Math.sin(t * 2.2 + x * 0.01) * 0.08;

    ctx.save();
    ctx.translate(x, y);
    if (phase === "bud") {
      ctx.fillStyle = "#6a8a55";
      ctx.beginPath();
      ctx.ellipse(0, 2, 4 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9bbb70";
      ctx.beginPath();
      ctx.arc(0, -2 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 8 * s, 7 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(sway);

    if (kind === "berry") {
      [[-4, -2], [4, -2], [0, 3]].forEach(function (p, i) {
        ctx.fillStyle = i === 2 ? "#c86a7a" : FS.COLORS.berry;
        ctx.beginPath();
        ctx.arc(p[0] * s, p[1] * s, 4.2 * s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#7a9a55";
      ctx.fillRect(-1 * s, -10 * s, 2 * s, 5 * s);
    } else if (kind === "pear") {
      ctx.fillStyle = FS.COLORS.pear || "#c4dcab";
      ctx.beginPath();
      ctx.ellipse(0, 2 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d8ecc0";
      ctx.beginPath();
      ctx.ellipse(-2 * s, 0, 2 * s, 3 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7e9a62";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.quadraticCurveTo(4 * s, -12 * s, 6 * s, -10 * s);
      ctx.stroke();
    } else if (kind === "seed") {
      ctx.fillStyle = FS.COLORS.seed;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 * s, 7 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8a9860";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2 * s, -4 * s);
      ctx.lineTo(2 * s, 4 * s);
      ctx.stroke();
    } else if (kind === "golden") {
      ctx.fillStyle = FS.COLORS.golden;
      ctx.beginPath();
      ctx.arc(0, 0, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      ctx.arc(-2.5 * s, -2.5 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7e9a62";
      ctx.beginPath();
      ctx.ellipse(3 * s, -7 * s, 4 * s, 2 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // apple / fruit default
      ctx.fillStyle = kind === "fruit" ? FS.COLORS.fruit : "#e07060";
      ctx.beginPath();
      ctx.arc(0, 1 * s, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.ellipse(-2.5 * s, -1 * s, 2.2 * s, 3 * s, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6a8a48";
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(0, -11 * s);
      ctx.stroke();
      ctx.fillStyle = "#8fbc6a";
      ctx.beginPath();
      ctx.ellipse(4 * s, -9 * s, 4 * s, 2.2 * s, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  FS.drawSnakeBody = function (ctx, points, dir, color, opts) {
    opts = opts || {};
    var cell = opts.cell || 34;
    var ox = opts.ox || 0, oy = opts.oy || 0;
    color = color || FS.COLORS.player;
    if (!points || !points.length) return;

    function pt(p) {
      return {
        x: ox + (p.x != null ? p.x : p[0] + 0.5) * (p.x != null ? cell : cell),
        y: oy + (p.y != null ? p.y : p[1] + 0.5) * (p.x != null ? cell : cell)
      };
    }
    // Accept [{x,y}] world cells OR [[gx,gy]] grid indices with ox/oy origin
    var pts = points.map(function (p) {
      if (p.x != null) return { x: ox + (p.x + 0.5) * cell, y: oy + (p.y + 0.5) * cell };
      return { x: ox + (p[0] + 0.5) * cell, y: oy + (p[1] + 0.5) * cell };
    });

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // shadow
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = cell * 0.62;
    ctx.beginPath();
    pts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y + 3);
      else ctx.lineTo(p.x, p.y + 3);
    });
    ctx.stroke();

    // under-tone
    ctx.strokeStyle = shadeHex(color, -0.18);
    ctx.lineWidth = cell * 0.68;
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();

    // main
    ctx.strokeStyle = color;
    ctx.lineWidth = cell * 0.58;
    ctx.beginPath();
    pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();

    // taper hint near tail
    if (pts.length > 2) {
      var tail = pts[pts.length - 1], near = pts[pts.length - 2];
      ctx.strokeStyle = shadeHex(color, 0.1);
      ctx.lineWidth = cell * 0.38;
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();
    }

    var h = pts[0];
    var v = FS.dirVec(dir || "R");
    ctx.fillStyle = shadeHex(color, -0.06);
    ctx.beginPath();
    ctx.arc(h.x, h.y, cell * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeHex(color, 0.12);
    ctx.beginPath();
    ctx.arc(h.x - v.y * 3, h.y - v.x * 3, cell * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0f6e6";
    ctx.beginPath();
    ctx.arc(h.x + v.x * 5 - v.y * 6, h.y + v.y * 5 + v.x * 6, 3.6, 0, Math.PI * 2);
    ctx.arc(h.x + v.x * 5 + v.y * 6, h.y + v.y * 5 - v.x * 6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17251c";
    ctx.beginPath();
    ctx.arc(h.x + v.x * 6 - v.y * 6, h.y + v.y * 6 + v.x * 6, 1.6, 0, Math.PI * 2);
    ctx.arc(h.x + v.x * 6 + v.y * 6, h.y + v.y * 6 - v.x * 6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  };

  function shadeHex(hex, amt) {
    hex = (hex || "#88aa66").replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var num = parseInt(hex, 16);
    var r = Math.min(255, Math.max(0, (num >> 16) + Math.round(amt * 255)));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(amt * 255)));
    var b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(amt * 255)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  FS._shadeHex = shadeHex;
})(window.FoxSerpent);
