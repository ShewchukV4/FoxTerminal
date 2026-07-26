'use strict';

function mapHeightOf(world) {
  return world.mapHeight ?? (typeof world.height === 'number' ? world.height : 600);
}

function cellHeightsOf(gen) {
  return gen.heights || gen.height;
}

function seaLevelOf(world, gen) {
  return gen?.seaLevel ?? world?.seaLevel ?? 0.33;
}

function cellPairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex) {
  const raw = (hex || '#000000').replace('#', '');
  if (raw.length !== 6) return [0, 0, 0];
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16)
  ];
}

function mixHex(a, b, t) {
  const p = clamp(t, 0, 1);
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const rr = Math.round(ar + (br - ar) * p);
  const rg = Math.round(ag + (bg - ag) * p);
  const rb = Math.round(ab + (bb - ab) * p);
  return `rgb(${rr},${rg},${rb})`;
}

function smoothPathFromCells(cells, points) {
  if (!cells || cells.length < 2) return '';
  const pts = cells.map(c => points[c]);
  if (pts.length === 2) {
    return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const mx = (cx + nx) / 2;
    const my = (cy + ny) / 2;
    d += ` Q${cx},${cy} ${mx},${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0]},${last[1]}`;
  return d;
}

const MapRenderer = {
  layers: {
    ocean: true,
    land: true,
    relief: false,
    rivers: true,
    borders: true,
    routes: false,
    labels: true,
    markers: true,
    grid: false,
    vignette: true
  },
  viewMode: 'political',

  render(world, gen) {
    if (!gen.voronoi) gen = WorldGenerator.fromData(world);
    this._renderOcean(world, gen);
    this._renderLand(world, gen);
    this._renderRelief(world, gen);
    this._renderRivers(world, gen);
    this._renderBorders(world, gen);
    this._renderRoutes(world, gen);
    this._renderMarkers(world, gen);
    this._renderLabels(world, gen);
    this._renderGrid(world, gen);
    this._renderVignette(world, gen);
    this._applyLayerVisibility();
  },

  _cellPath(gen, i) {
    if (gen.cellPaths?.[i]) return gen.cellPaths[i];
    const poly = gen.voronoi.cellPolygon(i);
    if (!poly) return '';
    return 'M' + poly.map(p => p.join(',')).join('L') + 'Z';
  },

  _renderOcean(world, gen) {
    const g = document.getElementById('layerOcean');
    const h = mapHeightOf(world);
    g.innerHTML = `
      <rect width="${world.width}" height="${h}" fill="#081222"/>
      <rect width="${world.width}" height="${h}" fill="url(#oceanGrad)" opacity="0.95"/>
      <ellipse cx="${world.width * 0.5}" cy="${h * 0.52}" rx="${world.width * 0.6}" ry="${h * 0.58}" fill="url(#oceanShelfGrad)" opacity="0.32"/>
    `;
  },

  _renderLand(world, gen) {
    const g = document.getElementById('layerLand');
    const mode = this.viewMode;
    const elev = cellHeightsOf(gen);
    const seaLevel = seaLevelOf(world, gen);
    let html = '';
    for (let i = 0; i < gen.points.length; i++) {
      const path = this._cellPath(gen, i);
      if (!path) continue;
      let fill;
      if (mode === 'height') {
        const h = elev[i];
        const v = Math.floor(h * 220);
        fill = `rgb(${v * 0.4 | 0},${v * 0.55 | 0},${v * 0.35 | 0})`;
      } else if (mode === 'biomes' || mode === 'physical') {
        fill = BIOMES[gen.biome[i]]?.color || '#333';
      } else {
        const sid = gen.stateOf[i];
        const waterKind = gen.waterKind?.[i] || 'ocean';
        if (elev[i] < seaLevel) {
          const depth = clamp((seaLevel - elev[i]) / seaLevel, 0, 1);
          if (waterKind === 'lake') fill = mixHex('#5ca4cf', '#2e648f', depth * 0.55);
          else if (waterKind === 'sea') fill = mixHex('#2d6798', '#123659', depth * 0.65);
          else if (waterKind === 'deep') fill = mixHex('#1b426e', '#08172a', depth * 0.9);
          else fill = mixHex('#2f5f96', '#0b2038', depth * 0.82);
        } else if (sid >= 0) {
          const tone = clamp((elev[i] - seaLevel) / 0.6, 0, 1);
          fill = mixHex(world.states[sid].color, '#f2e7c7', tone * 0.28);
        } else {
          fill = BIOMES[gen.biome[i]].color;
        }
      }
      const isLand = elev[i] >= seaLevel;
      const isCoast = isLand && gen.neighbors[i].some(nb => elev[nb] < seaLevel);
      const stroke = mode === 'physical'
        ? 'rgba(0,0,0,0.16)'
        : (isCoast ? 'rgba(240,214,164,0.65)' : 'rgba(255,255,255,0.04)');
      const strokeWidth = isCoast ? 0.7 : 0.38;
      html += `<path data-cell="${i}" d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }
    g.innerHTML = html;
  },

  _renderRelief(world, gen) {
    const g = document.getElementById('layerRelief');
    const elev = cellHeightsOf(gen);
    let html = '';
    const step = Math.max(1, Math.floor(gen.points.length / 400));
    for (let i = 0; i < gen.points.length; i += step) {
      if (elev[i] < 0.55 || elev[i] > 0.9) continue;
      if (this.randish(i, world.seed) > 0.35) continue;
      const [x, y] = gen.points[i];
      const s = 2 + elev[i] * 4;
      html += `<circle cx="${x}" cy="${y}" r="${s}" fill="rgba(0,0,0,0.08)"/>`;
    }
    g.innerHTML = html;
  },

  randish(i, seed) {
    return ((i * 9301 + seed) % 233280) / 233280;
  },

  _renderRivers(world, gen) {
    const g = document.getElementById('layerRivers');
    let html = '';
    gen.rivers.forEach(river => {
      const d = smoothPathFromCells(river, gen.points);
      if (!d) return;
      html += `<path d="${d}" fill="none" stroke="#2d7ec7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>`;
      html += `<path d="${d}" fill="none" stroke="#9ad8ff" stroke-width="0.75" stroke-linecap="round" opacity="0.55"/>`;
    });
    g.innerHTML = html;
  },

  _sharedEdge(gen, i, j) {
    return gen.sharedEdges?.get(cellPairKey(i, j)) || null;
  },

  _renderBorders(world, gen) {
    const g = document.getElementById('layerBorders');
    const elev = cellHeightsOf(gen);
    const seaLevel = seaLevelOf(world, gen);
    const edges = new Set();
    let html = '';
    for (let i = 0; i < gen.points.length; i++) {
      const si = gen.stateOf[i];
      if (si < 0 || elev[i] < seaLevel) continue;
      const nbs = gen.neighbors[i];
      for (let k = 0; k < nbs.length; k++) {
        const j = nbs[k];
        const sj = gen.stateOf[j];
        if (sj < 0 || si === sj || elev[j] < seaLevel) continue;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (edges.has(key)) continue;
        edges.add(key);
        const seg = this._sharedEdge(gen, i, j);
        if (seg) {
          html += `<line x1="${seg[0][0]}" y1="${seg[0][1]}" x2="${seg[1][0]}" y2="${seg[1][1]}" stroke="#20170f" stroke-width="1.05" stroke-linecap="round" opacity="0.62"/>`;
        } else {
          html += `<line x1="${gen.points[i][0]}" y1="${gen.points[i][1]}" x2="${gen.points[j][0]}" y2="${gen.points[j][1]}" stroke="#20170f" stroke-width="0.9" opacity="0.45"/>`;
        }
      }
    }
    g.innerHTML = html;
  },

  _renderRoutes(world, gen) {
    const g = document.getElementById('layerRoutes');
    let html = '';
    (gen.routes || []).forEach(route => {
      const d = smoothPathFromCells(route, gen.points);
      if (!d) return;
      html += `<path d="${d}" fill="none" stroke="#8b6914" stroke-width="1.2" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.62"/>`;
    });
    g.innerHTML = html;
  },

  _renderMarkers(world, gen) {
    const g = document.getElementById('layerMarkers');
    let html = '';
    gen.settlements.forEach(s => {
      const [x, y] = gen.points[s.cell];
      const r = s.type === 'capital' ? 5 : 3;
      const col = s.type === 'capital' ? '#ffd56b' : '#e8dcc8';
      html += `<circle cx="${x}" cy="${y}" r="${r + 2}" fill="rgba(0,0,0,0.35)"/>`;
      html += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" stroke="#2a2018" stroke-width="1"/>`;
      if (s.type === 'capital') {
        html += `<path d="M${x},${y - r - 6} L${x + 4},${y - 2} L${x},${y} L${x - 4},${y - 2}Z" fill="#c9a227" stroke="#3a2a10" stroke-width="0.5"/>`;
      }
    });
    g.innerHTML = html;
  },

  _renderLabels(world, gen) {
    const g = document.getElementById('layerLabels');
    let html = '';
    const capitals = gen.settlements.filter(s => s.type === 'capital');
    const towns = gen.settlements.filter(s => s.type !== 'capital').slice(0, 10);

    capitals.forEach(s => {
      const [x, y] = gen.points[s.cell];
      html += `<text x="${x}" y="${y - 11}" text-anchor="middle" font-size="11.5" font-weight="700" letter-spacing="0.3" fill="#f5eed8" stroke="#1a1408" stroke-width="2.7" paint-order="stroke" font-family="Cinzel,serif">${s.name}</text>`;
    });

    towns.forEach((s, idx) => {
      const [x, y] = gen.points[s.cell];
      const dy = idx % 2 === 0 ? -8 : 12;
      html += `<text x="${x}" y="${y + dy}" text-anchor="middle" font-size="7.4" font-weight="500" fill="#dcd2bf" stroke="#1a1408" stroke-width="1.5" opacity="0.8" paint-order="stroke" font-family="Inter,sans-serif">${s.name}</text>`;
    });

    gen.states.forEach(st => {
      if (!st.cellCount) return;
      const sx = st.centroidX ?? gen.points[st.capital][0];
      const sy = st.centroidY ?? gen.points[st.capital][1];
      html += `<text x="${sx}" y="${sy}" text-anchor="middle" font-size="9.3" fill="${st.color}" opacity="0.3" font-family="Cinzel,serif" font-weight="600">${st.name}</text>`;
    });

    html += `<text x="${world.width / 2}" y="36" text-anchor="middle" font-size="22" fill="#e8dcc8" font-family="Cinzel,serif" font-weight="700" opacity="0.9">${world.worldName}</text>`;
    g.innerHTML = html;
  },

  _renderGrid(world, gen) {
    const g = document.getElementById('layerGrid');
    const h = mapHeightOf(world);
    let html = '';
    const step = 50;
    for (let x = 0; x <= world.width; x += step) {
      html += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;
    }
    for (let y = 0; y <= h; y += step) {
      html += `<line x1="0" y1="${y}" x2="${world.width}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>`;
    }
    g.innerHTML = html;
  },

  _renderVignette(world, gen) {
    const g = document.getElementById('layerVignette');
    const h = mapHeightOf(world);
    const id = 'vignetteGrad';
    document.getElementById('mapDefs').innerHTML = `
      <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#23476f"/>
        <stop offset="45%" stop-color="#18385e"/>
        <stop offset="100%" stop-color="#0b1f36"/>
      </linearGradient>
      <radialGradient id="oceanShelfGrad" cx="50%" cy="48%" r="58%">
        <stop offset="0%" stop-color="#4f86b8" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#1f3f64" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}" cx="50%" cy="50%" r="55%">
        <stop offset="52%" stop-color="transparent"/>
        <stop offset="100%" stop-color="rgba(4,8,16,0.75)"/>
      </radialGradient>`;
    g.innerHTML = `<rect width="${world.width}" height="${h}" fill="url(#${id})" pointer-events="none"/>`;
  },

  _applyLayerVisibility() {
    const map = {
      ocean: 'layerOcean',
      land: 'layerLand',
      relief: 'layerRelief',
      rivers: 'layerRivers',
      borders: 'layerBorders',
      routes: 'layerRoutes',
      labels: 'layerLabels',
      markers: 'layerMarkers',
      grid: 'layerGrid',
      vignette: 'layerVignette'
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = this.layers[key] ? '' : 'none';
    });
  },

  buildLayerUI(container) {
    const labels = {
      ocean: 'Океан', land: 'Суша / режим', relief: 'Рельєф (тіні)',
      rivers: 'Річки', borders: 'Кордони держав', routes: 'Торгові шляхи',
      labels: 'Підписи', markers: 'Міста', grid: 'Сітка', vignette: 'Віньєтка'
    };
    container.innerHTML = Object.keys(this.layers).map(key => `
      <li><label class="layer-item">
        <input type="checkbox" data-layer="${key}" ${this.layers[key] ? 'checked' : ''}>
        <span>${labels[key]}</span>
      </label></li>`).join('');
    container.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        this.layers[inp.dataset.layer] = inp.checked;
        this._applyLayerVisibility();
      });
    });
  }
};

window.MapRenderer = MapRenderer;
