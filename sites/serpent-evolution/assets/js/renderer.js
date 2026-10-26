/* FOX SERPENT — Canvas 2D garden snake renderer */
(function (FS) {
  "use strict";

  FS.Renderer = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { x: 0, y: 0, z: 1 };
    this.dpr = 1;
  };

  FS.Renderer.prototype.resize = function (quality) {
    var dpr = Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 2);
    if (quality === "medium") dpr = Math.min(dpr, 1.5);
    this.dpr = dpr;
    var w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  FS.Renderer.prototype.follow = function (state) {
    var h = FS.snakeHead(state.player);
    var cell = FS.CELL;
    var tx = (h.x + 0.5) * cell;
    var ty = (h.y + 0.5) * cell;
    var worldW = (state.world.maxX - state.world.minX + 1) * cell;
    var worldH = (state.world.maxY - state.world.minY + 1) * cell;
    var viewW = this.canvas.width / this.dpr;
    var viewH = this.canvas.height / this.dpr;
    // fit small maps
    var fit = Math.min(viewW / (worldW + 80), viewH / (worldH + 80), 1.35);
    var zTarget = fit * (1 - Math.min(0.25, (state.effects.vision || 0) * 0.02));
    this.cam.z = FS.lerp(this.cam.z, zTarget, 0.08);
    this.cam.x = FS.lerp(this.cam.x, tx, 0.12);
    this.cam.y = FS.lerp(this.cam.y, ty, 0.12);
  };

  FS.Renderer.prototype.draw = function (state) {
    var ctx = this.ctx;
    var w = this.canvas.width / this.dpr, h = this.canvas.height / this.dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = FS.COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.cam.z, this.cam.z);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawTiles(state);
    this.drawNest(state);
    this.drawItems(state);
    this.drawSnakes(state);
    this.drawForesight(state);
    if (state.ui.heartBreak && state.ui.heartBreak.t > 0) this.drawHeartBreak(state);
    if (state.lastDeath && state.ui.panel === "death") this.drawDeathCell(state);

    ctx.restore();
  };

  FS.Renderer.prototype.drawTiles = function (state) {
    var ctx = this.ctx;
    var q = state.settings.quality;
    var cell = FS.CELL;
    for (var key in state.world.tiles) {
      var t = state.world.tiles[key];
      var x = t.x * cell, y = t.y * cell;
      var n = t.moss || 0.5;
      ctx.fillStyle = n > 0.55 ? FS.COLORS.moss : FS.COLORS.soil;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (q !== "low" && n > 0.7) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = FS.COLORS.mint;
        ctx.beginPath();
        ctx.ellipse(x + cell * 0.5, y + cell * 0.5, 6 + n * 4, 4, n, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t.block) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = FS.COLORS.stone;
        roundRect(ctx, x + 6, y + 6, cell - 12, cell - 12, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(x + cell / 2, y + cell - 4, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // subtle grid
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x, y, cell, cell);
    }
    ctx.globalAlpha = 1;
    // border
    ctx.strokeStyle = "rgba(105,224,190,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      state.world.minX * cell - 2,
      state.world.minY * cell - 2,
      (state.world.maxX - state.world.minX + 1) * cell + 4,
      (state.world.maxY - state.world.minY + 1) * cell + 4
    );
  };

  FS.Renderer.prototype.drawNest = function (state) {
    var ctx = this.ctx;
    var cell = FS.CELL;
    var n = state.world.nest;
    var x = (n.x + 0.5) * cell, y = (n.y + 0.5) * cell;
    ctx.fillStyle = "rgba(160,120,80,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = FS.COLORS.nest;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  };

  FS.Renderer.prototype.drawItems = function (state) {
    var ctx = this.ctx;
    var cell = FS.CELL;
    state.world.foods.forEach(function (f) {
      var x = (f.x + 0.5) * cell, y = (f.y + 0.5) * cell;
      ctx.fillStyle = f.kind === "berry" ? FS.COLORS.berry : (f.kind === "seed" ? FS.COLORS.seed : FS.COLORS.fruit);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (state.effects.foodPreview) {
        ctx.strokeStyle = "rgba(232,184,106,0.5)";
        ctx.strokeRect(f.x * cell + 4, f.y * cell + 4, cell - 8, cell - 8);
      }
    });
    state.world.materials.forEach(function (m) {
      var x = (m.x + 0.5) * cell, y = (m.y + 0.5) * cell;
      ctx.fillStyle = FS.COLORS.amber;
      if (state.effects.materialGlow) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y + 4);
      ctx.lineTo(x - 5, y + 4);
      ctx.fill();
    });
  };

  FS.Renderer.prototype.drawSnake = function (ctx, snake, state) {
    if (snake.dead) return;
    var cell = FS.CELL;
    var body = snake.body;
    if (!body.length) return;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (var i = 0; i < body.length; i++) {
      ctx.beginPath();
      ctx.ellipse((body[i].x + 0.5) * cell, (body[i].y + 0.55) * cell + 4, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // continuous body stroke
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = snake.color;
    ctx.lineWidth = cell * 0.62;
    ctx.beginPath();
    for (var j = 0; j < body.length; j++) {
      var px = (body[j].x + 0.5) * cell;
      var py = (body[j].y + 0.5) * cell;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // scale pattern
    if (state.settings.quality !== "low") {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (var k = 1; k < body.length - 1; k += 2) {
        ctx.beginPath();
        ctx.arc((body[k].x + 0.5) * cell, (body[k].y + 0.5) * cell, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // head
    var h = body[0];
    var hx = (h.x + 0.5) * cell, hy = (h.y + 0.5) * cell;
    ctx.fillStyle = shade(snake.color, -0.08);
    ctx.beginPath();
    ctx.arc(hx, hy, cell * 0.38, 0, Math.PI * 2);
    ctx.fill();
    var v = FS.dirVec(snake.dir);
    // eyes
    ctx.fillStyle = "#F5FFF8";
    ctx.beginPath();
    ctx.arc(hx + v.x * 4 - v.y * 5, hy + v.y * 4 + v.x * 5, 3.2, 0, Math.PI * 2);
    ctx.arc(hx + v.x * 4 + v.y * 5, hy + v.y * 4 - v.x * 5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#102018";
    ctx.beginPath();
    ctx.arc(hx + v.x * 5 - v.y * 5, hy + v.y * 5 + v.x * 5, 1.4, 0, Math.PI * 2);
    ctx.arc(hx + v.x * 5 + v.y * 5, hy + v.y * 5 - v.x * 5, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // tongue breath when standing
    if (snake.standing && !state.settings.reducedMotion) {
      var flick = Math.sin(state.time * 8) > 0.6;
      if (flick) {
        ctx.strokeStyle = FS.COLORS.danger;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hx + v.x * 10, hy + v.y * 10);
        ctx.lineTo(hx + v.x * 16, hy + v.y * 16);
        ctx.stroke();
      }
    }
    // outline for enemy
    if (snake.kind !== "player") {
      ctx.strokeStyle = "rgba(224,116,106,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, cell * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  FS.Renderer.prototype.drawSnakes = function (state) {
    var ctx = this.ctx;
    state.enemies.forEach(function (e) { this.drawSnake(ctx, e, state); }.bind(this));
    this.drawSnake(ctx, state.player, state);
  };

  FS.Renderer.prototype.drawForesight = function (state) {
    if (!state.effects.foresight) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    state.enemies.forEach(function (e) {
      if (e.dead || !e.intentDir) return;
      var h = FS.snakeHead(e);
      var v = FS.dirVec(e.intentDir);
      var nx = h.x + v.x, ny = h.y + v.y;
      ctx.fillStyle = "rgba(224,116,106,0.28)";
      ctx.fillRect(nx * cell + 4, ny * cell + 4, cell - 8, cell - 8);
    });
  };

  FS.Renderer.prototype.drawHeartBreak = function (state) {
    var ctx = this.ctx;
    var cell = FS.CELL;
    var hb = state.ui.heartBreak;
    var x = (hb.cell.x + 0.5) * cell, y = (hb.cell.y + 0.5) * cell;
    ctx.strokeStyle = FS.COLORS.heart;
    ctx.globalAlpha = Math.max(0, hb.t);
    ctx.lineWidth = 3;
    ctx.strokeRect(hb.cell.x * cell, hb.cell.y * cell, cell, cell);
    ctx.font = "20px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillStyle = FS.COLORS.heart;
    ctx.fillText("♥", x, y - 16);
    ctx.globalAlpha = 1;
  };

  FS.Renderer.prototype.drawDeathCell = function (state) {
    var c = state.lastDeath.cell;
    if (!c) return;
    var cell = FS.CELL;
    this.ctx.strokeStyle = FS.COLORS.danger;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(c.x * cell, c.y * cell, cell, cell);
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    try {
      var c = hex.replace("#", "");
      var num = parseInt(c, 16);
      var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
      r = Math.max(0, Math.min(255, Math.floor(r * (1 - amt))));
      g = Math.max(0, Math.min(255, Math.floor(g * (1 - amt))));
      b = Math.max(0, Math.min(255, Math.floor(b * (1 - amt))));
      return "rgb(" + r + "," + g + "," + b + ")";
    } catch (e) { return hex; }
  }
})(window.FoxSerpent);
