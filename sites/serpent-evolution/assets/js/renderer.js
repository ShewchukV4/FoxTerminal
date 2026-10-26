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
    this.drawBuildings(state);
    this.drawWoodNodes(state);
    this.drawLandmarks(state);
    this.drawItems(state);
    this.drawBuildPreview(state);
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
    var cell = FS.CELL;
    // Calm base field: soft green soil; water/stone/plot as clear exceptions — not a 12-color mosaic
    var base = FS.COLORS.soil || "#243528";
    var pathTint = "#2a3a2e";
    for (var key in state.world.tiles) {
      var t = state.world.tiles[key];
      var x = t.x * cell, y = t.y * cell;
      var tt = t.tt || (t.block ? "stone" : "meadow");
      ctx.globalAlpha = 0.95;
      if (tt === "deep") ctx.fillStyle = "#1a3040";
      else if (tt === "shallow") ctx.fillStyle = "#243e48";
      else if (tt === "stone" || t.block) ctx.fillStyle = "#2e3438";
      else if (tt === "bridge") ctx.fillStyle = "#3a4030";
      else if (tt === "plot") ctx.fillStyle = "#2c4028";
      else if (tt === "path") ctx.fillStyle = pathTint;
      else ctx.fillStyle = base;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (tt === "deep" || tt === "shallow") {
        ctx.fillStyle = tt === "deep" ? "rgba(50,100,120,0.45)" : "rgba(70,130,150,0.3)";
        ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
      }
      if (tt === "stone" || t.block) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = FS.COLORS.stone;
        roundRect(ctx, x + 7, y + 7, cell - 14, cell - 14, 5);
        ctx.fill();
      }
      if (tt === "bridge") {
        ctx.fillStyle = "#8a7a55";
        ctx.fillRect(x + 4, y + cell * 0.35, cell - 8, cell * 0.3);
      }
      ctx.globalAlpha = 0.05;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(x, y, cell, cell);
    }
    ctx.globalAlpha = 1;
    if (state.farms && state.farms.list) {
      state.farms.list.forEach(function (f) {
        var fx = f.x * cell, fy = f.y * cell;
        ctx.fillStyle = "rgba(90,120,70,0.55)";
        ctx.fillRect(fx + 5, fy + 5, cell - 10, cell - 10);
        if (f.stage === "ready" && f.store && f.store.length) {
          FS.drawFruit(ctx, f.kind || "berry", fx + cell / 2, fy + cell / 2, 0.7, {
            phase: "ripe", time: state.time, reducedMotion: state.settings.reducedMotion
          });
        } else if (f.stage === "growing" || f.stage === "planted") {
          ctx.fillStyle = "#6a9a58";
          ctx.fillRect(fx + cell * 0.42, fy + cell * 0.35, 4, cell * 0.3);
        }
      });
    }
    ctx.strokeStyle = "rgba(105,224,190,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      state.world.minX * cell - 2,
      state.world.minY * cell - 2,
      (state.world.maxX - state.world.minX + 1) * cell + 4,
      (state.world.maxY - state.world.minY + 1) * cell + 4
    );
  };

  FS.Renderer.prototype.drawBuildings = function (state) {
    if (!state.buildings) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    state.buildings.forEach(function (b) {
      var x = b.x * cell, y = b.y * cell;
      if (b.kind === "fence") {
        ctx.fillStyle = b.owner === "enemy" ? "#6a4040" : "#8a6a40";
        ctx.fillRect(x + 4, y + 10, cell - 8, 8);
        ctx.fillRect(x + 8, y + 4, 6, cell - 8);
      } else if (b.kind === "gate") {
        ctx.strokeStyle = b.closed !== false ? "#c4a060" : "#69E0BE";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        ctx.fillStyle = b.closed !== false ? "rgba(140,100,50,0.45)" : "rgba(105,224,190,0.2)";
        ctx.fillRect(x + 8, y + 8, cell - 16, cell - 16);
      } else if (b.kind === "block") {
        ctx.fillStyle = "#5a6068";
        roundRect(ctx, x + 5, y + 5, cell - 10, cell - 10, 4);
        ctx.fill();
      } else if (b.kind === "hut" || b.kind === "shed") {
        ctx.fillStyle = b.kind === "shed" ? "#6a5a38" : "#7a5a40";
        ctx.fillRect(x + 6, y + 10, cell - 12, cell - 14);
        ctx.fillStyle = "#503828";
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 12);
        ctx.lineTo(x + cell / 2, y + 4);
        ctx.lineTo(x + cell - 4, y + 12);
        ctx.fill();
      }
    });
  };

  FS.Renderer.prototype.drawWoodNodes = function (state) {
    if (!state.woodNodes) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    // trees first (behind branch piles)
    state.woodNodes.forEach(function (n) {
      if (n.kind !== "tree") return;
      var x = (n.x + 0.5) * cell, y = (n.y + 0.5) * cell;
      // canopy shade
      ctx.fillStyle = "rgba(40,70,40,0.28)";
      ctx.beginPath();
      ctx.arc(x, y - 2, cell * 0.72, 0, Math.PI * 2);
      ctx.fill();
      // trunk
      ctx.fillStyle = n.cd > 0 ? "#5a4830" : "#6a5030";
      ctx.fillRect(x - 4, y - 2, 8, cell * 0.42);
      // foliage
      ctx.fillStyle = n.cd > 0 ? "#3a5a38" : "#4a7a48";
      ctx.beginPath();
      ctx.arc(x, y - cell * 0.28, cell * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a9a58";
      ctx.beginPath();
      ctx.arc(x - 8, y - cell * 0.18, cell * 0.26, 0, Math.PI * 2);
      ctx.arc(x + 9, y - cell * 0.2, cell * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8d0a0";
      ctx.font = "10px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("F", x, y + cell * 0.42);
    });
    state.woodNodes.forEach(function (n) {
      if (n.kind === "tree") return;
      if (n.cd > 0 && n.kind === "wood") return;
      var x = (n.x + 0.5) * cell, y = (n.y + 0.5) * cell;
      if (n.kind === "stump") {
        ctx.fillStyle = n.cd > 0 ? "rgba(90,70,40,0.35)" : "#6a5030";
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c4a060";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // branch pile under / beside tree
        ctx.fillStyle = "#8a6a38";
        ctx.fillRect(x - 10, y - 3, 20, 6);
        ctx.fillRect(x - 6, y - 8, 4, 14);
        ctx.fillRect(x + 2, y - 6, 4, 12);
        ctx.fillStyle = "#e8d0a0";
        ctx.font = "10px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText("≡", x, y + 12);
      }
    });
  };

  FS.Renderer.prototype.drawBuildPreview = function (state) {
    if (!state.buildMode || !state.buildMode.on || !state.buildMode.hover) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    var cells = [state.buildMode.hover];
    if (state.buildMode.drag && state.buildMode.tool === "fence") {
      cells = FS.lineCells(state.buildMode.drag.from, state.buildMode.drag.to || state.buildMode.hover);
    }
    cells.forEach(function (c) {
      var ok = state.buildMode.demolish
        ? !!(FS.buildingAt(state, c.x, c.y) && FS.buildingAt(state, c.x, c.y).owner === "player")
        : (state.buildMode.tool && FS.canBuildAt(state, c.x, c.y, state.buildMode.tool).ok);
      ctx.fillStyle = ok ? "rgba(105,224,190,0.35)" : "rgba(224,116,106,0.35)";
      ctx.fillRect(c.x * cell + 2, c.y * cell + 2, cell - 4, cell - 4);
    });
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
    var icons = {
      bush: "❀", drop_pad: "▣", ruin: "⌂", spring: "💧", reward_glade: "✧",
      fertile_garden: "⚘", enemy_nest: "⚠", bridge_site: "≂", rival: "◇"
    };
    (state.world.landmarks || []).forEach(function (lm) {
      var x = (lm.x + 0.5) * cell, y = (lm.y + 0.5) * cell;
      if (lm.kind === "drop_pad") {
        ctx.strokeStyle = "rgba(160,120,80,0.7)";
        ctx.strokeRect(lm.x * cell + 6, lm.y * cell + 6, cell - 12, cell - 12);
        return;
      }
      if (lm.kind === "enemy_nest") {
        ctx.fillStyle = "rgba(180,60,60,0.35)";
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#E0746A";
        ctx.stroke();
      } else {
        ctx.fillStyle = lm.done ? "rgba(181,211,152,0.2)" : "rgba(242,213,151,0.28)";
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = lm.kind === "bush" ? "#b5d398" : FS.COLORS.amber;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = FS.COLORS.text;
      ctx.font = "11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(icons[lm.kind] || "?", x, y + 4);
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
