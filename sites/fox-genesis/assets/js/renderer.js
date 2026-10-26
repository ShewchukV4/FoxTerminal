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
    this.drawWater(state);
    this.drawResources(state);
    this.drawBuildings(state);
    this.drawWebs(state);
    this.drawHazards(state);
    this.drawCreatures(state);
    this.drawProjectiles(state);
    this.drawParticles(state, q);
    this.drawTelegraphs(state);
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
    var step = q === "low" ? 96 : 64;
    var x0 = Math.floor((this.cam.x - viewR) / step) * step;
    var y0 = Math.floor((this.cam.y - viewR) / step) * step;
    var x1 = this.cam.x + viewR;
    var y1 = this.cam.y + viewR;

    for (var x = x0; x < x1; x += step) {
      for (var y = y0; y < y1; y += step) {
        var bio = FG.biomeAtWorld(state.world, x + step / 2, y + step / 2);
        var b = FG.BIOMES[bio];
        var n = FG.hash2(Math.floor(x / step), Math.floor(y / step), state.world.seed);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.85 + n * 0.15;
        ctx.beginPath();
        roundPatch(ctx, x + n * 10, y + n * 8, step * 1.15, step * 1.05, 18);
        ctx.fill();

        // moss / detail
        if (q !== "low" && n > 0.55) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = b.accent;
          ctx.beginPath();
          ctx.ellipse(x + 20 + n * 30, y + 20 + n * 20, 8 + n * 10, 5 + n * 6, n, 0, Math.PI * 2);
          ctx.fill();
        }
        // trees in grove
        if (bio === "grove" && n > 0.72 && q !== "low") {
          this.drawTree(ctx, x + 24, y + 24, b.accent, n);
        }
        if (bio === "swamp" && n > 0.7) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#6A9A50";
          ctx.beginPath();
          ctx.arc(x + 30, y + 28, 10 + n * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (bio === "crystal" && n > 0.75) {
          this.drawCrystal(ctx, x + 28, y + 26, b.accent, n);
        }
        if (bio === "roots" && n > 0.68) {
          ctx.strokeStyle = b.accent;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + 40);
          ctx.quadraticCurveTo(x + 30, y + 10, x + 50, y + 35);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // nest glow
    var nest = state.world.nest;
    var g = ctx.createRadialGradient(nest.x, nest.y, 10, nest.x, nest.y, 140);
    g.addColorStop(0, "rgba(105,224,190,0.35)");
    g.addColorStop(1, "rgba(105,224,190,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, 140, 0, Math.PI * 2);
    ctx.fill();
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
    for (var i = 0; i < state.colony.buildings.length; i++) {
      var b = state.colony.buildings[i];
      var def = FG.BUILDINGS[b.type];
      ctx.fillStyle = "rgba(85,201,219,0.15)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = FG.COLORS.teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      if (b.type === "heart") {
        ctx.fillStyle = FG.COLORS.mint;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.settings.showNames) {
        ctx.fillStyle = FG.COLORS.text;
        ctx.font = "11px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(def.name, b.x, b.y - 28);
      }
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

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle || 0);

    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // body segments
    var phase = c.segmentPhase || 0;
    for (var s = 2; s >= 0; s--) {
      var ox = -s * 10;
      var sway = Math.sin(phase - s * 0.7) * (3 - s);
      ctx.fillStyle = shade(base, s * 0.12);
      ctx.beginPath();
      ctx.ellipse(ox, sway, 14 - s * 2, 10 - s, 0, 0, Math.PI * 2);
      ctx.fill();
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

    // eye
    ctx.globalAlpha = 1;
    ctx.fillStyle = FG.COLORS.text;
    ctx.beginPath();
    ctx.arc(8, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#07141C";
    ctx.beginPath();
    ctx.arc(9, -3, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // marker ring for relation
    ctx.restore();
    ctx.globalAlpha = 1;
    if (!isPlayer) {
      ctx.strokeStyle = c.kind === "ally" ? FG.COLORS.ally : (c.kind === "neutral" ? FG.COLORS.neutral : FG.COLORS.danger);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
      if (c.kind !== "player" && !FG.isExplored(state.world, c.x, c.y) && !(c._vibeVisible)) {
        if (!(state.player._vibe > 0 && FG.dist(c.x, c.y, state.player.x, state.player.y) < 180)) continue;
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
