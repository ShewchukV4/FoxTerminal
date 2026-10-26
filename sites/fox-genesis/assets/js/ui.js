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
      objectives: [],
      waypoint: null,
      panelDirty: true,
      healOpen: false,
      mapCam: { x: 0.5, y: 0.5, z: 1 }
    };
    var root = document.getElementById("ui-root");
    root.innerHTML = [
      '<div id="hud">',
      '  <div class="hud-left">',
      '    <div class="bar"><span>HP</span><div class="track"><i id="hp-bar"></i></div><b id="hp-txt"></b></div>',
      '    <button type="button" id="btn-heal" class="heal-link">Лікування ▾</button>',
      '    <div id="heal-list" class="heal-list hidden"></div>',
      '    <div class="bar energy"><span>EN</span><div class="track"><i id="en-bar"></i></div><b id="en-txt"></b></div>',
      '    <div class="cargo" id="cargo"></div>',
      '    <div class="res-hint" id="res-hint"></div>',
      '  </div>',
      '  <div class="hud-center"><div id="objective"></div><div id="objective-detail"></div><div id="event-line"></div></div>',
      '  <div class="hud-right">',
      '    <div id="res"></div>',
      '    <div id="save-status" class="tiny"></div>',
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
      '    <p id="continue-msg" class="tiny"></p>',
      '    <p class="tiny">WASD · ЛКМ · R лікування · F · M · C · Tab · Пробіл</p>',
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
      if (!r.ok) {
        document.getElementById("continue-msg").textContent = r.why + " — імпортуй сейв або почни нову гру.";
        state.ui.toast = r.why;
        return;
      }
      document.getElementById("overlay-title").classList.add("hidden");
      state.started = true;
      state.ui.toast = "Прогрес відновлено";
    };
    document.getElementById("btn-import").onclick = function () {
      document.getElementById("import-file").click();
    };
    document.getElementById("import-file").onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      FG.importSave(state, f, function (r) {
        if (!r.ok) {
          document.getElementById("continue-msg").textContent = r.why;
          state.ui.toast = r.why;
        } else {
          document.getElementById("overlay-title").classList.add("hidden");
          state.started = true;
          state.ui.toast = "Імпортовано";
        }
      });
    };
    document.getElementById("btn-heal").onclick = function () {
      state.ui.healOpen = !state.ui.healOpen;
      document.getElementById("heal-list").classList.toggle("hidden", !state.ui.healOpen);
    };
  };

  FG.renderHUD = function (state) {
    if (!state.started) return;
    var p = state.player;
    var hpLow = p.hp < p.hpMax * 0.35;
    document.getElementById("hp-bar").style.width = (100 * p.hp / p.hpMax) + "%";
    document.getElementById("hp-bar").parentElement.classList.toggle("low", hpLow);
    document.getElementById("en-bar").style.width = (100 * p.energy / p.energyMax) + "%";
    document.getElementById("hp-txt").textContent = Math.ceil(p.hp) + "/" + Math.ceil(p.hpMax);
    document.getElementById("en-txt").textContent = Math.ceil(p.energy);
    document.getElementById("cargo").textContent =
      "Вантаж " + (p.carrying.biomass + p.carrying.mineral + p.carrying.sample) + "/" + p.capacity +
      " (б" + Math.floor(p.carrying.biomass) + " м" + Math.floor(p.carrying.mineral) + ")";
    document.getElementById("res").innerHTML =
      "<div>Колонія біо <b>" + Math.floor(state.resources.biomass) + "</b></div>" +
      "<div>Мінерали <b>" + Math.floor(state.resources.mineral) + "</b></div>" +
      "<div>Зразки <b>" + Math.floor(state.resources.sample) + "</b></div>" +
      "<div>Покоління <b>" + state.generation + "</b></div>";
    document.getElementById("res-hint").textContent =
      "HP≠енергія≠їжа. Вантаж здавай у гнізді (F). Запас колонії — для органів.";
    var ss = document.getElementById("save-status");
    if (state.saveStatus === "ok") ss.textContent = "Сейв ok";
    else if (state.saveStatus === "error") ss.textContent = "Сейв помилка";
    else if (state.saveStatus === "unavailable") ss.textContent = "Сейв недоступний";
    else ss.textContent = "";

    FG.updateObjectives(state);
    var obj = state.ui.objectives[0];
    document.getElementById("objective").textContent = obj ? obj.title : "";
    document.getElementById("objective-detail").textContent = obj ? ((obj.detail || "") + (obj.prog ? " · " + obj.prog : "")) : "";
    var ev = state.world.activeEvents.map(function (e) { return e.name; }).join(" · ");
    document.getElementById("event-line").textContent = ev;

    // Heal list
    if (state.ui.healOpen) {
      var hl = FG.healStatus(state);
      document.getElementById("heal-list").innerHTML = hl.map(function (h) {
        return '<div class="heal-item' + (h.ok ? " ok" : "") + '"><b>' + h.name + "</b><span>" + h.detail +
          "</span><em>" + (h.ok ? "доступно" : (h.why || "")) + "</em></div>";
      }).join("") + (hpLow ? '<button type="button" class="btn ghost" id="btn-way-nest">Показати шлях до гнізда</button>' : "");
      var bn = document.getElementById("btn-way-nest");
      if (bn) bn.onclick = function () {
        state.ui.waypoint = { x: state.world.nest.x, y: state.world.nest.y, label: "Гніздо" };
        state.ui.toast = "Waypoint: серце гнізда";
      };
    }

    // Abilities from single binding registry
    FG.ensureAbilityBinds(p);
    var abs = document.getElementById("abilities");
    var keys = [
      { k: "ЛКМ", slot: "lmb", label: "Укус" },
      { k: "ПКМ", slot: "rmb", label: bindLabel(p, "rmb") },
      { k: "Q", slot: "q", label: bindLabel(p, "q") },
      { k: "E", slot: "e", label: bindLabel(p, "e") },
      { k: "R", slot: "field", label: "Лік. " + FG.FIELD_HEAL.hp }
    ];
    var abHtml = keys.map(function (a) {
      var cd = a.slot === "field" ? (p.fieldHealCd || 0) : (p.abilityCd[a.slot] || 0);
      return '<div class="abil' + (cd > 0 ? " cd" : "") + '"><em>' + a.k + "</em><span>" + a.label + "</span>" +
        (cd > 0 ? "<i>" + cd.toFixed(1) + "</i>" : "") + "</div>";
    }).join("");
    if (state.atNest) {
      var rest = (p.nestRestT || 0) >= FG.NEST_REST.delay ? "відпочинок…" : (p.nestRestBlocked || "відпочинок через " + Math.max(0, FG.NEST_REST.delay - (p.nestRestT || 0)).toFixed(1) + "с");
      abHtml += '<div class="abil nest-rest"><em>гніздо</em><span>' + rest + "</span></div>";
    }
    // throttle full abilities rebuild
    if (state.ui._abHtml !== abHtml) {
      abs.innerHTML = abHtml;
      state.ui._abHtml = abHtml;
    }

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
    if (state.ui.panel) {
      if (state.ui.panelDirty || state.ui._panelShown !== state.ui.panel) {
        FG.renderPanel(state);
        state.ui.panelDirty = false;
        state.ui._panelShown = state.ui.panel;
      } else if (state.ui.panel === "evolve") {
        FG.paintBodyPreview(state);
      }
    } else {
      state.ui._panelShown = null;
      document.getElementById("panel").classList.add("hidden");
    }
  };

  function bindLabel(p, slot) {
    var id = p.abilityBinds && p.abilityBinds[slot];
    if (!id || !FG.ORGANS[id]) return "—";
    return FG.ORGANS[id].name;
  }

  FG.drawMinimap = function (state) {
    var c = document.getElementById("minimap");
    if (!c) return;
    var ctx = c.getContext("2d");
    var s = 160 / FG.WORLD_W;
    ctx.fillStyle = "#0A101C";
    ctx.fillRect(0, 0, 160, 160);
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
    if (state.ui.waypoint) {
      ctx.strokeStyle = FG.COLORS.amber;
      ctx.beginPath();
      ctx.moveTo(state.player.x * s, state.player.y * s);
      ctx.lineTo(state.ui.waypoint.x * s, state.ui.waypoint.y * s);
      ctx.stroke();
    }
    ctx.fillStyle = FG.COLORS.amber;
    ctx.beginPath();
    ctx.arc(state.player.x * s, state.player.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };

  FG.togglePanel = function (state, name) {
    if (state.ui.panel === name) {
      state.ui.panel = null;
      FG.setPauseReason(state, "panel", false);
      state.ui.panelDirty = true;
      return;
    }
    state.ui.panel = name;
    state.ui.panelDirty = true;
    if (name) FG.setPauseReason(state, "panel", true);
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
    if (state.ui.panel === "evolve") {
      requestAnimationFrame(function () { FG.paintBodyPreview(state); });
    }
    if (state.ui.panel === "map") {
      requestAnimationFrame(function () { FG.paintMapCanvas(state); });
    }
  };

  FG.htmlEvolve = function (state) {
    var syn = FG.activeSynergies(state.player.body);
    var organs = Object.keys(FG.ORGANS);
    var sel = state.ui.selectedGene;
    var stats = FG.bodyStats(state.player.body);
    var html = '<div class="panel-head"><h2>Еволюція</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    if (FG.atNest(state)) html += '<p class="ok-line">У гнізді: обери орган → переглянь → «Встановити».</p>';
    else html += '<p class="warn">Поза гніздом — лише перегляд. <button type="button" class="btn ghost" data-act="way-nest">Шлях додому</button></p>';

    html += '<div class="path-row">Напрямок: ';
    Object.keys(FG.PATHS).forEach(function (pid) {
      html += '<button type="button" class="btn ghost' + (state.path === pid ? " on" : "") + '" data-path="' + pid + '">' + FG.PATHS[pid].name + "</button>";
    });
    html += "</div>";

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
        html += "<em>" + (FG.SLOT_NAMES[o.slot] || o.slot) + " · load " + o.load +
          " · біо " + (cost.biomass || 0) + "/" + Math.floor(state.resources.biomass) +
          (cost.mineral ? " · мін " + cost.mineral + "/" + Math.floor(state.resources.mineral) : "") +
          (FG.ABILITY_DEFS[id] ? " · активна" : " · пасив") + "</em>";
      }
      html += "</button>";
    }
    html += '</div></div><div class="col center"><h3>Тіло</h3>';
    html += '<canvas id="body-preview-canvas" width="280" height="220" class="body-preview-canvas"></canvas>';
    html += "<p>Форма: " + (FG.FORMS[state.player.body.form] || FG.FORMS.mobile).name +
      " · навантаження " + stats.load.toFixed(0) + " · HP " + Math.round(stats.hpMax) + " · броня " + Math.round(stats.armor) + "</p>";

    if (sel && FG.ORGANS[sel]) {
      var so = FG.ORGANS[sel];
      var can = FG.canInstall(state, sel);
      var installedSel = state.player.body.organs.indexOf(sel) >= 0;
      html += '<div class="sel-box"><p class="sel-line"><b>' + so.name + "</b> · " + (FG.SLOT_NAMES[so.slot] || so.slot) + "</p>";
      html += "<p>" + so.hint + "</p>";
      if (state.genes[sel] && state.genes[sel].source) html += '<p class="muted">Джерело: ' + state.genes[sel].source + "</p>";
      if (!installedSel) {
        html += '<p class="' + (can.ok ? "ok-line" : "warn") + '">' + (can.ok ? "Можна встановити" : can.why) + "</p>";
        html += '<button type="button" class="btn primary" data-act="install"' + (can.ok ? "" : " disabled") + ">Встановити</button>";
      } else {
        var lv = state.player.body.levels[sel] || 1;
        html += "<p>Встановлено · рівень " + lv + "</p>";
        html += '<button type="button" class="btn ghost" data-act="remove">Зняти (−40% вартості назад)</button>';
        html += '<button type="button" class="btn ghost" data-act="level">Рівень+</button>';
        if (FG.ABILITY_DEFS[sel]) {
          html += '<div class="bind-row">Призначити: ';
          ["rmb", "q", "e"].forEach(function (s) {
            html += '<button type="button" class="btn ghost" data-bind="' + s + '" data-bind-gene="' + sel + '">' + s.toUpperCase() +
              (state.player.abilityBinds[s] === sel ? " ✓" : "") + "</button>";
          });
          html += "</div>";
        }
      }
      // near synergies
      FG.SYNERGIES.forEach(function (sy) {
        if (sy.needs.indexOf(sel) < 0) return;
        var missing = sy.needs.filter(function (n) { return state.player.body.organs.indexOf(n) < 0 && n !== sel; });
        if (missing.length === 1) {
          html += '<p class="syn-hint">До синергії «' + sy.name + '» бракує: ' + (FG.ORGANS[missing[0]] || {}).name + "</p>";
        }
      });
      html += "</div>";
    } else {
      html += '<p class="muted">Обери орган зі списку — без миттєвої витрати.</p>';
    }

    html += '</div><div class="col"><h3>Синергії</h3>';
    if (!syn.length) html += '<p class="muted">Поки немає активних комбінацій.</p>';
    for (var s = 0; s < FG.SYNERGIES.length; s++) {
      var sy = FG.SYNERGIES[s];
      var on = syn.some(function (x) { return x.id === sy.id; });
      html += '<div class="syn' + (on ? " on" : "") + '"><b>' + sy.name + "</b><span>" + sy.desc + "</span></div>";
    }
    html += "</div></div>";
    if (state.ui.specChoice) {
      var opts = FG.specOptions(state.ui.specChoice);
      if (opts.length) {
        html += '<div class="spec-box"><h3>Спеціалізація: ' + FG.ORGANS[state.ui.specChoice].name + "</h3>";
        for (var j = 0; j < opts.length; j++) {
          html += '<button class="btn" data-spec="' + opts[j].id + '">' + opts[j].name + " — " + opts[j].desc + "</button>";
        }
        html += "</div>";
      } else {
        state.ui.specChoice = null;
      }
    }
    return html;
  };

  FG.paintBodyPreview = function (state) {
    var canvas = document.getElementById("body-preview-canvas");
    if (!canvas || !state.renderer) return;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0A1418";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var fake = {
      x: canvas.width / 2, y: canvas.height / 2 + 10,
      angle: -0.4, body: state.player.body, kind: "player",
      hp: state.player.hp, hpMax: state.player.hpMax,
      segmentPhase: (state.world.time || 0) * 2,
      color: FG.COLORS.mint
    };
    // highlight selected slot organ
    var sel = state.ui.selectedGene;
    ctx.save();
    state.renderer.drawCreature(ctx, fake, state, true);
    ctx.restore();
    if (sel && FG.ORGANS[sel]) {
      ctx.strokeStyle = FG.ORGANS[sel].color || FG.COLORS.amber;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fake.x, fake.y, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = FG.COLORS.text;
      ctx.font = "12px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(FG.ORGANS[sel].name, fake.x, 24);
    }
  };

  FG.htmlColony = function (state) {
    var html = '<div class="panel-head"><h2>Колонія</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<div class="colony-grid"><div><h3>Будівлі</h3><div class="list">';
    Object.keys(FG.BUILDINGS).forEach(function (id) {
      if (id === "heart") return;
      var b = FG.BUILDINGS[id];
      if (b.hidden) return;
      var has = FG.hasBuilding(state, id);
      html += '<button class="org" data-build="' + id + '"><b>' + b.name + (has ? " ✓" : "") + "</b><span>" + b.desc +
        "</span><em>біо " + (b.cost.biomass || 0) + " · мін " + (b.cost.mineral || 0) + "</em></button>";
    });
    html += '</div></div><div><h3>Породи / інкубація</h3>';
    html += '<div class="row"><input id="breed-name" placeholder="Ім’я породи" value="Порода ' + (state.colony.breeds.length + 1) + '"/>';
    html += '<select id="breed-role">';
    Object.keys(FG.ROLES).forEach(function (r) {
      html += '<option value="' + r + '">' + FG.ROLES[r].name + "</option>";
    });
    html += '</select><button class="btn primary" data-act="save-breed">Зберегти</button></div>';
    html += '<div class="list">';
    state.colony.breeds.forEach(function (br) {
      html += '<button class="org" data-incubate="' + br.id + '"><b>' + br.name + "</b><span>" + (FG.ROLES[br.role] || {}).name +
        " · виростити (18 біо / 3 мін)</span></button>";
    });
    if (!state.colony.breeds.length) html += '<p class="muted">Ще немає порід.</p>';
    html += "</div><h3>Черга</h3>";
    state.colony.queue.forEach(function (q) {
      html += "<p>" + Math.floor(q.t) + "/" + q.need + " с</p>";
    });
    html += '<h3>Накази</h3><div class="row wrap">';
    var orders = [
      { id: "follow", name: "За мною" },
      { id: "defend", name: "Обороняти" },
      { id: "attack", name: "Атакувати" },
      { id: "gather", name: "Збирати тут" },
      { id: "nest", name: "Повернутися" }
    ];
    orders.forEach(function (o) {
      html += '<button class="btn ghost" data-order="' + o.id + '">' + o.name + "</button>";
    });
    html += '</div><h3>Нове покоління</h3><p class="muted">Ціна: ' + FG.GENERATION_COST.biomass + " біо / " +
      FG.GENERATION_COST.mineral + " мін / " + FG.GENERATION_COST.sample + " зраз · не аптечка</p>";
    html += '<div class="row wrap">';
    Object.keys(FG.FORMS).forEach(function (f) {
      html += '<button class="btn" data-gen="' + f + '">' + FG.FORMS[f].name + "</button>";
    });
    html += '<select id="heritage"><option value="">Спадок…</option>';
    html += '<option value="tough">Міцність (+HP/броня)</option>';
    html += '<option value="swift">Швидкість</option>';
    html += '<option value="vital">Життєвість (хіл/енергія)</option></select>';
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
      FG.HELP_TEXT.map(function (t) { return "<li>" + t + "</li>"; }).join("") +
      "</ul><h3>Ресурси</h3><ul class=\"help\"><li>HP — здоров’я тіла</li><li>Енергія — здібності</li><li>Вантаж — те, що несеш (здай у гнізді)</li><li>Запас колонії — будівлі й органи</li></ul>";
  };

  FG.htmlMap = function (state) {
    return '<div class="panel-head"><h2>Карта</h2><button class="btn ghost" data-act="close">Закрити</button></div>' +
      '<canvas id="map-canvas" width="640" height="420" class="map-canvas"></canvas>' +
      '<p class="muted">Перетягуй · колесо — зум. Легенда: м’ята — гніздо, бурштин — ти, лілія — локації. Невідоме темне.</p>' +
      '<div class="row"><button class="btn ghost" data-act="way-nest">Waypoint: гніздо</button>' +
      '<button class="btn ghost" data-act="clear-way">Скинути waypoint</button></div>';
  };

  FG.paintMapCanvas = function (state) {
    var canvas = document.getElementById("map-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var cam = state.ui.mapCam;
    var scale = (420 / FG.WORLD_W) * cam.z;
    var ox = canvas.width / 2 - FG.WORLD_W * cam.x * scale;
    var oy = canvas.height / 2 - FG.WORLD_H * cam.y * scale;
    ctx.fillStyle = "#050A10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var tile = state.world.fogTile;
    for (var key in state.world.explored) {
      var p = key.split(",");
      var ix = +p[0], iy = +p[1];
      var bio = FG.biomeAtWorld(state.world, ix * tile, iy * tile);
      ctx.fillStyle = FG.BIOMES[bio].color;
      ctx.fillRect(ox + ix * tile * scale, oy + iy * tile * scale, tile * scale + 0.5, tile * scale + 0.5);
    }
    function dot(x, y, color, r) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ox + x * scale, oy + y * scale, r, 0, Math.PI * 2);
      ctx.fill();
    }
    dot(state.world.nest.x, state.world.nest.y, FG.COLORS.mint, 5);
    (state.world.locations || []).forEach(function (l) {
      if (!FG.isExplored(state.world, l.x, l.y) && !l.done) return;
      dot(l.x, l.y, l.done ? "#668" : FG.COLORS.lilac, 4);
    });
    state.allies.forEach(function (a) {
      if (FG.isAlive(a)) dot(a.x, a.y, FG.COLORS.ally, 3);
    });
    dot(state.player.x, state.player.y, FG.COLORS.amber, 4);
    if (state.ui.waypoint) {
      ctx.strokeStyle = FG.COLORS.amber;
      ctx.beginPath();
      ctx.moveTo(ox + state.player.x * scale, oy + state.player.y * scale);
      ctx.lineTo(ox + state.ui.waypoint.x * scale, oy + state.ui.waypoint.y * scale);
      ctx.stroke();
    }
    // drag/zoom once
    if (!canvas._bound) {
      canvas._bound = true;
      var drag = null;
      canvas.addEventListener("mousedown", function (ev) {
        drag = { x: ev.offsetX, y: ev.offsetY, cx: cam.x, cy: cam.y };
      });
      window.addEventListener("mouseup", function () { drag = null; });
      canvas.addEventListener("mousemove", function (ev) {
        if (!drag) return;
        cam.x = FG.clamp(drag.cx - (ev.offsetX - drag.x) / (FG.WORLD_W * scale), 0.1, 0.9);
        cam.y = FG.clamp(drag.cy - (ev.offsetY - drag.y) / (FG.WORLD_H * scale), 0.1, 0.9);
        FG.paintMapCanvas(state);
      });
      canvas.addEventListener("wheel", function (ev) {
        ev.preventDefault();
        cam.z = FG.clamp(cam.z * (ev.deltaY > 0 ? 0.9 : 1.1), 0.6, 3);
        FG.paintMapCanvas(state);
      }, { passive: false });
    }
  };

  FG.htmlBestiary = function (state) {
    var html = '<div class="panel-head"><h2>Журнал</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<h3>Спостереження</h3><ul>";
    state.world.journal.forEach(function (j) {
      html += "<li>" + j.text + "</li>";
    });
    html += "</ul><h3>Відкриті гени</h3><ul>";
    Object.keys(state.genes).forEach(function (g) {
      html += "<li>" + FG.ORGANS[g].name + (state.genes[g].source ? " <em>(" + state.genes[g].source + ")</em>" : "") + "</li>";
    });
    html += "</ul>";
    return html;
  };

  FG.bindPanelHandlers = function (state) {
    var el = document.getElementById("panel");
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-act],[data-gene],[data-build],[data-incubate],[data-order],[data-gen],[data-spec],[data-path],[data-bind]");
      if (!t) return;
      if (t.dataset.act === "close" || t.dataset.act === "resume") {
        state.ui.panel = null;
        FG.setPauseReason(state, "panel", false);
        return;
      }
      if (t.dataset.act === "way-nest") {
        state.ui.waypoint = { x: state.world.nest.x, y: state.world.nest.y, label: "Гніздо" };
        state.ui.toast = "Waypoint: гніздо";
        return;
      }
      if (t.dataset.act === "clear-way") { state.ui.waypoint = null; return; }
      if (t.dataset.act === "install") {
        if (!state.ui.selectedGene) { state.ui.toast = "Спочатку обери орган"; return; }
        var r = FG.installOrgan(state, state.ui.selectedGene);
        if (!r.ok) state.ui.toast = r.why;
        else { state.tutorial.done.install = true; }
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
        var nameEl = document.getElementById("breed-name");
        var roleEl = document.getElementById("breed-role");
        var sb = FG.saveBreed(state, nameEl ? nameEl.value : null, roleEl ? roleEl.value : "hunter");
        if (!sb.ok) state.ui.toast = sb.why;
        else state.ui.toast = "Породу збережено";
        state.ui.panelDirty = true;
        FG.renderPanel(state); return;
      }
      if (t.dataset.act === "save") {
        var sr = FG.saveGame(state, "manual");
        state.ui.toast = sr.ok ? "Збережено" : (sr.why || "Помилка збереження");
        return;
      }
      if (t.dataset.act === "export") { FG.exportSave(state); return; }
      if (t.dataset.act === "help") { state.ui.panel = "help"; state.ui.panelDirty = true; FG.renderPanel(state); return; }
      if (t.dataset.act === "bestiary") { state.ui.panel = "bestiary"; state.ui.panelDirty = true; FG.renderPanel(state); return; }
      if (t.dataset.act === "new") {
        if (confirm("Створити новий світ? Експортуй прогрес заздалегідь.")) {
          FG.newGame(state); state.ui.panel = null; FG.setPauseReason(state, "panel", false);
        }
        return;
      }
      if (t.dataset.gene) {
        state.ui.selectedGene = t.dataset.gene;
        state.ui.panelDirty = true;
        FG.renderPanel(state);
        return;
      }
      if (t.dataset.bind) {
        FG.bindAbilitySlot(state.player, t.dataset.bind, t.dataset.bindGene);
        state.ui.toast = "Призначено на " + t.dataset.bind.toUpperCase();
        state.ui.panelDirty = true;
        FG.renderPanel(state);
        return;
      }
      if (t.dataset.path) {
        FG.choosePath(state, t.dataset.path);
        state.ui.panelDirty = true;
        FG.renderPanel(state);
        return;
      }
      if (t.dataset.build) {
        state.ui.buildGhost = { type: t.dataset.build, x: state.player.x, y: state.player.y };
        state.ui.panel = null; FG.setPauseReason(state, "panel", false);
        state.ui.toast = "Клік ЛКМ — поставити, Esc — скасувати";
        return;
      }
      if (t.dataset.incubate) {
        var inc = FG.enqueueIncubate(state, t.dataset.incubate);
        if (!inc.ok) state.ui.toast = inc.why;
        state.ui.panelDirty = true;
        FG.renderPanel(state); return;
      }
      if (t.dataset.order) {
        var nearest = FG.nearestEnemy(state, state.player.x, state.player.y, 260);
        state.allies.forEach(function (a) {
          if (t.dataset.order === "defend") a.order = { type: "defend", x: state.world.nest.x, y: state.world.nest.y };
          else if (t.dataset.order === "attack") a.order = { type: "attack", targetId: nearest && nearest.id };
          else if (t.dataset.order === "gather") a.order = { type: "gather", x: state.player.x, y: state.player.y, r: 260, area: true };
          else if (t.dataset.order === "nest") a.order = { type: "nest" };
          else a.order = { type: "follow" };
        });
        state.ui.toast = "Наказ віддано";
        return;
      }
      if (t.dataset.gen) {
        var herit = document.getElementById("heritage");
        var trait = herit ? herit.value : "";
        var g0 = FG.startNewGeneration(state, t.dataset.gen, trait || null, { confirmed: false });
        if (g0.needConfirm) {
          var msg = "Нове покоління?\nЦіна: " + FG.GENERATION_COST.biomass + " біо / " +
            FG.GENERATION_COST.mineral + " мін / " + FG.GENERATION_COST.sample + " зраз.\n" +
            "Органи поточного тіла буде скинуто (гени колонії лишаються).";
          if (!confirm(msg)) return;
          var g = FG.startNewGeneration(state, t.dataset.gen, trait || null, { confirmed: true });
          if (!g.ok) state.ui.toast = g.why;
        } else if (!g0.ok) state.ui.toast = g0.why;
        return;
      }
      if (t.dataset.spec) {
        FG.chooseSpec(state, state.ui.specChoice, t.dataset.spec);
        state.ui.specChoice = null;
        state.ui.panelDirty = true;
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
