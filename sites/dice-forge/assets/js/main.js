'use strict';

/* ══ Settings ════════════════════════════════════════════════════════════ */
const cfg = {
  particles:     true,
  particleLevel: 2,
  sound:         true,
  volume:        0.50,
  font:          'Inter',
};

/* ══ App state ═══════════════════════════════════════════════════════════ */
const state = {
  theme:   'default',
  sides:   6,
  count:   1,
  rolling: false,
};

/* ══ Theme metadata ══════════════════════════════════════════════════════ */
const THEME_META = {
  default: { sub: 'neon glass · roll anything',         partCol: ['#60b8ff','#a060ff','#ffffff'],  shape: 'circle',  grav: 0.13, bg: 'drift'  },
  dnd:     { sub: 'parchment & runes · d&d edition',    partCol: ['#d4a840','#f2c76d','#ffd080'],  shape: 'rune',    grav: 0.10, bg: 'motes'  },
  dota:    { sub: 'radiant vs dire · invoker approved', partCol: ['#c07020','#e07a30','#ff9940'],  shape: 'ember',   grav: 0.15, bg: 'embers' },
  roll:    { sub: 'red & white · clean & fast',         partCol: ['#cc1111','#ff4444','#ffaaaa'],  shape: 'circle',  grav: 0.13, bg: 'minimal'},
  cyber:   { sub: 'matrix · hack the dice',             partCol: ['#00ff88','#00cc66','#88ffcc'],  shape: 'square',  grav: 0.06, bg: 'matrix' },
  space:   { sub: 'cosmic · roll among the stars',      partCol: ['#b060ff','#ffffff','#e0a0ff'],  shape: 'star',    grav: 0.04, bg: 'stars'  },
  arcane:  { sub: 'arcane · magic never lies',          partCol: ['#ff60c0','#d030a0','#ffb0e0'],  shape: 'diamond', grav: 0.11, bg: 'swirl'  },
};

/* ══════════════════════════════════════════════════════════════════════════
   BACKGROUND CANVAS — ambient effects, always running
   ══════════════════════════════════════════════════════════════════════════ */
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx    = bgCanvas.getContext('2d');

function resizeBg() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
resizeBg();
window.addEventListener('resize', () => { resizeBg(); resSparks(); });

/* ── Matrix rain (Cyber) ────────────────────────────────────────────────── */
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01234ABCDEF!@#$%';
let matrixCols  = [];
let matrixClock = 0;

function initMatrix() {
  const cols = Math.ceil(bgCanvas.width / 18);
  matrixCols = Array.from({ length: cols }, () => ({
    y:     Math.random() * -bgCanvas.height,
    speed: 8 + Math.random() * 12,
    chars: Array.from({ length: 28 }, () =>
      MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]),
    glitch: 0,
  }));
}

function drawMatrix(dt) {
  bgCtx.fillStyle = 'rgba(2,10,4,0.18)';
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  const fs = 14;
  bgCtx.font = `bold ${fs}px monospace`;

  matrixCols.forEach((col, i) => {
    col.y += col.speed * dt;
    if (col.y > bgCanvas.height + 200) {
      col.y = -Math.random() * 400;
      col.speed = 8 + Math.random() * 12;
    }
    // Randomly mutate chars
    if (Math.random() < 0.04) {
      const idx = Math.floor(Math.random() * col.chars.length);
      col.chars[idx] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
    }

    const x = i * 18;
    col.chars.forEach((ch, j) => {
      const cy = col.y - j * fs;
      if (cy < 0 || cy > bgCanvas.height) return;
      const alpha = Math.max(0, 1 - j / col.chars.length);
      if (j === 0) {
        bgCtx.fillStyle = `rgba(200,255,220,${alpha})`;
      } else {
        bgCtx.fillStyle = `rgba(0,${180 + Math.floor(Math.random()*30)},${80 + j * 3},${alpha * 0.75})`;
      }
      bgCtx.fillText(ch, x, cy);
    });
  });
}

/* ── Star field (Space) ─────────────────────────────────────────────────── */
let stars = [];
function initStars() {
  stars = Array.from({ length: 220 }, () => ({
    x:    Math.random() * bgCanvas.width,
    y:    Math.random() * bgCanvas.height,
    r:    0.3 + Math.random() * 2.2,
    base: 0.2 + Math.random() * 0.7,   // base opacity
    phase: Math.random() * Math.PI * 2,
    freq:  0.5 + Math.random() * 2,    // twinkle speed
    col:  Math.random() < 0.15 ? '#e0b0ff' : Math.random() < 0.15 ? '#b0d0ff' : '#ffffff',
    drift: (Math.random() - 0.5) * 0.04,
  }));
}

