/* ==========================================================================
   FOXSTYLE — ThemeEngine
   Modular appearance state → CSS custom properties + data-* attributes.
   Storage key: foxstyle.theme.v1  (applied theme)
                foxstyle.preset.custom (user "Custom" preset)
   No framework, no build step.
   ========================================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'foxstyle.theme.v1';
  const CUSTOM_KEY  = 'foxstyle.preset.custom';
  const SCHEMA_VERSION = 1;

  const root  = document.documentElement;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------------
     FoxOS `sw` palette (cmd/foxos-lib.ps1 / sw-script.ps1)
     ------------------------------------------------------------------------ */
  const SW_PALETTE = {
    orange: '#DC7A14', blue: '#5A8CFF', purple: '#A05AFF', cyan: '#46DCC8',
    crimson: '#D14A5A', rose: '#E05A9A', magenta: '#D44BBD', violet: '#8356E6',
    indigo: '#4E75D8', sky: '#6FC4F0', teal: '#36B8B3', mint: '#6BD3B0',
    emerald: '#4CB874', lime: '#9BD94A', gold: '#E0B148', amber: '#E5943A',
    peach: '#E7A37C', coral: '#E07D69', ruby: '#C83B5C', slate: '#7D93B0',
    ice: '#7CC8E8', neon: '#7EF06B', forest: '#4E8C66', mocha: '#A17A5A',
    black: '#111111', white: '#F2F2F2',
  };

  const EASES = {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decel:    'cubic-bezier(0, 0, 0.2, 1)',
    elastic:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce:   'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
    liquid:   'cubic-bezier(0.65, 0, 0.1, 1)',
  };

  const FONT_STACKS = {
    'Inter':                      '"Inter", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    'Space Grotesk':              '"Space Grotesk", "Inter", system-ui, sans-serif',
    'Segoe UI Variable':          '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    'Segoe UI Variable Display':  '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
    'system-ui':                  'system-ui, -apple-system, "Segoe UI", sans-serif',
    'JetBrains Mono':             '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    'Cascadia Mono':              '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
    'Consolas':                   'Consolas, "Cascadia Mono", monospace',
    'monospace':                  'ui-monospace, monospace',
  };

  const TRACKING = { tight: '-0.02em', normal: '0', wide: '0.04em' };

  /* ------------------------------------------------------------------------
     Modular theme schema — defaults (= Dark preset)
     ------------------------------------------------------------------------ */
  const DEFAULT_THEME = Object.freeze({
    version: SCHEMA_VERSION,
    name: 'FoxOS Dark',
    preset: 'dark',
    colors: { theme: 'dark', accent: null, accent2: null, bg: null, surface: null, ink: null, glass: 72 },
    chrome: { opacity: 72, blur: 18, height: 36, floating: false, icons: 'line', iconSize: 16 },
    window: {
      radius: 16,
      shadowPreset: 'custom',
      shadow: { x: 0, y: 28, blur: 70, spread: -12, color: '#000000', alpha: 60 },
      openAnim: 'auto',
    },
    panel: { enter: 'book', speed: 'normal', blur: 28, radius: 24 },
    button: { style: 'glass', radius: null, pressScale: 97 },
    motion: { scale: 'full', fast: 160, med: 320, slow: 640, ease: 'standard', stagger: 45 },
    typography: { ui: 'Inter', display: 'Space Grotesk', mono: 'JetBrains Mono', size: 13.5, density: 'normal', tracking: 'tight', displayWeight: '600' },
    texture: { kind: 'glass', opacity: 100, rain: 35, dock: 'pill' },
    labs: { dynamicShadows: false, foxGlow: false, motionBlur: false, liquidWindows: false },
    perElementAnims: { dock: 'fs-bounce-in', nav: 'fs-fade-up', card: 'fs-fade-up', tile: 'fs-zoom-open', toggle: 'fs-elastic-pop' },
  });

  /* ------------------------------------------------------------------------
     Built-in presets (mirrored in presets/*.json)
     ------------------------------------------------------------------------ */
  const PRESETS = {
    dark: DEFAULT_THEME,

    light: merge(DEFAULT_THEME, {
      name: 'FoxOS Light', preset: 'light',
      colors: { theme: 'light' },
      chrome: { opacity: 82, blur: 20 },
      window: { radius: 14, shadow: { x: 0, y: 22, blur: 60, spread: -14, color: '#281E5A', alpha: 22 } },
      panel: { enter: 'slide', speed: 'fast', blur: 24 },
      button: { style: 'rounded' },
      texture: { kind: 'glass', opacity: 60, rain: 18, dock: 'pill' },
    }),

    neon: merge(DEFAULT_THEME, {
      name: 'FoxOS Neon', preset: 'neon',
      colors: { theme: 'neon' },
      chrome: { opacity: 55, blur: 24, icons: 'duotone' },
      window: { radius: 12, shadowPreset: 'neon', openAnim: 'flip' },
      panel: { enter: 'fold', speed: 'normal', blur: 32 },
      button: { style: 'sharp' },
      motion: { ease: 'elastic', stagger: 60 },
      texture: { kind: 'neon-grid', opacity: 100, rain: 55, dock: 'bar' },
      labs: { foxGlow: true },
      perElementAnims: { dock: 'fs-elastic-in', card: 'fs-flip-open', tile: 'fs-flip-open' },
    }),

    foxpurple: merge(DEFAULT_THEME, {
      name: 'FoxPurple', preset: 'foxpurple',
      colors: { theme: 'foxpurple' },
      chrome: { opacity: 70, blur: 20, height: 38 },
      window: { radius: 18, shadow: { x: 0, y: 30, blur: 80, spread: -14, color: '#140532', alpha: 70 }, openAnim: 'liquid' },
      panel: { enter: 'book', speed: 'slow', blur: 30, radius: 26 },
      button: { style: 'liquid', radius: 14 },
      motion: { ease: 'liquid' },
      texture: { kind: 'glass', opacity: 100, rain: 40, dock: 'pill' },
      labs: { liquidWindows: true, foxGlow: true },
      perElementAnims: { dock: 'fs-bounce-in', card: 'fs-liquid-open', tile: 'fs-elastic-in' },
    }),

    custom: merge(DEFAULT_THEME, {
      name: 'My FoxOS', preset: 'custom',
      colors: { theme: 'custom', accent: '#7B5CFF', accent2: '#FFA23A', bg: '#0B0A12', surface: '#161322', ink: '#F4F1FF', glass: 72 },
    }),
  };

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */
  let state   = clone(DEFAULT_THEME);  // live (edited, previewed)
  let applied = clone(DEFAULT_THEME);  // persisted
  let appliedAt = null;

  /* ------------------------------------------------------------------------
     Utils
     ------------------------------------------------------------------------ */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function merge(base, patch) {
    const out = clone(base);
    (function rec(t, p) {
      for (const k of Object.keys(p)) {
        if (isObj(p[k]) && isObj(t[k])) rec(t[k], p[k]);
        else t[k] = isObj(p[k]) ? clone(p[k]) : p[k];
      }
    })(out, patch);
    return out;
  }
  function get(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function set(obj, path, value) {
    const keys = path.split('.'); const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
    target[last] = value;
  }
  function setVar(name, value) {
    if (value == null || value === '') root.style.removeProperty(name);
    else root.style.setProperty(name, String(value));
  }
  function setAttr(name, value) {
    if (value == null || value === '' || value === 'auto') root.removeAttribute(name);
    else root.setAttribute(name, String(value));
  }
  function normHex(v) {
    if (!v) return null;
    let s = String(v).trim();
    if (!s.startsWith('#')) s = '#' + s;
    if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + [...s.slice(1)].map(c => c + c).join('');
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
  }
  function hexToRgb(hex) { const h = normHex(hex); if (!h) return null; const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function nearestSw(hex) {
    const c = hexToRgb(hex); if (!c) return null;
    let best = null, bd = Infinity;
    for (const [name, h] of Object.entries(SW_PALETTE)) {
      const p = hexToRgb(h);
      const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
      if (d < bd) { bd = d; best = name; }
    }
    return best;
  }
  function themeDefaultAccent(theme) {
    return { dark: '#7B5CFF', light: '#5B3FE0', neon: '#9D7BFF', foxpurple: '#A05AFF', custom: '#7B5CFF' }[theme] || '#7B5CFF';
  }
  function themeDefaultAccent2(theme) {
    return { dark: '#FFA23A', light: '#D9731A', neon: '#7EF06B', foxpurple: '#FFA23A', custom: '#FFA23A' }[theme] || '#FFA23A';
  }
  function effectiveAccent()  { return state.colors.accent  || themeDefaultAccent(state.colors.theme); }
  function effectiveAccent2() { return state.colors.accent2 || themeDefaultAccent2(state.colors.theme); }

  function diffCount(a, b) {
    let n = 0;
    (function rec(x, y) {
      const keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
      for (const k of keys) {
        const vx = x?.[k], vy = y?.[k];
        if (isObj(vx) || isObj(vy)) rec(vx, vy);
        else if (JSON.stringify(vx) !== JSON.stringify(vy)) n++;
      }
    })(a, b);
    return n;
  }

  function restartAnimations(el) {
    // Re-inserting the node restarts CSS animations (incl. ::before/::after).
    if (!el || !el.parentNode) return;
    const parent = el.parentNode, next = el.nextSibling;
    const active = document.activeElement;
    parent.removeChild(el);
    parent.insertBefore(el, next);
    if (active && el.contains(active)) active.focus?.({ preventScroll: true });
  }

  /* ------------------------------------------------------------------------
     applyState — state → DOM
     ------------------------------------------------------------------------ */
  function applyState(s = state) {
    const { colors, chrome, window: win, panel, button, motion, typography, texture, labs, perElementAnims } = s;

    /* --- colors ---------------------------------------------------------- */
    setAttr('data-theme', colors.theme);
    const isCustom = colors.theme === 'custom';
    if (isCustom) {
      const c = PRESETS.custom.colors;
      setVar('--fs-custom-accent',  colors.accent  || c.accent);
      setVar('--fs-custom-accent2', colors.accent2 || c.accent2);
      setVar('--fs-custom-bg',      colors.bg      || c.bg);
      setVar('--fs-custom-surface', colors.surface || c.surface);
      setVar('--fs-custom-ink',     colors.ink     || c.ink);
      setVar('--fs-custom-glass',   (colors.glass ?? 72) / 100);
      ['--fs-accent', '--fs-accent-bright', '--fs-accent-deep', '--fs-accent2', '--fs-accent2-deep', '--fs-bg', '--fs-bg-2', '--fs-surface', '--fs-surface-solid', '--fs-ink']
        .forEach(v => setVar(v, null));
    } else {
      ['--fs-custom-accent', '--fs-custom-accent2', '--fs-custom-bg', '--fs-custom-surface', '--fs-custom-ink', '--fs-custom-glass']
        .forEach(v => setVar(v, null));
      if (colors.accent) {
        setVar('--fs-accent', colors.accent);
        setVar('--fs-accent-bright', `color-mix(in oklab, ${colors.accent} 70%, white)`);
        setVar('--fs-accent-deep',   `color-mix(in oklab, ${colors.accent} 75%, black)`);
      } else { setVar('--fs-accent', null); setVar('--fs-accent-bright', null); setVar('--fs-accent-deep', null); }
      if (colors.accent2) {
        setVar('--fs-accent2', colors.accent2);
        setVar('--fs-accent2-deep', `color-mix(in oklab, ${colors.accent2} 78%, black)`);
      } else { setVar('--fs-accent2', null); setVar('--fs-accent2-deep', null); }
      setVar('--fs-bg', colors.bg);
      setVar('--fs-bg-2', colors.bg ? `color-mix(in srgb, ${colors.bg} 85%, ${effectiveAccent()} 15%)` : null);
      setVar('--fs-surface-solid', colors.surface);
      setVar('--fs-surface', colors.surface ? `color-mix(in srgb, ${colors.surface} ${colors.glass ?? 72}%, transparent)` : null);
      setVar('--fs-ink', colors.ink);
    }

    /* --- chrome bar ------------------------------------------------------ */
    setVar('--fs-chrome-opacity', (chrome.opacity ?? 72) / 100);
    setVar('--fs-chrome-blur',    `${chrome.blur ?? 18}px`);
    setVar('--fs-chrome-height',  `${chrome.height ?? 36}px`);
    setVar('--fs-chrome-radius',  chrome.floating ? '10px' : '0px');
    setVar('--fs-chrome-icon-size', `${chrome.iconSize ?? 16}px`);
    setAttr('data-icons', chrome.icons || 'line');
    const miniChrome = $('#fs-mini-chrome');
    if (miniChrome) miniChrome.dataset.float = chrome.floating ? 'true' : 'false';

    /* --- window ---------------------------------------------------------- */
    setVar('--fs-win-radius', `${win.radius ?? 16}px`);
    if (win.shadowPreset && win.shadowPreset !== 'custom') {
      setAttr('data-win-shadow', win.shadowPreset);
      ['--fs-win-shadow-x', '--fs-win-shadow-y', '--fs-win-shadow-blur', '--fs-win-shadow-spread', '--fs-win-shadow-color'].forEach(v => setVar(v, null));
    } else {
      setAttr('data-win-shadow', null);
      const sh = win.shadow || DEFAULT_THEME.window.shadow;
      setVar('--fs-win-shadow-x',      `${sh.x ?? 0}px`);
      setVar('--fs-win-shadow-y',      `${sh.y ?? 28}px`);
      setVar('--fs-win-shadow-blur',   `${sh.blur ?? 70}px`);
      setVar('--fs-win-shadow-spread', `${sh.spread ?? -12}px`);
      setVar('--fs-win-shadow-color',  `color-mix(in srgb, ${normHex(sh.color) || '#000000'} ${sh.alpha ?? 60}%, transparent)`);
    }
    setAttr('data-win-open', win.openAnim);
    $('#fs-shadow-card')?.toggleAttribute('data-disabled', win.shadowPreset !== 'custom');

    /* --- panel ----------------------------------------------------------- */
    setAttr('data-panel-enter', panel.enter || 'book');
    setAttr('data-panel-speed', panel.speed || 'normal');
    setVar('--fs-panel-blur',   `${panel.blur ?? 28}px`);
    setVar('--fs-panel-radius', `${panel.radius ?? 24}px`);

    /* --- buttons --------------------------------------------------------- */
    setAttr('data-buttons', button.style || 'glass');
    setVar('--fs-btn-radius', button.radius == null ? null : `${button.radius}px`);
    setVar('--fs-btn-press-scale', (button.pressScale ?? 97) / 100);

    /* --- motion ---------------------------------------------------------- */
    setAttr('data-motion', motion.scale || 'full');
    setVar('--fs-dur-fast', `${motion.fast ?? 160}ms`);
    setVar('--fs-dur-med',  `${motion.med ?? 320}ms`);
    setVar('--fs-dur-slow', `${motion.slow ?? 640}ms`);
    setVar('--fs-ease-standard', EASES[motion.ease] || null);
    setVar('--fs-stagger', `${motion.stagger ?? 45}ms`);

    /* --- typography ------------------------------------------------------ */
    setVar('--fs-font-ui',      FONT_STACKS[typography.ui]      || typography.ui      || null);
    setVar('--fs-font-display', FONT_STACKS[typography.display] || typography.display || null);
    setVar('--fs-font-mono',    FONT_STACKS[typography.mono]    || typography.mono    || null);
    setVar('--fs-fs-md', `${typography.size ?? 13.5}px`);
    setAttr('data-density', typography.density === 'normal' ? null : typography.density);
    setVar('--fs-track-tight', TRACKING[typography.tracking] ?? null);
    setVar('--fs-fw-semibold', typography.displayWeight || null);

    /* --- texture / backgrounds ------------------------------------------- */
    setAttr('data-texture', texture.kind || 'glass');
    setVar('--fs-texture-opacity', (texture.opacity ?? 100) / 100);
    setVar('--fs-rain-opacity', (texture.rain ?? 35) / 100);
    const dock = $('#fs-mini-dock');
    if (dock) { if (texture.dock && texture.dock !== 'card') dock.dataset.style = texture.dock; else delete dock.dataset.style; }

    /* --- labs ------------------------------------------------------------ */
    setAttr('data-lab-dynamic-shadows', labs.dynamicShadows ? 'on' : 'off');
    setAttr('data-lab-fox-glow',        labs.foxGlow        ? 'on' : 'off');
    setAttr('data-lab-motion-blur',     labs.motionBlur     ? 'on' : 'off');
    setAttr('data-lab-liquid-windows',  labs.liquidWindows  ? 'on' : 'off');
    if (!labs.dynamicShadows) { setVar('--fs-shadow-shift-x', null); setVar('--fs-shadow-shift-y', null); }

    /* --- per-element animations ----------------------------------------- */
    for (const [k, v] of Object.entries(perElementAnims || {})) setVar(`--fs-anim-${k}`, v || null);

    /* --- preview text ---------------------------------------------------- */
    const sw = nearestSw(effectiveAccent());
    const cmd = $('#fs-mini-cmd'); if (cmd) cmd.textContent = `sw ${sw}`;
    const tn = $('#fs-mini-theme-name'); if (tn) tn.textContent = s.name || colors.theme;
    const badge = $('#fs-accent-sw'); if (badge) badge.textContent = `sw ${sw}`;
    const pb = $('#fs-preset-badge'); if (pb) pb.textContent = s.preset || colors.theme;
  }

  /* ------------------------------------------------------------------------
     UI sync — state → controls
     ------------------------------------------------------------------------ */
  function fmt(v, unit) { return unit ? `${v}${unit}` : String(v); }

  function updateUI() {
    // generic bindings
    for (const el of $$('[data-bind]')) {
      const path = el.dataset.bind;
      const val  = get(state, path);
      const kind = el.dataset.kind || (el.classList.contains('fs-segment') ? 'segment' : (el.type === 'text' ? 'text' : null));
      switch (kind) {
        case 'range': {
          const slider = el.closest('.fs-slider');
          const out = slider?.querySelector('.fs-slider-value');
          if (val == null) {
            if (out) out.textContent = 'auto';
            if (slider) slider.style.setProperty('--_val', '0%');
          } else {
            el.value = val;
            const pct = ((val - el.min) / (el.max - el.min)) * 100;
            if (slider) slider.style.setProperty('--_val', `${pct}%`);
            if (out) out.textContent = fmt(val, el.dataset.unit);
          }
          break;
        }
        case 'toggle': el.checked = !!val; break;
        case 'select': el.value = val ?? ''; break;
        case 'color':  el.value = normHex(val) || (path === 'colors.accent' ? effectiveAccent() : path === 'colors.accent2' ? effectiveAccent2() : '#000000'); break;
        case 'hex':    el.value = normHex(val) || ''; break;
        case 'segment':
          for (const b of $$('button[data-value]', el)) b.setAttribute('aria-pressed', String(b.dataset.value === String(val)));
          break;
        case 'text':   el.value = val ?? ''; break;
        default: break;
      }
    }
    // swatches
    for (const grp of $$('[data-swatches]')) {
      const cur = normHex(get(state, grp.dataset.swatches)) || themeDefaultAccent(state.colors.theme);
      const name = nearestSw(cur);
      for (const b of $$('.fs-swatch', grp)) b.setAttribute('aria-pressed', String(b.dataset.sw === name && SW_PALETTE[name] === cur));
    }
    // preset tiles + quick chips
    for (const t of $$('#fs-preset-tiles .fs-tile')) t.setAttribute('aria-pressed', String(t.dataset.preset === state.preset));
    for (const c of $$('[data-quick-theme]')) c.setAttribute('aria-pressed', String(c.dataset.quickTheme === state.colors.theme));

    // JSON view + CLI
    const ta = $('#fs-json');
    if (ta && document.activeElement !== ta) {
      ta.value = JSON.stringify(state, null, 2);
      const sz = $('#fs-json-size'); if (sz) sz.textContent = `${new Blob([ta.value]).size} B`;
    }
    renderCli();
    updateDirty();
  }

  function updateDirty() {
    const n = diffCount(state, applied);
    const dirty = n > 0;
    const st = $('#fs-status');
    if (st) {
      st.dataset.dirty = String(dirty);
      st.textContent = dirty ? `${n} ${plural(n, 'зміна', 'зміни', 'змін')} не застосовано`
                             : (appliedAt ? `застосовано ${appliedAt}` : 'збережено');
    }
    $('#fs-apply')?.setAttribute('data-dirty', String(dirty));
    const rv = $('#fs-revert'); if (rv) rv.disabled = !dirty;
  }
  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }

  /* ------------------------------------------------------------------------
     CLI mapping — state → FoxOS commands
     ------------------------------------------------------------------------ */
  function renderCli() {
    const code = $('#fs-cli-code'); if (!code) return;
    const sw = nearestSw(effectiveAccent());
    const lines = [];
    const esc = (s) => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const cmd = (c, note) => lines.push(`<span class="fs-prompt">❯</span> ${esc(c)}${note ? `   <span class="fs-dim"># ${esc(note)}</span>` : ''}`);
    const dim = (t) => lines.push(`<span class="fs-dim"># ${esc(t)}</span>`);

    dim(`FOXSTYLE → FoxOS   theme: ${state.name} (${state.preset})`);
    cmd(`sw ${sw}`, `accent ${effectiveAccent()}${state.colors.accent ? '' : ' (preset default)'}`);
    if (state.colors.theme === 'light') cmd('sw white', 'light wallpaper base');
    cmd(state.texture.rain > 0 ? 'foxos on' : 'foxos off', state.texture.rain > 0 ? `ASCII rain ${state.texture.rain}%` : 'no rain wallpaper');
    cmd('foxlook on', 'dark + cursors + dock + Win keys');
    cmd(`foxlook dock style ${state.texture.dock || 'pill'}`);
    if (state.labs.foxGlow) cmd('shader glow', 'labs: fox glow (Ghostty shader)');
    if (state.texture.kind === 'neon-grid') cmd('shader grid', 'neon grid texture');
    lines.push('');
    dim('not yet mapped to CLI (panel-only):');
    dim(`  chrome ${state.chrome.opacity}% / blur ${state.chrome.blur}px / h ${state.chrome.height}px · window r${state.window.radius} · panel ${state.panel.enter}/${state.panel.speed} · buttons ${state.button.style}`);
    lines.push('');
    dim('restore Explorer shell:  %LOCALAPPDATA%\\FoxTerminal\\foxos\\restore-windows.cmd');
    code.innerHTML = lines.join('\n');
  }
  function cliPlainText() {
    const el = $('#fs-cli-code'); if (!el) return '';
    return el.innerText.split('\n').map(l => l.replace(/^❯\s?/, '')).join('\n');
  }

  /* ------------------------------------------------------------------------
     Storage · presets · import/export
     ------------------------------------------------------------------------ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SCHEMA_VERSION) {
          applied = merge(DEFAULT_THEME, parsed);
          appliedAt = parsed.__appliedAt || null;
          delete applied.__appliedAt;
        }
      }
    } catch (e) { console.warn('[foxstyle] load failed', e); }
    state = clone(applied);
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...applied, __appliedAt: appliedAt })); }
    catch (e) { console.warn('[foxstyle] save failed', e); }
  }
  function loadPreset(name) {
    let base = PRESETS[name] || PRESETS.dark;
    if (name === 'custom') {
      try { const raw = localStorage.getItem(CUSTOM_KEY); if (raw) base = merge(PRESETS.custom, JSON.parse(raw)); } catch {}
    }
    const prevAnim = state.window.openAnim;
    state = clone(base);
    state.preset = name;
    applyState(); updateUI();
    if (state.window.openAnim !== prevAnim) replayWindow();
    toast(`Пресет «${state.name}»`, 'success');
  }
  function validateTheme(obj) {
    if (!isObj(obj)) throw new Error('не об’єкт');
    if (obj.version != null && obj.version !== SCHEMA_VERSION) throw new Error(`невідома версія ${obj.version}`);
    const modules = ['colors', 'chrome', 'window', 'panel', 'button', 'motion', 'typography', 'texture', 'labs', 'perElementAnims'];
    for (const m of modules) if (obj[m] != null && !isObj(obj[m])) throw new Error(`модуль ${m} має бути об’єктом`);
    if (obj.colors?.theme && !['dark', 'light', 'neon', 'foxpurple', 'custom'].includes(obj.colors.theme)) throw new Error(`невідома тема ${obj.colors.theme}`);
    return true;
  }
  function importTheme(obj) {
    validateTheme(obj);
    const prevAnim = state.window.openAnim;
    state = merge(DEFAULT_THEME, obj);
    state.version = SCHEMA_VERSION;
    applyState(); updateUI();
    if (state.window.openAnim !== prevAnim) replayWindow();
  }
  function exportTheme() {
    const name = (state.name || 'theme').toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '');
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `foxstyle-${name || 'theme'}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('JSON експортовано', 'success');
  }

  /* ------------------------------------------------------------------------
     Apply · replay · toast
     ------------------------------------------------------------------------ */
  function apply(ev) {
    const btn = $('#fs-apply');
    if (btn) {
      if (ev && ev.clientX != null) {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--x', `${ev.clientX - r.left}px`);
        btn.style.setProperty('--y', `${ev.clientY - r.top}px`);
      } else { btn.style.removeProperty('--x'); btn.style.removeProperty('--y'); }
      btn.classList.remove('is-waving'); void btn.offsetWidth; btn.classList.add('is-waving');
      btn.dataset.state = 'done';
      setTimeout(() => { btn.classList.remove('is-waving'); delete btn.dataset.state; }, 900);
    }
    const mini = $('#fs-mini');
    if (mini) { mini.classList.remove('is-waving'); void mini.offsetWidth; mini.classList.add('is-waving'); setTimeout(() => mini.classList.remove('is-waving'), 900); }

    applied = clone(state);
    appliedAt = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    save();
    if (state.preset === 'custom') { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(state)); } catch {} }
    updateDirty();
    toast('Тему застосовано', 'success');
  }
  function revert() { state = clone(applied); applyState(); updateUI(); toast('Повернуто до застосованої'); }

  function replayWindow() {
    const w = $('#fs-mini-window'); if (!w) return;
    if (state.labs.motionBlur) { w.classList.add('fs-blur-on-move', 'is-moving'); setTimeout(() => w.classList.remove('is-moving'), state.motion.slow || 640); }
    restartAnimations(w);
  }
  function replayPanel() { restartAnimations($('.fs-book')); }
  function replayElements() {
    const groups = [
      ['.fs-mini-dock-item', 'dock'], ['.fs-nav-item', 'nav'],
      ['.fs-section:not([hidden]) .fs-card', 'card'], ['.fs-tile', 'tile'], ['.fs-toggle', 'toggle'],
    ];
    for (const [sel] of groups) {
      for (const el of $$(sel)) {
        el.classList.remove('is-replaying'); void el.offsetWidth; el.classList.add('is-replaying');
        el.addEventListener('animationend', () => el.classList.remove('is-replaying'), { once: true });
      }
    }
  }

  let toastTimer = null;
  function toast(msg, kind = 'info') {
    const host = $('#fs-toasts'); if (!host) return;
    host.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'fs-toast'; el.dataset.kind = kind; el.textContent = msg;
    host.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }

  /* ------------------------------------------------------------------------
     Panel open / close · sections
     ------------------------------------------------------------------------ */
  function openPanel() {
    $('#fs-reopen')?.setAttribute('hidden', '');
    const ov = $('#fs-overlay'), sh = $('#fs-shell');
    if (ov) ov.dataset.state = 'open';
    if (sh) sh.dataset.state = 'open';
    replayPanel();
    setTimeout(() => $('.fs-nav-item[aria-current="true"]')?.focus({ preventScroll: true }), 50);
  }
  function closePanel() {
    const ov = $('#fs-overlay'), sh = $('#fs-shell');
    if (sh) sh.dataset.state = 'closed';
    const ms = Math.max(120, (state.motion.scale === 'off' ? 0 : ({ fast: 320, normal: 640, slow: 1100 }[state.panel.speed] || 640) * 0.75));
    setTimeout(() => { if (ov) ov.dataset.state = 'closed'; $('#fs-reopen')?.removeAttribute('hidden'); }, ms);
  }
  function showSection(id, { pushHash = true } = {}) {
    let found = false;
    for (const sec of $$('.fs-section[data-section]')) {
      const on = sec.dataset.section === id;
      sec.toggleAttribute('hidden', !on);
      if (on) found = true;
    }
    if (!found) return showSection('themes', { pushHash });
    for (const b of $$('.fs-nav-item[data-section]')) {
      if (b.dataset.section === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
    const main = $('#fs-main'); if (main) main.scrollTop = 0;
    if (pushHash && history.replaceState) history.replaceState(null, '', `#${id}`);
  }

  /* ------------------------------------------------------------------------
     Wiring
     ------------------------------------------------------------------------ */
  function onChange(path, value, { live = true } = {}) {
    set(state, path, value);
    if (path === 'colors.theme') state.preset = value;
    if (live) applyState();
    updateUI();
  }

  function wire() {
    /* generic bindings */
    for (const el of $$('[data-bind]')) {
      const path = el.dataset.bind;
      const kind = el.dataset.kind || (el.classList.contains('fs-segment') ? 'segment' : 'text');
      switch (kind) {
        case 'range':
          el.addEventListener('input', () => {
            const v = el.step && String(el.step).includes('.') ? parseFloat(el.value) : parseInt(el.value, 10);
            onChange(path, v);
          });
          break;
        case 'toggle':
          el.addEventListener('change', () => {
            onChange(path, el.checked);
            const lab = el.closest('.fs-toggle');
            if (lab) { lab.classList.remove('is-replaying'); void lab.offsetWidth; lab.classList.add('is-replaying'); lab.addEventListener('animationend', () => lab.classList.remove('is-replaying'), { once: true }); }
          });
          break;
        case 'select':
          el.addEventListener('change', () => { onChange(path, el.value); if (path.startsWith('perElementAnims.')) replayElements(); });
          break;
        case 'color':
          el.addEventListener('input', () => onChange(path, normHex(el.value)));
          break;
        case 'hex':
          el.addEventListener('change', () => {
            const h = normHex(el.value);
            if (el.value.trim() === '') return onChange(path, null);
            if (!h) { el.value = normHex(get(state, path)) || ''; return toast('Невалідний hex', 'danger'); }
            onChange(path, h);
          });
          break;
        case 'segment':
          el.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-value]'); if (!b) return;
            const prevAnim = state.window.openAnim;
            onChange(path, b.dataset.value);
            if (path === 'window.openAnim' && state.window.openAnim !== prevAnim) replayWindow();
            if (path === 'panel.enter' || path === 'panel.speed') replayPanel();
          });
          break;
        default: // text
          el.addEventListener('input', () => onChange(path, el.value));
      }
    }

    /* clear buttons → null */
    for (const b of $$('[data-clear]')) b.addEventListener('click', () => onChange(b.dataset.clear, null));

    /* swatches */
    for (const grp of $$('[data-swatches]')) {
      grp.addEventListener('click', (e) => {
        const b = e.target.closest('.fs-swatch'); if (!b) return;
        onChange(grp.dataset.swatches, SW_PALETTE[b.dataset.sw] || null);
      });
    }

    /* presets */
    $('#fs-preset-tiles')?.addEventListener('click', (e) => {
      const t = e.target.closest('.fs-tile[data-preset]'); if (!t) return;
      loadPreset(t.dataset.preset);
    });
    for (const c of $$('[data-quick-theme]')) c.addEventListener('click', () => loadPreset(c.dataset.quickTheme));

    /* nav */
    for (const b of $$('.fs-nav-item[data-section]')) b.addEventListener('click', () => showSection(b.dataset.section));
    window.addEventListener('hashchange', () => showSection(location.hash.slice(1) || 'themes', { pushHash: false }));

    /* actions */
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      switch (a.dataset.action) {
        case 'replay-window':   replayWindow(); break;
        case 'replay-panel':    replayPanel(); break;
        case 'replay-elements': replayElements(); break;
        case 'reset-preset':    loadPreset(state.preset || 'dark'); break;
        case 'reset-colors':
          state.colors = { ...clone(PRESETS[state.colors.theme === 'custom' ? 'custom' : 'dark'].colors), theme: state.colors.theme };
          applyState(); updateUI(); break;
        case 'revert':          revert(); break;
        case 'export':          exportTheme(); break;
        case 'import':          $('#fs-import-file')?.click(); break;
        case 'apply-json':
          try { importTheme(JSON.parse($('#fs-json').value)); toast('JSON застосовано у прев’ю', 'success'); }
          catch (err) { toast(`JSON помилка: ${err.message}`, 'danger'); }
          break;
        case 'save-custom':
          state.preset = 'custom'; state.colors.theme = 'custom';
          if (!state.colors.accent) state.colors.accent = effectiveAccent();
          if (!state.colors.accent2) state.colors.accent2 = effectiveAccent2();
          state.colors.bg ??= PRESETS.custom.colors.bg; state.colors.surface ??= PRESETS.custom.colors.surface; state.colors.ink ??= PRESETS.custom.colors.ink;
          try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(state)); } catch {}
          applyState(); updateUI(); toast('Збережено як Custom', 'success'); break;
        case 'clear-storage':
          localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(CUSTOM_KEY);
          applied = clone(DEFAULT_THEME); appliedAt = null; updateDirty(); toast('Сховище очищено'); break;
        case 'copy-cli':
          navigator.clipboard?.writeText(cliPlainText()).then(() => toast('Команди скопійовано', 'success'), () => toast('Clipboard недоступний', 'danger'));
          break;
        default: break;
      }
    });

    $('#fs-import-file')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      f.text().then(t => { importTheme(JSON.parse(t)); toast(`Імпортовано «${state.name}»`, 'success'); })
        .catch(err => toast(`Імпорт: ${err.message}`, 'danger'))
        .finally(() => { e.target.value = ''; });
    });

    /* apply / close / reopen / keyboard */
    $('#fs-apply')?.addEventListener('click', apply);
    $('#fs-close')?.addEventListener('click', closePanel);
    $('#fs-reopen')?.addEventListener('click', openPanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#fs-overlay')?.dataset.state === 'open') { closePanel(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); apply(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); apply(); }
    });

    /* dynamic shadows (labs) */
    const mini = $('#fs-mini');
    if (mini) {
      mini.addEventListener('pointermove', (e) => {
        if (!state.labs.dynamicShadows) return;
        const w = $('#fs-mini-window'); if (!w) return;
        const r = w.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        setVar('--fs-shadow-shift-x', `${(-dx * 24).toFixed(1)}px`);
        setVar('--fs-shadow-shift-y', `${(-dy * 16).toFixed(1)}px`);
      });
      mini.addEventListener('pointerleave', () => { setVar('--fs-shadow-shift-x', null); setVar('--fs-shadow-shift-y', null); });
    }

    /* JSON textarea live-edit size badge */
    $('#fs-json')?.addEventListener('input', (e) => { const sz = $('#fs-json-size'); if (sz) sz.textContent = `${new Blob([e.target.value]).size} B`; });

    /* clock */
    const tick = () => { const c = $('#fs-mini-clock'); if (c) c.textContent = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 30000);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function boot() {
    load();
    applyState();
    wire();
    updateUI();
    showSection(location.hash.slice(1) || 'themes', { pushHash: false });
    // book-open on load is CSS-driven (.fs-shell animation); ensure overlay state
    $('#fs-overlay')?.setAttribute('data-state', 'open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* public API for console / future FoxOS bridge */
  window.FoxStyle = {
    get state() { return clone(state); },
    get applied() { return clone(applied); },
    presets: Object.keys(PRESETS),
    loadPreset, importTheme, exportTheme, apply, revert, applyState: () => applyState(), replayWindow, replayPanel, showSection,
    set(path, value) { onChange(path, value); },
    SW_PALETTE, DEFAULT_THEME,
  };
})();
