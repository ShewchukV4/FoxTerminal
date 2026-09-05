/* ================================================================
   FOX SNAKE — main.js
   ================================================================ */

// ===== THEME SYSTEM =====
const THEME_VARS = {
  default:  { '--bg':'#0d0d0f','--surface':'#161618','--surface2':'#1e1e21','--text':'#e8e8f0','--muted':'#6b6b80','--accent':'#00f5d4','--accent2':'#a78bfa','--accent3':'#f5a623','--wrong':'#ff4d6d' },
  neon:     { '--bg':'#050510','--surface':'#0d0d25','--surface2':'#15153a','--text':'#e0e0ff','--muted':'#5050a0','--accent':'#ff00ff','--accent2':'#00ffff','--accent3':'#ffff00','--wrong':'#ff4d6d' },
  retro:    { '--bg':'#0a0a00','--surface':'#111100','--surface2':'#1a1a00','--text':'#00ff41','--muted':'#005514','--accent':'#00ff41','--accent2':'#ffff00','--accent3':'#ff6600','--wrong':'#ff0000' },
  ocean:    { '--bg':'#020b18','--surface':'#041428','--surface2':'#071f3d','--text':'#c8e8f8','--muted':'#2a5070','--accent':'#00b4d8','--accent2':'#48cae4','--accent3':'#0077b6','--wrong':'#ff6b6b' },
  espresso: { '--bg':'#1a0f0a','--surface':'#241510','--surface2':'#2e1c14','--text':'#e8d5c0','--muted':'#7a5c40','--accent':'#d4713a','--accent2':'#e8a96e','--accent3':'#c45a1e','--wrong':'#ff4d4d' },
  midnight: { '--bg':'#07071a','--surface':'#0e0e2e','--surface2':'#151540','--text':'#d0d0f0','--muted':'#3a3a70','--accent':'#818cf8','--accent2':'#c084fc','--accent3':'#67e8f9','--wrong':'#f87171' },
  forest:   { '--bg':'#030f06','--surface':'#071a0c','--surface2':'#0c2612','--text':'#d4f0d4','--muted':'#3a6b3a','--accent':'#4ade80','--accent2':'#86efac','--accent3':'#fde68a','--wrong':'#f87171' },
  lava:     { '--bg':'#100305','--surface':'#1e0508','--surface2':'#2d070c','--text':'#f0d0c0','--muted':'#7a2a1a','--accent':'#ff4500','--accent2':'#ff8c00','--accent3':'#ffd700','--wrong':'#ff0000' }
};

function setTheme(name, btn) {
  document.querySelectorAll('.mode-switcher .mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const vars = THEME_VARS[name] || THEME_VARS.default;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.setProperty('--glow', `0 0 20px ${vars['--accent']}`);
  refreshPalette();
  S.theme = name;
  saveSettings();
  rebuildThemeDecor();
  needsRedraw = true;
}

function setAccent(color, el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--glow', `0 0 20px ${color}`);
  refreshPalette();
  S.accent = color;
  saveSettings();
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const PAL = {
  bg: '#0d0d0f',
  surface: '#161618',
  surface2: '#1e1e21',
  accent: '#00f5d4',
  accent2: '#a78bfa',
  wrong: '#ff4d6d',
  muted: '#6b6b80'
};

function refreshPalette() {
  PAL.bg = getCssVar('--bg');
  PAL.surface = getCssVar('--surface');
  PAL.surface2 = getCssVar('--surface2');
  PAL.accent = getCssVar('--accent');
  PAL.accent2 = getCssVar('--accent2');
  PAL.wrong = getCssVar('--wrong');
  PAL.muted = getCssVar('--muted');
}

// ===== TABS =====
function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'stats') renderStats();
  if (name === 'achievements') renderAchievements();
}

// ===== SETTINGS =====
const DEFAULT_SETTINGS = {
  theme: 'default', accent: '#00f5d4',
  speed: 'normal', boardSize: 'medium',
  snakeStyle: 'block', snakeSkin: 'classic', foodStyle: 'dot',
  showGrid: true, particles: true,
  showEyes: true, trail: false,
  sound: true, foodPulse: true,
  scoreOnCanvas: false, bgParticles: true,
  themeDecor: true, vectorDecor: true,
  decorDensity: 'normal', renderScale: 'hd'
};
let S = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try { S = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('foxsnake-settings') || '{}') }; } catch(e) {}
  applySettings();
}

function applySettings() {
  // Theme
  const themeBtn = document.querySelector(`.mode-btn[onclick*="'${S.theme}'"]`);
  setTheme(S.theme, themeBtn);
  if (S.accent) setAccent(S.accent, null);

  // Selects
  const spd = document.getElementById('set-speed'); if (spd) spd.value = S.speed;
  const brd = document.getElementById('set-board'); if (brd) brd.value = S.boardSize;
  const decor = document.getElementById('set-decor-density'); if (decor) decor.value = S.decorDensity || 'normal';
  const renderScale = document.getElementById('set-render-scale'); if (renderScale) renderScale.value = S.renderScale || 'hd';

  // Toggles
  const togMap = {
    'tog-grid': 'showGrid', 'tog-particles': 'particles', 'tog-eyes': 'showEyes',
    'tog-trail': 'trail', 'tog-sound': 'sound', 'tog-foodpulse': 'foodPulse',
    'tog-onscore': 'scoreOnCanvas', 'tog-bgpart': 'bgParticles',
    'tog-themedecor': 'themeDecor', 'tog-vectordecor': 'vectorDecor'
  };
  for (const [id, key] of Object.entries(togMap)) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('on', !!S[key]);
  }

  // Style chips
  document.querySelectorAll('[id^="style-"]').forEach(b => b.classList.remove('active'));
  const styleEl = document.getElementById('style-' + S.snakeStyle);
  if (styleEl) styleEl.classList.add('active');

  document.querySelectorAll('[id^="skin-"]').forEach(b => b.classList.remove('active'));
  const skinEl = document.getElementById('skin-' + (S.snakeSkin || 'classic'));
  if (skinEl) skinEl.classList.add('active');

  document.querySelectorAll('[id^="food-"]').forEach(b => b.classList.remove('active'));
  const foodEl = document.getElementById('food-' + S.foodStyle);
  if (foodEl) foodEl.classList.add('active');
}

