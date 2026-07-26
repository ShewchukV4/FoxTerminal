(() => {
  "use strict";

  const ROWS = 6;
  const COLS = 5;
  const LS_STATS = "fox-word-stats";
  const LS_THEME = "fox-word-theme";
  const LS_MODE = "fox-word-mode";
  const EPOCH = new Date("2024-01-01T00:00:00");

  const THEMES = [
    { id: "cyber", icon: "⚡", name: "Cyber", tag: "neon grid · sharp tiles" },
    { id: "fox", icon: "🦊", name: "Fox", tag: "ember glow · warm wood" },
    { id: "noir", icon: "🕶", name: "Noir", tag: "mono film · square cut" },
    { id: "neon", icon: "🌈", name: "Neon", tag: "synthwave · hot pink" },
    { id: "retro", icon: "🕹", name: "Retro", tag: "matrix green · pixel" },
    { id: "synth", icon: "🌆", name: "Synth", tag: "sunset vapor · soft round" },
    { id: "ocean", icon: "🌊", name: "Ocean", tag: "deep blue · bubble tiles" },
    { id: "forest", icon: "🍀", name: "Forest", tag: "moss calm · organic" },
    { id: "lava", icon: "🔥", name: "Lava", tag: "volcanic heat · ember" },
    { id: "frost", icon: "❄", name: "Frost", tag: "ice glass · pill shape" },
    { id: "espresso", icon: "☕", name: "Espresso", tag: "coffee shop · cozy" },
    { id: "arcade", icon: "👾", name: "Arcade", tag: "cabinet glow · chunky" },
    { id: "midnight", icon: "🌙", name: "Midnight", tag: "indigo dream · soft" },
    { id: "pride", icon: "🏳️‍🌈", name: "Pride", tag: "gradient shell · vivid" }
  ];

  const THEME_BG = {
    cyber: "float", fox: "ember", noir: "dust", neon: "spark", retro: "matrix",
    synth: "float", ocean: "bubble", forest: "leaf", lava: "ember", frost: "snow",
    espresso: "dust", arcade: "spark", midnight: "star", pride: "spark"
  };

  const KEY_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"]
  ];

  const $ = (id) => document.getElementById(id);
  const boardEl = $("board");
  const keyboardEl = $("keyboard");
  const msgEl = $("msg");
  const dictStatus = $("dict-status");
  const boardWrap = $("board-wrap");
  const loadOverlay = $("load-overlay");
  const loadFill = $("load-fill");
  const loadHint = $("load-hint");
  const overlay = $("overlay");
  const overlayTitle = $("overlay-title");
  const overlayBody = $("overlay-body");
  const themeLabel = $("theme-label");

  let dict = null;
  let answer = "";
  let row = 0;
  let col = 0;
  let grid = [];
  let done = false;
  let busy = false;
  let gameMode = localStorage.getItem(LS_MODE) || "daily";
  let keyState = {};
  let tiles = [];
  let visualTheme = localStorage.getItem(LS_THEME) || "cyber";
  let bgPts = [];
  let bgAnim = null;

  function loadStats() {
    try {
      return JSON.parse(localStorage.getItem(LS_STATS)) || {
        played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0]
      };
    } catch {
      return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
    }
  }

  function saveStats(s) {
    localStorage.setItem(LS_STATS, JSON.stringify(s));
  }

  function themeMeta(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  function setTheme(id) {
    visualTheme = id;
    document.body.className = "theme-" + id;
    localStorage.setItem(LS_THEME, id);
    document.querySelectorAll("#theme-bar .mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === id);
    });
    const meta = themeMeta(id);
    if (themeLabel) themeLabel.textContent = `${meta.icon} ${meta.name} — ${meta.tag}`;
    initBgParticles(true);
  }

  function buildThemeBar() {
    const bar = $("theme-bar");
    bar.innerHTML = THEMES.map((t) =>
      `<button class="mode-btn${t.id === visualTheme ? " active" : ""}" type="button" data-theme="${t.id}">${t.icon} ${t.name.toUpperCase()}</button>`
    ).join("");
    bar.querySelectorAll(".mode-btn").forEach((b) => {
      b.addEventListener("click", () => setTheme(b.dataset.theme));
    });
  }

  function setGameMode(mode) {
    gameMode = mode;
    localStorage.setItem(LS_MODE, mode);
    document.querySelectorAll("#game-mode-bar .mode-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    newGame();
  }

  function dailyIndex() {
    const now = new Date();
    const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH.getTime()) / 86400000);
    return ((day % dict.answers.length) + dict.answers.length) % dict.answers.length;
  }

  function pickAnswer() {
    if (gameMode === "daily") return dict.answers[dailyIndex()];
    return dict.answers[Math.floor(Math.random() * dict.answers.length)];
  }

  function resetTileEl(tile) {
    tile.className = "tile";
    tile.innerHTML = '<span class="tile-letter"></span>';
  }

  function letterEl(tile) {
    return tile.querySelector(".tile-letter");
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    tiles = [];
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      rowEl.dataset.row = r;
      const rowTiles = [];
      for (let c = 0; c < COLS; c++) {
        const t = document.createElement("div");
        t.className = "tile";
        t.dataset.row = r;
        t.dataset.col = c;
        t.innerHTML = '<span class="tile-letter"></span>';
        rowEl.appendChild(t);
        rowTiles.push(t);
      }
      boardEl.appendChild(rowEl);
      tiles.push(rowTiles);
    }
    updateActiveTile();
  }

  function updateActiveTile() {
    tiles.forEach((rowTiles, r) => {
      rowTiles.forEach((tile, c) => {
        tile.classList.toggle("active", !done && !busy && r === row && c === col);
      });
    });
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_ROWS.forEach((keys) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      keys.forEach((k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "kb-key" + (k.length > 1 ? " wide" : "");
        btn.textContent = k === "Backspace" ? "⌫" : k;
        btn.dataset.key = k;
        if (k.length === 1) btn.dataset.letter = k;
        btn.addEventListener("click", () => onKey(k));
        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function paintKeyboard() {
    document.querySelectorAll(".kb-key[data-letter]").forEach((el) => {
      const ch = el.dataset.letter;
      el.classList.remove("correct", "present", "absent");
      const s = keyState[ch];
      if (s) el.classList.add(s);
    });
  }

  function updateKeyState(letter, state) {
    const rank = { absent: 1, present: 2, correct: 3 };
    const cur = keyState[letter];
    if (!cur || rank[state] > rank[cur]) keyState[letter] = state;
    paintKeyboard();
  }

  function scoreGuess(guess, target) {
    const result = Array(COLS).fill("absent");
    const ans = target.split("");
    const used = Array(COLS).fill(false);

    for (let i = 0; i < COLS; i++) {
      if (guess[i] === ans[i]) {
        result[i] = "correct";
        used[i] = true;
      }
    }
    for (let i = 0; i < COLS; i++) {
      if (result[i] === "correct") continue;
      const ch = guess[i];
      const j = ans.findIndex((a, idx) => !used[idx] && a === ch);
      if (j !== -1) {
        result[i] = "present";
        used[j] = true;
      }
    }
    return result;
  }

  function showMsg(text, ms = 2000) {
    msgEl.textContent = text;
    clearTimeout(showMsg._t);
    if (text) showMsg._t = setTimeout(() => { msgEl.textContent = ""; }, ms);
  }

  function shakeRow(r) {
    const rowEl = boardEl.children[r];
    rowEl.classList.remove("shake");
    void rowEl.offsetWidth;
    rowEl.classList.add("shake");
  }

  async function revealRow(r, guess, target) {
    busy = true;
    updateActiveTile();
    const scores = scoreGuess(guess, target);

    for (let c = 0; c < COLS; c++) {
      await new Promise((res) => setTimeout(res, 260));
      const tile = tiles[r][c];
      tile.classList.remove("active", "filled");
      tile.classList.add("revealed", scores[c], "reveal-anim");
      letterEl(tile).textContent = guess[c].toUpperCase();
      updateKeyState(guess[c], scores[c]);
      setTimeout(() => tile.classList.remove("reveal-anim"), 380);
    }

    await new Promise((res) => setTimeout(res, 200));
    busy = false;
    updateActiveTile();
  }

  function recordWin(attemptRow) {
    const s = loadStats();
    s.played++;
    s.wins++;
    s.streak++;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.dist[attemptRow]++;
    saveStats(s);
  }

  function recordLoss() {
    const s = loadStats();
    s.played++;
    s.streak = 0;
    saveStats(s);
  }

  async function submitRow() {
    if (done || busy || col < COLS) return;
    const guess = grid[row].join("");
    if (!dict.valid5.has(guess)) {
      shakeRow(row);
      showMsg("Немає в словнику");
      return;
    }

    await revealRow(row, guess, answer);

    if (guess === answer) {
      done = true;
      updateActiveTile();
      recordWin(row);
      showMsg(row === 0 ? "Genius! 🦊" : `Вгадав за ${row + 1}!`);
      if (gameMode !== "daily") setTimeout(() => newGame(), 2500);
      return;
    }

    row++;
    col = 0;
    if (row >= ROWS) {
      done = true;
      updateActiveTile();
      recordLoss();
      showMsg(`Слово: ${answer.toUpperCase()}`, 5000);
      if (gameMode !== "daily") setTimeout(() => newGame(), 4000);
    } else {
      updateActiveTile();
    }
  }

  function onKey(key) {
    if (done || busy || !dict) return;
    const k = key === "Backspace" ? "Backspace" : key === "Enter" ? "Enter" : key.toLowerCase();

    if (k === "Enter") {
      if (col < COLS) {
        shakeRow(row);
        showMsg("Замало літер");
      } else submitRow();
      return;
    }

    if (k === "Backspace") {
      if (col > 0) {
        col--;
        grid[row][col] = "";
        const tile = tiles[row][col];
        tile.classList.remove("filled");
        letterEl(tile).textContent = "";
      }
      updateActiveTile();
      return;
    }

    if (!/^[a-z]$/.test(k) || col >= COLS) return;

    grid[row][col] = k;
    const tile = tiles[row][col];
    letterEl(tile).textContent = k.toUpperCase();
    tile.classList.add("filled");
    tile.classList.remove("revealed", "correct", "present", "absent", "reveal-anim");
    col++;
    updateActiveTile();
  }

  function newGame() {
    if (!dict) return;
    answer = pickAnswer();
    row = 0;
    col = 0;
    done = false;
    busy = false;
    keyState = {};
    buildBoard();
    paintKeyboard();
    showMsg(gameMode === "daily" ? "Слово дня 🦊" : "");
  }

  function showOverlay(title, html) {
    overlayTitle.textContent = title;
    overlayBody.innerHTML = html;
    overlay.classList.add("show");
  }

  function showHelp() {
    showOverlay("Як грати", `
      <ul>
        <li>Вгадай <strong>5-буквене</strong> англійське слово за 6 спроб.</li>
        <li><span style="color:var(--correct)">■</span> — буква на місці</li>
        <li><span style="color:var(--present)">■</span> — є в слові, інше місце</li>
        <li><span style="color:var(--wrong)">■</span> — немає в слові</li>
      </ul>
      <p>14 тем — кожна зі своїм кольором, формою плиток і фоном.</p>
    `);
  }

  function showStatsPanel() {
    const s = loadStats();
    const pct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    const bars = s.dist.map((n, i) => {
      const max = Math.max(...s.dist, 1);
      const w = Math.round((n / max) * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:0.75rem">
        <span style="width:12px">${i + 1}</span>
        <div style="flex:1;height:16px;background:var(--surface2);border-radius:3px;overflow:hidden">
          <div style="width:${w}%;height:100%;background:var(--accent)"></div>
        </div>
        <span style="width:24px;text-align:right">${n}</span>
      </div>`;
    }).join("");

    showOverlay("Статистика", `
      <div class="stats-grid">
        <div class="stat-box"><strong>${s.played}</strong><span>Ігор</span></div>
        <div class="stat-box"><strong>${pct}%</strong><span>Перемог</span></div>
        <div class="stat-box"><strong>${s.streak}</strong><span>Серія</span></div>
        <div class="stat-box"><strong>${s.maxStreak}</strong><span>Макс</span></div>
      </div>
      ${bars}
    `);
  }

  function initBgParticles(reset) {
    const cv = $("bg-canvas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const mode = THEME_BG[visualTheme] || "float";

    function resize() {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      const n = Math.min(55, Math.floor(cv.width * cv.height / 22000));
      bgPts = Array.from({ length: n }, () => spawn(mode, cv.width, cv.height));
    }

    if (reset) resize();
    else if (!bgPts.length) resize();
    window.onresize = resize;

    if (bgAnim) cancelAnimationFrame(bgAnim);
    const col = () => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3ecfb8";
    const col2 = () => getComputedStyle(document.documentElement).getPropertyValue("--accent2").trim() || "#5b8ef5";

    function spawn(m, w, h) {
      const base = {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: 0.6 + Math.random() * 1.6,
        a: 0.12 + Math.random() * 0.35,
        t: Math.random() * Math.PI * 2
      };
      if (m === "matrix") base.vy = 0.6 + Math.random() * 1.2;
      if (m === "snow") { base.vy = 0.15 + Math.random() * 0.35; base.vx *= 0.3; }
      if (m === "ember") { base.vy = -0.2 - Math.random() * 0.6; base.r = 1 + Math.random() * 2; }
      return base;
    }

    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const c1 = col();
      const c2 = col2();
      bgPts.forEach((p, i) => {
        p.t += 0.02;
        if (mode === "matrix") {
          p.y += p.vy;
          if (p.y > cv.height) { p.y = -4; p.x = Math.random() * cv.width; }
        } else if (mode === "ember") {
          p.x += p.vx + Math.sin(p.t) * 0.2;
          p.y += p.vy;
          if (p.y < -8) { p.y = cv.height + 4; p.x = Math.random() * cv.width; }
        } else if (mode === "snow") {
          p.x += p.vx + Math.sin(p.t) * 0.15;
          p.y += p.vy;
          if (p.y > cv.height) { p.y = -4; p.x = Math.random() * cv.width; }
        } else {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = cv.width;
          if (p.x > cv.width) p.x = 0;
          if (p.y < 0) p.y = cv.height;
          if (p.y > cv.height) p.y = 0;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? c2 : c1;
        ctx.globalAlpha = p.a;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      bgAnim = requestAnimationFrame(draw);
    }
    draw();
  }

  async function boot() {
    buildThemeBar();
    buildKeyboard();
    setTheme(THEMES.some((t) => t.id === visualTheme) ? visualTheme : "cyber");

    document.querySelectorAll("#game-mode-bar .mode-btn").forEach((b) => {
      if (b.dataset.mode === gameMode) b.classList.add("active");
      else b.classList.remove("active");
      b.addEventListener("click", () => setGameMode(b.dataset.mode));
    });

    loadOverlay.classList.add("show");
    loadFill.style.width = "20%";

    try {
      const t0 = performance.now();
      dict = await FoxWordDict.loadDictionary();
      const ms = Math.round(performance.now() - t0);
      loadFill.style.width = "100%";

      const m = dict.meta;
      const packKb = (m.dictGzBytes / 1024).toFixed(0);
      loadHint.textContent = `${m.totalWords.toLocaleString()} слів · ${packKb} KB · ${ms} ms`;
      dictStatus.textContent = `✓ ${m.fiveLetter.toLocaleString()} valid · ${m.answerWords.toLocaleString()} answers · ${packKb} KB`;
      dictStatus.classList.add("ready");

      $("stat-dict").textContent = `${m.totalWords.toLocaleString()} words archived`;
      $("stat-guess").textContent = `${m.fiveLetter.toLocaleString()} ×5 guesses`;

      boardWrap.hidden = false;
      keyboardEl.hidden = false;
      newGame();

      setTimeout(() => loadOverlay.classList.remove("show"), 400);
    } catch (e) {
      const hint = location.protocol === "file:"
        ? "Оновіть Ctrl+F5 — або node scripts/build-dict.mjs"
        : e.message;
      loadHint.textContent = "Помилка: " + hint;
      dictStatus.textContent = "Не вдалося завантажити словник";
      console.error(e);
    }

    document.addEventListener("keydown", (e) => {
      if (overlay.classList.contains("show") && e.key === "Escape") overlay.classList.remove("show");
      if (overlay.classList.contains("show") || loadOverlay.classList.contains("show")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") onKey("Enter");
      else if (e.key === "Backspace") onKey("Backspace");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key);
    });

    $("btn-help").addEventListener("click", showHelp);
    $("btn-stats").addEventListener("click", showStatsPanel);
    $("overlay-close").addEventListener("click", () => overlay.classList.remove("show"));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("show");
    });
  }

  boot();
})();
