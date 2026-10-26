/* FOX GENESIS — organs, unlocks, specializations, body apply */
(function (FG) {
  "use strict";

  FG.defaultBody = function (formId) {
    return {
      form: formId || "mobile",
      organs: [],
      specs: {},
      levels: {},
      planned: []
    };
  };

  FG.unlockGene = function (state, geneId, source) {
    if (!geneId || !FG.ORGANS[geneId]) return false;
    if (state.genes[geneId]) return false;
    state.genes[geneId] = { unlocked: true, source: source || "unknown", t: state.world.time };
    FG.addJournal(state.world, "Новий ген: " + FG.ORGANS[geneId].name + ".");
    if (state.ui) state.ui.toast = "Відкрито: " + FG.ORGANS[geneId].name;
    return true;
  };

  FG.slotUsed = function (body, slot) {
    var n = 0;
    for (var i = 0; i < body.organs.length; i++) {
      var o = FG.ORGANS[body.organs[i]];
      if (o && o.slot === slot) n++;
    }
    return n;
  };

  FG.slotMax = function (body, slot) {
    var form = FG.FORMS[body.form] || FG.FORMS.mobile;
    return (form.slots && form.slots[slot]) || 1;
  };

  FG.canInstall = function (state, geneId) {
    var o = FG.ORGANS[geneId];
    if (!o) return { ok: false, why: "Невідомий орган" };
    if (!state.genes[geneId]) return { ok: false, why: "Ген не відкрито" };
    if (!FG.atNest(state)) return { ok: false, why: "Перебудова лише в гнізді" };
    if (state.player.body.organs.indexOf(geneId) >= 0) return { ok: false, why: "Вже встановлено" };
    if (FG.slotUsed(state.player.body, o.slot) >= FG.slotMax(state.player.body, o.slot)) {
      return { ok: false, why: "Немає вільного слота: " + o.slot };
    }
    if (!FG.canAfford(state.resources, o.cost)) return { ok: false, why: "Бракує ресурсів" };
    var stats = FG.bodyStats(state.player.body);
    if (stats.load + (o.load || 0) > 55) return { ok: false, why: "Навантаження завелике" };
    return { ok: true };
  };

  FG.installOrgan = function (state, geneId) {
    var check = FG.canInstall(state, geneId);
    if (!check.ok) return check;
    var o = FG.ORGANS[geneId];
    FG.pay(state.resources, o.cost);
    state.player.body.organs.push(geneId);
    state.player.body.levels[geneId] = state.player.body.levels[geneId] || 1;
    FG.refreshCreatureStats(state.player);
    FG.ensureAbilityBinds(state.player);
    // Offer free ability slot if active organ installed into empty bind
    if (FG.ABILITY_DEFS[geneId]) {
      var binds = state.player.abilityBinds;
      var free = null;
      ["rmb", "q", "e"].forEach(function (s) { if (!binds[s] && !free) free = s; });
      if (free) {
        binds[free] = geneId;
        state.ui.toast = "Мутація: " + o.name + " → клавіша " + free.toUpperCase();
      } else {
        state.ui.toast = "Мутація: " + o.name + " · признач здібність у панелі M";
        state.ui.pendingBind = geneId;
      }
    } else {
      state.ui.toast = "Мутація: " + o.name;
    }
    FG.addJournal(state.world, "Встановлено орган: " + o.name + ".");
    state.ui.evolveFlash = 0.8;
    if (state.audio) FG.sfx(state, "mutate");
    return { ok: true };
  };

  FG.removeOrgan = function (state, geneId) {
    if (!FG.atNest(state)) return { ok: false, why: "Лише в гнізді" };
    var i = state.player.body.organs.indexOf(geneId);
    if (i < 0) return { ok: false, why: "Немає органа" };
    state.player.body.organs.splice(i, 1);
    if (state.player.abilityBinds) {
      ["rmb", "q", "e"].forEach(function (s) {
        if (state.player.abilityBinds[s] === geneId) state.player.abilityBinds[s] = null;
      });
    }
    FG.refreshCreatureStats(state.player);
    FG.ensureAbilityBinds(state.player);
    // Partial refund
    var o = FG.ORGANS[geneId];
    if (o && o.cost) {
      state.resources.biomass += Math.floor((o.cost.biomass || 0) * 0.4);
      state.resources.mineral += Math.floor((o.cost.mineral || 0) * 0.4);
    }
    return { ok: true };
  };

  FG.chooseSpec = function (state, geneId, branch) {
    if (!FG.atNest(state)) return false;
    if (state.player.body.organs.indexOf(geneId) < 0) return false;
    var lvl = state.player.body.levels[geneId] || 1;
    if (lvl < 2) return false;
    state.player.body.specs[geneId] = branch;
    FG.refreshCreatureStats(state.player);
    return true;
  };

  FG.levelOrgan = function (state, geneId) {
    if (!FG.atNest(state)) return { ok: false, why: "Лише в гнізді" };
    if (state.player.body.organs.indexOf(geneId) < 0) return { ok: false, why: "Не встановлено" };
    var lvl = state.player.body.levels[geneId] || 1;
    if (lvl >= 3) return { ok: false, why: "Макс. рівень" };
    var cost = { biomass: 10 * lvl, mineral: 2 * lvl };
    if (!FG.canAfford(state.resources, cost)) return { ok: false, why: "Бракує ресурсів" };
    FG.pay(state.resources, cost);
    state.player.body.levels[geneId] = lvl + 1;
    if (lvl + 1 === 2 && !state.player.body.specs[geneId]) {
      state.ui.specChoice = geneId;
    }
    FG.refreshCreatureStats(state.player);
    return { ok: true };
  };

  FG.specOptions = function (geneId) {
    var map = {
      electric: [
        { id: "chain", name: "Довгий ланцюг", desc: "Більше стрибків, менша шкода." },
        { id: "pulse", name: "Сильний імпульс", desc: "Один потужний удар." }
      ],
      web: [
        { id: "wide", name: "Широка мережа", desc: "Більша зона пастки." },
        { id: "snap", name: "Бойова пастка", desc: "Швидше й сильніше уповільнення." }
      ],
      needles: [
        { id: "spread", name: "Широкий залп", desc: "Більше голок." },
        { id: "focus", name: "Точний постріл", desc: "Менший розкид, більше шкоди." }
      ],
      regen: [
        { id: "field", name: "Поле відновлення", desc: "Слабке лікування союзників." },
        { id: "burst", name: "Швидкий ремонт", desc: "Сильніше самолікування." }
      ]
    };
    return map[geneId] || [];
  };

  FG.refreshCreatureStats = function (c) {
    var st = FG.bodyStats(c.body);
    c.stats = st;
    c.hpMax = st.hpMax;
    c.energyMax = st.energyMax;
    if (c.hp == null) c.hp = c.hpMax;
    if (c.energy == null) c.energy = c.energyMax;
    c.hp = FG.clamp(c.hp, 0, c.hpMax);
    c.energy = FG.clamp(c.energy, 0, c.energyMax);
    c.armor = st.armor;
    c.speed = st.speed;
    c.synergies = st.synergies.map(function (s) { return s.id; });
  };
})(window.FoxGenesis);
