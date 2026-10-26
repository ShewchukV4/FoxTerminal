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
      '    <p class="tiny">WASD · T дерево · B будувати · Tab карта · Пробіл пауза</p>',
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
    var nutLabel = nut >= FS.MAX_NUTRITION ? "Пожива повна · їжа дає лише досвід" : ("Пожива <b>" + nut + "</b>/9");
    document.getElementById("nutrition").innerHTML = nutLabel;
    document.getElementById("xp").innerHTML = "Досвід <b>" + state.xp + "/" + FS.xpToNext(state.talentLevel) + "</b>";
    document.getElementById("points").innerHTML = "Очки талантів <b>" + state.talents.points + "</b>";
    var fi = FS.foodHudInfo(state);
    var foodEl = document.getElementById("food-hud");
    if (fi && (state.effects.ripeHud || true)) {
      foodEl.textContent = "Їжа на ділянці: " + fi.ripe + "/" + fi.capacity +
        (fi.next != null ? " · новий плід через " + Math.ceil(fi.next) + " с" : "");
    } else foodEl.textContent = "";
    var hearts = "";
    for (var i = 0; i < state.talents.hearts; i++) hearts += "♥";
    if (!hearts) hearts = "♡ немає";
    document.getElementById("hearts").textContent = "Серця: " + hearts + " (витрачено " + state.talents.heartsSpent + ")";
    document.getElementById("move-ind").textContent = state.player.standing ? "СТОЮ" : "РУХАЮСЬ";
    document.getElementById("move-ind").className = "move-ind" + (state.player.standing ? " stand" : " move");

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
    else el.innerHTML = "";
    FS.bindPanel(state);
  };

  FS.htmlTalents = function (state) {
    var nut = FS.nutritionOf(state);
    var html = '<div class="panel-head talent-head"><div><h2>Сад розвитку</h2>';
    html += '<p class="muted">Очки <b>' + state.talents.points + '</b> · Пожива <b>' + nut + '</b>/9 · Довжина <b>' +
      state.player.body.length + '</b>/12 · Серця ' + state.talents.hearts + "</p></div>";
    html += '<button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<div class="talent-studio">';
    html += '<div class="talent-canvas-wrap" id="talent-pan"><div class="talent-tree" id="talent-tree">';
    // links
    html += '<svg class="talent-links" width="900" height="820">';
    FS.TALENT_LAYOUT.forEach(function (lay) {
      var node = FS.TALENTS[lay.id];
      if (!node || !node.prereq) return;
      node.prereq.forEach(function (pid) {
        var pl = FS.TALENT_LAYOUT.find(function (L) { return L.id === pid; });
        if (!pl) return;
        var unlocked = !!state.talents.unlocked[lay.id];
        html += '<line x1="' + (450 + pl.x * 78) + '" y1="' + (40 + pl.y * 72) +
          '" x2="' + (450 + lay.x * 78) + '" y2="' + (40 + lay.y * 72) +
          '" class="tlink' + (unlocked ? " on" : "") + '"/>';
      });
    });
    html += "</svg>";
    FS.TALENT_LAYOUT.forEach(function (lay) {
      var node = FS.TALENTS[lay.id];
      if (!node) return;
      var unlocked = !!state.talents.unlocked[lay.id];
      var can = FS.canUnlock(state, lay.id);
      var lockedAlt = node.fork && state.talents.forkPicks[lay.id];
      var cls = "tnode" + (unlocked ? " on" : "") + (node.fork ? " fork" : "") +
        (can.ok ? " can" : "") + (lockedAlt ? " picked" : "");
      html += '<button type="button" class="' + cls + '" style="left:' + (410 + lay.x * 78) +
        'px;top:' + (16 + lay.y * 72) + 'px" data-talent="' + lay.id + '" title="' + node.name + '">';
      html += '<span class="ticon">' + (node.fork ? "⟐" : (node.branch === "control" ? "◎" : node.branch === "explore" ? "❀" : "◆")) + "</span>";
      html += "<b>" + node.name + "</b>";
      if (node.fork && state.talents.forkPicks[lay.id]) html += "<em>" + state.talents.forkPicks[lay.id] + "</em>";
      html += "</button>";
    });
    html += '</div></div>';
    html += '<aside class="talent-detail" id="talent-detail"><p class="muted">Обери вузол на схемі. Click вибирає · кнопка підтверджує.</p>';
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
    var html = '<div class="panel-head"><h2>Відкрити територію</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p>Пожива: <b>' + nut + '</b>/9 · джерело: пожива (скорочує хвіст). Seed ' + state.world.seed + "</p>";
    state.world.openOffers.forEach(function (o) {
      var q = FS.getExpansionQuote(state, o.id);
      html += '<div class="offer"><b>' + o.name + "</b> <span class='tiny'>id " + o.id + "</span><p>" + o.desc + "</p>";
      if (!q.ok && q.why && q.cost == null) {
        html += "<em>" + q.why + "</em>";
      } else {
        html += "<em>Вартість " + q.cost + " поживи · є " + q.now + "/9 · довжина " +
          q.lenNow + " → " + q.lenAfter + (q.spawnsEnemy ? " · з’явиться змія" : "") + "</em>";
        if (!q.ok) html += "<p class='tiny'>" + q.why + " · " + q.source + "</p>";
        html += '<button class="btn' + (q.ok ? " primary" : "") + '" data-offer="' + o.id + '"' +
          (q.ok ? "" : " disabled") + ">Відкрити за " + q.cost + "</button>";
      }
      html += "</div>";
    });
    if (!state.world.openOffers.length) html += '<p class="muted">Немає сусідніх ділянок.</p>';
    return html;
  };

  FS.htmlBuild = function (state) {
    FS.ensureFarms(state);
    FS.ensureAllies(state);
    var h = FS.snakeHead(state.player);
    var tile = FS.tileAt(state.world, h.x, h.y);
    var info = FS.describeTile(tile);
    var html = '<div class="panel-head"><h2>Будівництво (B)</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += "<p>Під головою: <b>" + info.name + "</b> — " + info.effect + " · " + (info.walk ? "прохід" : "блок") + "</p>";
    html += "<p class='tiny'>Будує на клітинці голови. Ціна з поживи скорочує хвіст.</p>";
    html += "<h3>Ферми</h3>";
    Object.keys(FS.FARM_DEFS).forEach(function (id) {
      var d = FS.FARM_DEFS[id];
      var can = FS.canPlaceFarm(state, h.x, h.y, id);
      var prev = FS.previewSpend(state, d.cost);
      html += '<div class="offer"><b>' + d.name + "</b><p>" + d.desc + "</p><em>" + d.cost + " поживи · після довжина " +
        prev.lenNow + " → " + prev.lenAfter + "</em>";
      if (!can.ok) html += "<p class='tiny'>" + can.why + "</p>";
      html += '<button class="btn' + (can.ok && prev.ok ? " primary" : "") + '" data-build-farm="' + id + '"' +
        (can.ok && prev.ok ? "" : " disabled") + ">Посадити</button></div>";
    });
    html += "<h3>Домівка / союзник</h3>";
    var hc = FS.canPlaceHome(state, h.x, h.y, "hut");
    var hp = FS.previewSpend(state, FS.HOME_DEFS.hut.cost);
    html += '<div class="offer"><b>Домівка</b><em>' + FS.HOME_DEFS.hut.cost + " поживи</em>";
    if (!hc.ok) html += "<p class='tiny'>" + hc.why + "</p>";
    html += '<button class="btn' + (hc.ok && hp.ok ? " primary" : "") + '" data-build-home="hut"' +
      (hc.ok && hp.ok ? "" : " disabled") + ">Збудувати</button></div>";
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
    if (state.allies.length) {
      html += "<h3>Команди</h3>";
      state.allies.forEach(function (a) {
        html += "<p>" + a.name + " [" + a.role + "] " + (a.inside ? "вдома" : a.stateAI) + " ";
        ["work", "home", "follow", "wait"].forEach(function (c) {
          html += '<button class="btn ghost" data-ally-cmd="' + a.id + ":" + c + '">' + c + "</button> ";
        });
        html += "</p>";
      });
    }
    // farms status
    if (state.farms.list.length) {
      html += "<h3>Твої ферми</h3><ul>";
      state.farms.list.forEach(function (f) {
        var left = f.stage === "ready" ? "урожай " + f.store.length + "/" + f.storeMax :
          (f.stage + " · " + Math.max(0, Math.ceil((f.cycle || 14) - (f.t || 0))) + "с");
        html += "<li>" + f.type + " @" + f.x + "," + f.y + " — " + left +
          (f.waiting ? " · Урожай чекає" : "") + "</li>";
      });
      html += "</ul>";
    }
    return html;
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
      '<button class="btn" data-act="build">Будувати (B)</button>',
      '<button class="btn" data-act="help">Правила</button>',
      '<button class="btn" data-act="guide">Як грати (гайд)</button>',
      '<p class="tiny selectable copyable">Seed: ' + (state.world && state.world.seed) + "</p>",
      '<label class="check"><input type="checkbox" id="chk-mute"' + (state.settings.muted ? " checked" : "") + '/> Без звуку</label>',
      '<label class="check"><input type="checkbox" id="chk-motion"' + (state.settings.reducedMotion ? " checked" : "") + '/> Зменшений рух</label>',
      '<button class="btn danger" data-act="new">Новий світ…</button>',
      "</div>"
    ].join("");
  };

  FS.htmlHelp = function () {
    return '<div class="panel-head"><h2>Правила</h2><button class="btn ghost" data-act="close">Закрити</button></div>' +
      '<button class="btn primary" data-act="guide">Показати короткий гайд</button>' +
      '<ul class="help">' +
      FS.HELP.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  };

  FS.htmlDeath = function (state) {
    var d = state.lastDeath || {};
    return '<div class="panel-head"><h2>Смерть</h2></div>' +
      "<p><b>" + (d.reason || "") + "</b></p>" +
      "<p>Пожива скинута (було " + (d.nutritionLost || 0) + "). Довжина знову 3.</p>" +
      "<p>Таланти, витрачені серця й відкриті території збережено.</p>" +
      '<button class="btn primary" data-act="respawn">Повернутися до гнізда</button>';
  };

  FS.bindPanel = function (state) {
    var el = document.getElementById("panel");
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-act],[data-talent],[data-offer],[data-fork],[data-build-farm],[data-build-home],[data-hire],[data-ally-cmd]");
      if (!t) return;
      if (t.dataset.act === "close") {
        state.ui.panel = null; FS.setPauseReason(state, "panel", false); return;
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
      if (t.dataset.act === "expand") { state.ui.panel = "expand"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
      if (t.dataset.act === "build") { state.ui.panel = "build"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
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
        if (first) FS.showTalentDetail(state, first.id);
        return;
      }
      if (t.dataset.offer) {
        if (t.disabled) return;
        var q = FS.getExpansionQuote(state, t.dataset.offer);
        if (!q.ok) { state.ui.toast = q.why; state.ui.panelDirty = true; FS.renderPanel(state); return; }
        var msg = "Вартість " + q.cost + " поживи · зараз " + q.now + "/9 · довжина " +
          q.lenNow + " → " + q.lenAfter + " · " + q.label + ".";
        if (q.spawnsEnemy) msg += " З’явиться ворожа змія.";
        if (!confirm(msg + " Продовжити?")) return;
        var er = FS.purchaseExpansion(state, t.dataset.offer);
        if (!er.ok) state.ui.toast = er.why;
        state.ui.panelDirty = true;
        FS.renderPanel(state);
        return;
      }
      if (t.dataset.buildFarm) {
        var h2 = FS.snakeHead(state.player);
        var fr = FS.purchaseFarm(state, h2.x, h2.y, t.dataset.buildFarm);
        state.ui.toast = fr.ok ? "Ферму посаджено" : fr.why;
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.buildHome) {
        var h3 = FS.snakeHead(state.player);
        var hr = FS.purchaseHome(state, h3.x, h3.y, t.dataset.buildHome);
        state.ui.toast = hr.ok ? "Домівку збудовано" : hr.why;
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.hire) {
        var partsH = t.dataset.hire.split(":");
        var hi = FS.hireAlly(state, partsH[0], partsH[1]);
        state.ui.toast = hi.ok ? "Союзника найнято" : hi.why;
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
      if (t.dataset.allyCmd) {
        var partsC = t.dataset.allyCmd.split(":");
        FS.allyCommand(state, partsC[0], partsC[1]);
        state.ui.panelDirty = true; FS.renderPanel(state); return;
      }
    };
    var pan = document.getElementById("talent-pan");
    if (pan && !pan._bound) {
      pan._bound = true;
      var ox = 0, oy = 0, drag = false, sx = 0, sy = 0;
      pan.onpointerdown = function (ev) {
        if (ev.target.closest(".tnode")) return;
        drag = true; sx = ev.clientX - ox; sy = ev.clientY - oy;
        pan.setPointerCapture(ev.pointerId);
      };
      pan.onpointermove = function (ev) {
        if (!drag) return;
        ox = ev.clientX - sx; oy = ev.clientY - sy;
        var tree = document.getElementById("talent-tree");
        if (tree) tree.style.transform = "translate(" + ox + "px," + oy + "px)";
      };
      pan.onpointerup = function () { drag = false; };
      pan.onpointercancel = function () { drag = false; };
      window.addEventListener("blur", function () { drag = false; });
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