function drawStars(t) {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  stars.forEach(s => {
    s.x = (s.x + s.drift + bgCanvas.width) % bgCanvas.width;
    const alpha = s.base * (0.5 + 0.5 * Math.sin(t * s.freq + s.phase));
    bgCtx.save();
    bgCtx.globalAlpha = alpha;
    bgCtx.fillStyle = s.col;
    bgCtx.beginPath();
    bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    bgCtx.fill();
    // Occasional glow
    if (s.r > 1.5) {
      bgCtx.globalAlpha = alpha * 0.25;
      bgCtx.beginPath();
      bgCtx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
      bgCtx.fill();
    }
    bgCtx.restore();
  });
}

/* ── Drifting orbs (Default) ────────────────────────────────────────────── */
let orbs = [];
function initOrbs(color1, color2, count = 40) {
  orbs = Array.from({ length: count }, () => ({
    x:    Math.random() * bgCanvas.width,
    y:    Math.random() * bgCanvas.height,
    r:    1 + Math.random() * 4,
    vx:   (Math.random() - 0.5) * 0.3,
    vy:   -(0.05 + Math.random() * 0.25),
    alpha: 0.06 + Math.random() * 0.14,
    col:  Math.random() < 0.5 ? color1 : color2,
    life: Math.random(),
    decay: 0.0008 + Math.random() * 0.001,
  }));
}

function drawOrbs() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  orbs.forEach(o => {
    o.x  = (o.x + o.vx + bgCanvas.width)  % bgCanvas.width;
    o.y  =  o.y + o.vy;
    if (o.y < -10) { o.y = bgCanvas.height + 10; o.x = Math.random() * bgCanvas.width; o.life = 0; }
    o.life = Math.min(1, o.life + 0.002);

    bgCtx.save();
    bgCtx.globalAlpha = o.alpha * Math.min(1, o.life * 3);
    bgCtx.fillStyle = o.col;
    bgCtx.beginPath();
    bgCtx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();
  });
}

/* ── Arcane swirl ───────────────────────────────────────────────────────── */
let swirlMotes = [];
function initSwirl() {
  swirlMotes = Array.from({ length: 55 }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: 50 + Math.random() * Math.min(bgCanvas.width, bgCanvas.height) * 0.35,
    speed:  0.002 + Math.random() * 0.004,
    cx:  bgCanvas.width  / 2,
    cy:  bgCanvas.height / 2,
    r:   0.8 + Math.random() * 2.5,
    alpha: 0.05 + Math.random() * 0.15,
    col: ['#ff60c0','#d030a0','#ffb0e0','#cc00aa'][Math.floor(Math.random() * 4)],
  }));
}

function drawSwirl() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  swirlMotes.forEach(m => {
    m.angle += m.speed;
    const x = m.cx + Math.cos(m.angle) * m.radius;
    const y = m.cy + Math.sin(m.angle) * m.radius * 0.45;
    bgCtx.save();
    bgCtx.globalAlpha = m.alpha;
    bgCtx.fillStyle = m.col;
    bgCtx.beginPath();
    bgCtx.arc(x, y, m.r, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();
  });
}

/* ── Embers (Dota) ──────────────────────────────────────────────────────── */
let embers = [];
function initEmbers() {
  embers = Array.from({ length: 45 }, () => spawnEmber());
}
function spawnEmber() {
  return {
    x:  Math.random() * bgCanvas.width,
    y:  bgCanvas.height + 10,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -(0.4 + Math.random() * 0.8),
    r:  0.8 + Math.random() * 2,
    alpha: 0.08 + Math.random() * 0.18,
    col: ['#c07020','#e07a30','#ff9940','#ff6010'][Math.floor(Math.random()*4)],
  };
}
function drawEmbers() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  embers.forEach((e, i) => {
    e.x += e.vx; e.y += e.vy;
    e.vx += (Math.random() - 0.5) * 0.05;
    if (e.y < -10) embers[i] = spawnEmber();
    bgCtx.save();
    bgCtx.globalAlpha = e.alpha;
    bgCtx.fillStyle = e.col;
    bgCtx.beginPath();
    bgCtx.ellipse(e.x, e.y, e.r * 0.5, e.r * 1.4, 0, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();
  });
}

