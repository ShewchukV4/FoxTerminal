/* FOX GENESIS — DOM HUD and panels */
(function (FG) {
  "use strict";

  FG.bindUI = function (state) {
    state.ui = {
      panel: null,
      toast: "",
      toastT: 0,
      evolveFlash: 0,
      buildGhost: null,
      selectedGene: null,
      mapOpen: false,
      helpOpen: false,
      objectives: []
    };
    var root = document.getElementById("ui-root");
    root.innerHTML = [
      '<div id="hud">',
      '  <div class="hud-left">',
      '    <div class="bar"><span>HP</span><div class="track"><i id="hp-bar"></i></div><b id="hp-txt"></b></div>',
      '    <div class="bar energy"><span>EN</span><div class="track"><i id="en-bar"></i></div><b id="en-txt"></b></div>',
      '    <div class="cargo" id="cargo"></div>',
      '  </div>',
      '  <div class="hud-center"><div id="objective"></div><div id="event-line"></div></div>',
      '  <div class="hud-right">',
      '    <div id="res"></div>',
      '    <canvas id="minimap" width="160" height="160"></canvas>',
      '  </div>',
      '  <div class="abilities" id="abilities"></div>',
      '</div>',
      '<div id="toast"></div>',
      '<div id="pause-banner" class="hidden">ПАУЗА · Пробіл продовжити</div>',
      '<div id="panel" class="panel hidden"></div>',
      '<div id="overlay-title" class="overlay">',
      '  <div class="card title-card">',
      '    <div class="kicker">FOX GENESIS</div>',
      '    <h1>Зміни себе. Вирости свій вид.<br>Переживи зміну світу</h1>',
      '    <p>Локальна еволюційна сага у живому світі FOX.</p>',
      '    <div class="row">',
      '      <button id="btn-new" class="btn primary">Нова гра</button>',
      '      <button id="btn-continue" class="btn">Продовжити</button>',
      '      <button id="btn-import" class="btn ghost">Імпорт</button>',
      '      <input id="import-file" type="file" accept="application/json,.json" hidden />',
      '    </div>',
      '    <p class="tiny">WASD · ЛКМ/ПКМ · F · M · C · Tab · Пробіл</p>',
      '  </div>',
      '</div>'
    ].join("");

    document.getElementById("btn-new").onclick = function () {
      FG.unlockAudio(state);
      FG.newGame(state);
      document.getElementById("overlay-title").classList.add("hidden");
    };
    document.getElementById("btn-continue").onclick = function () {
      FG.unlockAudio(state);
      var r = FG.loadGame(state);
      if (!r.ok) { state.ui.toast = r.why; FG.newGame(state); }
      document.getElementById("overlay-title").classList.add("hidden");
      state.started = true;
    };
    document.getElementById("btn-import").onclick = function () {
      document.getElementById("import-file").click();
    };
    document.getElementById("import-file").onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      FG.importSave(state, f, function (r) {
        if (!r.ok) state.ui.toast = r.why;
        else {
          document.getElementById("overlay-title").classList.add("hidden");
          state.started = true;
          state.ui.toast = "Імпортовано";
        }
      });
    };
  };

  FG.updateObjectives = function (state) {
    var o = [];
    if (!state.tutorial.done.food) o.push("Збери світний плід (F)");
    else if (!state.tutorial.done.mutate) o.push("Знайди ген-зразок і відкрий мутацію");
    else if (!state.tutorial.done.nest) o.push("Повернись у гніздо і здай вантаж");
    else if (!state.tutorial.done.install) o.push("У гнізді (M) встанови орган");
    else if (!state.tutorial.done.ally) o.push("Збережи породу і вирости союзника (C)");
    else o.push("Дослідюй біоми · готуй колонію");
    if (state.colony.raidWarn > 0) o.unshift("⚠ Напад на гніздо!");
    state.ui.objectives = o.slice(0, 3);
  };

  FG.renderHUD = function (state) {
    if (!state.started) return;
    var p = state.player;
    document.getElementById("hp-bar").style.width = (100 * p.hp / p.hpMax) + "%";
    document.getElementById("en-bar").style.width = (100 * p.energy / p.energyMax) + "%";
    document.getElementById("hp-txt").textContent = Math.ceil(p.hp) + "/" + Math.ceil(p.hpMax);
    document.getElementById("en-txt").textContent = Math.ceil(p.energy);
    document.getElementById("cargo").textContent =
      "Вантаж " + (p.carrying.biomass + p.carrying.mineral + p.carrying.sample) + "/" + p.capacity;
    document.getElementById("res").innerHTML =
      "<div>Біомаса <b>" + Math.floor(state.resources.biomass) + "</b></div>" +
      "<div>Мінерали <b>" + Math.floor(state.resources.mineral) + "</b></div>" +
      "<div>Зразки <b>" + Math.floor(state.resources.sample) + "</b></div>" +
      "<div>Покоління <b>" + state.generation + "</b></div>";

    FG.updateObjectives(state);
    document.getElementById("objective").textContent = state.ui.objectives[0] || "";
    var ev = state.world.activeEvents.map(function (e) { return e.name; }).join(" · ");
    document.getElementById("event-line").textContent = ev;

    var abs = document.getElementById("abilities");
    var keys = [
      { k: "ЛКМ", slot: "lmb", label: "Укус" },
      { k: "ПКМ", slot: "rmb", label: abilityLabel(p, ["needles", "acid", "electric", "web", "tentacle", "tailmace", "parasite"]) },
      { k: "Q", slot: "q", label: abilityLabel(p, ["sporeburst", "biolume", "camouflage", "gasbags", "diggers"]) },
      { k: "E", slot: "e", label: abilityLabel(p, ["regen", "pheromone", "symbiont", "vibesense", "filter", "membrane"]) }
    ];
    abs.innerHTML = keys.map(function (a) {
      var cd = p.abilityCd[a.slot] || 0;
      return '<div class="abil' + (cd > 0 ? " cd" : "") + '"><em>' + a.k + "</em><span>" + a.label + "</span>" +
        (cd > 0 ? "<i>" + cd.toFixed(1) + "</i>" : "") + "</div>";
    }).join("");

    if (state.ui.toast) {
      state.ui.toastT = 2.2;
      document.getElementById("toast").textContent = state.ui.toast;
      document.getElementById("toast").classList.add("show");
      state.ui.toast = "";
    }
    if (state.ui.toastT > 0) {
      state.ui.toastT -= state._dt || 0.016;
      if (state.ui.toastT <= 0) document.getElementById("toast").classList.remove("show");
    }

    document.getElementById("pause-banner").classList.toggle("hidden", !state.paused || !!state.ui.panel);
    FG.drawMinimap(state);
    // Rebuild panel only when opened/changed — every-frame rebuild ate clicks.
    if (state.ui.panel) {
      if (state.ui.panelDirty || state.ui._panelShown !== state.ui.panel) {
        FG.renderPanel(state);
        state.ui.panelDirty = false;
        state.ui._panelShown = state.ui.panel;
      }
    } else {
      state.ui._panelShown = null;
      document.getElementById("panel").classList.add("hidden");
    }
  };

  function abilityLabel(p, list) {
    for (var i = 0; i < list.length; i++) {
      if (p.body.organs.indexOf(list[i]) >= 0) return FG.ORGANS[list[i]].name;
    }
    return "—";
  }

  FG.drawMinimap = function (state) {
    var c = document.getElementById("minimap");
    if (!c) return;
    var ctx = c.getContext("2d");
    var s = 160 / FG.WORLD_W;
    ctx.fillStyle = "#0A101C";
    ctx.fillRect(0, 0, 160, 160);
    // explored
    for (var key in state.world.explored) {
      var parts = key.split(",");
      var ix = +parts[0], iy = +parts[1];
      var bio = FG.biomeAtWorld(state.world, ix * state.world.fogTile, iy * state.world.fogTile);
      ctx.fillStyle = FG.BIOMES[bio].color;
      ctx.fillRect(ix * state.world.fogTile * s, iy * state.world.fogTile * s, state.world.fogTile * s + 0.5, state.world.fogTile * s + 0.5);
    }
    ctx.fillStyle = FG.COLORS.mint;
    ctx.beginPath();
    ctx.arc(state.world.nest.x * s, state.world.nest.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FG.COLORS.amber;
    ctx.beginPath();
    ctx.arc(state.player.x * s, state.player.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };

  FG.togglePanel = function (state, name) {
    if (state.ui.panel === name) {
      state.ui.panel = null;
      state.paused = false;
      state.ui.panelDirty = true;
      return;
    }
    state.ui.panel = name;
    state.ui.panelDirty = true;
    if (name) state.paused = true;
  };

  FG.renderPanel = function (state) {
    var el = document.getElementById("panel");
    el.classList.remove("hidden");
    if (state.ui.panel === "evolve") el.innerHTML = FG.htmlEvolve(state);
    else if (state.ui.panel === "colony") el.innerHTML = FG.htmlColony(state);
    else if (state.ui.panel === "menu") el.innerHTML = FG.htmlMenu(state);
    else if (state.ui.panel === "map") el.innerHTML = FG.htmlMap(state);
    else if (state.ui.panel === "help") el.innerHTML = FG.htmlHelp(state);
    else if (state.ui.panel === "bestiary") el.innerHTML = FG.htmlBestiary(state);
    else el.innerHTML = "";
    FG.bindPanelHandlers(state);
  };

  FG.htmlEvolve = function (state) {
    var syn = FG.activeSynergies(state.player.body);
    var organs = Object.keys(FG.ORGANS);
    var sel = state.ui.selectedGene;
    var html = '<div class="panel-head"><h2>Еволюція</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    if (state.atNest) {
      html += '<p class="ok-line">Ти в гнізді — клікни відкритий орган, щоб встановити.</p>';
    } else {
      html += '<p class="warn">Зараз поза гніздом: можна дивитись гени. Щоб встановити — стань у світле коло гнізда і натисни M.</p>';
    }
    html += '<div class="evolve-grid"><div class="col"><h3>Органи</h3><div class="list">';
    for (var i = 0; i < organs.length; i++) {
      var id = organs[i];
      var o = FG.ORGANS[id];
      var unlocked = !!state.genes[id];
      var installed = state.player.body.organs.indexOf(id) >= 0;
      var selected = sel === id;
      html += '<button type="button" class="org' + (installed ? " on" : "") + (selected ? " sel" : "") + (!unlocked ? " locked" : "") + '" data-gene="' + id + '">';
      html += "<b>" + (unlocked ? o.name : "???") + (installed ? " ✓" : "") + "</b>";
      html += "<span>" + (unlocked ? o.hint : o.unlockHint) + "</span>";
      if (unlocked) {
        var cost = o.cost || {};
        html += "<em>" + o.slot + " · load " + o.load +
          " · біо " + (cost.biomass || 0) +
          (cost.mineral ? " · мін " + cost.mineral : "") +
          (cost.sample ? " · зраз " + cost.sample : "") + "</em>";
      }
      html += "</button>";
    }
    html += '</div></div><div class="col center"><h3>Тіло</h3><div id="body-preview" class="body-preview"></div>';
    html += "<p>Форма: " + (FG.FORMS[state.player.body.form] || FG.FORMS.mobile).name + "</p>";
    html += "<p>Навантаження: " + FG.bodyStats(state.player.body).load + "</p>";
    if (sel && FG.ORGANS[sel]) {
      html += '<p class="sel-line">Обрано: <b>' + FG.ORGANS[sel].name + "</b></p>";
    } else {
      html += '<p class="muted">Обери орган зі списку зліва.</p>';
    }
    html += '<div class="row"><button type="button" class="btn primary" data-act="install">Встановити</button>';
    html += '<button type="button" class="btn ghost" data-act="remove">Зняти</button>';
    html += '<button type="button" class="btn ghost" data-act="level">Рівень+</button></div></div>';
    html += '<div class="col"><h3>Синергії</h3>';
    if (!syn.length) html += '<p class="muted">Поки немає активних комбінацій.</p>';
    for (var s = 0; s < FG.SYNERGIES.length; s++) {
      var sy = FG.SYNERGIES[s];
      var on = syn.some(function (x) { return x.id === sy.id; });
      html += '<div class="syn' + (on ? " on" : "") + '"><b>' + sy.name + "</b><span>" + sy.desc + "</span></div>";
    }
    html += "</div></div>";
    if (state.ui.specChoice) {
      var opts = FG.specOptions(state.ui.specChoice);
      html += '<div class="spec-box"><h3>Спеціалізація: ' + FG.ORGANS[state.ui.specChoice].name + "</h3>";
      for (var j = 0; j < opts.length; j++) {
        html += '<button class="btn" data-spec="' + opts[j].id + '">' + opts[j].name + " — " + opts[j].desc + "</button>";
      }
      html += "</div>";
    }
    return html;
  };

  FG.htmlColony = function (state) {
    var html = '<div class="panel-head"><h2>Колонія</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<div class="colony-grid"><div><h3>Будівлі</h3><div class="list">';
    Object.keys(FG.BUILDINGS).forEach(function (id) {
      if (id === "heart") return;
      var b = FG.BUILDINGS[id];
      var has = FG.hasBuilding(state, id);
      html += '<button class="org" data-build="' + id + '"><b>' + b.name + (has ? " ✓" : "") + "</b><span>" + b.desc +
        "</span><em>біо " + (b.cost.biomass || 0) + " · мін " + (b.cost.mineral || 0) + "</em></button>";
    });
    html += '</div></div><div><h3>Породи / інкубація</h3>';
    html += '<div class="row"><button class="btn primary" data-act="save-breed">Зберегти поточне тіло як породу</button></div>';
    html += '<div class="list">';
    state.colony.breeds.forEach(function (br) {
      html += '<button class="org" data-incubate="' + br.id + '"><b>' + br.name + "</b><span>" + (FG.ROLES[br.role] || {}).name +
        " · виростити</span></button>";
    });
    if (!state.colony.breeds.length) html += '<p class="muted">Ще немає порід.</p>';
    html += "</div><h3>Черга</h3>";
    state.colony.queue.forEach(function (q) {
      html += "<p>" + Math.floor(q.t) + "/" + q.need + " с</p>";
    });
    html += '<h3>Накази союзникам</h3><div class="row wrap">';
    ["follow", "hold", "gather", "nest"].forEach(function (o) {
      html += '<button class="btn ghost" data-order="' + o + '">' + o + "</button>";
    });
    html += '</div><h3>Нове покоління</h3><div class="row wrap">';
    Object.keys(FG.FORMS).forEach(function (f) {
      html += '<button class="btn" data-gen="' + f + '">' + FG.FORMS[f].name + "</button>";
    });
    html += "</div></div></div>";
    return html;
  };

  FG.htmlMenu = function (state) {
    return [
      '<div class="panel-head"><h2>Меню</h2><button class="btn ghost" data-act="close">Назад</button></div>',
      '<div class="stack">',
      '<button class="btn primary" data-act="resume">Продовжити</button>',
      '<button class="btn" data-act="save">Зберегти</button>',
      '<button class="btn" data-act="export">Експорт JSON</button>',
      '<button class="btn" data-act="help">Довідка</button>',
      '<button class="btn" data-act="bestiary">Бестіарій / журнал</button>',
      '<label class="check"><input type="checkbox" id="chk-mute"' + (state.settings.muted ? " checked" : "") + '/> Без звуку</label>',
      '<label class="check"><input type="checkbox" id="chk-motion"' + (state.settings.reducedMotion ? " checked" : "") + '/> Зменшений рух</label>',
      '<label>Якість <select id="sel-quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>',
      '<button class="btn danger" data-act="new">Новий світ…</button>',
      "</div>"
    ].join("");
  };

  FG.htmlHelp = function () {
    return '<div class="panel-head"><h2>Довідка</h2><button class="btn ghost" data-act="close">Закрити</button></div><ul class="help">' +
      FG.HELP_TEXT.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  };

  FG.htmlMap = function (state) {
    var html = '<div class="panel-head"><h2>Карта</h2><button class="btn ghost" data-act="close">Закрити</button></div><ul>';
    state.world.landmarks.forEach(function (l) {
      html += "<li><b>" + l.name + "</b> — " + Math.round(l.x) + ", " + Math.round(l.y) + "</li>";
    });
    html += '</ul><p class="muted">Туман війни: невідоме приховане на мінімапі й у світі.</p>';
    return html;
  };

  FG.htmlBestiary = function (state) {
    var html = '<div class="panel-head"><h2>Журнал</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<h3>Спостереження</h3><ul>";
    state.world.journal.forEach(function (j) {
      html += "<li>" + j.text + "</li>";
    });
    html += "</ul><h3>Відкриті гени</h3><ul>";
    Object.keys(state.genes).forEach(function (g) {
      html += "<li>" + FG.ORGANS[g].name + "</li>";
    });
    html += "</ul>";
    return html;
  };

  FG.bindPanelHandlers = function (state) {
    var el = document.getElementById("panel");
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-act],[data-gene],[data-build],[data-incubate],[data-order],[data-gen],[data-spec]");
      if (!t) return;
      if (t.dataset.act === "close" || t.dataset.act === "resume") {
        state.ui.panel = null; state.paused = false; return;
      }
      if (t.dataset.act === "install") {
        if (!state.ui.selectedGene) { state.ui.toast = "Спочатку обери орган зі списку"; return; }
        var r = FG.installOrgan(state, state.ui.selectedGene);
        if (!r.ok) state.ui.toast = r.why;
        else { state.tutorial.done.install = true; state.ui.toast = "Встановлено"; }
        state.ui.panelDirty = true;
        FG.renderPanel(state); return;
      }
      if (t.dataset.act === "remove") {
        if (!state.ui.selectedGene) { state.ui.toast = "Обери орган"; return; }
        var rm = FG.removeOrgan(state, state.ui.selectedGene);
        if (!rm.ok) state.ui.toast = rm.why;
        state.ui.panelDirty = true;
        FG.renderPanel(state); return;
      }
      if (t.dataset.act === "level") {
        if (!state.ui.selectedGene) { state.ui.toast = "Обери орган"; return; }
        var lv = FG.levelOrgan(state, state.ui.selectedGene);
        if (!lv.ok) state.ui.toast = lv.why;
        state.ui.panelDirty = true;
        FG.renderPanel(state); return;
      }
      if (t.dataset.act === "save-breed") {
        var roles = Object.keys(FG.ROLES);
        var role = roles[state.colony.breeds.length % roles.length];
        var sb = FG.saveBreed(state, null, role);
        if (!sb.ok) state.ui.toast = sb.why;
        FG.renderPanel(state); return;
      }
      if (t.dataset.act === "save") { FG.saveGame(state, "manual"); state.ui.toast = "Збережено"; return; }
      if (t.dataset.act === "export") { FG.exportSave(state); return; }
      if (t.dataset.act === "help") { state.ui.panel = "help"; FG.renderPanel(state); return; }
      if (t.dataset.act === "bestiary") { state.ui.panel = "bestiary"; FG.renderPanel(state); return; }
      if (t.dataset.act === "new") {
        if (confirm("Створити новий світ? Поточний прогрес у сховищі можна експортувати.")) {
          FG.newGame(state); state.ui.panel = null; state.paused = false;
        }
        return;
      }
      if (t.dataset.gene) {
        var gid = t.dataset.gene;
        state.ui.selectedGene = gid;
        // One-click install in nest for unlocked, not-yet-installed organs
        if (state.atNest && state.genes[gid] && state.player.body.organs.indexOf(gid) < 0) {
          var ir = FG.installOrgan(state, gid);
          if (!ir.ok) state.ui.toast = ir.why;
          else { state.tutorial.done.install = true; state.ui.toast = "Встановлено: " + FG.ORGANS[gid].name; }
        }
        state.ui.panelDirty = true;
        FG.renderPanel(state);
        return;
      }
      if (t.dataset.build) {
        state.ui.buildGhost = { type: t.dataset.build, x: state.player.x, y: state.player.y };
        state.ui.panel = null; state.paused = false;
        state.ui.toast = "Клік ЛКМ — поставити, Esc — скасувати";
        return;
      }
      if (t.dataset.incubate) {
        var inc = FG.enqueueIncubate(state, t.dataset.incubate);
        if (!inc.ok) state.ui.toast = inc.why;
        FG.renderPanel(state); return;
      }
      if (t.dataset.order) {
        state.allies.forEach(function (a) {
          if (t.dataset.order === "hold") a.order = { type: "hold", x: a.x, y: a.y };
          else if (t.dataset.order === "gather") a.order = { type: "gather", x: state.player.x, y: state.player.y, r: 260 };
          else a.order = { type: t.dataset.order };
        });
        state.ui.toast = "Наказ: " + t.dataset.order;
        return;
      }
      if (t.dataset.gen) {
        var g = FG.startNewGeneration(state, t.dataset.gen);
        if (!g.ok) state.ui.toast = g.why;
        return;
      }
      if (t.dataset.spec) {
        FG.chooseSpec(state, state.ui.specChoice, t.dataset.spec);
        state.ui.specChoice = null;
        FG.renderPanel(state);
      }
    };
    var mute = document.getElementById("chk-mute");
    if (mute) mute.onchange = function () { state.settings.muted = mute.checked; FG.applyAudioSettings(state); };
    var motion = document.getElementById("chk-motion");
    if (motion) motion.onchange = function () { state.settings.reducedMotion = motion.checked; };
    var q = document.getElementById("sel-quality");
    if (q) {
      q.value = state.settings.quality;
      q.onchange = function () {
        state.settings.quality = q.value;
        state.renderer.resize(state.settings.quality);
      };
    }
  };
})(window.FoxGenesis);