function saveSettings() { localStorage.setItem('foxsnake-settings', JSON.stringify(S)); }
function saveSetting(key, value) {
  S[key] = value;
  saveSettings();
  if ((key === 'boardSize' || key === 'renderScale') && !gameRunning) drawIdleBoard();
  if (key === 'boardSize' || key === 'decorDensity' || key === 'themeDecor') rebuildThemeDecor();
  if (key === 'renderScale' && gameRunning) initBoard();
  needsRedraw = true;
}

function toggleSetting(key, el) {
  S[key] = !S[key];
  el.classList.toggle('on', S[key]);
  saveSettings();
  if (key === 'bgParticles') bgAnimRunning = S.bgParticles;
  if (key === 'themeDecor') rebuildThemeDecor();
  needsRedraw = true;
}

function setSnakeStyle(style, btn) {
  document.querySelectorAll('[id^="style-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  S.snakeStyle = style; saveSettings();
}
function setSnakeSkin(skin, btn) {
  document.querySelectorAll('[id^="skin-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  S.snakeSkin = skin;
  saveSettings();
  needsRedraw = true;
}
function setFoodStyle(style, btn) {
  document.querySelectorAll('[id^="food-"]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  S.foodStyle = style; saveSettings();
}
function resetAllData() {
  if (!confirm('Скинути всі дані? Це незворотньо!')) return;
  ['foxsnake-settings','foxsnake-stats','foxsnake-achievements','foxsnake-history'].forEach(k => localStorage.removeItem(k));
  location.reload();
}

// ===== GAME MODES =====
const MODES = {
  portal: false, ghost: false, gravity: false, multifood: false,
  shrink: false, obstacles: false, speedup: false, invisible: false,
  zen: false, dark: false
};

function toggleChip(mode, el) {
  MODES[mode] = !MODES[mode];
  el.classList.toggle('active', MODES[mode]);
  updateActiveBadge();
}
function updateActiveBadge() {
  const active = Object.entries(MODES).filter(([,v]) => v).map(([k]) => k.toUpperCase());
  const el = document.getElementById('active-modes-badge');
  if (el) el.textContent = active.length ? 'Активні режими: ' + active.join(' · ') : '';
}

// ===== CANVAS & BOARD =====
const canvas  = document.getElementById('game-canvas');
const ctx     = canvas.getContext('2d');

const SPEED_MS     = { slug: 230, slow: 160, normal: 110, fast: 65, insane: 32 };
const BOARD_SIZES  = { tiny: [15,15], small: [20,20], medium: [28,28], large: [36,36] };
const RENDER_SCALES = { pixel: 1, hd: 2, ultra: 3 };
let COLS, ROWS, CELL, BOARD_PIXELS = 0, RENDER_SCALE = 1;

function initBoard() {
  [COLS, ROWS] = BOARD_SIZES[S.boardSize] || [28,28];
  const wrap = document.getElementById('canvas-wrap');
  const maxSize = Math.min(560, (wrap.clientWidth || 560) - 2);
  const gridSize = Math.max(COLS, ROWS);
  CELL = Math.max(1, Math.floor(maxSize / gridSize));
  const size = CELL * gridSize;
  BOARD_PIXELS = size;
  RENDER_SCALE = RENDER_SCALES[S.renderScale] || 2;
  canvas.width  = size * RENDER_SCALE;
  canvas.height = size * RENDER_SCALE;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
}

// ===== GAME STATE =====
let snake, food, obstacles, dir, nextDir;
let score, level, foodEaten, maxLength, elapsed;
let gameRunning = false, gamePaused = false;
let gameInterval = null, startTime = 0;
let trailBuf = [];
let foodPulseAngle = 0;
let particles = [];
let decorItems = [];
let decorKey = '';
let lastRenderTs = 0;
let needsRedraw = true;
let cachedHighScore = 0;
const MAX_RENDER_FPS = 45;

// ===== INIT GAME =====
function initGame() {
  initBoard();
  const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
  snake = [{ x:mx, y:my }, { x:mx-1, y:my }, { x:mx-2, y:my }];
  dir = { x:1, y:0 };
  nextDir = { x:1, y:0 };
  score = 0; level = 1; foodEaten = 0; maxLength = 3; elapsed = 0;
  trailBuf = []; food = []; obstacles = []; particles = [];
  rebuildThemeDecor();

  spawnFood();
  if (MODES.multifood) { spawnFood(); spawnFood(); }
  if (MODES.obstacles) spawnObstacles();
  updateUI();
}

function spawnFood() {
  for (let i = 0; i < 300; i++) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (isFree(x, y)) {
      const r = Math.random();
      const type = r < 0.05 ? 'golden' : r < 0.13 ? 'bonus' : 'normal';
      food.push({ x, y, type, age: Math.random() * Math.PI * 2 });
      return;
    }
  }
}

function spawnObstacles() {
  const count = Math.max(2, Math.floor(COLS * ROWS * 0.03));
  for (let i = 0; i < count * 5; i++) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (isFree(x, y) && obstacles.length < count) obstacles.push({ x, y });
    if (obstacles.length >= count) break;
  }
}

function isFree(x, y) {
  return !snake.some(s => s.x===x && s.y===y)
      && !food.some(f => f.x===x && f.y===y)
      && !obstacles.some(o => o.x===x && o.y===y);
}

// ===== GAME LOOP =====
function startGame() {
  if (gameRunning) stopGame();
  initGame();
  gameRunning = true;
  gamePaused  = false;
  startTime   = Date.now();
  cachedHighScore = loadStatsData().highScore || 0;
  needsRedraw = true;
  lastRenderTs = 0;

  document.getElementById('game-overlay').classList.remove('show');
  document.getElementById('start-btn').style.display  = 'none';
  document.getElementById('pause-btn').style.display  = '';
  document.getElementById('stop-btn').style.display   = '';
  document.getElementById('pause-btn').textContent    = '⏸ ПАУЗА';

  const ms = SPEED_MS[S.speed] || 110;
  gameInterval = setInterval(gameStep, ms);
  requestAnimationFrame(drawLoop);
}

function stopGame() {
  gameRunning = false;
  gamePaused  = false;
  clearInterval(gameInterval);
  document.getElementById('start-btn').style.display  = '';
  document.getElementById('pause-btn').style.display  = 'none';
  document.getElementById('stop-btn').style.display   = 'none';
  showOverlay('SERPENT FOX', false);
}

function pauseGame() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  document.getElementById('pause-btn').textContent = gamePaused ? '▶ ПРОДОВЖ.' : '⏸ ПАУЗА';
  if (gamePaused) {
    draw();
  } else {
    requestAnimationFrame(drawLoop);
  }
}