/* ── Rune motes (DND) ───────────────────────────────────────────────────── */
let runeMotes = [];
function initRuneMotes() {
  runeMotes = Array.from({ length: 30 }, () => ({
    x:     Math.random() * bgCanvas.width,
    y:     bgCanvas.height + Math.random() * 200,
    vy:   -(0.15 + Math.random() * 0.35),
    vx:    (Math.random() - 0.5) * 0.15,
    r:     1 + Math.random() * 2.5,
    alpha: 0.06 + Math.random() * 0.12,
    col:  Math.random() < 0.5 ? '#d4a840' : '#f2c76d',
  }));
}
function drawRuneMotes() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  runeMotes.forEach(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.y < -10) { m.y = bgCanvas.height + 10; m.x = Math.random() * bgCanvas.width; }
    bgCtx.save();
    bgCtx.globalAlpha = m.alpha;
    bgCtx.strokeStyle = m.col;
    bgCtx.lineWidth = m.r * 0.5;
    bgCtx.beginPath();
    bgCtx.moveTo(m.x, m.y - m.r); bgCtx.lineTo(m.x, m.y + m.r);
    bgCtx.moveTo(m.x - m.r, m.y); bgCtx.lineTo(m.x + m.r, m.y);
    bgCtx.stroke();
    bgCtx.restore();
  });
}

/* ── Background master loop ─────────────────────────────────────────────── */
let bgRaf    = null;
let bgT      = 0;
let lastTime = 0;

function bgLoop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  bgT += dt * 0.016;
  matrixClock += dt;

  const bg = THEME_META[state.theme]?.bg;
  switch (bg) {
    case 'matrix':  drawMatrix(dt); break;
    case 'stars':   drawStars(bgT); break;
    case 'drift':   drawOrbs();     break;
    case 'embers':  drawEmbers();   break;
    case 'motes':   drawRuneMotes();break;
    case 'swirl':   drawSwirl();    break;
    default:
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  }
  bgRaf = requestAnimationFrame(bgLoop);
}

function initBg() {
  const bg = THEME_META[state.theme]?.bg;
  if (bg === 'matrix')  initMatrix();
  if (bg === 'stars')   initStars();
  if (bg === 'drift')   initOrbs('#60b8ff', '#a060ff');
  if (bg === 'embers')  initEmbers();
  if (bg === 'motes')   initRuneMotes();
  if (bg === 'swirl')   initSwirl();
  if (bg === 'minimal') bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  if (!bgRaf) bgRaf = requestAnimationFrame(bgLoop);
}

/* ══════════════════════════════════════════════════════════════════════════
   SPARKS CANVAS — burst particles on roll
   ══════════════════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('sparks');
const ctx2d  = canvas.getContext('2d');
let   pts    = [];
let   raf    = null;

function resSparks() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resSparks();

function drawStar(c, cx, cy, r) {
  const sp = 5, step = Math.PI / sp;
  let rot = -Math.PI / 2;
  c.beginPath();
  for (let i = 0; i < sp * 2; i++) {
    const rd = i % 2 === 0 ? r : r * 0.42;
    c.lineTo(cx + Math.cos(rot) * rd, cy + Math.sin(rot) * rd);
    rot += step;
  }
  c.closePath();
}

function drawParticle(p) {
  ctx2d.save();
  const a = p.life * p.life;
  ctx2d.globalAlpha = a;
  ctx2d.translate(p.x, p.y);
  ctx2d.rotate(p.rot);
  ctx2d.fillStyle = ctx2d.strokeStyle = p.color;
  if (p.trail && p.prevX !== undefined) {
    ctx2d.globalAlpha = a * 0.3;
    ctx2d.lineWidth = p.r * 0.6;
    ctx2d.beginPath();
    ctx2d.moveTo(0, 0);
    ctx2d.lineTo(p.prevX - p.x, p.prevY - p.y);
    ctx2d.stroke();
    ctx2d.globalAlpha = a;
  }
  switch (p.shape) {
    case 'circle':
      ctx2d.beginPath(); ctx2d.arc(0, 0, p.r, 0, Math.PI * 2); ctx2d.fill(); break;
    case 'square':
      ctx2d.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); break;
    case 'star':
      drawStar(ctx2d, 0, 0, p.r); ctx2d.fill(); break;
    case 'diamond':
      ctx2d.beginPath();
      ctx2d.moveTo(0, -p.r*1.3); ctx2d.lineTo(p.r*0.75,0);
      ctx2d.lineTo(0, p.r*1.3);  ctx2d.lineTo(-p.r*0.75,0);
      ctx2d.closePath(); ctx2d.fill(); break;
    case 'rune':
      ctx2d.lineWidth = p.r * 0.5;
      ctx2d.beginPath();
      ctx2d.moveTo(0,-p.r); ctx2d.lineTo(0,p.r);
      ctx2d.moveTo(-p.r,0); ctx2d.lineTo(p.r,0);
      ctx2d.stroke(); break;
    case 'ember':
      ctx2d.beginPath();
      ctx2d.ellipse(0, 0, p.r * 0.45, p.r * 1.5, 0, 0, Math.PI * 2);
      ctx2d.fill(); break;
  }
  ctx2d.restore();
}

function rafLoop() {
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  pts = pts.filter(p => p.life > 0.02);
  pts.forEach(p => {
    p.prevX = p.x; p.prevY = p.y;
    p.x += p.vx; p.y += p.vy;
    p.vy += p.grav; p.vx *= 0.975;
    p.rot += p.rotSpeed; p.life -= p.decay;
    drawParticle(p);
  });
  raf = pts.length ? requestAnimationFrame(rafLoop) : null;
}

const LEVEL_MULT = [0.4, 1, 2.2];

function burst(n) {
  if (!cfg.particles) return;
  const m   = THEME_META[state.theme];
  const cnt = Math.round(n * LEVEL_MULT[cfg.particleLevel - 1]);
  const r   = dieSvg.getBoundingClientRect();
  const cx  = r.left + r.width / 2;
  const cy  = r.top  + r.height / 2;
  for (let i = 0; i < cnt; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 5.5;
    pts.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd * (0.6 + Math.random() * 0.8),
      vy: Math.sin(ang) * spd * (0.6 + Math.random() * 0.8) - 2.2,
      r: 1.4 + Math.random() * 3.2,
      life:     0.85 + Math.random() * 0.15,
      decay:    0.022 + Math.random() * 0.015,
      shape:    m.shape,
      color:    m.partCol[Math.floor(Math.random() * m.partCol.length)],
      rot:      Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      grav:     m.grav * (0.7 + Math.random() * 0.6),
      trail:    state.theme === 'space' || state.theme === 'cyber',
      prevX: cx, prevY: cy,
    });
  }
  if (!raf) rafLoop();
}

/* ══════════════════════════════════════════════════════════════════════════
   AUDIO SYSTEM
   ══════════════════════════════════════════════════════════════════════════ */
