'use strict';

let worldData = null;
let generator = null;
let zoom = 1;
let panX = 0, panY = 0;
let drag = null;

const $ = s => document.querySelector(s);

function showLoading(on) {
  $('#loading').hidden = !on;
}

function updateStats() {
  if (!worldData) return;
  const s = worldData;
  $('#mapStats').textContent =
    `${s.worldName} · seed ${s.seed} · ${s.cellCount} клітин · ${s.states.length} держав · ${s.settlements.length} поселень · ${s.rivers.length} річок`;
}

function applyWorldViewBox() {
  if (!worldData) return;
  const h = worldData.mapHeight ?? 600;
  $('#mapSvg').setAttribute('viewBox', `0 0 ${worldData.width} ${h}`);
}

function getOptions() {
  const cellSlider = $('#rngCells');
  const cells = Math.max(+cellSlider.min, Math.min(+cellSlider.max, +cellSlider.value || 1000));
  return {
    seed: hashSeed($('#inpSeed').value || String(Date.now())),
    worldName: $('#inpWorldName').value.trim() || undefined,
    stateCount: +$('#rngStates').value,
    cellCount: cells
  };
}

function saveMeta() {
  if (!worldData) return;
  const meta = {
    seed: worldData.seed,
    worldName: worldData.worldName,
    stateCount: worldData.states.length,
    cellCount: worldData.cellCount
  };
  localStorage.setItem('fox-realm-meta', JSON.stringify(meta));
}

function generateWorld() {
  showLoading(true);
  $('#mapStats').textContent = 'Генерую світ…';
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        getDelaunayLib();
        const opts = getOptions();
        const gen = new WorldGenerator(opts);
        if (opts.worldName) gen.worldName = opts.worldName;
        const tGen = performance.now();
        worldData = gen.generate();
        const genMs = performance.now() - tGen;
        generator = gen;
        requestAnimationFrame(() => {
          try {
            const tRender = performance.now();
            applyWorldViewBox();
            $('#inpSeed').value = String(worldData.seed);
            $('#inpWorldName').value = worldData.worldName;
            MapRenderer.render(worldData, generator);
            const renderMs = performance.now() - tRender;
            updateStats();
            $('#mapStats').textContent += ` · gen ${Math.round(genMs)}ms · render ${Math.round(renderMs)}ms`;
            saveMeta();
          } catch (e) {
            console.error(e);
            $('#mapStats').textContent = 'Помилка рендеру: ' + e.message;
          } finally {
            showLoading(false);
          }
        });
      } catch (e) {
        console.error(e);
        $('#mapStats').textContent = 'Помилка: ' + e.message;
        showLoading(false);
      }
    }, 16);
  });
}

function setupPanZoom() {
  const vp = $('#mapViewport');
  const svg = $('#mapSvg');

  function applyTransform() {
    svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.4, Math.min(4, zoom * delta));
    applyTransform();
  }, { passive: false });

  vp.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX - panX, y: e.clientY - panY };
    vp.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    panX = e.clientX - drag.x;
    panY = e.clientY - drag.y;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    drag = null;
    vp.classList.remove('dragging');
  });

  vp.addEventListener('dblclick', () => {
    zoom = 1; panX = 0; panY = 0;
    applyTransform();
  });

  $('#btnZoomIn').addEventListener('click', () => { zoom = Math.min(4, zoom * 1.2); applyTransform(); });
  $('#btnZoomOut').addEventListener('click', () => { zoom = Math.max(0.4, zoom / 1.2); applyTransform(); });
  $('#btnZoomReset').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; applyTransform(); });
}

function exportPng() {
  const svg = $('#mapSvg');
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgData = new XMLSerializer().serializeToString(clone);
  const canvas = document.createElement('canvas');
  canvas.width = worldData.width * 2;
  canvas.height = (worldData.mapHeight ?? 600) * 2;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = (worldData.worldName || 'realm') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = url;
}

function saveJson() {
  if (!worldData) return;
  const blob = new Blob([JSON.stringify(worldData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = (worldData.worldName || 'realm') + '.json';
  a.href = URL.createObjectURL(blob);
  a.click();
}

function loadJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      worldData = JSON.parse(reader.result);
      generator = WorldGenerator.fromData(worldData);
      applyWorldViewBox();
      $('#inpSeed').value = String(worldData.seed);
      $('#inpWorldName').value = worldData.worldName;
      MapRenderer.render(worldData, generator);
      updateStats();
    } catch {
      alert('Невірний файл світу');
    }
  };
  reader.readAsText(file);
}

function setupBg() {
  const c = $('#bgCanvas');
  const ctx = c.getContext('2d');
  function resize() {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  let t = 0;
  function draw() {
    t++;
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(t * 0.002 + i) * 0.5 + 0.5) * c.width;
      const y = (Math.cos(t * 0.0015 + i * 1.3) * 0.5 + 0.5) * c.height;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,140,200,${0.08 + 0.06 * Math.sin(t * 0.01 + i)})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

function init() {
  setupBg();
  setupPanZoom();
  MapRenderer.buildLayerUI($('#layerList'));

  try {
    getDelaunayLib();
  } catch (e) {
    $('#mapStats').textContent = e.message;
    showLoading(false);
    return;
  }

  localStorage.removeItem('fox-realm-last');

  $('#rngStates').addEventListener('input', e => { $('#outStates').textContent = e.target.value; });
  $('#rngCells').addEventListener('input', e => { $('#outCells').textContent = e.target.value; });

  $('#btnNewMap').addEventListener('click', generateWorld);
  $('#btnRandomSeed').addEventListener('click', () => {
    $('#inpSeed').value = String(Math.floor(Math.random() * 1e9));
    generateWorld();
  });
  $('#btnExportPng').addEventListener('click', exportPng);
  $('#btnSave').addEventListener('click', saveJson);
  $('#btnLoad').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', e => {
    if (e.target.files[0]) loadJson(e.target.files[0]);
    e.target.value = '';
  });

  document.querySelectorAll('#viewPresets .preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#viewPresets .preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      MapRenderer.viewMode = btn.dataset.view;
      if (worldData) MapRenderer.render(worldData, generator);
    });
  });

  const metaRaw = localStorage.getItem('fox-realm-meta');
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      if (meta.seed != null) $('#inpSeed').value = String(meta.seed);
      if (meta.worldName) $('#inpWorldName').value = meta.worldName;
      if (meta.stateCount) { $('#rngStates').value = meta.stateCount; $('#outStates').textContent = meta.stateCount; }
      if (meta.cellCount) {
        const slider = $('#rngCells');
        const clamped = Math.max(+slider.min, Math.min(+slider.max, +meta.cellCount));
        slider.value = clamped;
        $('#outCells').textContent = clamped;
      }
    } catch { /* ignore */ }
  }

  if (!$('#inpSeed').value) {
    $('#inpSeed').value = String(Math.floor(Math.random() * 999999));
  }
  generateWorld();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
