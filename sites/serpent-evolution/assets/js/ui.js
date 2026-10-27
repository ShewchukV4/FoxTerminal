/* FOX SERPENT — DOM UI */
(function (FS) {
  "use strict";

  FS.bindUI = function (state) {
    var root = document.getElementById("ui-root");
    root.innerHTML = [
      '<div id="hud">',
      '  <div class="hud-left">',
      '    <div id="len">Довжина <b>3</b>/12</div>',
      '    <div id="nutrition">Пожива <b>0</b>/9</div>',
      '    <div id="pantry">База <b>0</b>/12</div>',
      '    <div id="wood">Деревина <b>0</b>/12</div>',
      '    <div id="xp">Досвід <b>0</b></div>',
      '    <div id="points">Очки талантів <b>0</b></div>',
      '    <div id="food-hud"></div>',
      '    <div id="hearts" title="Кожне рятує один раз. Не відновлюється"></div>',
      '    <div id="move-ind" class="move-ind">СТОЮ</div>',
      '    <div id="skills"></div>',
      '  </div>',
      '  <div class="hud-center"><div id="objective"></div><div id="objective-d"></div></div>',
      '  <div class="hud-right"><div id="save-st"></div></div>',
      '</div>',
      '<div id="toast"></div>',
      '<div id="pause-banner" class="hidden">ПАУЗА</div>',
      '<div id="panel" class="panel hidden"></div>',
      '<div id="overlay" class="overlay">',
      '  <div class="card">',
      '    <div class="kicker">FOX SERPENT</div>',
      '    <h1>EVOLUTION</h1>',
      '    <p class="lead"><b>Пожива 0–9 = довжина 3–12. Відпусти клавішу — зупинишся.</b></p>',
      '    <p>Клітинкова змійка: їжа відновлюється, дерево талантів, серця й території.</p>',
      '    <label class="seed-row">Seed <input id="seed-input" class="selectable" type="text" spellcheck="false" placeholder="випадковий"/></label>',
      '    <div class="row">',
      '      <button id="btn-seed-rand" class="btn ghost" type="button">Новий seed</button>',
      '      <button id="btn-seed-copy" class="btn ghost" type="button">Копіювати</button>',
      '    </div>',
      '    <div class="row">',
      '      <button id="btn-new" class="btn primary">Нова гра</button>',
      '      <button id="btn-continue" class="btn">Продовжити</button>',
      '      <button id="btn-import" class="btn ghost">Імпорт</button>',
      '      <input id="import-file" type="file" accept="application/json,.json" hidden />',
      '    </div>',
      '    <p id="cont-msg" class="tiny"></p>',
      '    <p class="tiny">WASD · T дерево · B будівництво курсором · Tab карта · H гайд · Пробіл пауза</p>',
      '  </div>',
      '</div>'
    ].join("");

    document.getElementById("btn-seed-rand").onclick = function () {
      document.getElementById("seed-input").value = String(((Date.now() ^ (Math.random() * 1e9)) >>> 0));
    };
    document.getElementById("btn-seed-copy").onclick = function () {
      var v = document.getElementById("seed-input").value || String(state.world && state.world.seed || "");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v);
      else {
        document.getElementById("seed-input").select();
        try { document.execCommand("copy"); } catch (e) {}
      }
    };
    document.getElementById("btn-new").onclick = function () {
      FS.unlockAudio(state);
      var raw = document.getElementById("seed-input").value;
      FS.newGame(state, raw === "" ? null : raw);
      document.getElementById("seed-input").value = String(state.world.seed);
      document.getElementById("overlay").classList.add("hidden");
    };
    document.getElementById("btn-continue").onclick = function () {
      FS.unlockAudio(state);
      var r = FS.loadGame(state);
      if (!r.ok) {
        document.getElementById("cont-msg").textContent = r.why + " — імпортуй або нова гра.";
        return;
      }
      state.started = true;
      document.getElementById("overlay").classList.add("hidden");
    };
    document.getElementById("btn-import").onclick = function () {
      document.getElementById("import-file").click();
    };
    document.getElementById("import-file").onchange = function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      FS.importSave(state, f, function (r) {
        if (!r.ok) document.getElementById("cont-msg").textContent = r.why;
        else {
          state.started = true;
          document.getElementById("overlay").classList.add("hidden");
        }
      });
    };
  };

  FS.togglePanel = function (state, name) {
    if (state.ui.panel === name) {
      state.ui.panel = null;
      FS.setPauseReason(state, "panel", false);
      state.ui.panelDirty = true;
      return;
    }
    state.ui.panel = name;
    state.ui.panelDirty = true;
    FS.setPauseReason(state, "panel", true);
  };

  FS.renderHUD = function (state) {
    if (!state.started) return;
    var nut = FS.nutritionOf(state);
    var target = FS.targetLength(nut);
    var pending = FS.pendingGrowth(state.player);
    document.getElementById("len").innerHTML = "Довжина <b>" + state.player.body.length + "</b>/12" +
      (pending ? " <span class='muted'>(+ " + pending + " росте)</span>" : "") +
      (state.effects.growthHud ? " · ціль " + target : "");
    var nutLabel = nut >= FS.MAX_NUTRITION ? "На змійці повна · їжа → XP" : ("На змійці <b>" + nut + "</b>/9");
    document.getElementById("nutrition").innerHTML = nutLabel;
    if (FS.ensurePantry) FS.ensurePantry(state);
    var panEl = document.getElementById("pantry");
    if (panEl && state.pantry) {
      panEl.innerHTML = "На базі <b>" + state.pantry.food + "</b>/" + state.pantry.cap;
    }
    if (FS.ensureWood) FS.ensureWood(state);
    var woodEl = document.getElementById("wood");
    if (woodEl) {
      woodEl.innerHTML = "Деревина <b>" + (state.wood || 0) + "</b>/" + (state.woodCap || 12) +
        (state.buildMode && state.buildMode.on ? " · <span class='ok'>БУДІВНИЦТВО</span>" : "");
    }
    document.getElementById("xp").innerHTML = "Досвід <b>" + state.xp + "/" + FS.xpToNext(state.talentLevel) + "</b>";
    document.getElementById("points").innerHTML = "Очки талантів <b>" + state.talents.points + "</b>";
    var fi = FS.foodHudInfo(state);
    var foodEl = document.getElementById("food-hud");
    if (fi) {
      foodEl.textContent = "Грядки: " + fi.ripe + "/" + fi.capacity + " стиглих" +
        (fi.next != null ? " · наступний ~" + Math.ceil(fi.next) + " с" : "");
    } else foodEl.textContent = "";
    var hearts = "";
    for (var i = 0; i < state.talents.hearts; i++) hearts += "♥";
    if (!hearts) hearts = "♡ немає";
    document.getElementById("hearts").textContent = "Серця: " + hearts + " (витрачено " + state.talents.heartsSpent + ")";
    var standLabel = (state.buildMode && state.buildMode.on) ? "СТОЮ · БУД" : (state.player.standing ? "СТОЮ" : "РУХАЮСЬ");
    document.getElementById("move-ind").textContent = standLabel;
    document.getElementById("move-ind").className = "move-ind" + (state.player.standing || (state.buildMode && state.buildMode.on) ? " stand" : " move");

    var sk = state.effects.skills || {};
    var skHtml = "";
    if (sk.phaseSelf) skHtml += "F маневр " + (sk.phaseSelf.t > 0 ? sk.phaseSelf.t.toFixed(0) + "с" : "OK") + " · ";
    if (sk.shed) skHtml += "G линяння " + (sk.shed.t > 0 ? sk.shed.t.toFixed(0) + "с" : "OK") + " · ";
    if (sk.selfSlow) skHtml += "V гальмо " + (sk.selfSlow.t > 0 ? sk.selfSlow.t.toFixed(0) + "с" : "OK") + " · ";
    if (sk.coldBlood) skHtml += "C холод " + (sk.coldBlood.t > 0 ? sk.coldBlood.t.toFixed(0) + "с" : "OK");
    document.getElementById("skills").textContent = skHtml;

    FS.updateObjectives(state);
    var o = state.ui.objectives[0];
    document.getElementById("objective").textContent = o ? o.title : "";
    document.getElementById("objective-d").textContent = o ? o.detail : "";

    document.getElementById("pause-banner").classList.toggle("hidden", !state.paused || !!state.ui.panel);
    document.getElementById("save-st").textContent = state.saveStatus === "ok" ? "сейв ok" : (state.saveStatus || "");

    if (state.ui.toast) {
      state.ui.toastT = 2.4;
      var el = document.getElementById("toast");
      el.textContent = state.ui.toast;
      el.classList.add("show");
      state.ui.toast = "";
    }
    if (state.ui.toastT > 0) {
      state.ui.toastT -= 1 / 60;
      if (state.ui.toastT <= 0) document.getElementById("toast").classList.remove("show");
    }

    if (state.ui.panel) {
      if (state.ui.panelDirty || state.ui._shown !== state.ui.panel) {
        FS.renderPanel(state);
        state.ui.panelDirty = false;
        state.ui._shown = state.ui.panel;
      }
    } else {
      state.ui._shown = null;
      document.getElementById("panel").classList.add("hidden");
    }
  };

  FS.renderPanel = function (state) {
    var el = document.getElementById("panel");
    el.classList.remove("hidden");
    if (state.ui.panel === "talents") el.innerHTML = FS.htmlTalents(state);
    else if (state.ui.panel === "map") el.innerHTML = FS.htmlMap(state);
    else if (state.ui.panel === "menu") el.innerHTML = FS.htmlMenu(state);
    else if (state.ui.panel === "help") el.innerHTML = FS.htmlHelp();
    else if (state.ui.panel === "death") el.innerHTML = FS.htmlDeath(state);
    else if (state.ui.panel === "expand") el.innerHTML = FS.htmlExpand(state);
    else if (state.ui.panel === "build") el.innerHTML = FS.htmlBuild(state);
    else if (state.ui.panel === "pantry") el.innerHTML = FS.htmlPantry(state);
    else el.innerHTML = "";
    FS.bindPanel(state);
  };

  FS.htmlTalents = function (state) {
    var nut = FS.nutritionOf(state);
    var bounds = FS.talentTreeBounds();
    var N = FS.TALENT_NODE;
    var html = '<div class="panel-head talent-head"><div><h2>Сад розвитку</h2>';
    html += '<p class="muted">Очки <b>' + state.talents.points + '</b> · Пожива <b>' + nut + '</b>/9 · Довжина <b>' +
      state.player.body.length + '</b>/12 · Серця ' + state.talents.hearts + "</p></div>";
    html += '<button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<div class="talent-studio">';
    html += '<div class="talent-canvas-wrap" id="talent-pan"><div class="talent-tree" id="talent-tree" style="width:' +
      bounds.w + "px;height:" + bounds.h + 'px">';
    html += '<svg class="talent-links" width="' + bounds.w + '" height="' + bounds.h +
      '" viewBox="0 0 ' + bounds.w + " " + bounds.h + '">';
    FS.TALENT_LAYOUT.forEach(function (lay) {
      var node = FS.TALENTS[lay.id];
      if (!node || !node.prereq) return;
      var p = FS.talentPixel(lay);
      node.prereq.forEach(function (pid) {
        var pl = FS.TALENT_LAYOUT.find(function (L) { return L.id === pid; });
        if (!pl) return;
        var pp = FS.talentPixel(pl);
        var unlocked = !!state.talents.unlocked[lay.id];
        // line ends at node edges (vertical branches)
        var x1 = pp.cx, y1 = pp.y + pp.h, x2 = p.cx, y2 = p.y;
        html += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
          '" class="tlink' + (unlocked ? " on" : "") + '"/>';
      });
    });
    html += "</svg>";
    // branch headers
    ["Керування", "Дім", "Огляд", "Тактика"].forEach(function (label, i) {
      html += '<div class="tbranch" style="left:' + (N.pad + i * (N.w + N.gapX)) +
        'px;top:4px;width:' + N.w + 'px">' + label + "</div>";
    });
    FS.TALENT_LAYOUT.forEach(function (lay) {
      var node = FS.TALENTS[lay.id];
      if (!node) return;
      var p = FS.talentPixel(lay);
      var unlocked = !!state.talents.unlocked[lay.id];
      var can = FS.canUnlock(state, lay.id);
      var lockedAlt = node.fork && state.talents.forkPicks[lay.id];
      var cls = "tnode" + (unlocked ? " on" : "") + (node.fork ? " fork" : "") +
        (can.ok ? " can" : "") + (lockedAlt ? " picked" : "");
      var icon = node.fork ? "⟐" : (node.branch === "control" ? "◎" : node.branch === "explore" ? "❀" :
        node.branch === "house" ? "⌂" : "◆");
      html += '<button type="button" class="' + cls + '" style="left:' + p.x + "px;top:" + p.y +
        "px;width:" + N.w + "px;height:" + N.h + 'px" data-talent="' + lay.id + '" title="' + node.name + '">';
      html += '<span class="ticon">' + icon + "</span>";
      html += "<b>" + node.name + "</b>";
      if (node.fork && state.talents.forkPicks[lay.id]) html += "<em>" + state.talents.forkPicks[lay.id] + "</em>";
      html += "</button>";
    });
    html += '</div></div>';
    html += '<aside class="talent-detail" id="talent-detail"><p class="muted">Обери вузол. Click вибирає · кнопка підтверджує.</p>';
    html += '<button class="btn" data-act="talent-focus">До доступних</button></aside></div>';
    html += '<div class="talent-legend"><span class="leg can">доступно</span><span class="leg on">відкрито</span><span class="leg">заблоковано</span><span class="leg fork">розвилка A/B</span></div>';
    return html;
  };

  FS.htmlMap = function (state) {
    var html = '<div class="panel-head"><h2>Карта / території</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<ul>";
    Object.keys(state.world.chunks).forEach(function (id) {
      var c = state.world.chunks[id];
      html += "<li><b>" + c.name + "</b> (" + c.cx + "," + c.cy + ") · небезпека " + c.danger + "</li>";
    });
    html += "</ul>";
    html += '<button class="btn primary" data-act="expand">Відкрити територію…</button>';
    html += '<button class="btn ghost" data-act="cam-me">До своєї змії</button>';
    return html;
  };

  FS.htmlExpand = function (state) {
    var nut = FS.nutritionOf(state);
    var confirmId = state.ui.expandConfirm;
    var err = state.ui.expandError || "";
    var html = '<div class="panel-head"><h2>Відкрити територію</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p>Пожива: <b>' + nut + '</b>/9 · джерело: пожива (скорочує хвіст). Seed ' + state.world.seed + "</p>";
    if (err) html += '<p class="expand-err" role="alert">' + err + "</p>";
    state.world.openOffers.forEach(function (o) {
      var q = FS.getExpansionQuote(state, o.id);
      html += '<div class="offer' + (confirmId === o.id ? " confirm" : "") + '"><b>' + o.name +
        "</b> <span class='tiny'>id " + o.id + "</span><p>" + o.desc + "</p>";
      if (!q.ok && q.cost == null) {
        html += "<em class='expand-err'>" + q.why + "</em>";
      } else {
        html += "<em>Вартість " + q.cost + " поживи · є " + q.now + "/9 · довжина " +
          q.lenNow + " → " + q.lenAfter + (q.spawnsEnemy ? " · з’явиться змія" : "") + "</em>";
        if (!q.ok) html += "<p class='expand-err'>" + q.why + " · " + (q.source || "") + "</p>";
        if (confirmId === o.id && q.ok) {
          html += "<p class='tiny'>Підтверди покупку. Пауза меню не блокує оплату.</p>";
          html += '<button class="btn primary" data-offer-yes="' + o.id + '">Так, відкрити за ' + q.cost + "</button> ";
          html += '<button class="btn ghost" data-offer-no="1">Скасувати</button>';
        } else {
          html += '<button class="btn' + (q.ok ? " primary" : "") + '" data-offer="' + o.id + '"' +
            (q.ok ? "" : " disabled") + ">" + (q.ok ? ("Відкрити за " + q.cost) : "Недостатньо поживи") + "</button>";
        }
      }
      html += "</div>";
    });
    if (!state.world.openOffers.length) html += '<p class="muted">Немає сусідніх ділянок.</p>';
    return html;
  };

  FS.htmlBuild = function (state) {
    FS.ensureFarms(state);
    FS.ensureAllies(state);
    FS.ensureWood(state);
    var html = '<div class="panel-head"><h2>База / союзники</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<p>Споруди став у <b>B-режимі курсором</b> (паркан, ворота, грядка…). Тут — найм і команди.</p>";
    html += '<button class="btn primary" data-act="build-mode">Відкрити B-режим</button>';
    html += "<p>Деревина <b>" + state.wood + "</b>/" + state.woodCap + " · Пожива <b>" + FS.nutritionOf(state) + "</b>/9</p>";
    state.homes.forEach(function (home) {
      html += '<div class="offer"><b>Дім @' + home.x + "," + home.y + "</b> · мешканці " +
        home.residents.length + "/" + home.capacity;
      Object.keys(FS.ALLY_ROLES).forEach(function (role) {
        var r = FS.ALLY_ROLES[role];
        html += '<button class="btn" data-hire="' + home.id + ":" + role + '">Найм: ' + r.name +
          " (" + r.cost + ")</button> ";
      });
      html += "</div>";
    });
    if (!state.homes.length) html += '<p class="muted">Збудуй домівку в B-режимі (5 деревини).</p>';
    if (state.allies.length) {
      html += "<h3>Команди</h3>";
      html += '<button class="btn" data-ally-all="home">Усім додому</button>';
      state.allies.forEach(function (a) {
        html += "<p>" + a.name + " [" + a.role + "] " + (a.inside ? "вдома" : a.stateAI) + " ";
        ["work", "home", "follow", "wait"].forEach(function (c) {
          html += '<button class="btn ghost" data-ally-cmd="' + a.id + ":" + c + '">' + c + "</button> ";
        });
        html += "</p>";
      });
    }
    if (state.farms.list.length) {
      html += "<h3>Твої ферми</h3><ul>";
      state.farms.list.forEach(function (f) {
        var openings = FS.farmRaidOpenings ? FS.farmRaidOpenings(state, f) : [];
        var left = f.stage === "ready" ? "урожай " + f.store.length + "/" + f.storeMax :
          (f.stage + " · " + Math.max(0, Math.ceil((f.cycle || 14) - (f.t || 0))) + "с");
        html += "<li>" + f.type + " @" + f.x + "," + f.y + " — " + left +
          (openings.length ? " · дірок для рейду: " + openings.length : " · огороджено?") + "</li>";
      });
      html += "</ul>";
    }
    return html;
  };

  FS.htmlHelp = function () {
    var legend = (FS.OBJECT_LEGEND || []).map(function (o) {
      return "<li><b>" + o.name + "</b> (" + o.look + ") — " + o.action + "</li>";
    }).join("");
    return '<div class="panel-head"><h2>Правила</h2><button class="btn ghost" data-act="close">Закрити</button></div>' +
      '<button class="btn primary" data-act="guide">Показати гайд</button>' +
      '<ul class="help">' +
      FS.HELP.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" +
      "<h3>Легенда об’єктів</h3><ul class='help'>" + legend + "</ul>";
  };

  FS.htmlMenu = function (state) {
    return [
      '<div class="panel-head"><h2>Меню</h2><button class="btn ghost" data-act="close">Назад</button></div>',
      '<div class="stack">',
      '<button class="btn primary" data-act="close">Продовжити</button>',
      '<button class="btn" data-act="save">Зберегти</button>',
      '<button class="btn" data-act="export">Експорт</button>',
      '<button class="btn" data-act="talents">Дерево (T)</button>',
      '<button class="btn" data-act="map">Карта</button>',
      '<button class="btn" data-act="build-mode">Будівництво (B)</button>',
      '<button class="btn" data-act="build">База / союзники</button>',
      '<button class="btn" data-act="help">Правила</button>',
      '<button class="btn" data-act="guide">Як грати (гайд)</button>',
      '<p class="tiny selectable copyable">Seed: ' + (state.world && state.world.seed) + "</p>",
      '<label class="check"><input type="checkbox" id="chk-mute"' + (state.settings.muted ? " checked" : "") + '/> Без звуку</label>',
      '<label class="check"><input type="checkbox" id="chk-motion"' + (state.settings.reducedMotion ? " checked" : "") + '/> Зменшений рух</label>',
      '<button class="btn danger" data-act="new">Новий світ…</button>',
      "</div>"
    ].join("");
  };

  FS.htmlDeath = function (state) {
    var d = state.lastDeath || {};
    return '<div class="panel-head"><h2>Смерть</h2></div>' +
      "<p><b>" + (d.reason || "") + "</b></p>" +
      "<p>Пожива скинута (було " + (d.nutritionLost || 0) + "). Довжина знову 3.</p>" +
      "<p>Таланти, витрачені серця й відкриті території збережено.</p>" +
      '<button class="btn primary" data-act="respawn">Повернутися до гнізда</button>';
  };

  FS.applyTalentTransform = function (state) {
    var tree = document.getElementById("talent-tree");
    if (!tree) return;
    var v = state.ui.talentView || { x: 24, y: 12, z: 1 };
    tree.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.z + ")";
  };

  FS.focusTalentNode = function (state, lay) {
    if (!lay) return;
    var wrap = document.getElementById("talent-pan");
    var p = FS.talentPixel(lay);
    if (!wrap) return;
    var z = 1.05;
    var cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2;
    state.ui.talentView = {
      x: cx - (p.x + p.w / 2) * z,
      y: cy - (p.y + p.h / 2) * z,
      z: z
    };
    FS.applyTalentTransform(state);
    FS.showTalentDetail(state, lay.id);
  };

  FS.bindPanel = function (state) {
    var el = document.getElementById("panel");
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-act],[data-talent],[data-offer],[data-offer-yes],[data-offer-no],[data-fork],[data-hire],[data-ally-cmd],[data-ally-all],[data-pantry]");
      if (!t) return;
      if (t.dataset.act === "close") {
        state.ui.panel = null;
        state.ui.expandConfirm = null;
        state.ui.expandError = "";
        FS.setPauseReason(state, "panel", false);
        return;
      }
      if (t.dataset.act === "save") {
        var r = FS.saveGame(state, "manual");
        state.ui.toast = r.ok ? "Збережено" : r.why;
        return;
      }
      if (t.dataset.act === "export") { FS.exportSave(state); return; }
      if (t.dataset.act === "talents") { state.ui.panel = "talents"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
      if (t.dataset.act === "map") { state.ui.panel = "map"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
      if (t.dataset.act === "help") { state.ui.panel = "help"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
      if (t.dataset.act === "guide") {
        state.ui.panel = null;
        FS.setPauseReason(state, "panel", false);
        FS.openGuide(state, { firstRun: false });
        return;
      }
      if (t.dataset.act === "expand") {
        state.ui.expandConfirm = null;
        state.ui.expandError = "";
        state.ui.panel = "expand";
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
      if (t.dataset.act === "build") { state.ui.panel = "build"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
      if (t.dataset.act === "build-mode") {
        state.ui.panel = null;
        FS.setPauseReason(state, "panel", false);
        FS.enterBuildMode(state);
        return;
      }
      if (t.dataset.act === "cam-me") {
        var h = FS.snakeHead(state.player);
        state.renderer.cam.x = (h.x + 0.5) * FS.CELL;
        state.renderer.cam.y = (h.y + 0.5) * FS.CELL;
        return;
      }
      if (t.dataset.act === "respawn") { FS.respawnPlayer(state); return; }
      if (t.dataset.act === "new") {
        if (confirm("Новий світ? Експортуй прогрес заздалегідь.")) {
          FS.newGame(state); state.ui.panel = null; FS.setPauseReason(state, "panel", false);
        }
        return;
      }
      if (t.dataset.talent) {
        FS.showTalentDetail(state, t.dataset.talent);
        return;
      }
      if (t.dataset.fork) {
        var parts = t.dataset.fork.split(":");
        if (!confirm("Підтвердити вибір " + parts[1] + "? Альтернативу цієї розвилки більше не взяти. Серце не повертається.")) return;
        var ur = FS.unlockTalent(state, parts[0], parts[1]);
        if (!ur.ok) state.ui.toast = ur.why;
        else {
          state.tutorial.done.talentPick = true;
          state.ui.panelDirty = true;
          FS.renderPanel(state);
        }
        return;
      }
      if (t.dataset.act === "talent-focus") {
        var first = FS.TALENT_LAYOUT.find(function (L) {
          return FS.canUnlock(state, L.id).ok;
        });
        if (first) FS.focusTalentNode(state, first);
        else state.ui.toast = "Немає доступних вузлів";
        return;
      }
      if (t.dataset.offerNo) {
        state.ui.expandConfirm = null;
        state.ui.expandError = "";
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
      if (t.dataset.offer) {
        if (t.disabled) {
          state.ui.expandError = "Недостатньо поживи для цієї ділянки";
          state.ui.panelDirty = true;
          FS.renderPanel(state);
          return;
        }
        var q0 = FS.getExpansionQuote(state, t.dataset.offer);
        if (!q0.ok) {
          state.ui.expandError = q0.why || "Неможливо";
          state.ui.panelDirty = true;
          FS.renderPanel(state);
          return;
        }
        state.ui.expandConfirm = t.dataset.offer;
        state.ui.expandError = "";
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
      if (t.dataset.offerYes) {
        var oid = t.dataset.offerYes;
        if (state._expandLock) {
          state.ui.expandError = "Покупка вже виконується";
          state.ui.panelDirty = true;
          FS.renderPanel(state);
          return;
        }
        var q = FS.getExpansionQuote(state, oid);
        if (!q.ok) {
          state.ui.expandError = q.why || "Пропозиція застаріла";
          state.ui.expandConfirm = null;
          state.ui.panelDirty = true;
          FS.renderPanel(state);
          return;
        }
        var er = FS.purchaseExpansion(state, oid);
        if (!er.ok) {
          state.ui.expandError = er.why || "Помилка покупки";
          state.ui.expandConfirm = null;
        } else {
          state.ui.expandError = "";
          state.ui.expandConfirm = null;
          state.ui.toast = "Територію відкрито";
        }
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
      if (t.dataset.hire) {
        var partsH = t.dataset.hire.split(":");
        var hi = FS.hireAlly(state, partsH[0], partsH[1]);
        state.ui.toast = hi.ok ? "Союзника найнято" : hi.why;
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.allyAll === "home") {
        (state.allies || []).forEach(function (a) { FS.allyCommand(state, a.id, "home"); });
        state.ui.toast = "Усім: додому";
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.allyCmd) {
        var partsC = t.dataset.allyCmd.split(":");
        FS.allyCommand(state, partsC[0], partsC[1]);
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.pantry) {
        var pp = t.dataset.pantry.split(":");
        var tr = FS.pantryTransfer(state, pp[0], +pp[1]);
        state.ui.toast = tr.ok
          ? (pp[0] === "deposit" ? "Складено " + tr.moved : "Взято " + tr.moved)
          : tr.why;
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
    };
    var pan = document.getElementById("talent-pan");
    if (pan) {
      if (!state.ui.talentView) state.ui.talentView = { x: 24, y: 12, z: 1 };
      FS.applyTalentTransform(state);
      if (!pan._bound) {
        pan._bound = true;
        var drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
        pan.onpointerdown = function (ev) {
          if (ev.target.closest(".tnode")) return;
          var v = state.ui.talentView || { x: 0, y: 0, z: 1 };
          drag = true; ox = v.x; oy = v.y; sx = ev.clientX; sy = ev.clientY;
          pan.setPointerCapture(ev.pointerId);
        };
        pan.onpointermove = function (ev) {
          if (!drag) return;
          state.ui.talentView.x = ox + (ev.clientX - sx);
          state.ui.talentView.y = oy + (ev.clientY - sy);
          FS.applyTalentTransform(state);
        };
        pan.onpointerup = function () { drag = false; };
        pan.onpointercancel = function () { drag = false; };
        pan.onwheel = function (ev) {
          ev.preventDefault();
          var v = state.ui.talentView;
          var next = FS.clamp(v.z * (ev.deltaY > 0 ? 0.9 : 1.1), 0.55, 1.6);
          v.z = next;
          FS.applyTalentTransform(state);
        };
        window.addEventListener("blur", function () { drag = false; });
      }
    }
    var mute = document.getElementById("chk-mute");
    if (mute) mute.onchange = function () { state.settings.muted = mute.checked; };
    var motion = document.getElementById("chk-motion");
    if (motion) motion.onchange = function () { state.settings.reducedMotion = motion.checked; };
  };

  FS.showTalentDetail = function (state, id) {
    var node = FS.TALENTS[id];
    var box = document.getElementById("talent-detail");
    if (!box || !node) return;
    var html = "<h3>" + node.name + "</h3><p>" + (node.desc || "") + "</p>";
    html += "<p>Гілка: " + node.branch + " · ціна: " + (node.cost || 0) + "</p>";
    if (node.fork) {
      if (state.talents.forkPicks[id]) {
        html += "<p class='ok'>Обрано: " + state.talents.forkPicks[id] + " — " + node.choices[state.talents.forkPicks[id]].name + "</p>";
      } else {
        html += '<div class="fork-box">';
        html += "<div><b>A · " + node.choices.A.name + "</b><p>" + node.choices.A.desc +
          '</p><button class="btn primary" data-fork="' + id + ':A">Обрати A</button></div>';
        html += "<div><b>B · " + node.choices.B.name + "</b><p>" + node.choices.B.desc +
          '</p><button class="btn" data-fork="' + id + ':B">Обрати серце</button></div>';
        html += "</div>";
      }
    } else if (!state.talents.unlocked[id]) {
      var can = FS.canUnlock(state, id);
      html += '<button class="btn primary" id="btn-unlock"' + (can.ok ? "" : " disabled") + ">" +
        (can.ok ? "Відкрити" : can.why) + "</button>";
    } else {
      html += '<p class="ok">Відкрито</p>';
    }
    box.innerHTML = html;
    var bu = document.getElementById("btn-unlock");
    if (bu) bu.onclick = function () {
      var r = FS.unlockTalent(state, id);
      if (!r.ok) state.ui.toast = r.why;
      else {
        state.tutorial.done.talentPick = true;
        state.ui.panelDirty = true;
        FS.renderPanel(state);
      }
    };
  };
})(window.FoxSerpent);
