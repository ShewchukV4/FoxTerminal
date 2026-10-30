/* FOX SERPENT — four starting specializations */
(function (FS) {
  "use strict";

  FS.SPECS = {
    explorer: {
      id: "explorer",
      name: "Дослідник",
      icon: "compass",
      blurb: "Маршрути, мітки, різноманітні печери й знахідки.",
      perks: ["+1 до огляду", "Більше POI у нових чанках", "Ранні корисні мітки"],
      example: "Картографувати багатовихідні печери"
    },
    steward: {
      id: "steward",
      name: "Господар",
      icon: "hearth",
      blurb: "Виробництво, логістика й більші осередки.",
      perks: ["Швидші черги станцій", "Раніше +1 працівник", "Кращі грядки"],
      example: "Зібрати повний осередок і логістику"
    },
    raider: {
      id: "raider",
      name: "Рейдер",
      icon: "banner",
      blurb: "Табори ворогів, трофеї й тактичний вхід.",
      perks: ["Частіші ворожі бази (з правилами відстані)", "Кращі трофеї", "Тактичні інструменти"],
      example: "Захопити чужий двір без HP-смужок"
    },
    miner: {
      id: "miner",
      name: "Шахтар",
      icon: "pick",
      blurb: "Тунелі, опори, гідротехніка й підземне господарство.",
      perks: ["Раннє копання й опори", "Кращий видобуток", "Підземні станції"],
      example: "Осередок біля підземної водойми"
    }
  };

  FS.applySpecEffects = function (state) {
    state.effects = state.effects || {};
    var sp = state.specialization;
    if (sp === "explorer") {
      state.effects.vision = (state.effects.vision || 0) + 1;
      state.effects.poiChanceAdd = 0.08;
    } else if (sp === "steward") {
      state.effects.craftSpeed = 1.25;
      state.effects.allyCapAdd = 1;
      state.effects.farmBonus = 0.1;
    } else if (sp === "raider") {
      state.effects.baseSpawnChance = 0.22;
      state.effects.lootBonus = 0.15;
    } else if (sp === "miner") {
      state.effects.mineSpeed = 1.3;
      state.effects.digUnlocked = true;
      state.effects.supportBonus = 1;
    }
    if (!sp) state.effects.baseSpawnChance = state.effects.baseSpawnChance || 0.12;
  };

  FS.chooseSpecialization = function (state, id) {
    if (!FS.SPECS[id]) return { ok: false, why: "Невідома гілка" };
    if (state.specialization && state.progress && state.progress.specLocked) {
      return { ok: false, why: "Спеціалізацію вже обрано" };
    }
    state.specialization = id;
    state.progress = state.progress || {};
    state.progress.specLocked = true;
    state.progress.specChosenAt = state.time || 0;
    if (FS.recomputeEffects) FS.recomputeEffects(state);
    else if (FS.applySpecEffects) FS.applySpecEffects(state);
    state.ui.panel = null;
    FS.setPauseReason(state, "panel", false);
    state.ui.toast = "Гілка: " + FS.SPECS[id].name;
    if (FS.saveGame) FS.saveGame(state, "spec");
    if (FS.shouldAutoOpenGuide && FS.shouldAutoOpenGuide(state)) {
      FS.openGuide(state, { firstRun: true });
    }
    return { ok: true };
  };

  FS.openSpecPicker = function (state, opts) {
    opts = opts || {};
    if (state.specialization && state.progress && state.progress.specLocked && !opts.force) {
      return;
    }
    state.ui.panel = "spec";
    state.ui.panelDirty = true;
    FS.setPauseReason(state, "panel", true);
  };

  FS.htmlSpecPicker = function (state) {
    var html = '<div class="panel-head"><h2>Оберіть спеціалізацію</h2></div>';
    html += '<p class="tiny">Стиль гри, не стіна. Базове житло, ремесло, печери й захоплення доступні всім. Старий сейв бачить цей вибір один раз.</p>';
    html += '<div class="spec-grid">';
    Object.keys(FS.SPECS).forEach(function (id) {
      var s = FS.SPECS[id];
      html += '<button class="btn spec-card" data-spec="' + id + '"><b>' + s.name + "</b>";
      html += '<span class="tiny">' + s.blurb + "</span>";
      s.perks.forEach(function (p) { html += '<span class="tiny">• ' + p + "</span>"; });
      html += '<span class="tiny muted">Напр.: ' + s.example + "</span></button>";
    });
    html += "</div>";
    return html;
  };
})(window.FoxSerpent);