let audioCtx  = null;
let reverbBuf  = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Synthetic reverb impulse (cached)
function getReverb(ctx, dur = 1.8, decay = 4) {
  if (reverbBuf) return reverbBuf;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  reverbBuf = conv;
  return conv;
}

// Cached remote audio buffers
const audioCache = {};

async function fetchAudioBuffer(ctx, url) {
  if (audioCache[url]) return audioCache[url];
  try {
    const res = await fetch(url);
    const ab  = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    audioCache[url] = buf;
    return buf;
  } catch { return null; }
}

// Play a decoded AudioBuffer
function playBuffer(ctx, buf, vol, when = 0) {
  if (!buf) return;
  const src  = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  gain.gain.setValueAtTime(vol, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + buf.duration * 0.95);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(ctx.currentTime + when);
}

/* ── Theme-specific sound URLs (freesound / NASA public) ────────────────── */
const REMOTE_SOUNDS = {
  space_land:  'https://cdn.freesound.org/previews/415/415510_5121236-lq.mp3',   // deep rumble
  space_roll:  'https://cdn.freesound.org/previews/277/277022_5450487-lq.mp3',   // whoosh
  dnd_land:    'https://cdn.freesound.org/previews/240/240777_3750928-lq.mp3',   // stone
  dnd_roll:    'https://cdn.freesound.org/previews/441/441487_5765423-lq.mp3',   // dice on table
  cyber_roll:  'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',   // digital glitch
  cyber_land:  'https://cdn.freesound.org/previews/316/316847_3797507-lq.mp3',   // beep
  default_roll:'https://cdn.freesound.org/previews/145/145441_2142300-lq.mp3',   // dice roll
  default_land:'https://cdn.freesound.org/previews/145/145441_2142300-lq.mp3',
};

// Pre-warm: try loading on first user interaction
let remotePreloaded = false;
function preloadRemote() {
  if (remotePreloaded) return;
  remotePreloaded = true;
  const ctx = getAudio();
  Object.values(REMOTE_SOUNDS).forEach(url => fetchAudioBuffer(ctx, url));
}

/* ── Synthesized fallbacks (always work, no network) ────────────────────── */
function synthRoll(ctx, vol) {
  const sc = {
    default: { f: 380, type: 'sawtooth', dur: 0.12 },
    dnd:     { f: 220, type: 'sine',     dur: 0.20 },
    dota:    { f: 300, type: 'square',   dur: 0.10 },
    roll:    { f: 540, type: 'square',   dur: 0.09 },
    cyber:   { f: 900, type: 'square',   dur: 0.08 },
    space:   { f: 40,  type: 'sine',     dur: 0.30 },
    arcane:  { f: 480, type: 'sine',     dur: 0.16 },
  }[state.theme] || { f: 380, type: 'sawtooth', dur: 0.12 };

  const now = ctx.currentTime;
  const g   = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.35, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + sc.dur);
  g.connect(ctx.destination);

  if (state.theme === 'space') {
    // Deep sub-bass drone for space
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(28, now);
    o1.frequency.linearRampToValueAtTime(18, now + 0.8);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 6;
    lfo.connect(lfoG); lfoG.connect(o1.frequency);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.7, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    o1.connect(g2); g2.connect(ctx.destination);
    o1.start(now); o1.stop(now + 1.2);
    lfo.start(now); lfo.stop(now + 1.2);
    return;
  }

  // Noise burst
  const bufSize = Math.floor(ctx.sampleRate * sc.dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass'; bpf.frequency.value = sc.f; bpf.Q.value = 1.2;
  src.connect(bpf); bpf.connect(g);
  src.start(now); src.stop(now + sc.dur);
}

