/* FOX SERPENT — Canvas 2D garden snake renderer */
(function (FS) {
  "use strict";

  FS.Renderer = function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { x: 0, y: 0, z: 1, baseFit: 1, userZoom: 1 };
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
    // baseFit for small maps only; large maps stay readable with camera follow
    var fit = Math.min(viewW / (worldW + 80), viewH / (worldH + 80), 1.35);
    if (worldW > viewW * 1.2 || worldH > viewH * 1.2) fit = Math.min(1.05, fit);
    var vision = 1 - Math.min(0.2, (state.effects.vision || 0) * 0.015);
    this.cam.baseFit = FS.lerp(this.cam.baseFit || fit, fit * vision, 0.08);
    if (this.cam.userZoom == null) this.cam.userZoom = 1;
    this.cam.z = this.cam.baseFit * this.cam.userZoom;
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
    this.drawLandmarks(state);
    this.drawItems(state);
    this.drawSnakes(state);
    this.drawFruitArrow(state);
    this.drawForesight(state);
    this.drawPauseDanger(state);
    if (state.ui.heartBreak && state.ui.heartBreak.t > 0) this.drawHeartBreak(state);
    if (state.lastDeath && state.ui.panel === "death") this.drawDeathCell(state);

    ctx.restore();
  };

  FS.Renderer.prototype.drawTiles = function (state) {
    var ctx = this.ctx;
    var q = state.settings.quality;
    var cell = FS.CELL;
    var colors = {
      meadow: "#243528", fertile: "#3a5a32", soil: "#3a4030", path: "#4a5a40",
      mud: "#3a3028", shallow: "#2a4850", deep: "#1a3040", stone: "#4A5560",
      thicket: "#1e3a28", bridge: "#6a5a40", plot: "#4a6a38", home_door: "#5a4a38"
    };
    for (var key in state.world.tiles) {
      var t = state.world.tiles[key];
      var x = t.x * cell, y = t.y * cell;
      var tt = t.tt || (t.block ? "stone" : "meadow");
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = colors[tt] || FS.COLORS.soil;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (tt === "path") {
        ctx.strokeStyle = "rgba(242,213,151,0.25)";
        ctx.strokeRect(x + 8, y + 8, cell - 16, cell - 16);
      }
      if (tt === "fertile" && q !== "low") {
        ctx.fillStyle = "rgba(181,211,152,0.2)";
        ctx.beginPath();
        ctx.arc(x + cell * 0.5, y + cell * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tt === "deep" || tt === "shallow") {
        ctx.fillStyle = tt === "deep" ? "rgba(40,80,100,0.5)" : "rgba(60,120,140,0.35)";
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      }
      if (tt === "stone" || t.block) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = FS.COLORS.stone;
        roundRect(ctx, x + 6, y + 6, cell - 12, cell - 12, 6);
        ctx.fill();
      }
      if (tt === "bridge") {
        ctx.fillStyle = "#8a7a55";
        ctx.fillRect(x + 4, y + cell * 0.35, cell - 8, cell * 0.3);
      }
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x, y, cell, cell);
    }
    ctx.globalAlpha = 1;
    // farms overlay
    if (state.farms && state.farms.list) {
      state.farms.list.forEach(function (f) {
        var fx = f.x * cell, fy = f.y * cell;
        ctx.fillStyle = f.stage === "ready" ? "rgba(232,184,106,0.45)" : "rgba(105,224,190,0.25)";
        ctx.fillRect(fx + 6, fy + 6, cell - 12, cell - 12);
        if (f.stage === "ready") {
          ctx.fillStyle = FS.COLORS.amber;
          ctx.font = "12px Segoe UI";
          ctx.textAlign = "center";
          ctx.fillText("◆", fx + cell / 2, fy + cell / 2 + 4);
        }
      });
    }
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

  FS.Renderer.prototype.drawLandmarks = function (state) {
    var ctx = this.ctx;
    var cell = FS.CELL;
    (state.world.landmarks || []).forEach(function (lm) {
      var x = (lm.x + 0.5) * cell, y = (lm.y + 0.5) * cell;
      ctx.fillStyle = lm.done ? "rgba(181,211,152,0.25)" : "rgba(242,213,151,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = FS.COLORS.amber;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = FS.COLORS.text;
      ctx.font = "10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(lm.kind === "bush" ? "❀" : "◆", x, y + 3);
    });
  };

  FS.Renderer.prototype.drawItems = function (state) {
    var ctx = this.ctx;
    var cell = FS.CELL;
    var self = this;
    state.world.foods.forEach(function (f) {
      var x = (f.x + 0.5) * cell, y = (f.y + 0.5) * cell;
      FS.drawFruit(ctx, f.kind || "apple", x, y, cell / 36 * 0.95, {
        phase: f.phase || "ripe",
        time: state.time,
        reducedMotion: state.settings.reducedMotion
      });
      if (state.effects.foodPreview || state.effects.growthHud) {
        ctx.strokeStyle = "rgba(242,213,151,0.4)";
        ctx.strokeRect(f.x * cell + 4, f.y * cell + 4, cell - 8, cell - 8);
      }
    });
  };

  FS.Renderer.prototype.drawSnake = function (ctx, snake, state) {
    if (snake.dead) return;
    if (!snake.body.length) return;
    FS.drawSnakeBody(ctx, snake.body, snake.dir, snake.color, { cell: FS.CELL, ox: 0, oy: 0 });
    if (snake.kind !== "player") {
      var h = snake.body[0];
      var hx = (h.x + 0.5) * FS.CELL, hy = (h.y + 0.5) * FS.CELL;
      ctx.strokeStyle = "rgba(224,116,106,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, FS.CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  FS.Renderer.prototype.drawFruitArrow = function (state) {
    if (!state.effects.fruitArrow) return;
    var best = null, bd = 1e9;
    var h = FS.snakeHead(state.player);
    state.world.foods.forEach(function (f) {
      if (f.phase === "bud") return;
      var d = FS.manhattan(h, f);
      if (d < bd) { bd = d; best = f; }
    });
    if (!best || bd < 2) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    var ax = (h.x + 0.5) * cell, ay = (h.y + 0.5) * cell;
    var bx = (best.x + 0.5) * cell, by = (best.y + 0.5) * cell;
    ctx.strokeStyle = "rgba(242,213,151,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25);
    ctx.stroke();
  };

  FS.Renderer.prototype.drawPauseDanger = function (state) {
    if (!state.paused || !state.effects.pauseDanger || state.ui.panel) return;
    var dir = state.player.requestedDir || state.player.dir;
    if (FS.wouldEnterNeck(state.player, dir)) return;
    var h = FS.snakeHead(state.player);
    var v = FS.dirVec(dir);
    var nx = h.x + v.x, ny = h.y + v.y;
    var block = FS.isBlockedCell(state, nx, ny);
    var hits = FS.snakeAtCell(state, nx, ny, true);
    if (!block && !hits.length) return;
    var cell = FS.CELL;
    this.ctx.fillStyle = "rgba(231,161,141,0.35)";
    this.ctx.fillRect(nx * cell + 2, ny * cell + 2, cell - 4, cell - 4);
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
