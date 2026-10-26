/* FOX SERPENT — XP, cargo, death, objectives */
(function (FS) {
  "use strict";

  FS.xpToNext = function (level) {
    return 4 + level * 2;
  };

  FS.addXp = function (state, amount) {
    amount = Math.floor(amount * (state.effects.xpMul || 1));
    state.xp += amount;
    while (state.xp >= FS.xpToNext(state.talentLevel)) {
      state.xp -= FS.xpToNext(state.talentLevel);
      state.talentLevel += 1;
      state.talents.points += 1;
      state.ui.toast = "Очко таланту! (T)";
      state.tutorial.done.talentPoint = true;
    }
  };

  FS.onFood = function (state, food) {
    state.player.foodsEaten = (state.player.foodsEaten || 0) + 1;
    var skip = state.effects.skipGrowEvery && (state.player.foodsEaten % state.effects.skipGrowEvery === 0);
    if (!skip) FS.growSnake(state.player, food.grow || 1);
    FS.addXp(state, food.xp || 1);
    state.tutorial.done.food = true;
    if (state.audio) FS.sfx(state, "eat");
  };

  FS.onMaterial = function (state, mat) {
    var space = state.cargoMax - state.cargo;
    if (space <= 0) {
      state.ui.toast = "Вантаж повний — здай у гнізді";
      // put back
      state.world.materials.push(mat);
      return;
    }
    state.cargo += mat.amount || 1;
    state.tutorial.done.material = true;
  };

  FS.depositCargo = function (state) {
    if (!FS.atNest(state)) return;
    if (state.cargo <= 0) return;
    var add = state.cargo;
    if (state.progress.pendingRegionBonus && state.effects.firstDeliveryBonus) {
      add += state.effects.firstDeliveryBonus;
      state.progress.regionBonus[state.progress.pendingRegionBonus] = true;
      state.progress.pendingRegionBonus = null;
      state.ui.toast = "Бонус експедиції!";
    }
    state.nestMaterials += add;
    state.cargo = 0;
    state.tutorial.done.deposit = true;
    state.ui.toast = "Здано матеріал: +" + add;
    if (state.audio) FS.sfx(state, "deposit");
  };

  FS.handleDeath = function (state, snake, reason, cell) {
    if (snake.kind === "enemy") {
      snake.dead = true;
      // drop food
      var h = snake.body[0];
      state.world.foods.push({ id: FS.uid(), x: h.x, y: h.y, kind: "fruit", xp: 2, grow: 1 });
      if (state.effects.killXp) FS.addXp(state, state.effects.killXp);
      state.ui.toast = snake.name + " загинула";
      return;
    }

    // Player
    if (FS.tryUseHeart(state, reason, cell).ok) return;

    snake.dead = true;
    var lossMul = state.effects.deathLoss || 1;
    var lost = Math.ceil(state.cargo * 0.6 * lossMul);
    state.lastDeath = {
      reason: reason,
      cell: cell,
      lostCargo: lost,
      lengthBefore: snake.body.length
    };
    state.cargo = Math.max(0, state.cargo - lost);
    state.ui.panel = "death";
    FS.setPauseReason(state, "panel", true);
    if (state.audio) FS.sfx(state, "die");
  };

  FS.respawnPlayer = function (state) {
    var nest = state.world.nest;
    state.player = FS.createPlayerSnake(nest);
    FS.recomputeEffects(state);
    state.player.body = [];
    var dir = "R";
    var v = FS.dirVec(dir);
    for (var i = 0; i < FS.DEATH_LENGTH; i++) {
      state.player.body.push({ x: nest.x + 2 - v.x * i, y: nest.y - v.y * i });
    }
    state.player.dir = dir;
    state.player.dead = false;
    state.player._dying = false;
    FS.clearInput(state.input);
    state.ui.panel = null;
    FS.setPauseReason(state, "panel", false);
    state.ui.toast = "Повернення до гнізда. Таланти й території збережено.";
    FS.saveGame(state, "respawn");
  };

  FS.updateObjectives = function (state) {
    var o = [];
    var t = state.tutorial.done;
    if (!t.move) o.push({ title: "Зроби крок", detail: "WASD — tap = один крок" });
    else if (!t.hold) o.push({ title: "Утримай клавішу", detail: "Рухайся, потім відпусти — зупинись" });
    else if (!t.food) o.push({ title: "З’їж плід", detail: "Довжина зросте на 1" });
    else if (!t.material) o.push({ title: "Збери матеріал", detail: "Бурштинові точки" });
    else if (!t.deposit) o.push({ title: "Здай у гнізді", detail: "Підійди до гнізда" });
    else if (!t.talentPoint) o.push({ title: "Збери досвід", detail: "Отримай очко таланту" });
    else if (!t.talentPick) o.push({ title: "Відкрий талант (T)", detail: "Або розвилка: сила / серце" });
    else if (!t.expand) {
      var need = Math.max(4, FS.FIRST_EXPAND_COST - (state.effects.expandDiscount || 0));
      o.push({
        title: "Відкрий першу ділянку",
        detail: "Матеріал у гнізді " + state.nestMaterials + "/" + need,
        mark: "expand"
      });
    } else if (!t.enemyWarn) o.push({ title: "Обережно", detail: "На новій землі може бути змія" });
    else o.push({ title: "Досліджуй", detail: "Таланти · території · суперники" });
    state.ui.objectives = o.slice(0, 2);
  };
})(window.FoxSerpent);