function synthLand(ctx, vol) {
  const now = ctx.currentTime;

  if (state.theme === 'space') {
    // Black-hole resonance: low sine descending + harmonics
    [28, 56, 84].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 2.5);
      g.gain.setValueAtTime(vol * (0.6 - i * 0.15), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      const rev = getReverb(ctx, 3, 2);
      o.connect(g); g.connect(rev); rev.connect(ctx.destination);
      o.start(now); o.stop(now + 2.5);
    });
    return;
  }

  if (state.theme === 'arcane') {
    // Magical chord chime
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.4, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      const rev = getReverb(ctx, 2, 3);
      o.connect(g); g.connect(rev); rev.connect(ctx.destination);
      o.start(now + i * 0.04); o.stop(now + 1.5);
    });
    return;
  }

  if (state.theme === 'dnd') {
    // Stone thud + reverb
    const bufSize = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const dd  = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) dd[i] = (Math.random()*2-1) * Math.pow(1 - i/bufSize, 1.5);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.8, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 300;
    const rev = getReverb(ctx, 1.5, 3);
    src.connect(lpf); lpf.connect(g); g.connect(rev); rev.connect(ctx.destination);
    src.start(now); src.stop(now + 0.5);
    return;
  }

  if (state.theme === 'cyber') {
    // Digital blip
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1400, now);
    o.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    o.connect(g); g.connect(ctx.destination);
    o.start(now); o.stop(now + 0.14);
    return;
  }

  // Generic land
  const lFreq = { default:780, dota:600, roll:1000 }[state.theme] || 780;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(lFreq, now);
  o.frequency.exponentialRampToValueAtTime(lFreq * 0.4, now + 0.18);
  g.gain.setValueAtTime(vol * 0.55, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  o.connect(g); g.connect(ctx.destination);
  o.start(now); o.stop(now + 0.22);
  // click
  const ck = ctx.createOscillator();
  const cg = ctx.createGain();
  ck.type = 'square'; ck.frequency.value = lFreq * 2.5;
  cg.gain.setValueAtTime(vol * 0.3, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  ck.connect(cg); cg.connect(ctx.destination);
  ck.start(now); ck.stop(now + 0.03);
}

function synthTick(ctx, vol) {
  const freq = { default:380, dnd:220, dota:300, roll:540, cyber:900, space:60, arcane:480 }[state.theme] || 400;
  const now  = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq * (0.85 + Math.random() * 0.3);
  g.gain.setValueAtTime(vol * 0.1, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  o.connect(g); g.connect(ctx.destination);
  o.start(now); o.stop(now + 0.04);
}

async function playSound(type) {
  if (!cfg.sound) return;
  try {
    const ctx = getAudio();
    const vol = cfg.volume;

    if (type === 'roll') {
      // Try remote, fallback to synth
      const key  = state.theme + '_roll';
      const rKey = REMOTE_SOUNDS[key] || REMOTE_SOUNDS['default_roll'];
      const buf  = audioCache[rKey];
      if (buf) { playBuffer(ctx, buf, vol * 0.7); return; }
      synthRoll(ctx, vol);
    } else if (type === 'land') {
      const key  = state.theme + '_land';
      const rKey = REMOTE_SOUNDS[key] || REMOTE_SOUNDS['default_land'];
      const buf  = audioCache[rKey];
      if (buf) { playBuffer(ctx, buf, vol * 0.8); return; }
      synthLand(ctx, vol);
    } else if (type === 'tick') {
      synthTick(ctx, vol);
    } else if (type === 'start') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const f0 = { space: 40 }[state.theme] || 380;
      o.frequency.setValueAtTime(f0 * 0.7, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(f0 * 1.2, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(vol * 0.30, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.22);
    } else if (type === 'stop') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const f0 = { space: 56 }[state.theme] || 780;
      o.frequency.setValueAtTime(f0 * 1.1, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.3, ctx.currentTime + 0.28);
      g.gain.setValueAtTime(vol * 0.45, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.30);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.30);
    }
  } catch (e) { /* blocked */ }
}

/* ══ SVG die shapes ══════════════════════════════════════════════════════ */
function buildDieSvg(sides, val) {
  const num   = val != null ? String(val) : '';
  const gid   = 'dg' + sides;
  const fs    = num.length > 2 ? 36 : num.length > 1 ? 48 : 60;
  const numEl = num ? `
    <text x="100" y="${100 + fs * 0.36}"
      text-anchor="middle" dominant-baseline="middle"
      font-family="Inter,Arial,sans-serif" font-size="${fs}"
      font-weight="900" fill="var(--die-num)" letter-spacing="-1">${num}</text>` : '';

  const defs = `<defs>
    <radialGradient id="${gid}" cx="36%" cy="32%" r="72%">
      <stop offset="0%" stop-color="var(--die-c1)"/>
      <stop offset="100%" stop-color="var(--die-c2)"/>
    </radialGradient>
  </defs>`;
  const ln = `stroke="var(--die-line)" stroke-width="1.5"`;
  const F  = `fill="url(#${gid})" stroke="white" stroke-width="1.6"`;

  switch (sides) {
    case 4: return `${defs}
      <polygon points="100,10 188,165 12,165" ${F}/>
      <line x1="100" y1="10"  x2="100" y2="107" ${ln}/>
      <line x1="100" y1="107" x2="188" y2="165" ${ln}/>
      <line x1="100" y1="107" x2="12"  y2="165" ${ln}/>
      <line x1="12"  y1="165" x2="188" y2="165" ${ln}/>
      ${num ? `<text x="100" y="148" text-anchor="middle" dominant-baseline="middle"
        font-family="Inter,Arial,sans-serif" font-size="${fs}"
        font-weight="900" fill="var(--die-num)" letter-spacing="-1">${num}</text>` : ''}`;
    case 6: return `${defs}
      <rect x="14" y="14" width="172" height="172" rx="22" ry="22" ${F}/>
      <line x1="14" y1="71" x2="186" y2="71" ${ln}/><line x1="14" y1="129" x2="186" y2="129" ${ln}/>
      <line x1="71" y1="14" x2="71"  y2="186" ${ln}/><line x1="129" y1="14" x2="129" y2="186" ${ln}/>
      ${numEl}`;
    case 8: return `${defs}
      <polygon points="100,10 190,100 100,190 10,100" ${F}/>
      <line x1="100" y1="10" x2="100" y2="190" ${ln}/><line x1="10" y1="100" x2="190" y2="100" ${ln}/>
      <line x1="28" y1="28" x2="172" y2="172" ${ln}/><line x1="172" y1="28" x2="28" y2="172" ${ln}/>
      ${numEl}`;
    case 10: return `${defs}
      <polygon points="100,10 182,66 152,168 48,168 18,66" ${F}/>
      <line x1="100" y1="10" x2="100" y2="92" ${ln}/><line x1="182" y1="66" x2="100" y2="92" ${ln}/>
      <line x1="152" y1="168" x2="100" y2="92" ${ln}/><line x1="48" y1="168" x2="100" y2="92" ${ln}/>
      <line x1="18" y1="66" x2="100" y2="92" ${ln}/>${numEl}`;
    case 12: return `${defs}
      <polygon points="100,10 163,40 188,112 148,180 52,180 12,112 37,40" ${F}/>
      <line x1="100" y1="10" x2="100" y2="100" ${ln}/><line x1="163" y1="40" x2="100" y2="100" ${ln}/>
      <line x1="188" y1="112" x2="100" y2="100" ${ln}/><line x1="148" y1="180" x2="100" y2="100" ${ln}/>
      <line x1="52" y1="180" x2="100" y2="100" ${ln}/><line x1="12" y1="112" x2="100" y2="100" ${ln}/>
      <line x1="37" y1="40" x2="100" y2="100" ${ln}/>${numEl}`;
    case 20: return `${defs}
      <polygon points="100,8 168,38 196,112 152,180 48,180 4,112 32,38" ${F}/>
      <line x1="100" y1="8" x2="100" y2="80" ${ln}/><line x1="168" y1="38" x2="100" y2="80" ${ln}/>
      <line x1="196" y1="112" x2="134" y2="112" ${ln}/><line x1="152" y1="180" x2="134" y2="112" ${ln}/>
      <line x1="48" y1="180" x2="66" y2="112" ${ln}/><line x1="4" y1="112" x2="66" y2="112" ${ln}/>
      <line x1="32" y1="38" x2="100" y2="80" ${ln}/><line x1="100" y1="80" x2="134" y2="112" ${ln}/>
      <line x1="134" y1="112" x2="66" y2="112" ${ln}/><line x1="66" y1="112" x2="100" y2="80" ${ln}/>
      ${numEl}`;
    case 100: {
      const n100 = num ? `<text x="100" y="97"
        text-anchor="middle" dominant-baseline="middle"
        font-family="Inter,Arial,sans-serif" font-size="${fs}"
        font-weight="900" fill="var(--die-num)" letter-spacing="-1">${num}</text>` : '';
      return `${defs}
        <circle cx="100" cy="100" r="88" ${F}/>
        <circle cx="100" cy="100" r="62" fill="none" stroke="var(--die-line)" stroke-width="1.5"/>
        <circle cx="100" cy="100" r="34" fill="none" stroke="var(--die-line)" stroke-width="1.5"/>
        <line x1="100" y1="12" x2="100" y2="38" ${ln}/><line x1="100" y1="162" x2="100" y2="188" ${ln}/>
        <line x1="12" y1="100" x2="38" y2="100" ${ln}/><line x1="162" y1="100" x2="188" y2="100" ${ln}/>
        ${n100}`;
    }
    default: return `${defs}<circle cx="100" cy="100" r="88" ${F}/>${numEl}`;
  }
}

/* ══ DOM refs ════════════════════════════════════════════════════════════ */
const dieSvg       = document.getElementById('dieSvg');
const dieLabel     = document.getElementById('dieLabel');
const resultNum    = document.getElementById('resultNum');
const resultDetail = document.getElementById('resultDetail');
const histList     = document.getElementById('histList');
const histEmpty    = document.getElementById('histEmpty');
const rollBtn      = document.getElementById('rollBtn');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const decBtn       = document.getElementById('decBtn');
const incBtn       = document.getElementById('incBtn');
const countValEl   = document.getElementById('countVal');
const clearBtn     = document.getElementById('clearBtn');
const themeSub     = document.getElementById('themeSub');
const diePills     = document.querySelectorAll('.die-pill');
const settingsBtn  = document.getElementById('settingsBtn');
const settingsPanel= document.getElementById('settingsPanel');
const partToggle   = document.getElementById('partToggle');
const soundToggle  = document.getElementById('soundToggle');
const volRange     = document.getElementById('volRange');
const volVal       = document.getElementById('volVal');
const fontSel      = document.getElementById('fontSel');

function renderDie(val) {
  dieSvg.innerHTML = buildDieSvg(state.sides, val);
  dieLabel.textContent = 'd' + state.sides;
}

/* ══ Theme switch ════════════════════════════════════════════════════════ */
document.querySelectorAll('.t-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    stopAllAuto();
    state.theme = btn.dataset.theme;
    document.body.dataset.theme = state.theme;
    document.querySelectorAll('.t-btn').forEach(b => b.classList.toggle('active', b === btn));
    themeSub.textContent = THEME_META[state.theme].sub;
    reverbBuf = null; // reset reverb cache for new theme
    renderDie(null);
    initBg();
  });
});

