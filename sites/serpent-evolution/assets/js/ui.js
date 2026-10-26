/* FOX SERPENT — DOM UI */
(function (FS) {
  "use strict";

  FS.bindUI = function (state) {
    var root = document.getElementById("ui-root");
    root.innerHTML = [
      '<div id="hud">',
      '  <div class="hud-left">',
      '    <div id="len">Довжина <b>3</b></div>',
      '    <div id="xp">Досвід <b>0</b></div>',
      '    <div id="points">Очки талантів <b>0</b></div>',
      '    <div id="cargo">Вантаж <b>0</b> · гніздо <b>0</b></div>',
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
      '    <p class="lead"><b>Відпусти клавішу — зупинишся. Вороги продовжують рухатися.</b></p>',
      '    <p>Клітинкова змійка: таланти, території, одноразові серця й розумні суперники.</p>',
      '    <div class="row">',
      '      <button id="btn-new" class="btn primary">Нова гра</button>',
      '      <button id="btn-continue" class="btn">Продовжити</button>',
      '      <button id="btn-import" class="btn ghost">Імпорт</button>',
      '      <input id="import-file" type="file" accept="application/json,.json" hidden />',
      '    </div>',
      '    <p id="cont-msg" class="tiny"></p>',
      '    <p class="tiny">WASD · T дерево · Tab карта · Пробіл пауза</p>',
      '  </div>',
      '</div>'
    ].join("");

    document.getElementById("btn-new").onclick = function () {
      FS.unlockAudio(state);
      FS.newGame(state);
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
    document.getElementById("len").innerHTML = "Довжина <b>" + state.player.body.length + "</b>";
    document.getElementById("xp").innerHTML = "Досвід <b>" + state.xp + "/" + FS.xpToNext(state.talentLevel) + "</b>";
    document.getElementById("points").innerHTML = "Очки талантів <b>" + state.talents.points + "</b>";
    document.getElementById("cargo").innerHTML =
      "Вантаж <b>" + state.cargo + "/" + state.cargoMax + "</b> · гніздо <b>" + state.nestMaterials + "</b>";
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
    else el.innerHTML = "";
    FS.bindPanel(state);
  };

  FS.htmlTalents = function (state) {
    var html = '<div class="panel-head"><h2>Дерево талантів</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p class="muted">Очки: ' + state.talents.points + ' · Серця: ' + state.talents.hearts + ' (витрачені лишаються витраченими)</p>';
    html += '<div class="talent-wrap"><div class="talent-tree" id="talent-tree">';
    FS.TALENT_LAYOUT.forEach(function (lay) {
      var node = FS.TALENTS[lay.id];
      if (!node) return;
      var unlocked = !!state.talents.unlocked[lay.id];
      var can = FS.canUnlock(state, lay.id);
      var cls = "tnode" + (unlocked ? " on" : "") + (node.fork ? " fork" : "") + (can.ok ? " can" : "");
      html += '<button type="button" class="' + cls + '" style="left:' + (50 + lay.x * 70) + 'px;top:' + (20 + lay.y * 70) + 'px" data-talent="' + lay.id + '">';
      html += "<b>" + node.name + "</b>";
      if (node.fork && state.talents.forkPicks[lay.id]) {
        html += "<em>" + state.talents.forkPicks[lay.id] + "</em>";
      }
      html += "</button>";
    });
    html += '</div><div class="talent-detail" id="talent-detail"><p class="muted">Обери вузол</p></div></div>';
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
    var html = '<div class="panel-head"><h2>Відкрити територію</h2><button class="btn ghost" data-act="close">Закрити</button></div>';
    html += '<p>Матеріал у гнізді: <b>' + state.nestMaterials + "</b>. Розширення — окремий вибір, не авто з довжини.</p>";
    state.world.openOffers.forEach(function (o, i) {
      var cost = Math.max(4, o.cost - (state.effects.expandDiscount || 0));
      html += '<div class="offer"><b>' + o.name + "</b><p>" + o.desc + "</p>";
      html += "<em>Вартість " + cost + " · небезпека " + o.danger +
        (o.spawnsEnemy ? " · з’явиться змія" : "") + "</em>";
      html += '<button class="btn' + (state.nestMaterials >= cost ? " primary" : "") + '" data-expand="' + i + '">Відкрити</button></div>';
    });
    if (!state.world.openOffers.length) html += '<p class="muted">Немає сусідніх ділянок.</p>';
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
      '<button class="btn" data-act="help">Правила</button>',
      '<label class="check"><input type="checkbox" id="chk-mute"' + (state.settings.muted ? " checked" : "") + '/> Без звуку</label>',
      '<label class="check"><input type="checkbox" id="chk-motion"' + (state.settings.reducedMotion ? " checked" : "") + '/> Зменшений рух</label>',
      '<button class="btn danger" data-act="new">Новий світ…</button>',
      "</div>"
    ].join("");
  };

  FS.htmlHelp = function () {
    return '<div class="panel-head"><h2>Правила</h2><button class="btn ghost" data-act="close">Закрити</button></div><ul class="help">' +
      FS.HELP.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>";
  };

  FS.htmlDeath = function (state) {
    var d = state.lastDeath || {};
    return '<div class="panel-head"><h2>Смерть</h2></div>' +
      "<p><b>" + (d.reason || "") + "</b></p>" +
      "<p>Втрачено матеріалу з вантажу: " + (d.lostCargo || 0) + "</p>" +
      "<p>Таланти, серця (вже витрачені), гніздо й території збережено.</p>" +
      '<button class="btn primary" data-act="respawn">Повернутися до гнізда</button>';
  };

  FS.bindPanel = function (state) {
    var el = document.getElementById("panel");
    el.onclick = function (ev) {
      var t = ev.target.closest("[data-act],[data-talent],[data-expand],[data-fork]");
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
      if (t.dataset.act === "expand") { state.ui.panel = "expand"; state.ui.panelDirty = true; FS.renderPanel(state); return; }
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
      if (t.dataset.expand != null) {
        var offer = state.world.openOffers[+t.dataset.expand];
        if (!offer) return;
        if (offer.spawnsEnemy && !confirm("Увага: на цій території з’явиться ворожа змія. Продовжити?")) return;
        var er = FS.expandChunk(state, offer);
        if (!er.ok) state.ui.toast = er.why;
        else { state.ui.panelDirty = true; FS.renderPanel(state); }
      }
    };
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