function gameStep() {
  if (!gameRunning || gamePaused) return;

  // Gravity: occasionally pull down when moving horizontally
  if (MODES.gravity && dir.x !== 0 && Math.random() < 0.35) {
    if (dir.x !== 0) nextDir = { x:0, y:1 };
  }

  dir = { ...nextDir };

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall handling
  if (MODES.portal || MODES.zen) {
    head.x = ((head.x % COLS) + COLS) % COLS;
    head.y = ((head.y % ROWS) + ROWS) % ROWS;
  } else {
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      triggerDeath(); return;
    }
  }

  // Self collision
  if (!MODES.ghost && !MODES.zen) {
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      triggerDeath(); return;
    }
  }

  // Obstacle collision
  if (!MODES.zen && obstacles.some(o => o.x === head.x && o.y === head.y)) {
    triggerDeath(); return;
  }

  // Push to trail
  if (S.trail && trailBuf.length < 200) trailBuf.push({ ...snake[snake.length - 1], age: 0 });

  // Tag segment with timestamp for invisible mode
  if (MODES.invisible) head.born = Date.now();

  snake.unshift(head);

  // Check food
  const fi = food.findIndex(f => f.x === head.x && f.y === head.y);
  if (fi >= 0) {
    const f = food[fi];
    const pts = f.type === 'golden' ? 50 * level : f.type === 'bonus' ? 20 : 10 * level;
    score += pts;
    foodEaten++;
    maxLength = Math.max(maxLength, snake.length);
    playSound('eat');
    if (S.particles) spawnFoodParticles(head.x * CELL + CELL/2, head.y * CELL + CELL/2, f.type);

    food.splice(fi, 1);
    if (f.type === 'bonus') snake.pop(); // bonus: score but no growth

    spawnFood();
    if (MODES.multifood && food.length < 3) spawnFood();

    // Speed up mode
    if (MODES.speedup) {
      const newLevel = Math.min(10, 1 + Math.floor(foodEaten / 5));
      if (newLevel !== level) {
        level = newLevel;
        clearInterval(gameInterval);
        const ms = Math.max(28, (SPEED_MS[S.speed] || 110) - (level - 1) * 9);
        gameInterval = setInterval(gameStep, ms);
      }
    }

    // New obstacle batch every 5 eats
    if (MODES.obstacles && foodEaten % 5 === 0) spawnObstacles();

    checkAchievements();
  } else {
    snake.pop();
  }

  // Shrink mode: random tail loss
  if (MODES.shrink && snake.length > 2 && Math.random() < 0.025) snake.pop();

  // Update stats
  elapsed = Math.floor((Date.now() - startTime) / 1000);
  updateUI();
  needsRedraw = true;

  // Trail aging
  trailBuf = trailBuf.filter(t => { t.age++; return t.age < 10; });
}

// ===== INPUT =====
function setDir(x, y) {
  if (x !== 0 && dir.x !== 0) return; // prevent 180
  if (y !== 0 && dir.y !== 0) return;
  nextDir = { x, y };
}

document.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); setDir(0,-1);  break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); setDir(0,1);   break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); setDir(-1,0);  break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); setDir(1,0);   break;
    case 'p': case 'P': case 'Escape': if (gameRunning) pauseGame(); break;
    case ' ': if (!gameRunning) startGame(); else pauseGame(); break;
  }
});

// Swipe support
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
  touchStart = null;
  e.preventDefault();
}, { passive: false });

// ===== DRAW LOOP =====
function drawLoop(ts) {
  if (!gameRunning) return;
  if (gamePaused) return;

  try {
    const minFrame = 1000 / MAX_RENDER_FPS;
    if (needsRedraw || ts - lastRenderTs >= minFrame) {
      draw();
      lastRenderTs = ts;
      needsRedraw = false;
    }
  } catch (err) {
    // Keep the render loop alive even if one effect crashes.
    console.error('FoxSnake draw error:', err);
    enableSafeRenderMode();
    draw();
    needsRedraw = false;
  } finally {
    if (gameRunning && !gamePaused) requestAnimationFrame(drawLoop);
  }
}

function enableSafeRenderMode() {
  S.particles = false;
  S.foodPulse = false;
  S.trail = false;
  S.snakeStyle = 'block';
  MODES.dark = false;
  saveSettings();
  const darkChip = document.getElementById('chip-dark');
  if (darkChip) darkChip.classList.remove('active');
}

function draw() {
  const W = BOARD_PIXELS, H = BOARD_PIXELS;
  ctx.clearRect(0, 0, W, H);

  // Background fill
  ctx.fillStyle = PAL.surface;
  ctx.fillRect(0, 0, W, H);
  drawVectorBackdrop(W, H);
  drawThemeDecor();

  if (S.showGrid) drawGrid();
  obstacles.forEach(o => drawObstacle(o));
  if (S.trail) drawTrail();

  foodPulseAngle += 0.06;
  food.forEach(f => drawFood(f));

  drawSnake();
  drawParticles();

  // Dark zone overlay
  if (MODES.dark && snake.length) drawDarkOverlay();

  // Paused overlay
  if (gamePaused) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `bold ${Math.max(18, CELL)}px 'Orbitron', monospace`;
    ctx.fillStyle = PAL.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSE', W/2, H/2);
    ctx.restore();
  }

  // Score on canvas
  if (S.scoreOnCanvas && gameRunning) {
    ctx.save();
    ctx.font = `bold ${Math.max(12, CELL * 0.55)}px 'Orbitron', monospace`;
    ctx.fillStyle = PAL.accent + '99';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(score, 6, 6);
    ctx.restore();
  }
}