/* ══ Die pills ════════════════════════════════════════════════════════════ */
diePills.forEach(pill => {
  pill.addEventListener('click', () => {
    state.sides = parseInt(pill.dataset.sides);
    diePills.forEach(p => p.classList.toggle('active', p === pill));
    renderDie(null);
    resultDetail.textContent = '';
  });
});

/* ══ Count ════════════════════════════════════════════════════════════════ */
function setCount(n) {
  state.count = Math.max(1, Math.min(20, n));
  countValEl.textContent = state.count;
}
decBtn.addEventListener('click', () => setCount(state.count - 1));
incBtn.addEventListener('click', () => setCount(state.count + 1));

/* ══ Slot machine ═════════════════════════════════════════════════════════ */
const SLOT_DELAYS = [28,32,38,46,58,74,94,120,152,188,228];

function slotMachine(finalVal, cb) {
  let step = 0;
  function tick() {
    step++;
    renderDie(Math.floor(Math.random() * state.sides) + 1);
    if (step < SLOT_DELAYS.length) setTimeout(tick, SLOT_DELAYS[step]);
    else {
      renderDie(finalVal);
      dieSvg.classList.remove('rolling');
      dieSvg.classList.add('pop');
      dieSvg.addEventListener('animationend', () => {
        dieSvg.classList.remove('pop');
        cb && cb();
      }, { once: true });
    }
  }
  setTimeout(tick, SLOT_DELAYS[0]);
}

