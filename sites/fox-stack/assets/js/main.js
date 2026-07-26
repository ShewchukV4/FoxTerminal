(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const HS_KEY = 'fox-stack-hs';

  const SHAPES = {
    I: { m: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], c: '#46dcc8' },
    O: { m: [[1,1],[1,1]], c: '#e0b148' },
    T: { m: [[0,1,0],[1,1,1],[0,0,0]], c: '#a05aff' },
    S: { m: [[0,1,1],[1,1,0],[0,0,0]], c: '#4cb874' },
    Z: { m: [[1,1,0],[0,1,1],[0,0,0]], c: '#ff4d6d' },
    J: { m: [[1,0,0],[1,1,1],[0,0,0]], c: '#5a8cff' },
    L: { m: [[0,0,1],[1,1,1],[0,0,0]], c: '#dc7a14' }
  };
  const KEYS = Object.keys(SHAPES);

  const THEME_META = {
    cyber:    { block: 'glass-cyber', particle: 'float' },
    fox:      { block: 'ember',       particle: 'ember' },
    noir:     { block: 'flat',        particle: 'dust' },
    neon:     { block: 'neon',        particle: 'spark' },
    retro:    { block: 'pixel',       particle: 'matrix' },
    synth:    { block: 'synth',       particle: 'float' },
    ocean:    { block: 'bubble',      particle: 'bubble' },
    forest:   { block: 'matte',       particle: 'leaf' },
    lava:     { block: 'ember',       particle: 'ember' },
    frost:    { block: 'crystal',     particle: 'snow' },
    espresso: { block: 'matte',       particle: 'dust' },
    arcade:   { block: 'arcade',      particle: 'spark' },
    midnight: { block: 'glass',       particle: 'star' }
  };

  const RULES = [
    { id: 'classic',      icon: '⚡', name: 'Classic',  hint: 'Чистий Tetris — рівні, next, класичні очки.', features: {} },
    { id: 'hold-slot',    icon: '📦', name: 'Hold',     hint: 'Як Tetris.io: C або кнопка Swap — покласти фігуру в HOLD і витягнути назад (swap). 1 раз на падіння.', features: { hold: true } },
    { id: 'ghost-noir',   icon: '👻', name: 'Ghost',    hint: 'Після lock dim-привид ~4 сек — можна ставити поверх.', features: {} },
    { id: 'fox-bite',     icon: '🦊', name: 'Fox Bite', hint: 'Кожні 8 ліній лис з\'їдає 5 блоків зверху.', features: {} },
    { id: 'chain-forge',  icon: '⛓', name: 'Chain',    hint: 'Друга лінія за 2.5с = ×2, третя = ×3…', features: {} },
    { id: 'gravity-flip', icon: '↕', name: 'Flip',     hint: 'Кожні 35 сек на 7 сек гравітація вгору.', features: {} },
    { id: 'garbage-rush', icon: '💀', name: 'Rush',     hint: 'Кожні 18 сек знизу піднімається сміттєвий ряд з дірками — тисне на stack.', features: { rush: true } }
  ];

  const board = document.getElementById('board');
  const preview = document.getElementById('preview');
  const holdCanvas = document.getElementById('hold');
  const ctx = board.getContext('2d');
  const pctx = preview.getContext('2d');
  const hctx = holdCanvas.getContext('2d');
  const bgCanvas = document.getElementById('bg-canvas');
  const bgCtx = bgCanvas.getContext('2d');

  let grid = [];
  let ghosts = [];
  let mode = RULES[0];
  let visualTheme = 'cyber';
  let piece = null;
  let nextKey = 'T';
  let holdKey = null;
  let canHold = true;
  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = 0;
  let lastClearAt = 0;
  let running = false;
  let paused = false;
  let dropMs = 800;
  let lastDrop = 0;
  let animId = 0;
  let biteProgress = 0;
  let flipCooldown = 35000;
  let flipDuration = 7000;
  let flipUntil = 0;
  let nextFlipAt = 0;
  let nextRushAt = 0;
  let rushInterval = 18000;
  let gravityUp = false;
  let clearFlash = 0;
  let particles = [];

  function featureOn(name) {
    return !!(mode.features && mode.features[name]);
  }

  function getThemeMeta() {
    return THEME_META[visualTheme] || THEME_META.cyber;
  }

  function getBodyThemeClass() {
    const m = document.body.className.match(/theme-(\w+)/);
    return m ? m[1] : 'cyber';
  }

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function rotate(m) {
    const n = m.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) out[x][n - 1 - y] = m[y][x];
    return out;
  }

  function bag() {
    const b = [...KEYS];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }
  let bagQueue = bag();

  function nextPieceKey() {
    if (!bagQueue.length) bagQueue = bag();
    return bagQueue.pop();
  }

  function makePiece(key) {
    const shape = SHAPES[key];
    return {
      key,
      m: shape.m.map(r => [...r]),
      c: shape.c,
      x: Math.floor((COLS - shape.m[0].length) / 2),
      y: gravityUp ? ROWS - shape.m.length : 0
    };
  }

  function collides(px, py, m) {
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
        if (grid[gy][gx]) return true;
        if (ghostAt(gx, gy)) return true;
      }
    }
    return false;
  }

  function ghostAt(x, y) {
    return ghosts.some(g => g.x === x && g.y === y);
  }

  function ghostDropY() {
    if (!piece) return 0;
    let gy = piece.y;
    const dy = gravityUp ? -1 : 1;
    while (!collides(piece.x, gy + dy, piece.m)) gy += dy;
    return gy;
  }

  function spawnFromKey(key) {
    piece = makePiece(key);
    if (collides(piece.x, piece.y, piece.m)) {
      gameOver();
      return false;
    }
    return true;
  }

  function spawn() {
    if (!spawnFromKey(nextKey)) return false;
    nextKey = nextPieceKey();
    canHold = true;
    updateHoldUI();
    drawPreview();
    return true;
  }

  function swapHold() {
    if (!featureOn('hold') || !canHold || !piece || !running || paused) return;

    if (holdKey === null) {
      holdKey = piece.key;
      spawnFromKey(nextKey);
      nextKey = nextPieceKey();
    } else {
      const tmp = holdKey;
      holdKey = piece.key;
      if (!spawnFromKey(tmp)) {
        holdKey = piece.key;
        piece.key = tmp;
        return;
      }
    }

    canHold = false;
    document.getElementById('hold-panel')?.classList.add('hold-flash');
    setTimeout(() => document.getElementById('hold-panel')?.classList.remove('hold-flash'), 250);
    drawHold();
    drawPreview();
    drawBoard();
    updateHoldUI();
  }

  function lock() {
    const cells = [];
    for (let y = 0; y < piece.m.length; y++) {
      for (let x = 0; x < piece.m[y].length; x++) {
        if (!piece.m[y][x]) continue;
        const gx = piece.x + x;
        const gy = piece.y + y;
        if (gy >= 0) {
          grid[gy][gx] = piece.c;
          cells.push({ x: gx, y: gy, c: piece.c });
        }
      }
    }
    if (mode.id === 'ghost-noir') {
      const expire = performance.now() + 4000;
      cells.forEach(c => ghosts.push({ ...c, expire, alpha: 0.4 }));
    }
    clearLines();
    if (mode.id === 'fox-bite') maybeBite();
    spawn();
  }

  function pushGarbageRow() {
    const holes = new Set();
    const holeCount = 2 + (Math.random() > 0.6 ? 1 : 0);
    while (holes.size < holeCount) holes.add(Math.floor(Math.random() * COLS));

    const row = Array.from({ length: COLS }, (_, x) =>
      holes.has(x) ? null : (SHAPES[KEYS[Math.floor(Math.random() * KEYS.length)]].c)
    );

    grid.shift();
    grid.push(row);

    if (piece && collides(piece.x, piece.y, piece.m)) {
      gameOver();
      return;
    }
    score = Math.max(0, score - 25);
    updateStats();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(c => c)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (!cleared) return;

    clearFlash = performance.now();
    document.getElementById('board-shell')?.classList.add('line-flash');
    setTimeout(() => document.getElementById('board-shell')?.classList.remove('line-flash'), 350);

    const now = performance.now();
    if (mode.id === 'chain-forge' && now - lastClearAt < 2500) combo++;
    else combo = 1;
    lastClearAt = now;

    const base = [0, 100, 300, 500, 800][cleared] || 800;
    const mult = mode.id === 'chain-forge' ? combo : 1;
    score += base * level * mult;
    lines += cleared;
    level = 1 + Math.floor(lines / 10);
    dropMs = Math.max(120, 800 - (level - 1) * 60);

    if (mode.id === 'fox-bite') {
      biteProgress = Math.min(8, biteProgress + cleared);
      updateModeStats();
    }
    updateStats();
  }

  function maybeBite() {
    if (mode.id !== 'fox-bite' || biteProgress < 8) return;
    biteProgress = 0;
    updateModeStats();
    const filled = [];
    for (let y = 0; y < ROWS - 2; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) filled.push({ x, y });
      }
    }
    for (let i = 0; i < 5 && filled.length; i++) {
      const idx = Math.floor(Math.random() * filled.length);
      const cell = filled.splice(idx, 1)[0];
      grid[cell.y][cell.x] = null;
    }
    score += 50;
  }

  function hardDrop() {
    const dy = gravityUp ? -1 : 1;
    while (!collides(piece.x, piece.y + dy, piece.m)) {
      piece.y += dy;
      score += 2;
    }
    lock();
    updateStats();
  }

  function move(dx) {
    if (!collides(piece.x + dx, piece.y, piece.m)) piece.x += dx;
  }

  function softDrop() {
    const dy = gravityUp ? -1 : 1;
    if (!collides(piece.x, piece.y + dy, piece.m)) {
      piece.y += dy;
      score += 1;
      updateStats();
      return true;
    }
    lock();
    return false;
  }

  function tryRotate() {
    const nm = rotate(piece.m);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!collides(piece.x + k, piece.y, nm)) {
        piece.m = nm;
        piece.x += k;
        return;
      }
    }
  }

  function tickGhosts() {
    const now = performance.now();
    ghosts = ghosts.filter(g => g.expire > now);
  }

  function tickGravityFlip(now) {
    if (mode.id !== 'gravity-flip') return;
    if (!nextFlipAt) nextFlipAt = now + flipCooldown;
    if (!gravityUp && now >= nextFlipAt) {
      gravityUp = true;
      flipUntil = now + flipDuration;
    }
    if (gravityUp && now >= flipUntil) {
      gravityUp = false;
      nextFlipAt = now + flipCooldown;
    }
    const el = document.getElementById('stat-flip');
    if (el) {
      el.textContent = gravityUp
        ? '↑ ' + Math.ceil((flipUntil - now) / 1000) + 's'
        : '↓ ' + Math.ceil((nextFlipAt - now) / 1000) + 's';
    }
  }

  function tickGarbageRush(now) {
    if (!featureOn('rush')) return;
    if (!nextRushAt) nextRushAt = now + rushInterval;
    const el = document.getElementById('stat-rush');
    if (el) el.textContent = Math.ceil((nextRushAt - now) / 1000) + 's';
    if (now >= nextRushAt) {
      pushGarbageRow();
      const interval = Math.max(12000, 18000 - lines * 80);
      nextRushAt = now + interval;
    }
  }

  function drawBlockStyled(c, x, y, color, alpha, ghost) {
    const px = x * BLOCK;
    const py = y * BLOCK;
    const pad = ghost ? 2 : 1;
    const w = BLOCK - pad * 2;
    const h = BLOCK - pad * 2;
    const style = getThemeMeta().block;

    c.globalAlpha = alpha ?? 1;

    if (ghost) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.globalAlpha = 0.32;
      if (style === 'pixel') c.strokeRect(px + pad, py + pad, w, h);
      else {
        c.beginPath();
        c.roundRect(px + pad, py + pad, w, h, style === 'neon' ? 0 : 3);
        c.stroke();
      }
      c.globalAlpha = 1;
      return;
    }

    const drawFill = (radius) => {
      c.fillStyle = color;
      c.beginPath();
      if (radius === 0) c.rect(px + pad, py + pad, w, h);
      else c.roundRect(px + pad, py + pad, w, h, radius);
      c.fill();
    };

    switch (style) {
      case 'flat':
        drawFill(2);
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 1;
        c.strokeRect(px + pad + 0.5, py + pad + 0.5, w - 1, h - 1);
        c.fillStyle = 'rgba(255,255,255,0.04)';
        c.fillRect(px + pad + 1, py + pad + 1, w - 2, 1);
        break;

      case 'pixel':
        c.shadowBlur = 0;
        drawFill(0);
        c.fillStyle = 'rgba(255,255,255,0.28)';
        c.fillRect(px + pad, py + pad, w, 2);
        c.fillStyle = 'rgba(0,0,0,0.38)';
        c.fillRect(px + pad, py + pad + h - 2, w, 2);
        break;

      case 'neon':
        c.shadowColor = color;
        c.shadowBlur = 10;
        drawFill(3);
        c.shadowBlur = 0;
        c.strokeStyle = 'rgba(255,255,255,0.65)';
        c.lineWidth = 1;
        c.strokeRect(px + pad + 1, py + pad + 1, w - 2, h - 2);
        break;

      case 'ember':
        c.shadowColor = color;
        c.shadowBlur = 6;
        drawFill(4);
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,210,130,0.28)';
        c.fillRect(px + pad + 2, py + pad + 2, w - 4, 2);
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(px + pad + 2, py + pad + h - 4, w - 4, 2);
        break;

      case 'crystal':
        drawFill(4);
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 1;
        c.strokeRect(px + pad + 0.5, py + pad + 0.5, w - 1, h - 1);
        c.fillStyle = 'rgba(255,255,255,0.22)';
        c.fillRect(px + pad + 2, py + pad + 2, w * 0.4, 2);
        break;

      case 'bubble':
        c.shadowColor = color;
        c.shadowBlur = 5;
        drawFill(5);
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.22)';
        c.beginPath();
        c.arc(px + pad + w * 0.32, py + pad + h * 0.26, w * 0.1, 0, Math.PI * 2);
        c.fill();
        break;

      case 'matte':
        drawFill(4);
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(px + pad + 1, py + pad + 1, w - 2, 2);
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(px + pad, py + pad + h - 3, w, 3);
        break;

      case 'arcade':
        drawFill(2);
        c.strokeStyle = '#fff';
        c.lineWidth = 2;
        c.strokeRect(px + pad, py + pad, w, h);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(px + pad + 2, py + pad + h - 4, w - 4, 3);
        break;

      case 'synth':
        c.shadowColor = '#ff6bcb';
        c.shadowBlur = 8;
        drawFill(2);
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(px + pad + 1, py + pad + 1, w - 2, 2);
        break;

      case 'glass-cyber':
        c.shadowColor = color;
        c.shadowBlur = 8;
        drawFill(5);
        c.shadowBlur = 0;
        const cg = c.createLinearGradient(px + pad, py + pad, px + pad, py + pad + h);
        cg.addColorStop(0, 'rgba(255,255,255,0.26)');
        cg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        cg.addColorStop(1, 'rgba(0,0,0,0.32)');
        c.fillStyle = cg;
        c.beginPath();
        c.roundRect(px + pad, py + pad, w, h, 5);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.1)';
        c.lineWidth = 1;
        c.strokeRect(px + pad + 0.5, py + pad + 0.5, w - 1, h - 1);
        break;

      default:
        c.shadowColor = color;
        c.shadowBlur = visualTheme === 'noir' ? 0 : 10;
        drawFill(4);
        c.shadowBlur = 0;
        const g = c.createLinearGradient(px, py, px, py + h);
        g.addColorStop(0, 'rgba(255,255,255,0.28)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(px + pad, py + pad, w, h, 4);
        c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--board-bg').trim() || '#030408';
    ctx.fillRect(0, 0, board.width, board.height);

    const gridAlpha = visualTheme === 'retro' ? 0.08 : 0.035;
    ctx.strokeStyle = `rgba(255,255,255,${gridAlpha})`;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK + 0.5, 0);
      ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK + 0.5);
      ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      ctx.stroke();
    }

    if (clearFlash && performance.now() - clearFlash < 200) {
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(0, 0, board.width, board.height);
    }
  }

  function drawBoard() {
    drawGrid();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawBlockStyled(ctx, x, y, grid[y][x]);
      }
    }
    ghosts.forEach(g => {
      const t = (g.expire - performance.now()) / 4000;
      drawBlockStyled(ctx, g.x, g.y, g.c, Math.max(0.12, t * g.alpha));
    });
    if (piece) {
      const gy = ghostDropY();
      if (gy !== piece.y) {
        for (let y = 0; y < piece.m.length; y++) {
          for (let x = 0; x < piece.m[y].length; x++) {
            if (piece.m[y][x]) drawBlockStyled(ctx, piece.x + x, gy + y, piece.c, 1, true);
          }
        }
      }
      for (let y = 0; y < piece.m.length; y++) {
        for (let x = 0; x < piece.m[y].length; x++) {
          if (piece.m[y][x]) drawBlockStyled(ctx, piece.x + x, piece.y + y, piece.c);
        }
      }
    }
  }

  function drawMiniPiece(c, key, w, h) {
    c.fillStyle = getComputedStyle(document.body).getPropertyValue('--board-bg').trim() || '#030408';
    c.fillRect(0, 0, w, h);
    if (!key) return;
    const shape = SHAPES[key];
    const m = shape.m;
    const size = 22;
    const ox = Math.floor((w - m[0].length * size) / 2);
    const oy = Math.floor((h - m.length * size) / 2);
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        c.save();
        c.translate(ox + x * size, oy + y * size);
        c.scale(size / BLOCK, size / BLOCK);
        drawBlockStyled(c, 0, 0, shape.c);
        c.restore();
      }
    }
  }

  function drawPreview() {
    drawMiniPiece(pctx, nextKey, preview.width, preview.height);
  }

  function drawHold() {
    drawMiniPiece(hctx, holdKey, holdCanvas.width, holdCanvas.height);
  }

  function loadHs() {
    try { return JSON.parse(localStorage.getItem(HS_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveHs() {
    const all = loadHs();
    if (score > (all[mode.id] || 0)) {
      all[mode.id] = score;
      localStorage.setItem(HS_KEY, JSON.stringify(all));
    }
    document.getElementById('stat-hs').textContent = all[mode.id] || 0;
  }

  function updateStats() {
    document.getElementById('stat-score').textContent = score;
    document.getElementById('stat-lines').textContent = lines;
    document.getElementById('stat-level').textContent = level;
    document.getElementById('stat-combo').textContent =
      mode.id === 'chain-forge' && combo > 1 ? '×' + combo : '—';
  }

  function updateModeStats() {
    if (mode.id === 'fox-bite') {
      document.getElementById('stat-bite').textContent = Math.round((biteProgress / 8) * 100) + '%';
    }
  }

  function updateHoldUI() {
    const panel = document.getElementById('hold-panel');
    const btn = document.getElementById('btn-hold');
    if (!featureOn('hold')) return;
    panel.hidden = false;
    btn.disabled = !canHold || !running || paused;
    panel.classList.toggle('active-slot', canHold && running);
  }

  function renderControls() {
    const list = document.getElementById('ctrl-list');
    const items = [
      ['←', '→', 'рух'],
      ['↑', 'поворот'],
      ['↓', 'soft drop'],
      ['Space', 'hard drop'],
      ['P', 'пауза']
    ];
    if (featureOn('hold')) items.splice(4, 0, ['C', 'hold swap']);
    list.innerHTML = items.map(([a, b]) => {
      const keys = a.includes('/') ? a.split('/').map(k => `<kbd>${k.trim()}</kbd>`).join('') : `<kbd>${a}</kbd>`;
      return `<li>${keys} ${b || ''}</li>`;
    }).join('');
  }

  function updateModeUI() {
    document.getElementById('mode-hint').textContent = mode.hint;
    document.getElementById('stat-bite-wrap').hidden = mode.id !== 'fox-bite';
    document.getElementById('stat-flip-wrap').hidden = mode.id !== 'gravity-flip';
    document.getElementById('stat-rush-wrap').hidden = !featureOn('rush');
    document.getElementById('hold-panel').hidden = !featureOn('hold');
    document.getElementById('stat-hs').textContent = loadHs()[mode.id] || 0;
    renderControls();
    updateModeStats();
    updateHoldUI();
    drawHold();
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(animId);
    saveHs();
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('overlay-title').textContent = 'GAME OVER';
    document.getElementById('overlay-msg').textContent = `Score ${score} · Lines ${lines}`;
    document.getElementById('btn-start').textContent = '↻ ЩЕ РАЗ';
    document.getElementById('btn-pause').hidden = true;
    updateHoldUI();
  }

  function resetGame() {
    grid = emptyGrid();
    ghosts = [];
    holdKey = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    biteProgress = 0;
    dropMs = 800;
    gravityUp = false;
    nextFlipAt = 0;
    flipUntil = 0;
    nextRushAt = 0;
    rushInterval = 18000;
    bagQueue = bag();
    nextKey = nextPieceKey();
    updateStats();
    updateModeStats();
    drawHold();
    spawn();
    drawBoard();
  }

  function loop(now) {
    if (!running || paused) return;
    tickGhosts();
    tickGravityFlip(now);
    tickGarbageRush(now);
    if (now - lastDrop >= dropMs) {
      softDrop();
      lastDrop = now;
    }
    drawBoard();
    animId = requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    running = true;
    paused = false;
    lastDrop = performance.now();
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('btn-start').textContent = '▶ СТАРТ';
    document.getElementById('btn-pause').hidden = false;
    updateHoldUI();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function stopToOverlay(title, msg) {
    running = false;
    paused = false;
    cancelAnimationFrame(animId);
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('btn-pause').hidden = true;
    updateHoldUI();
    drawBoard();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (!paused) {
      lastDrop = performance.now();
      document.getElementById('overlay').classList.add('hidden');
      document.getElementById('btn-pause').textContent = '⏸ ПАУЗА';
      animId = requestAnimationFrame(loop);
    } else {
      document.getElementById('overlay').classList.remove('hidden');
      document.getElementById('overlay-title').textContent = 'PAUSE';
      document.getElementById('overlay-msg').textContent = 'P — продовжити';
      document.getElementById('btn-pause').textContent = '▶ ПРОДОВЖИТИ';
    }
    updateHoldUI();
  }

  function setRule(rule, btn) {
    const wasRunning = running;
    if (wasRunning) {
      running = false;
      cancelAnimationFrame(animId);
    }
    mode = rule;
    document.querySelectorAll('#rule-bar .mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateModeUI();
    if (wasRunning) startGame();
    else {
      resetGame();
      stopToOverlay('FOX STACK', mode.hint);
    }
  }

  function setTheme(theme, btn) {
    visualTheme = theme;
    document.body.className = 'theme-' + theme;
    document.querySelectorAll('#theme-bar .mode-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    const scan = document.getElementById('scanlines');
    if (scan) scan.style.opacity = getComputedStyle(document.body).getPropertyValue('--scan-op');
    initParticles();
    drawBoard();
    drawPreview();
    drawHold();
  }

  function buildRuleBar() {
    const bar = document.getElementById('rule-bar');
    RULES.forEach((r, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-btn' + (i === 0 ? ' active' : '');
      btn.textContent = `${r.icon} ${r.name}`.toUpperCase();
      btn.addEventListener('click', () => setRule(r, btn));
      bar.appendChild(btn);
    });
  }

  function resizeBg() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }

  function initParticles() {
    particles = [];
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#dc7a14';
    const accent2 = getComputedStyle(document.body).getPropertyValue('--accent2').trim() || '#5a8cff';
    const kind = getThemeMeta().particle;
    const n = Math.min(56, Math.floor(window.innerWidth / 24));

    for (let i = 0; i < n; i++) {
      const p = {
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        r: Math.random() * 2.2 + 0.4,
        vy: Math.random() * 0.5 + 0.1,
        vx: (Math.random() - 0.5) * 0.25,
        c: Math.random() > 0.5 ? accent : accent2,
        a: Math.random() * 0.35 + 0.08,
        kind
      };
      if (kind === 'matrix') { p.vy = Math.random() * 2 + 1; p.r = 1.2; }
      if (kind === 'snow') { p.vy = Math.random() * 0.6 + 0.2; p.vx *= 0.5; }
      if (kind === 'ember') { p.vy = -(Math.random() * 0.8 + 0.2); }
      if (kind === 'bubble') { p.vy = -(Math.random() * 0.4 + 0.1); p.r *= 1.5; }
      particles.push(p);
    }
  }

  function drawParticles() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      const outBottom = p.y > bgCanvas.height + 8;
      const outTop = p.y < -8;
      if (p.kind === 'ember' || p.kind === 'bubble') {
        if (outTop) { p.y = bgCanvas.height + 4; p.x = Math.random() * bgCanvas.width; }
      } else if (outBottom) {
        p.y = -4;
        p.x = Math.random() * bgCanvas.width;
      }
      if (p.x < 0) p.x = bgCanvas.width;
      if (p.x > bgCanvas.width) p.x = 0;

      bgCtx.globalAlpha = p.a;
      if (p.kind === 'matrix') {
        bgCtx.fillStyle = p.c;
        bgCtx.fillRect(p.x, p.y, 2, 8 + Math.random() * 10);
      } else {
        bgCtx.beginPath();
        bgCtx.fillStyle = p.c;
        bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgCtx.fill();
      }
    });
    bgCtx.globalAlpha = 1;
    requestAnimationFrame(drawParticles);
  }

  document.querySelectorAll('#theme-bar .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme, btn));
  });

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('btn-hold').addEventListener('click', swapHold);

  document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (e.key === 'c' || e.key === 'C') {
      if (running && !paused && featureOn('hold')) {
        e.preventDefault();
        swapHold();
      }
      return;
    }
    if (!running || paused) {
      if (e.code === 'Space') { e.preventDefault(); startGame(); }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a') move(-1);
    else if (e.key === 'ArrowRight' || e.key === 'd') move(1);
    else if (e.key === 'ArrowUp' || e.key === 'w') tryRotate();
    else if (e.key === 'ArrowDown' || e.key === 's') softDrop();
    else if (e.code === 'Space') { e.preventDefault(); hardDrop(); }
    drawBoard();
  });

  buildRuleBar();
  updateModeUI();
  resizeBg();
  initParticles();
  drawParticles();
  window.addEventListener('resize', () => { resizeBg(); initParticles(); });
  resetGame();
  stopToOverlay('FOX STACK', mode.hint);
})();