// ===== VECTOR BACKDROP =====
function drawVectorBackdrop(W, H) {
  if (!S.vectorDecor) return;
  const theme = S.theme || 'default';
  ctx.save();

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.72);
  glow.addColorStop(0, PAL.accent + '18');
  glow.addColorStop(0.58, PAL.accent2 + '08');
  glow.addColorStop(1, '#00000000');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (theme === 'lava') {
    drawLavaRivers(W, H);
  } else if (theme === 'forest') {
    drawForestVeins(W, H);
  } else if (theme === 'ocean') {
    drawOceanWaves(W, H);
  } else if (theme === 'neon' || theme === 'cyber') {
    drawCircuitLines(W, H);
  } else if (theme === 'midnight') {
    drawConstellationLines(W, H);
  } else if (theme === 'retro') {
    drawPixelNoise(W, H);
  } else {
    drawSoftDiagonalLines(W, H);
  }

  ctx.restore();
}

function drawLavaRivers(W, H) {
  const t = Date.now() * 0.001;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    const yBase = H * (0.22 + r * 0.24);
    for (let x = -20; x <= W + 20; x += 18) {
      const y = yBase + Math.sin(x * 0.025 + t + r * 2.1) * 16;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 8 + r * 2;
    ctx.strokeStyle = '#ff45001f';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd16655';
    ctx.stroke();
  }
}

function drawForestVeins(W, H) {
  ctx.strokeStyle = '#86efac24';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * W / 9;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.bezierCurveTo(x - 35, H * 0.65, x + 45, H * 0.35, x - 10, 0);
    ctx.stroke();
  }
}