/* ══ Roll ════════════════════════════════════════════════════════════════ */
function doRoll(silent) {
  if (state.rolling) return;
  state.rolling = true;
  const rolls   = Array.from({ length: state.count }, () => Math.floor(Math.random() * state.sides) + 1);
  const total   = rolls.reduce((a,b) => a+b, 0);
  const display = state.count === 1 ? rolls[0] : total;

  playSound('roll'); burst(24);
  dieSvg.classList.add('rolling');
  slotMachine(display, () => {
    playSound('land'); burst(18);
    resultNum.textContent = display;
    resultNum.classList.remove('flash'); void resultNum.offsetWidth; resultNum.classList.add('flash');
    resultDetail.textContent = state.count > 1 ? rolls.join(' + ') + ' = ' + total : 'd' + state.sides;
    if (!silent) addHistory(rolls, total);
    state.rolling = false;
  });
}

/* ══ History ═════════════════════════════════════════════════════════════ */
function addHistory(rolls, total) {
  histEmpty.style.display = 'none';
  const li = document.createElement('li');
  const t  = new Date();
  const ts = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`;
  const det = rolls.length > 1 ? rolls.join('+')+'='+total : 'd'+state.sides;
  li.innerHTML = `<span class="hist-val">${total}</span>
    <span class="hist-detail">${det}</span><span class="hist-time">${ts}</span>`;
  histList.prepend(li);
  while (histList.children.length > 30) histList.lastChild.remove();
}
clearBtn.addEventListener('click', () => { histList.innerHTML = ''; histEmpty.style.display = ''; });

/* ══ Continuous spin ══════════════════════════════════════════════════════ */
let spinTimer  = null;
let isSpinning = false;
let tickCount  = 0;

function startAuto() {
  if (isSpinning) return;
  isSpinning = true; tickCount = 0;
  startBtn.style.display = 'none'; stopBtn.style.display = '';
  resultNum.textContent = '—'; resultDetail.textContent = '';
  playSound('start'); preloadRemote();
  spinTimer = setInterval(() => {
    tickCount++;
    renderDie(Math.floor(Math.random() * state.sides) + 1);
    if (tickCount % 4 === 0) playSound('tick');
    if (tickCount % 10 === 0) burst(7);
  }, 80);
}

function stopAuto() {
  if (!isSpinning) return;
  isSpinning = false;
  clearInterval(spinTimer); spinTimer = null;
  stopBtn.style.display = 'none'; startBtn.style.display = '';
  const fv = Math.floor(Math.random() * state.sides) + 1;
  state.rolling = true;
  playSound('stop');
  dieSvg.classList.add('rolling');
  slotMachine(fv, () => {
    playSound('land'); burst(22);
    resultNum.textContent = fv;
    resultNum.classList.remove('flash'); void resultNum.offsetWidth; resultNum.classList.add('flash');
    resultDetail.textContent = 'd' + state.sides;
    addHistory([fv], fv);
    state.rolling = false;
  });
}

function stopAllAuto() {
  if (isSpinning) {
    isSpinning = false;
    clearInterval(spinTimer); spinTimer = null;
    stopBtn.style.display = 'none'; startBtn.style.display = '';
    state.rolling = false;
  }
}

/* ══ Button wiring ════════════════════════════════════════════════════════ */
rollBtn.addEventListener('click',  () => { stopAllAuto(); doRoll(false); });
dieSvg.addEventListener('click',   () => { stopAllAuto(); doRoll(false); });
startBtn.addEventListener('click', startAuto);
stopBtn.addEventListener('click',  stopAuto);

/* ══ Settings panel ══════════════════════════════════════════════════════ */
settingsBtn.addEventListener('click', () => {
  const open = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = open ? 'none' : 'block';
  settingsBtn.classList.toggle('open', !open);
  if (!open) preloadRemote();
});

partToggle.addEventListener('change', () => {
  cfg.particles = partToggle.checked;
  document.getElementById('partLevelRow').style.opacity = cfg.particles ? '1' : '0.4';
});
soundToggle.addEventListener('change', () => {
  cfg.sound = soundToggle.checked;
  document.getElementById('volRow').style.opacity = cfg.sound ? '1' : '0.4';
  if (cfg.sound) { try { getAudio(); preloadRemote(); } catch(e) {} }
});
volRange.addEventListener('input', () => {
  cfg.volume = parseInt(volRange.value) / 100;
  volVal.textContent = volRange.value;
});
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    cfg.particleLevel = parseInt(btn.dataset.level);
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
});
const GOOGLE_FONTS = {
  'Orbitron':       'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
  'JetBrains Mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap',
};
fontSel.addEventListener('change', () => {
  cfg.font = fontSel.value;
  const url = GOOGLE_FONTS[cfg.font];
  if (url && !document.querySelector(`link[data-font="${cfg.font}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url; l.dataset.font = cfg.font;
    document.head.appendChild(l);
  }
  document.documentElement.style.setProperty('--font-ui', `'${cfg.font}', system-ui, sans-serif`);
});

/* ══ Keyboard ════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); stopAllAuto(); doRoll(false); }
  if (e.code === 'KeyS')     { e.preventDefault(); isSpinning ? stopAuto() : startAuto(); }
  if (e.code === 'ArrowUp')  { e.preventDefault(); setCount(state.count + 1); }
  if (e.code === 'ArrowDown'){ e.preventDefault(); setCount(state.count - 1); }
});

/* ══ Init ════════════════════════════════════════════════════════════════ */
renderDie(null);
themeSub.textContent = THEME_META[state.theme].sub;
initBg();
