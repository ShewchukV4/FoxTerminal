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
    this.drawVisionFog(state);
    if (state.ui.heartBreak && state.ui.heartBreak.t > 0) this.drawHeartBreak(state);
    if (state.lastDeath && state.ui.panel === "death") this.drawDeathCell(state);

    ctx.restore();
  };

  FS.Renderer.prototype.drawVisionFog = function (state) {
    if (!state._fov) return;
    if (state.layerId !== "cave" && !(state.settlement && state.settlement.phase === "night")) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    var night = state.settlement && state.settlement.phase === "night";
    // Only cells near camera — full-map fog every frame caused hitches
    var viewW = this.canvas.width / this.dpr / this.cam.z;
    var viewH = this.canvas.height / this.dpr / this.cam.z;
    var x0 = Math.floor((this.cam.x - viewW / 2) / cell) - 1;
    var y0 = Math.floor((this.cam.y - viewH / 2) / cell) - 1;
    var x1 = Math.ceil((this.cam.x + viewW / 2) / cell) + 1;
    var y1 = Math.ceil((this.cam.y + viewH / 2) / cell) + 1;
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        if (!FS.inBounds(state.world, tx, ty)) continue;
        var vis = FS.cellVision ? FS.cellVision(state, tx, ty, state._fov) : "visible";
        if (vis === "visible") continue;
        var x = tx * cell, y = ty * cell;
        ctx.fillStyle = vis === "memory"
          ? (night ? "rgba(8,14,12,0.45)" : "rgba(4,8,12,0.55)")
          : "rgba(0,0,0,0.92)";
        ctx.fillRect(x, y, cell, cell);
      }
    }
    if (state.layerId === "cave") {
      (state.enemies || []).forEach(function (e) { e._hiddenByFog = true; });
    } else if (state.enemies) {
      state.enemies.forEach(function (e) {
        if (e.dead) return;
        var eh = FS.snakeHead(e);
        e._hiddenByFog = !state._fov[FS.key(eh.x, eh.y)];
      });
    }
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
      else if (tt === "cave_floor" || tt === "cave_exit") ctx.fillStyle = "#1e2830";
      else if (tt === "cave_wall") ctx.fillStyle = "#121820";
      else if (tt === "campfire") ctx.fillStyle = "#2a3020";
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
        var cx = (f.x + 0.5) * cell, cy = (f.y + 0.5) * cell;
        if (FS.drawFarmPlot) FS.drawFarmPlot(ctx, cx, cy, cell, f.stage, f.kind);
        if (f.stage === "ready") {
          FS.drawFruit(ctx, f.kind || "berry", cx, cy - 2, 0.75, {
            phase: "ripe", time: state.time, reducedMotion: state.settings.reducedMotion
          });
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
    FS.ensurePantry && FS.ensurePantry(state);
    state.buildings.forEach(function (b) {
      var cx = (b.x + 0.5) * cell, cy = (b.y + 0.5) * cell;
      var dmg = Math.max(0, (b.hpMax || 2) - (b.hp || 2));
      if (b.kind === "fence" && FS.drawFence) {
        FS.drawFence(ctx, cx, cy, cell, FS.fenceMask(state, b.x, b.y), dmg);
      } else if (b.kind === "gate" && FS.drawGate) {
        FS.drawGate(ctx, cx, cy, cell, b.closed !== false, b.rot || 0, dmg);
      } else if (b.kind === "block" && FS.drawBlock) {
        FS.drawBlock(ctx, cx, cy, cell, dmg);
      } else if (b.kind === "hut" && FS.drawHut) {
        FS.drawHut(ctx, cx, cy, cell);
      } else if (b.kind === "shed" && FS.drawWoodShed) {
        var wf = state.woodCap ? state.wood / state.woodCap : 0;
        FS.drawWoodShed(ctx, cx, cy, cell, wf);
      } else if (b.kind === "larder" && FS.drawLarder) {
        var pf = state.pantry && state.pantry.cap ? state.pantry.food / state.pantry.cap : 0;
        FS.drawLarder(ctx, cx, cy, cell, pf);
      }
    });
  };

  FS.Renderer.prototype.drawWoodNodes = function (state) {
    if (!state.woodNodes) return;
    var ctx = this.ctx;
    var cell = FS.CELL;
    var head = state.player && FS.snakeHead(state.player);
    state.woodNodes.forEach(function (n) {
      if (n.kind !== "tree") return;
      var cx = (n.x + 0.5) * cell, cy = (n.y + 0.5) * cell;
      var faded = head && FS.manhattan(head, n) === 0;
      if (FS.drawTreeSprite) {
        FS.drawTreeSprite(ctx, cx, cy, cell, n.variant || 0, { faded: faded });
      }
    });
    state.woodNodes.forEach(function (n) {
      if (n.kind === "tree") return;
      if (n.cd > 0 && n.kind === "wood") return;
      var cx = (n.x + 0.5) * cell, cy = (n.y + 0.5) * cell;
      if (n.kind === "wood" && FS.drawBranchPile) FS.drawBranchPile(ctx, cx, cy, cell);
      else if (n.kind === "stump") {
        ctx.fillStyle = "#6a5030";
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.2, 0, Math.PI * 2);
        ctx.fill();
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
    var n = (state.settlement && state.settlement.campfire) || state.world.nest;
    var x = (n.x + 0.5) * cell, y = (n.y + 0.5) * cell;
    if (FS.drawCampfire && state.layerId !== "cave") {
      FS.drawCampfire(ctx, x, y, cell, state.time || 0, !!(state.settings && state.settings.reducedMotion));
      return;
    }
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
      if (lm.kind === "cave_entrance") {
        if (FS.drawCaveEntrance) FS.drawCaveEntrance(ctx, x, y, cell);
        else {
          ctx.fillStyle = "#1a1010";
          ctx.beginPath();
          ctx.ellipse(x, y + 4, cell * 0.32, cell * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
        }
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
      if (snake.loot) {
        FS.drawFruit(ctx, snake.loot.kind || "berry", hx + 10, hy - 12, 0.55, {
          phase: "ripe", time: state.time, reducedMotion: true
        });
      }
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
    state.enemies.forEach(function (e) {
      if (e._hiddenByFog) return;
      this.drawSnake(ctx, e, state);
    }.bind(this));
    (state.allies || []).forEach(function (a) {
      if (a.inside || a.dead) return;
      this.drawSnake(ctx, a, state);
    }.bind(this));
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