function drawOceanWaves(W, H) {
  ctx.strokeStyle = '#48cae433';
  ctx.lineWidth = 1.5;
  for (let y = 24; y < H; y += 42) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const yy = y + Math.sin(x * 0.035 + y * 0.02) * 7;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawCircuitLines(W, H) {
  ctx.strokeStyle = PAL.accent + '28';
  ctx.lineWidth = 1;
  const step = Math.max(32, CELL * 3);
  for (let x = step; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.fillStyle = PAL.accent + '3a';
    ctx.fillRect(x - 2, (x * 1.7) % H, 4, 4);
  }
  for (let y = step; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawConstellationLines(W, H) {
  ctx.strokeStyle = '#c084fc28';
  ctx.fillStyle = '#ffffff55';
  for (let i = 0; i < 18; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
    const y = (Math.sin(i * 78.233) * 12345.6789 % 1 + 1) % 1 * H;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo((x + 70) % W, (y + 35) % H);
      ctx.stroke();
    }
  }
}

function drawPixelNoise(W, H) {
  ctx.fillStyle = '#00ff4118';
  const step = Math.max(12, CELL);
  for (let y = 0; y < H; y += step * 2) {
    for (let x = (y / step) % 2 ? step : 0; x < W; x += step * 2) {
      ctx.fillRect(x, y, Math.max(2, CELL * 0.22), Math.max(2, CELL * 0.22));
    }
  }
}

function drawSoftDiagonalLines(W, H) {
  ctx.strokeStyle = PAL.accent + '18';
  ctx.lineWidth = 1;
  for (let x = -H; x < W; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
}

// ===== THEMED DECOR =====
function rebuildThemeDecor() {
  const density = S.decorDensity || 'normal';
  const key = `${S.theme}|${COLS || 0}|${ROWS || 0}|${density}|${S.themeDecor ? 1 : 0}`;
  if (decorKey === key) return;
  decorKey = key;
  decorItems = [];
  if (!S.themeDecor || !COLS || !ROWS) return;

  const baseByDensity = { low: 14, normal: 24, high: 36 };
  const scale = Math.max(0.8, Math.min(1.6, (COLS * ROWS) / (28 * 28)));
  const count = Math.floor((baseByDensity[density] || 24) * scale);
  for (let i = 0; i < count; i++) {
    decorItems.push({
      x: Math.random() * COLS,
      y: Math.random() * ROWS,
      size: 0.4 + Math.random() * 1.1,
      seed: Math.random() * 1000
    });
  }
}

function drawThemeDecor() {
  if (!S.themeDecor) return;
  rebuildThemeDecor();
  if (!decorItems.length) return;
  const t = Date.now() * 0.001;
  const theme = S.theme || 'default';
  ctx.save();
  ctx.globalAlpha = 0.26;

  for (const d of decorItems) {
    const x = d.x * CELL + CELL / 2;
    const y = d.y * CELL + CELL / 2;
    const s = Math.max(2, CELL * d.size);
    const pulse = 0.85 + Math.sin(t + d.seed) * 0.15;

    if (theme === 'lava') {
      // Decorative lava puddles and embers, visual-only.
      ctx.fillStyle = '#ff450055';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.9, s * 0.45 * pulse, d.seed, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb34766';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.45, s * 0.2 * pulse, d.seed, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (theme === 'forest') {
      // Bushes and tiny trees, non-collidable.
      ctx.fillStyle = '#2f8a4f66';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
      ctx.arc(x + s * 0.28, y + 1, s * 0.34, 0, Math.PI * 2);
      ctx.arc(x - s * 0.26, y + 2, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ade8055';
      ctx.beginPath();
      ctx.arc(x, y - s * 0.18, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (theme === 'ocean') {
      ctx.strokeStyle = '#48cae466';
      ctx.lineWidth = Math.max(1, CELL * 0.1);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.35 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    if (theme === 'neon') {
      ctx.fillStyle = '#00ffff55';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.45);
      ctx.lineTo(x + s * 0.38, y);
      ctx.lineTo(x, y + s * 0.45);
      ctx.lineTo(x - s * 0.38, y);
      ctx.closePath();
      ctx.fill();
      continue;
    }

    if (theme === 'midnight') {
      ctx.fillStyle = '#c084fc55';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (theme === 'retro') {
      ctx.fillStyle = '#00ff4140';
      ctx.fillRect(x - s * 0.28, y - s * 0.28, s * 0.56, s * 0.56);
      continue;
    }

    if (theme === 'espresso') {
      ctx.fillStyle = '#8b5a3c55';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.35, s * 0.2, d.seed, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.fillStyle = PAL.accent + '30';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.22 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ===== GRID =====
function drawGrid() {
  ctx.save();
  ctx.strokeStyle = PAL.surface2;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.55;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, ROWS*CELL); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(COLS*CELL, y*CELL); ctx.stroke();
  }
  ctx.restore();
}

// ===== SNAKE =====
function drawSnake() {
  const accent  = PAL.accent;
  const accent2 = PAL.accent2;
  const style   = S.snakeStyle;
  const skin    = S.snakeSkin || 'classic';
  const now     = Date.now();

  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const px = seg.x * CELL, py = seg.y * CELL;
    const isHead = i === 0;
    let color = getSkinColor(skin, i, snake.length, isHead, accent, accent2);

    ctx.save();

    // Invisible mode: fade old segments
    if (MODES.invisible && !isHead && seg.born) {
      const age = (now - seg.born) / 2000;
      ctx.globalAlpha = Math.max(0, 1 - age);
    }

    // Gradient: tail fades out
    if (style === 'gradient') {
      ctx.globalAlpha = (ctx.globalAlpha ?? 1) * (1 - (i / snake.length) * 0.72);
    }

    // Neon glow
    if (style === 'neon') {
      ctx.shadowBlur = 14;
      ctx.shadowColor = accent;
    }

    ctx.fillStyle = color;
    const pad = style === 'dots' ? CELL * 0.18 : 1;
    const r = CELL - pad * 2;

    switch (style) {
      case 'rounded':
      case 'neon':
      case 'gradient':
        fillRoundRect(px + pad, py + pad, r, r, Math.min(5, CELL * 0.22));
        break;
      case 'dots':
        ctx.beginPath();
        ctx.arc(px + CELL/2, py + CELL/2, r/2, 0, Math.PI*2);
        ctx.fill();
        break;
      case 'arrows':
        if (isHead) drawArrow(px, py);
        else fillRoundRect(px + 2, py + 2, CELL-4, CELL-4, 2);
        break;
      default: // block
        ctx.fillRect(px + 1, py + 1, CELL-2, CELL-2);
    }

    drawSkinDetails(skin, px, py, isHead, i);
    ctx.restore();

    if (isHead && S.showEyes) drawEyes(px, py);
  }
}

function getSkinColor(skin, index, length, isHead, accent, accent2) {
  const k = length > 1 ? index / (length - 1) : 0;
  switch (skin) {
    case 'dragon': return isHead ? '#ff3b30' : (k < 0.5 ? '#ff8a00' : '#ffd166');
    case 'lava': return isHead ? '#ff6a00' : (k < 0.5 ? '#ff4500' : '#ff9e2c');
    case 'forest': return isHead ? '#16a34a' : (k < 0.5 ? '#22c55e' : '#86efac');
    case 'ice': return isHead ? '#7dd3fc' : (k < 0.5 ? '#38bdf8' : '#dbeafe');
    case 'cyber': return isHead ? '#00ffff' : (k < 0.5 ? '#00cfff' : '#a78bfa');
    case 'gold': return isHead ? '#fde047' : (k < 0.5 ? '#facc15' : '#f59e0b');
    case 'shadow': return isHead ? '#8b5cf6' : (k < 0.5 ? '#312e81' : '#0f172a');
    default: return isHead ? accent : accent2;
  }
}

function drawSkinDetails(skin, px, py, isHead, index) {
  const c = CELL;
  if (skin === 'dragon' || skin === 'lava') {
    if (!isHead && index % 2 === 0 && c >= 8) {
      ctx.fillStyle = '#ffe8a3aa';
      ctx.beginPath();
      ctx.moveTo(px + c * 0.5, py + c * 0.12);
      ctx.lineTo(px + c * 0.65, py + c * 0.32);
      ctx.lineTo(px + c * 0.35, py + c * 0.32);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  if (skin === 'cyber') {
    ctx.fillStyle = '#ffffff66';
    ctx.fillRect(px + c * 0.2, py + c * 0.45, c * 0.6, Math.max(1, c * 0.1));
    return;
  }
  if (skin === 'ice') {
    ctx.strokeStyle = '#ffffff66';
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.beginPath();
    ctx.moveTo(px + c * 0.3, py + c * 0.25);
    ctx.lineTo(px + c * 0.7, py + c * 0.75);
    ctx.stroke();
    return;
  }
  if (skin === 'forest') {
    ctx.fillStyle = '#bbf7d080';
    ctx.beginPath();
    ctx.arc(px + c * 0.5, py + c * 0.5, c * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (skin === 'gold') {
    ctx.fillStyle = '#fff8cc80';
    ctx.fillRect(px + c * 0.28, py + c * 0.28, c * 0.44, c * 0.44);
  }
}

function fillRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  }
  ctx.fill();
}

function drawArrow(px, py) {
  ctx.save();
  ctx.translate(px + CELL/2, py + CELL/2);
  ctx.rotate(Math.atan2(dir.y, dir.x));
  const s = CELL * 0.36;
  ctx.beginPath();
  ctx.moveTo(s, 0); ctx.lineTo(-s, -s*0.65); ctx.lineTo(-s*0.25, 0); ctx.lineTo(-s, s*0.65);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawEyes(px, py) {
  const er = Math.max(1.5, CELL * 0.1);
  const off = CELL * 0.28;
  let e1, e2;
  if      (dir.x === 1)  { e1={x:px+CELL*0.72,y:py+off};       e2={x:px+CELL*0.72,y:py+CELL-off}; }
  else if (dir.x === -1) { e1={x:px+off*0.6,  y:py+off};       e2={x:px+off*0.6,  y:py+CELL-off}; }
  else if (dir.y === -1) { e1={x:px+off,      y:py+off*0.6};   e2={x:px+CELL-off, y:py+off*0.6}; }
  else                   { e1={x:px+off,      y:py+CELL*0.72}; e2={x:px+CELL-off, y:py+CELL*0.72}; }

  ctx.save();
  ctx.fillStyle = PAL.bg;
  ctx.beginPath(); ctx.arc(e1.x, e1.y, er, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e2.x, e2.y, er, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  const pr = er * 0.5;
  ctx.beginPath(); ctx.arc(e1.x, e1.y, pr, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(e2.x, e2.y, pr, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// ===== FOOD =====
function drawFood(f) {
  const cx = f.x * CELL + CELL/2, cy = f.y * CELL + CELL/2;
  let scale = S.foodPulse ? 0.82 + Math.sin(foodPulseAngle + f.age) * 0.18 : 1;
  const color = f.type === 'golden' ? '#ffd700' : f.type === 'bonus' ? PAL.accent2 : PAL.wrong;
  const r = CELL * 0.34;

  ctx.save();
  if (S.snakeStyle === 'neon') { ctx.shadowBlur = 18; ctx.shadowColor = color; }
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;

  switch (S.foodStyle) {
    case 'apple':
      ctx.font = `${Math.max(10, CELL * 0.72)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🍎', 0, 0);
      break;
    case 'star':
      drawStarShape(0, 0, r, 5);
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0,-r); ctx.lineTo(r*0.65,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.65,0);
      ctx.closePath(); ctx.fill();
      break;
    case 'skull':
      ctx.font = `${Math.max(10, CELL * 0.68)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💀', 0, 0);
      break;
    default: // dot
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI*2);
      ctx.fill();
  }

  // Golden ring pulse
  if (f.type === 'golden') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4 + Math.sin(foodPulseAngle * 2 + f.age) * 0.3;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawStarShape(cx, cy, r, pts) {
  const inner = r * 0.44;
  ctx.beginPath();
  for (let i = 0; i < pts*2; i++) {
    const a = (i * Math.PI / pts) - Math.PI/2;
    const rad = i%2===0 ? r : inner;
    if (i===0) ctx.moveTo(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
    else ctx.lineTo(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
  }
  ctx.closePath(); ctx.fill();
}

// ===== OBSTACLES =====
function drawObstacle(o) {
  ctx.save();
  ctx.fillStyle = PAL.muted + '77';
  ctx.fillRect(o.x*CELL+1, o.y*CELL+1, CELL-2, CELL-2);
  ctx.strokeStyle = PAL.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(o.x*CELL+1, o.y*CELL+1, CELL-2, CELL-2);
  // X mark
  ctx.strokeStyle = PAL.muted + 'aa';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(o.x*CELL+4, o.y*CELL+4); ctx.lineTo(o.x*CELL+CELL-4, o.y*CELL+CELL-4);
  ctx.moveTo(o.x*CELL+CELL-4, o.y*CELL+4); ctx.lineTo(o.x*CELL+4, o.y*CELL+CELL-4);
  ctx.stroke();
  ctx.restore();
}

// ===== TRAIL =====
function drawTrail() {
  trailBuf.forEach(t => {
    ctx.save();
    ctx.globalAlpha = (1 - t.age/10) * 0.28;
    ctx.fillStyle = PAL.accent2;
    ctx.fillRect(t.x*CELL+2, t.y*CELL+2, CELL-4, CELL-4);
    ctx.restore();
  });
}

// ===== DARK ZONE =====
function drawDarkOverlay() {
  if (!snake.length) return;
  const head = snake[0];
  const cx = head.x*CELL + CELL/2, cy = head.y*CELL + CELL/2;
  const radius = CELL * 5;
  const W = BOARD_PIXELS, H = BOARD_PIXELS;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0,   'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1,   'rgba(0,0,0,0.94)');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ===== PARTICLES =====
function spawnFoodParticles(x, y, type) {
  const color = type === 'golden' ? '#ffd700' : type === 'bonus' ? PAL.accent2 : PAL.accent;
  for (let i = 0; i < 9; i++) {
    const a = (Math.PI*2 / 9) * i + Math.random() * 0.4;
    const speed = 1.4 + Math.random() * 2.2;
    particles.push({ x, y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, life: 1, color, size: 2 + Math.random()*2.5 });
  }
}

function drawParticles() {
  if (!S.particles) return;
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.038;
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

// ===== UI UPDATE =====
function updateUI() {
  document.getElementById('score-display').textContent  = score;
  document.getElementById('length-display').textContent = snake.length;
  document.getElementById('level-display').textContent  = level;
  const pct = (foodEaten % 5) * 20;
  document.getElementById('level-bar').style.width = pct + '%';
  const min = Math.floor(elapsed / 60), sec = elapsed % 60;
  document.getElementById('time-display').textContent = `${min}:${sec.toString().padStart(2,'0')}`;
  document.getElementById('hs-display').textContent = Math.max(cachedHighScore, score);
}

// ===== GAME OVER =====
function triggerDeath() {
  gameRunning = false;
  clearInterval(gameInterval);
  playSound('die');

  const stats = loadStatsData();
  const isNew = score > (stats.highScore || 0);
  saveGameStats();
  cachedHighScore = Math.max(cachedHighScore, score);

  // Update overlay
  document.getElementById('overlay-title').textContent = MODES.zen ? '✦ GG ✦' : '☠ GAME OVER';
  document.getElementById('overlay-title').style.color = MODES.zen ? PAL.accent : PAL.wrong;
  document.getElementById('ov-score').textContent  = score;
  document.getElementById('ov-length').textContent = snake.length;
  document.getElementById('ov-time').textContent   = elapsed + 's';
  document.getElementById('ov-hs').textContent     = isNew ? '🏆 ' + score : '';
  document.getElementById('ov-hs-lbl').textContent = isNew ? 'НОВИЙ РЕКОРД!' : '';
  document.getElementById('overlay-stats').style.display = 'flex';
  document.getElementById('overlay-btns').innerHTML = `
    <button class="overlay-btn primary" onclick="startGame()">↺ ЩЕ РАЗ</button>
    <button class="overlay-btn" onclick="stopGame()">✕ МЕНЮ</button>
  `;
  document.getElementById('game-overlay').classList.add('show');
  document.getElementById('start-btn').style.display = '';
  document.getElementById('pause-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display  = 'none';

  checkAchievements();
  draw(); // final frame
}

function showOverlay(title, showStats) {
  const ov = document.getElementById('game-overlay');
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-title').style.color = '';
  document.getElementById('overlay-stats').style.display = showStats ? 'flex' : 'none';
  document.getElementById('overlay-btns').innerHTML = `
    <button class="overlay-btn primary" onclick="startGame()">▶ СТАРТ</button>
    <button class="overlay-btn" onclick="switchTab('settings',document.querySelectorAll('.tab')[1])">⚙️ НАЛАШТ.</button>
  `;
  ov.classList.add('show');
}

// ===== STATS =====
function loadStatsData() {
  try { return JSON.parse(localStorage.getItem('foxsnake-stats') || '{}'); } catch(e) { return {}; }
}

function getModesKey() {
  const active = Object.entries(MODES).filter(([,v])=>v).map(([k])=>k);
  return active.length ? active.join('+') : 'classic';
}

function saveGameStats() {
  const stats = loadStatsData();
  stats.games      = (stats.games || 0) + 1;
  stats.foodEaten  = (stats.foodEaten || 0) + foodEaten;
  stats.timeTotal  = (stats.timeTotal || 0) + elapsed;
  stats.maxLength  = Math.max(stats.maxLength || 3, maxLength);
  if (!MODES.zen) stats.deaths = (stats.deaths || 0) + 1;
  if (score > (stats.highScore || 0)) stats.highScore = score;

  const mk = getModesKey();
  if (!stats.modeHS) stats.modeHS = {};
  if (!stats.modeHS[mk] || score > stats.modeHS[mk].score) {
    stats.modeHS[mk] = { score, length: snake.length, date: new Date().toLocaleDateString('uk') };
  }
  localStorage.setItem('foxsnake-stats', JSON.stringify(stats));

  // History
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('foxsnake-history') || '[]'); } catch(e) {}
  hist.unshift({ score, length: snake.length, time: elapsed, date: new Date().toLocaleDateString('uk'), modes: mk });
  if (hist.length > 20) hist.pop();
  localStorage.setItem('foxsnake-history', JSON.stringify(hist));
}

function renderStats() {
  const stats = loadStatsData();
  document.getElementById('st-games').textContent  = stats.games || 0;
  document.getElementById('st-best').textContent   = stats.highScore || 0;
  document.getElementById('st-food').textContent   = stats.foodEaten || 0;
  const sec = stats.timeTotal || 0;
  document.getElementById('st-time').textContent   = sec > 3600 ? Math.floor(sec/3600)+'h' : Math.floor(sec/60)+'m';
  document.getElementById('st-maxlen').textContent = stats.maxLength || 3;
  document.getElementById('st-deaths').textContent = stats.deaths || 0;

  // Mode HS table
  const tbody = document.getElementById('hs-table-body');
  const modeHS = stats.modeHS || {};
  const entries = Object.entries(modeHS).sort((a,b) => b[1].score - a[1].score);
  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px">Зіграй спочатку!</td></tr>';
  } else {
    tbody.innerHTML = entries.map(([mode, d], i) => `
      <tr>
        <td><span class="hs-rank">#${i+1}</span> ${mode}</td>
        <td class="hs-score">${d.score}</td>
        <td>${d.length}</td>
        <td style="color:var(--muted)">${d.date}</td>
      </tr>
    `).join('');
  }

  // History
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem('foxsnake-history') || '[]'); } catch(e) {}
  const histEl = document.getElementById('session-history');
  if (!hist.length) {
    histEl.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.8rem;padding:20px">Немає ігор</div>';
  } else {
    histEl.innerHTML = hist.map((h, i) => `
      <div class="hist-item">
        <span style="color:var(--muted);font-family:var(--font-display);font-size:0.58rem;min-width:22px">#${i+1}</span>
        <span style="color:var(--accent);font-family:var(--font-display);font-size:0.9rem;min-width:60px">${h.score}</span>
        <span style="color:var(--muted)">довж: <span style="color:var(--text)">${h.length}</span></span>
        <span style="color:var(--muted)">час: <span style="color:var(--text)">${h.time}s</span></span>
        <span style="color:var(--muted);margin-left:auto;font-size:0.7rem">${h.modes} · ${h.date}</span>
      </div>
    `).join('');
  }
}

// ===== ACHIEVEMENTS =====
const ACHIEVEMENTS = [
  { id:'first',     icon:'🐣', name:'Перший крок',     desc:'Зіграй першу гру' },
  { id:'score100',  icon:'💯', name:'Сотня',            desc:'Набери 100 очок' },
  { id:'score500',  icon:'⭐', name:'П\'ятсот',         desc:'Набери 500 очок' },
  { id:'score1000', icon:'🌟', name:'Тисяча',           desc:'Набери 1000 очок' },
  { id:'score5000', icon:'👑', name:'Легенда',          desc:'Набери 5000 очок' },
  { id:'len10',     icon:'📏', name:'Довга змійка',     desc:'Досягни довжини 10' },
  { id:'len25',     icon:'🐍', name:'Велика змія',      desc:'Досягни довжини 25' },
  { id:'len50',     icon:'🔥', name:'Монстр',           desc:'Досягни довжини 50' },
  { id:'food50',    icon:'🍽️', name:'Голодуха',        desc:'З\'їж 50 одиниць їжі' },
  { id:'food200',   icon:'🍖', name:'Ненажера',         desc:'З\'їж 200 одиниць їжі' },
  { id:'games10',   icon:'🎮', name:'Геймер',           desc:'Зіграй 10 ігор' },
  { id:'games50',   icon:'🏆', name:'Ветеран',          desc:'Зіграй 50 ігор' },
  { id:'time1h',    icon:'⏱️', name:'Час у грі',       desc:'Зіграй 1 годину загалом' },
  { id:'portal200', icon:'🌀', name:'Portal Runner',    desc:'Набери 200 очок в Portal' },
  { id:'ghost300',  icon:'👻', name:'Ghost Rider',      desc:'Набери 300 очок в Ghost' },
  { id:'zenlen100', icon:'🧘', name:'Дзен Майстер',     desc:'Досягни довжини 100 у Zen' },
  { id:'allModes5', icon:'🎭', name:'Мульти-режим',     desc:'Активуй 5+ режимів одночасно' },
  { id:'insane200', icon:'⚡', name:'Безумець',          desc:'Набери 200 очок на швидкості Безумно' },
  { id:'nodie5',    icon:'💎', name:'Невразливий',      desc:'Зіграй 5 ігор у Zen' },
  { id:'darkzone',  icon:'🌑', name:'Ліхтарик',         desc:'Набери 100 очок у Dark Zone' },
];

function checkAchievements() {
  const stats   = loadStatsData();
  const unlocked = loadUnlocked();
  const newOnes = [];

  const check = {
    first:     () => (stats.games||0) >= 1,
    score100:  () => Math.max(stats.highScore||0, score) >= 100,
    score500:  () => Math.max(stats.highScore||0, score) >= 500,
    score1000: () => Math.max(stats.highScore||0, score) >= 1000,
    score5000: () => Math.max(stats.highScore||0, score) >= 5000,
    len10:     () => Math.max(stats.maxLength||0, snake.length) >= 10,
    len25:     () => Math.max(stats.maxLength||0, snake.length) >= 25,
    len50:     () => Math.max(stats.maxLength||0, snake.length) >= 50,
    food50:    () => (stats.foodEaten||0) + foodEaten >= 50,
    food200:   () => (stats.foodEaten||0) + foodEaten >= 200,
    games10:   () => (stats.games||0) >= 10,
    games50:   () => (stats.games||0) >= 50,
    time1h:    () => (stats.timeTotal||0) + elapsed >= 3600,
    portal200: () => MODES.portal && score >= 200,
    ghost300:  () => MODES.ghost && score >= 300,
    zenlen100: () => MODES.zen && snake.length >= 100,
    allModes5: () => Object.values(MODES).filter(Boolean).length >= 5,
    insane200: () => S.speed === 'insane' && score >= 200,
    nodie5:    () => Object.keys(stats.modeHS||{}).some(k => k.includes('zen')) && (stats.games||0) >= 5,
    darkzone:  () => MODES.dark && score >= 100,
  };

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.includes(ach.id)) continue;
    try { if (check[ach.id]?.()) { unlocked.push(ach.id); newOnes.push(ach); } } catch(e) {}
  }

  if (newOnes.length) {
    localStorage.setItem('foxsnake-achievements', JSON.stringify(unlocked));
    newOnes.forEach((a, i) => setTimeout(() => showToast(a), i * 3500));
  }
}

function loadUnlocked() {
  try { return JSON.parse(localStorage.getItem('foxsnake-achievements') || '[]'); } catch(e) { return []; }
}

function showToast(ach) {
  const toast = document.getElementById('ach-toast');
  document.getElementById('toast-icon').textContent = ach.icon;
  document.getElementById('toast-name').textContent = ach.name;
  document.getElementById('toast-desc').textContent = ach.desc;
  toast.style.display   = 'block';
  toast.style.animation = 'none';
  void toast.offsetHeight;
  toast.style.animation = 'slideIn 0.3s ease';
  setTimeout(() => { toast.style.display = 'none'; }, 4500);
}

function renderAchievements() {
  const unlocked = loadUnlocked();
  document.getElementById('ach-count').textContent = `${unlocked.length} / ${ACHIEVEMENTS.length}`;
  document.getElementById('ach-bar').style.width   = (unlocked.length / ACHIEVEMENTS.length * 100) + '%';
  document.getElementById('ach-grid').innerHTML = ACHIEVEMENTS.map(a => `
    <div class="ach-card ${unlocked.includes(a.id) ? 'unlocked' : ''}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
      ${unlocked.includes(a.id) ? '<div style="margin-top:6px;font-size:0.58rem;color:var(--correct);font-family:var(--font-display);letter-spacing:1px">✓ ОТРИМАНО</div>' : ''}
    </div>
  `).join('');
}

// ===== SOUND =====
let audioCtx = null;
function getAC() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(type) {
  if (!S.sound) return;
  try {
    const ac = getAC();
    const osc = ac.createOscillator(), gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    if (type === 'eat') {
      osc.frequency.setValueAtTime(440, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.09);
      gain.gain.setValueAtTime(0.14, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
      osc.start(); osc.stop(ac.currentTime + 0.14);
    } else if (type === 'die') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.45);
      gain.gain.setValueAtTime(0.18, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.45);
      osc.start(); osc.stop(ac.currentTime + 0.45);
    }
  } catch(e) {}
}

// ===== BACKGROUND PARTICLES =====
const bgCanvas = document.getElementById('particle-canvas');
const bgCtx    = bgCanvas.getContext('2d');
let bgParts    = [];
let bgAnimRunning = true;
const BG_FPS = 30;
let bgLastTs = 0;

function initBg() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  bgParts = Array.from({ length: 35 }, () => ({
    x: Math.random() * bgCanvas.width,
    y: Math.random() * bgCanvas.height,
    vx: (Math.random()-0.5) * 0.28,
    vy: (Math.random()-0.5) * 0.28,
    size:  1 + Math.random() * 2,
    alpha: 0.08 + Math.random() * 0.38
  }));
}

function animBg(ts) {
  const minFrame = 1000 / BG_FPS;
  if (ts - bgLastTs < minFrame) {
    requestAnimationFrame(animBg);
    return;
  }
  bgLastTs = ts;
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  if (bgAnimRunning && S.bgParticles) {
    const color = PAL.accent;
    bgParts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = bgCanvas.width;
      if (p.x > bgCanvas.width) p.x = 0;
      if (p.y < 0) p.y = bgCanvas.height;
      if (p.y > bgCanvas.height) p.y = 0;
      bgCtx.globalAlpha = p.alpha;
      bgCtx.fillStyle = color;
      bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.size, 0, Math.PI*2); bgCtx.fill();
    });
    bgCtx.globalAlpha = 1;
  }
  requestAnimationFrame(animBg);
}

window.addEventListener('resize', () => {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
  if (!gameRunning) { initBoard(); drawIdleBoard(); }
});

// ===== IDLE BOARD (pretty preview) =====
function drawIdleBoard() {
  initBoard();
  rebuildThemeDecor();
  ctx.fillStyle = PAL.surface;
  ctx.fillRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);
  drawVectorBackdrop(BOARD_PIXELS, BOARD_PIXELS);
  drawThemeDecor();
  if (S.showGrid) drawGrid();
  // Draw a decorative snake
  const cx = Math.floor(COLS/2), cy = Math.floor(ROWS/2);
  const demoSnake = [
    {x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy},{x:cx-3,y:cy},{x:cx-4,y:cy}
  ].filter(s => s.x >= 0 && s.y >= 0 && s.x < COLS && s.y < ROWS);
  const accent = PAL.accent, accent2 = PAL.accent2;
  demoSnake.forEach((s, i) => {
    ctx.save();
    ctx.fillStyle = i === 0 ? accent : accent2;
    if (S.snakeStyle === 'neon') { ctx.shadowBlur = 14; ctx.shadowColor = accent; }
    ctx.globalAlpha = 1 - i * 0.14;
    fillRoundRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2, 3);
    ctx.restore();
  });
}

// ===== INIT =====
function init() {
  loadSettings();
  refreshPalette();
  cachedHighScore = loadStatsData().highScore || 0;
  initBg();
  animBg();
  drawIdleBoard();
  renderAchievements();
  updateActiveBadge();
  // Check first-launch achievement
  const stats = loadStatsData();
  if (stats.games > 0) checkAchievements();
}

init();
