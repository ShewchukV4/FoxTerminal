/* FOX GENESIS — organic Canvas 2D renderer */
(function (FG) {
  "use strict";

  FG.Renderer = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0 };
    this.bgCache = null;
    this.bgKey = "";
    this.dpr = 1;
  };

  FG.Renderer.prototype.resize = function (quality) {
    var dpr = Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 2);
    if (quality === "medium") dpr = Math.min(dpr, 1.5);
    this.dpr = dpr;
    var w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bgCache = null;
  };

  // Sports-style camera: follow position + soft velocity lead, no look-angle shake.
  FG.Renderer.prototype.follow = function (target, aim, dt) {
    dt = Math.max(dt || 0.016, 0.001);
    if (this._lx == null) { this._lx = target.x; this._ly = target.y; this._svx = 0; this._svy = 0; }
    var vx = (target.x - this._lx) / dt;
    var vy = (target.y - this._ly) / dt;
    this._lx = target.x;
    this._ly = target.y;
    // smooth velocity (ignore tiny jitter)
    var spd = Math.sqrt(vx * vx + vy * vy);
    if (spd < 8) { vx = 0; vy = 0; }
    this._svx = FG.lerp(this._svx, vx, 0.12);
    this._svy = FG.lerp(this._svy, vy, 0.12);
    var lead = 0.18; // seconds ahead while moving
    this.cam.tx = target.x + this._svx * lead;
    this.cam.ty = target.y + this._svy * lead;
    var dx = this.cam.tx - this.cam.x;
    var dy = this.cam.ty - this.cam.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    // deadzone: stay put if almost centered
    if (dist < 18) return;
    // slow chase — stable like a broadcast sports cam
    var k = 1 - Math.pow(0.04, dt);
    this.cam.x = FG.lerp(this.cam.x, this.cam.tx, k);
    this.cam.y = FG.lerp(this.cam.y, this.cam.ty, k);
  };

  FG.Renderer.prototype.worldToScreen = function (x, y) {
    var w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    return {
      x: (x - this.cam.x) * this.cam.z + w / 2,
      y: (y - this.cam.y) * this.cam.z + h / 2
    };
  };

  FG.Renderer.prototype.screenToWorld = function (sx, sy) {
    var w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    return {
      x: (sx - w / 2) / this.cam.z + this.cam.x,
      y: (sy - h / 2) / this.cam.z + this.cam.y
    };
  };

  FG.Renderer.prototype.draw = function (state) {
    var ctx = this.ctx;
    var w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    var q = state.settings.quality;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = FG.COLORS.bgDeep;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.cam.z, this.cam.z);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawTerrain(state, q);
    this.drawBarriers(state);
    this.drawWater(state);
    this.drawDecor(state, q);
    this.drawResources(state);
    this.drawLocations(state);
    this.drawBuildings(state);
    this.drawWebs(state);
    this.drawHazards(state);
    this.drawCreatures(state);
    this.drawProjectiles(state);
    this.drawParticles(state, q);
    this.drawTelegraphs(state);
    this.drawWaypoint(state);
    this.drawFog(state);

    ctx.restore();

    if (state._sporefog > 0) {
      ctx.fillStyle = "rgba(80,120,60," + (0.12 + 0.08 * Math.sin(state.world.time)) + ")";
      ctx.fillRect(0, 0, w, h);
    }
  };

  FG.Renderer.prototype.drawTerrain = function (state, q) {
    var ctx = this.ctx;
    var viewR = (Math.max(this.canvas.width, this.canvas.height) / this.dpr) / this.cam.z * 0.7;
    // Large natural patches — step fixed for geography; quality only affects edge soft moss
    var step = 80;
    var x0 = Math.floor((this.cam.x - viewR) / step) * step;
    var y0 = Math.floor((this.cam.y - viewR) / step) * step;
    var x1 = this.cam.x + viewR;
    var y1 = this.cam.y + viewR;

    for (var x = x0; x < x1; x += step) {
      for (var y = y0; y < y1; y += step) {
        var bio = FG.biomeAtWorld(state.world, x + step / 2, y + step / 2);
        var b = FG.BIOMES[bio];
        var n = FG.hash2(Math.floor(x / 80), Math.floor(y / 80), state.world.seed);
        var jx = (FG.hash2(Math.floor(x / 80), Math.floor(y / 80), state.world.seed + 3) - 0.5) * 28;
        var jy = (FG.hash2(Math.floor(x / 80), Math.floor(y / 80), state.world.seed + 7) - 0.5) * 28;
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.88 + n * 0.12;
        ctx.beginPath();
        roundPatch(ctx, x + jx, y + jy, step * (1.05 + n * 0.25), step * (0.95 + n * 0.2), 22 + n * 10);
        ctx.fill();
        if (q !== "low" && n > 0.5) {
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = b.accent;
          ctx.beginPath();
          ctx.ellipse(x + 20 + n * 30 + jx, y + 20 + n * 20 + jy, 10 + n * 12, 6 + n * 8, n, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    var nest = state.world.nest;
    var g = ctx.createRadialGradient(nest.x, nest.y, 10, nest.x, nest.y, 140);
    g.addColorStop(0, "rgba(105,224,190,0.35)");
    g.addColorStop(1, "rgba(105,224,190,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, 140, 0, Math.PI * 2);
    ctx.fill();
    // nest rest radius ring
    ctx.strokeStyle = "rgba(105,224,190,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, 110, 0, Math.PI * 2);
    ctx.stroke();
  };

  FG.Renderer.prototype.drawDecor = function (state, q) {
    var ctx = this.ctx;
    var decor = state.world.decor || [];
    var lim = q === "low" ? 0.55 : (q === "medium" ? 0.35 : 0.15);
    for (var i = 0; i < decor.length; i++) {
      var d = decor[i];
      if (d.n < lim) continue;
      if (FG.dist(d.x, d.y, this.cam.x, this.cam.y) > 850) continue;
      if (!FG.isExplored(state.world, d.x, d.y)) continue;
      var accent = FG.BIOMES[d.biome].accent;
      if (d.kind === "tree") this.drawTree(ctx, d.x, d.y, accent, d.n * d.scale);
      else if (d.kind === "mushroom") {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#6A9A50";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 8 * d.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (d.kind === "crystal") this.drawCrystal(ctx, d.x, d.y, accent, d.n);
      else if (d.kind === "root") {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 3 * d.scale;
        ctx.beginPath();
        ctx.moveTo(d.x - 20, d.y + 10);
        ctx.quadraticCurveTo(d.x, d.y - 20, d.x + 24, d.y + 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.quadraticCurveTo(d.x + 10, d.y - 12, d.x + 18, d.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  };

  FG.Renderer.prototype.drawBarriers = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.world.barriers.length; i++) {
      var b = state.world.barriers[i];
      if (FG.dist(b.x, b.y, this.cam.x, this.cam.y) > 900) continue;
      if (!FG.isExplored(state.world, b.x, b.y)) continue;
      // contact shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.h * 0.35, b.w * 0.55, b.h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.kind === "rock" ? "#3A4558" : "#4A3828";
      ctx.strokeStyle = b.kind === "rock" ? "#8AB4E8" : "#F0B66A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundPatch(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(229,238,232,0.55)";
      ctx.font = "10px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      var needName = (FG.ORGANS[b.needs] || {}).name || b.needs;
      ctx.fillText(needName, b.x, b.y - b.h / 2 - 6);
    }
  };

  FG.Renderer.prototype.drawLocations = function (state) {
    var ctx = this.ctx;
    var locs = state.world.locations || [];
    for (var i = 0; i < locs.length; i++) {
      var l = locs[i];
      if (FG.dist(l.x, l.y, this.cam.x, this.cam.y) > 900) continue;
      if (!FG.isExplored(state.world, l.x, l.y)) continue;
      ctx.strokeStyle = l.done ? "rgba(120,130,140,0.5)" : FG.COLORS.lilac;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r || 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = FG.COLORS.text;
      ctx.font = "11px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(l.name, l.x, l.y - (l.r || 50) - 8);
    }
  };

  FG.Renderer.prototype.drawWaypoint = function (state) {
    if (!state.ui.waypoint) return;
    var ctx = this.ctx;
    var w = state.ui.waypoint;
    var d = FG.dist(state.player.x, state.player.y, w.x, w.y);
    ctx.strokeStyle = "rgba(240,182,106,0.55)";
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(w.x, w.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = FG.COLORS.amber;
    ctx.font = "12px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((w.label || "ціль") + " · " + Math.round(d) + "м", w.x, w.y - 16);
  };

  FG.Renderer.prototype.drawTree = function (ctx, x, y, accent, n) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.quadraticCurveTo(x - 6, y, x, y - 16);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(x, y - 14, 14 + n * 8, 10 + n * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  FG.Renderer.prototype.drawCrystal = function (ctx, x, y, accent, n) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x, y - 16 - n * 8);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x - 8, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  FG.Renderer.prototype.drawWater = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.world.water.length; i++) {
      var wt = state.world.water[i];
      if (FG.dist(wt.x, wt.y, this.cam.x, this.cam.y) > 900) continue;
      var g = ctx.createRadialGradient(wt.x, wt.y, 4, wt.x, wt.y, wt.r);
      g.addColorStop(0, "rgba(85,201,219,0.35)");
      g.addColorStop(1, "rgba(10,28,40,0.15)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(wt.x, wt.y, wt.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(105,224,190,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wt.x, wt.y, wt.r * (0.6 + 0.1 * Math.sin(state.world.time + i)), 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  FG.Renderer.prototype.drawResources = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.world.resources.length; i++) {
      var r = state.world.resources[i];
      if (FG.dist(r.x, r.y, this.cam.x, this.cam.y) > 800) continue;
      if (!FG.isExplored(state.world, r.x, r.y)) continue;
      if (r.kind === "fruit") {
        var pulse = 0.7 + 0.3 * Math.sin(state.world.time * 3 + i);
        ctx.fillStyle = FG.COLORS.amber;
        ctx.globalAlpha = 0.35 * pulse;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#F0B66A";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (r.kind === "mineral") {
        ctx.fillStyle = FG.COLORS.teal;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - 6);
        ctx.lineTo(r.x + 5, r.y + 4);
        ctx.lineTo(r.x - 5, r.y + 4);
        ctx.fill();
      } else if (r.kind === "gene_sample") {
        ctx.strokeStyle = FG.COLORS.lilac;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 7 + Math.sin(state.world.time * 4) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = FG.COLORS.lilac;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  };

  FG.Renderer.prototype.drawBuildings = function (state) {
    var ctx = this.ctx;
    var pulse = 0.7 + 0.3 * Math.sin((state.world.time || 0) * 2);
    for (var i = 0; i < state.colony.buildings.length; i++) {
      var b = state.colony.buildings[i];
      var def = FG.BUILDINGS[b.type];
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 12, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      if (b.type === "heart") {
        ctx.fillStyle = "rgba(105,224,190," + (0.15 * pulse) + ")";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = FG.COLORS.mint;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = FG.COLORS.mint;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        // roots
        ctx.strokeStyle = "rgba(105,224,190,0.35)";
        for (var r = 0; r < 4; r++) {
          var ang = r * Math.PI / 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.quadraticCurveTo(b.x + Math.cos(ang) * 20, b.y + Math.sin(ang) * 20, b.x + Math.cos(ang) * 36, b.y + Math.sin(ang) * 36);
          ctx.stroke();
        }
      } else if (b.type === "incubator") {
        ctx.fillStyle = "rgba(173,140,222,0.35)";
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 16, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = FG.COLORS.lilac;
        ctx.stroke();
      } else if (b.type === "garden") {
        ctx.fillStyle = "rgba(105,224,190,0.25)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = FG.COLORS.amber;
        for (var g2 = 0; g2 < 5; g2++) {
          ctx.beginPath();
          ctx.arc(b.x + Math.cos(g2) * 10, b.y + Math.sin(g2) * 10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.type === "healbay") {
        ctx.strokeStyle = FG.COLORS.ally;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(123,207,154,0.35)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === "turret") {
        ctx.fillStyle = "#8AB4E8";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 16);
        ctx.lineTo(b.x + 12, b.y + 10);
        ctx.lineTo(b.x - 12, b.y + 10);
        ctx.closePath();
        ctx.fill();
      } else if (b.type === "store") {
        ctx.fillStyle = "rgba(85,201,219,0.35)";
        ctx.fillRect(b.x - 14, b.y - 12, 28, 24);
        ctx.strokeStyle = FG.COLORS.teal;
        ctx.strokeRect(b.x - 14, b.y - 12, 28, 24);
      } else if (b.type === "archive") {
        ctx.strokeStyle = FG.COLORS.lilac;
        ctx.strokeRect(b.x - 12, b.y - 14, 24, 28);
        ctx.fillStyle = FG.COLORS.lilac;
        ctx.fillRect(b.x - 8, b.y - 6, 16, 3);
      } else {
        ctx.strokeStyle = FG.COLORS.teal;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (b.hp < b.hpMax) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(b.x - 16, b.y - 30, 32, 4);
        ctx.fillStyle = FG.COLORS.danger;
        ctx.fillRect(b.x - 16, b.y - 30, 32 * (b.hp / b.hpMax), 4);
      }
      ctx.fillStyle = FG.COLORS.text;
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.7;
      ctx.fillText(def.name, b.x, b.y + 28);
      ctx.globalAlpha = 1;
    }
    if (state.ui.buildGhost) {
      var g = state.ui.buildGhost;
      ctx.strokeStyle = "rgba(105,224,190,0.7)";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(g.x, g.y, FG.BUILDINGS[g.type].radius || 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  FG.Renderer.prototype.drawCreature = function (ctx, c, state, isPlayer) {
    var organs = (c.body && c.body.organs) || [];
    var base = isPlayer ? FG.COLORS.mint : (c.color || FG.COLORS.danger);
    if (c.kind === "ally") base = (FG.ROLES[c.role] || {}).color || FG.COLORS.ally;
    if (c.kind === "neutral") base = "#7A9A78";
    if (c.camouflage > 0) ctx.globalAlpha = 0.35;
    if (c.invuln > 0) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(state.world.time * 30);

    var scale = c.boss ? 1.85 : (c.arch === "armorherb" ? 1.35 : (c.arch === "dasher" ? 1.1 : 1));
    if (c.kind === "ally" && c.role === "guard") scale = 1.15;
    if (c.kind === "ally" && c.role === "scout") scale = 0.85;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle || 0);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    var phase = c.segmentPhase || 0;
    var silhouette = c.arch || (c.kind === "ally" ? c.role : "player");
    if (silhouette === "armorherb" || silhouette === "guard") {
      ctx.fillStyle = shade(base, 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(base, -0.1);
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (silhouette === "dasher" || silhouette === "hunter") {
      ctx.fillStyle = shade(base, 0.08);
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 10);
      ctx.closePath();
      ctx.fill();
    } else if (silhouette === "spore" || silhouette === "support") {
      ctx.fillStyle = shade(base, 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, 20 + Math.sin(phase) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = base;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (silhouette === "digger") {
      ctx.fillStyle = shade(base, 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 4, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#C8A070";
      ctx.fillRect(10, -4, 10, 3);
      ctx.fillRect(10, 2, 10, 3);
    } else if (silhouette === "tideambush" || silhouette === "scout") {
      ctx.fillStyle = shade(base, 0.1);
      ctx.beginPath();
      ctx.ellipse(2, 0, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (var s = 2; s >= 0; s--) {
        var ox = -s * 10;
        var sway = Math.sin(phase - s * 0.7) * (3 - s);
        ctx.fillStyle = shade(base, s * 0.12);
        ctx.beginPath();
        ctx.ellipse(ox, sway, 14 - s * 2, 10 - s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // walking legs for dashlegs
    if (organs.indexOf("dashlegs") >= 0 || isPlayer) {
      ctx.strokeStyle = shade(base, 0.2);
      ctx.lineWidth = 2;
      var leg = Math.sin(phase * 2) * 5;
      ctx.beginPath();
      ctx.moveTo(-4, 8); ctx.lineTo(-8, 16 + leg);
      ctx.moveTo(4, 8); ctx.lineTo(8, 16 - leg);
      ctx.stroke();
    }

    // organs visuals
    if (organs.indexOf("carapace") >= 0) {
      ctx.strokeStyle = "#9AA8B0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (organs.indexOf("jaws") >= 0) {
      ctx.fillStyle = "#E8A090";
      ctx.beginPath();
      ctx.moveTo(12, -6); ctx.lineTo(22, -2); ctx.lineTo(12, 0);
      ctx.moveTo(12, 6); ctx.lineTo(22, 2); ctx.lineTo(12, 0);
      ctx.fill();
    }
    if (organs.indexOf("needles") >= 0) {
      ctx.strokeStyle = "#C8E8D0";
      ctx.lineWidth = 2;
      for (var n = -1; n <= 1; n++) {
        ctx.beginPath();
        ctx.moveTo(8, n * 6);
        ctx.lineTo(20, n * 8);
        ctx.stroke();
      }
    }
    if (organs.indexOf("electric") >= 0) {
      ctx.strokeStyle = FG.COLORS.teal;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(0, 0);
      ctx.lineTo(-4, 8);
      ctx.stroke();
    }
    if (organs.indexOf("acid") >= 0) {
      ctx.fillStyle = "rgba(182,232,106,0.7)";
      ctx.beginPath();
      ctx.arc(-4, 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (organs.indexOf("biolume") >= 0 || c._lume > 0) {
      var lg = ctx.createRadialGradient(4, -4, 1, 4, -4, 18);
      lg.addColorStop(0, "rgba(105,224,190,0.8)");
      lg.addColorStop(1, "rgba(105,224,190,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(4, -4, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    if (organs.indexOf("membrane") >= 0) {
      ctx.strokeStyle = FG.COLORS.teal;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 8 + Math.sin(phase) * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (organs.indexOf("tailmace") >= 0) {
      ctx.fillStyle = "#D0A080";
      ctx.beginPath();
      ctx.arc(-24, Math.sin(phase) * 3, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (organs.indexOf("web") >= 0) {
      ctx.strokeStyle = "rgba(230,220,200,0.6)";
      ctx.beginPath();
      ctx.arc(6, 8, 6, 0, Math.PI * 1.2);
      ctx.stroke();
    }
    if (organs.indexOf("parasite") >= 0) {
      ctx.strokeStyle = "#C070A0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.quadraticCurveTo(24, Math.sin(phase) * 8, 30, 0);
      ctx.stroke();
    }
    if (organs.indexOf("regen") >= 0) {
      ctx.strokeStyle = "#E090A0";
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(phase);
      ctx.beginPath();
      ctx.arc(-2, 0, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (organs.indexOf("filmshield") >= 0 && (c.filmCharges > 0 || c.kind !== "player")) {
      ctx.strokeStyle = "rgba(168,224,240,0.7)";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (organs.indexOf("pheromone") >= 0) {
      ctx.fillStyle = "rgba(173,140,222,0.35)";
      ctx.beginPath();
      ctx.arc(0, -12, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = FG.COLORS.text;
    ctx.beginPath();
    ctx.arc(8, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#07141C";
    ctx.beginPath();
    ctx.arc(9, -3, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
    if (!isPlayer) {
      ctx.strokeStyle = c.kind === "ally" ? FG.COLORS.ally : (c.kind === "neutral" ? FG.COLORS.neutral : FG.COLORS.danger);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (c.kind === "ally") {
        ctx.fillStyle = (FG.ROLES[c.role] || {}).color || FG.COLORS.ally;
        ctx.font = "9px Segoe UI,sans-serif";
        ctx.textAlign = "center";
        ctx.fillText((FG.ROLES[c.role] || {}).name || "", c.x, c.y + 26);
      }
    }

    // hp bar
    if (c.hp < c.hpMax) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(c.x - 16, c.y - 28, 32, 4);
      ctx.fillStyle = c.kind === "ally" ? FG.COLORS.ally : FG.COLORS.danger;
      ctx.fillRect(c.x - 16, c.y - 28, 32 * FG.clamp(c.hp / c.hpMax, 0, 1), 4);
    }
  };

  FG.Renderer.prototype.drawCreatures = function (state) {
    var ctx = this.ctx;
    var list = state.enemies.concat(state.allies);
    list.push(state.player);
    list.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.hp <= 0) continue;
      if (FG.dist(c.x, c.y, this.cam.x, this.cam.y) > 900) continue;
      // Explored = map memory; visibility = near player (or vibe)
      if (c.kind !== "player") {
        var visible = FG.isVisibleNow(state, c.x, c.y, 240);
        if (state.player._vibe > 0 && FG.dist(c.x, c.y, state.player.x, state.player.y) < 200) visible = true;
        if (!visible) continue;
      }
      this.drawCreature(ctx, c, state, c.kind === "player");
    }
    if (state.player._split) {
      var s = state.player._split;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = FG.COLORS.lilac;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  FG.Renderer.prototype.drawProjectiles = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.projectiles.length; i++) {
      var p = state.projectiles[i];
      ctx.fillStyle = p.color || FG.COLORS.amber;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.style === "needle" ? 2.5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  FG.Renderer.prototype.drawHazards = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.hazards.length; i++) {
      var h = state.hazards[i];
      if (h.kind === "spark") {
        ctx.strokeStyle = FG.COLORS.teal;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(h.x2, h.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (h.kind === "acid" || h.kind === "waterarc" || h.kind === "spore") {
        ctx.fillStyle = h.kind === "spore" ? "rgba(140,180,100,0.25)" : "rgba(160,220,80,0.28)";
        if (h.kind === "waterarc") ctx.fillStyle = "rgba(85,201,219,0.28)";
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r || 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  FG.Renderer.prototype.drawWebs = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.webs.length; i++) {
      var w = state.webs[i];
      ctx.strokeStyle = w.conductive ? FG.COLORS.teal : "rgba(230,220,200,0.55)";
      ctx.lineWidth = 1.5;
      for (var a = 0; a < 6; a++) {
        var ang = (a / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + Math.cos(ang) * w.r, w.y + Math.sin(ang) * w.r);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  FG.Renderer.prototype.drawTelegraphs = function (state) {
    var ctx = this.ctx;
    for (var i = 0; i < state.enemies.length; i++) {
      var e = state.enemies[i];
      if (!e.telegraph) continue;
      var tg = e.telegraph;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = FG.COLORS.danger;
      ctx.fillStyle = "rgba(224,116,106,0.2)";
      ctx.lineWidth = 2;
      if (tg.type === "dash" || tg.type === "melee") {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(tg.ang) * 80, e.y + Math.sin(tg.ang) * 80);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(tg.ang) * 50, e.y + Math.sin(tg.ang) * 50, 24, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.arc(e.x, e.y, 90, tg.ang - 0.4, tg.ang + 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // charge ring
      ctx.beginPath();
      ctx.arc(e.x, e.y, 26, 0, Math.PI * 2 * (1 - tg.t / 0.6));
      ctx.stroke();
      ctx.restore();
    }
  };

  FG.Renderer.prototype.drawParticles = function (state, q) {
    if (state.settings.reducedMotion) return;
    var ctx = this.ctx;
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      ctx.globalAlpha = FG.clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  FG.Renderer.prototype.drawFog = function (state) {
    var ctx = this.ctx;
    var tile = state.world.fogTile;
    var viewR = 700 / this.cam.z;
    var x0 = Math.floor((this.cam.x - viewR) / tile);
    var y0 = Math.floor((this.cam.y - viewR) / tile);
    var x1 = Math.floor((this.cam.x + viewR) / tile);
    var y1 = Math.floor((this.cam.y + viewR) / tile);
    for (var ix = x0; ix <= x1; ix++) {
      for (var iy = y0; iy <= y1; iy++) {
        var key = ix + "," + iy;
        if (state.world.explored[key]) continue;
        var bio = FG.biomeAtWorld(state.world, ix * tile, iy * tile);
        ctx.fillStyle = FG.BIOMES[bio].fog;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(ix * tile, iy * tile, tile + 1, tile + 1);
      }
    }
    ctx.globalAlpha = 1;
  };

  function roundPatch(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    // simple darken
    try {
      var c = hex.replace("#", "");
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      var num = parseInt(c, 16);
      var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      r = Math.max(0, Math.min(255, Math.floor(r * (1 - amt))));
      g = Math.max(0, Math.min(255, Math.floor(g * (1 - amt))));
      b = Math.max(0, Math.min(255, Math.floor(b * (1 - amt))));
      return "rgb(" + r + "," + g + "," + b + ")";
    } catch (e) { return hex; }
  }
})(window.FoxGenesis);
