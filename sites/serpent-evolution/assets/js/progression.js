/* FOX SERPENT — XP, nutrition food, death, objectives */
(function (FS) {
  "use strict";

  FS.xpToNext = function (level) {
    return 4 + level * 2;
  };

  FS.addXp = function (state, amount) {
    amount = Math.floor(amount * (state.effects.xpMul || 1));
    if (amount <= 0) return;
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
    var nut = food.nutrition != null ? food.nutrition : 1;
    var xpBase = food.xp || 1;
    var g = FS.gainNutrition(state, nut, xpBase);
    FS.addXp(state, g.xpBonus);
    if (FS.onFoodEaten) FS.onFoodEaten(state, food);
    state.tutorial.done.food = true;
    if (state.nutrition > 0) state.tutorial.done.nutrition = true;
    if (state.audio) FS.sfx(state, "eat");
  };

  FS.handleDeath = function (state, snake, reason, cell) {
    if (snake.kind === "enemy") {
      snake.dead = true;
      var h = snake.body[0];
      if (FS.foodCellFree(state, h.x, h.y)) {
        state.world.foods.push({
          id: FS.uid(), x: h.x, y: h.y,
          kind: "golden", phase: "ripe", nutrition: 1, xp: 2, age: 0
        });
      }
      if (state.effects.killXp) FS.addXp(state, state.effects.killXp);
      if (state.effects.cosmetics) {
        state.progress.patterns = state.progress.patterns || [];
        if (state.progress.patterns.indexOf(snake.arch) < 0) {
          state.progress.patterns.push(snake.arch);
        }
      }
      state.progress.kills = (state.progress.kills || 0) + 1;
      state.progress.killArch = state.progress.killArch || {};
      state.progress.killArch[snake.arch] = true;
      state.ui.toast = snake.name + " загинула";
      return;
    }

    if (FS.tryUseHeart(state, reason, cell).ok) return;

    snake.dead = true;
    state.lastDeath = {
      reason: reason,
      cell: cell,
      nutritionLost: FS.nutritionOf(state),
      lengthBefore: snake.body.length
    };
    // Death without heart: nutrition → 0, length → 3
    state.nutrition = 0;
    state.ui.panel = "death";
    FS.setPauseReason(state, "panel", true);
    if (state.audio) FS.sfx(state, "die");
  };

  FS.respawnPlayer = function (state) {
    var nest = state.world.nest;
    state.player = FS.createPlayerSnake(nest);
    state.nutrition = 0;
    FS.recomputeEffects(state);
    FS.initNutrition(state, 0);
    state.player.dead = false;
    state.player._dying = false;
    FS.clearInput(state.input);
    state.ui.panel = null;
    FS.setPauseReason(state, "panel", false);
    state.ui.toast = "Повернення до гнізда. Таланти й території збережено. Пожива скинута.";
    FS.saveGame(state, "respawn");
  };

  FS.updateObjectives = function (state) {
    var o = [];
    var t = state.tutorial.done;
    if (!t.move) o.push({ title: "Зроби крок", detail: "WASD — tap = один крок" });
    else if (!t.hold) o.push({ title: "Утримай клавішу", detail: "Потім відпусти — зупинись" });
    else if (!t.food) o.push({ title: "З’їж плід", detail: "Пожива +1 · довжина 3→4" });
    else if (!t.expand) {
      var offers = state.world.openOffers || [];
      var q = offers[0] ? FS.getExpansionQuote(state, offers[0].id) : null;
      var need = q ? q.cost : 3;
      o.push({
        title: "Збери " + need + " поживи на першу землю",
        detail: "Зараз " + FS.nutritionOf(state) + "/" + need + " · Tab → відкрити",
        mark: "expand"
      });
    } else if (!t.farm) o.push({ title: "Посади першу грядку", detail: "B на родючому ґрунті · 3 поживи" });
    else if (!t.harvest) o.push({ title: "Збери врожай", detail: "Стань на готову грядку або дочекайся садівника" });
    else if (!t.home) o.push({ title: "Збудуй домівку", detail: "B · 4 поживи біля гнізда" });
    else if (!t.ally) o.push({ title: "Признач садівника", detail: "Найми в домівці (B)" });
    else if (!t.talentPoint) o.push({ title: "Збери досвід", detail: "Очко таланту (T)" });
    else if (!t.talentPick) o.push({ title: "Відкрий талант (T)", detail: "Або розвилка: сила / серце" });
    else o.push({ title: "Розвивай господарство", detail: "Ферми · союзники · нові землі" });
    state.ui.objectives = o.slice(0, 2);
  };
})(window.FoxSerpent);
