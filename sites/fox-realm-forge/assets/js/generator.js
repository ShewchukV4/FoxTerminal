'use strict';

const BIOMES = {
  ocean:   { id: 'ocean',   name: 'Океан',      color: '#1a3a5c', habitability: 0 },
  deep:    { id: 'deep',    name: 'Глибокий океан', color: '#0f2840', habitability: 0 },
  sea:     { id: 'sea',     name: 'Море',       color: '#24557f', habitability: 0 },
  lake:    { id: 'lake',    name: 'Озеро',      color: '#3d7ea8', habitability: 0 },
  beach:   { id: 'beach',   name: 'Пляж',       color: '#d4c4a0', habitability: 0.3 },
  grass:   { id: 'grass',   name: 'Степи',      color: '#6b9e4a', habitability: 0.7 },
  forest:  { id: 'forest',  name: 'Ліс',        color: '#2d6b3a', habitability: 0.85 },
  swamp:   { id: 'swamp',   name: 'Болото',     color: '#4a6b52', habitability: 0.4 },
  desert:  { id: 'desert',  name: 'Пустеля',    color: '#c9a86c', habitability: 0.35 },
  hills:   { id: 'hills',   name: 'Пагорби',    color: '#7a8f5e', habitability: 0.55 },
  mountain:{ id: 'mountain',name: 'Гори',       color: '#6b6b6b', habitability: 0.15 },
  snow:    { id: 'snow',    name: 'Сніг',       color: '#e8eef5', habitability: 0.1 }
};

const STATE_COLORS = [
  '#c45c4a', '#4a7ab5', '#5a9e6f', '#b59b4a', '#8b5a9e', '#4a9e9e',
  '#b56b4a', '#6b7ab5', '#9e5a6b', '#5ab57a', '#7a5ab5', '#b5a04a',
  '#4a6b8b', '#8b6b4a', '#5a8b8b', '#9e4a5a', '#6b9e5a', '#5a5a9e',
  '#b58b4a', '#4a9e7a', '#9e6b4a', '#6b4a9e', '#4ab5a0', '#b54a7a'
];

const WORLD_NAME_PREFIXES = ['Aether', 'Elder', 'Storm', 'Silver', 'North', 'Sun', 'Moon', 'Wild', 'Dragon', 'Iron'];
const WORLD_NAME_SUFFIXES = ['reach', 'vale', 'march', 'coast', 'realm', 'isles', 'wilds', 'expanse', 'frontier', 'hollow'];
const WORLD_NAME_CORES = ['Aldor', 'Velar', 'Caelum', 'Orinth', 'Thyra', 'Merev', 'Dorian', 'Zephir', 'Kaelis', 'Vesper'];

const TITLE_WORDS = ['Kingdom', 'Empire', 'Duchy', 'Free Republic', 'Confederation', 'Principality', 'Grand Duchy', 'High Dominion'];
const STATE_NOUNS = ['Realm', 'March', 'Crown', 'League', 'Throne', 'Hold', 'Union', 'Compact'];
const STATE_ADJECTIVES = ['Northern', 'Southern', 'Eastern', 'Western', 'Upper', 'Lower', 'Emerald', 'Golden', 'Ashen', 'Crimson'];

const NAME_FRAG_START = ['al', 'an', 'ar', 'bel', 'cal', 'cor', 'dar', 'del', 'dor', 'el', 'fal', 'gal', 'hal', 'is', 'ka', 'lor', 'mar', 'nor', 'or', 'ra', 'rin', 'sel', 'tal', 'tor', 'ur', 'val', 'ver', 'wyn', 'zel'];
const NAME_FRAG_MID = ['a', 'ae', 'an', 'ar', 'el', 'en', 'er', 'ia', 'il', 'in', 'ir', 'or', 'os', 'ra', 'ri', 'ta', 'th', 'ul', 'ur', 'va'];
const NAME_FRAG_END = ['a', 'an', 'ar', 'as', 'ea', 'el', 'en', 'er', 'eth', 'ia', 'ion', 'is', 'on', 'or', 'os', 'um', 'us', 'yn'];

const CAPITAL_PREFIXES = ['Port', 'High', 'Stone', 'Silver', 'Dawn', 'Raven', 'Iron', 'Sun', 'Moon', 'Storm'];
const CAPITAL_SUFFIXES = ['haven', 'gate', 'watch', 'spire', 'hold', 'crest', 'port', 'ford', 'keep', 'fall'];
const TOWN_SUFFIXES = ['ford', 'brook', 'field', 'cross', 'bridge', 'stead', 'mere', 'den', 'crest', 'moor', 'hollow', 'wick'];
const DEFAULT_SEA_LEVEL = 0.33;
const EDGE_KEY_SCALE = 10;

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function quantizedPointKey(p) {
  return `${Math.round(p[0] * EDGE_KEY_SCALE)}:${Math.round(p[1] * EDGE_KEY_SCALE)}`;
}

function normalizedEdgeKey(a, b) {
  const ka = quantizedPointKey(a);
  const kb = quantizedPointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

class WorldGenerator {
  constructor(opts = {}) {
    this.width = opts.width || 1000;
    this.mapHeight = opts.height || 600;
    this.seed = opts.seed ?? Date.now();
    this.cellCount = opts.cellCount || 1200;
    this.stateCount = opts.stateCount || 12;
    this.seaLevel = opts.seaLevel ?? DEFAULT_SEA_LEVEL;
    this.noise = Noise2D.create(this.seed);
    this.rand = this.noise.rand;
    this.worldName = opts.worldName || this._worldName();
  }

  generate() {
    const Delaunay = getDelaunayLib();
    this.points = this._placePoints();
    if (this.points.length < 200) {
      throw new Error('Замало точок на карті — спробуй інший seed');
    }
    this.delaunay = Delaunay.from(this.points);
    this.voronoi = this.delaunay.voronoi([0, 0, this.width, this.mapHeight]);
    this.neighbors = this._buildNeighbors();
    this._cacheCellPaths();
    this._generateHeight();
    this._adjustSeaLevel();
    this._carveLakes();
    this._classifyWater();
    this._generateMoisture();
    this._assignBiomes();
    this._generateRivers();
    this._generateStates();
    this._generateSettlements();
    this._generateRoutes();
    return this.export();
  }

  _cacheCellPaths() {
    const n = this.points.length;
    this.cellPaths = new Array(n);
    this.cellPolygons = new Array(n);
    this.sharedEdges = new Map();
    const edgeOwner = new Map();
    for (let i = 0; i < n; i++) {
      const poly = this.voronoi.cellPolygon(i);
      if (!poly) {
        this.cellPolygons[i] = null;
        this.cellPaths[i] = '';
        continue;
      }
      const points = poly.map(p => [p[0], p[1]]);
      this.cellPolygons[i] = points;
      this.cellPaths[i] = 'M' + points.map(p => p.join(',')).join('L') + 'Z';
      for (let k = 0; k < points.length - 1; k++) {
        const a = points[k];
        const b = points[k + 1];
        const edgeKey = normalizedEdgeKey(a, b);
        if (!edgeOwner.has(edgeKey)) {
          edgeOwner.set(edgeKey, { cell: i, segment: [a, b] });
          continue;
        }
        const owner = edgeOwner.get(edgeKey);
        this.sharedEdges.set(pairKey(owner.cell, i), owner.segment);
        edgeOwner.delete(edgeKey);
      }
    }
  }

  /** Швидка сітка з jitter — O(n) замість O(n²) */
  _placePoints() {
    const pts = [];
    const target = this.cellCount;
    const area = this.width * this.mapHeight;
    const spacing = Math.sqrt(area / target);
    const cols = Math.ceil(this.width / spacing);
    const rows = Math.ceil(this.mapHeight / spacing);
    const jitter = spacing * 0.44;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const baseX = (col + 0.5) * spacing;
        const baseY = (row + 0.5) * spacing;
        const x = Math.max(2, Math.min(this.width - 2, baseX + (this.rand() * 2 - 1) * jitter));
        const y = Math.max(2, Math.min(this.mapHeight - 2, baseY + (this.rand() * 2 - 1) * jitter));
        pts.push([x, y]);
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    if (pts.length > target) pts.length = target;
    while (pts.length < target) {
      pts.push([this.rand() * this.width, this.rand() * this.mapHeight]);
    }
    return pts;
  }

  _buildNeighbors() {
    return Array.from({ length: this.points.length }, (_, i) => [...this.delaunay.neighbors(i)]);
  }

  _makeLandmassSeeds() {
    const seeds = [];
    const count = 3 + Math.floor(this.rand() * 4);
    for (let i = 0; i < count; i++) {
      seeds.push({
        x: this.width * (0.15 + this.rand() * 0.7),
        y: this.mapHeight * (0.14 + this.rand() * 0.72),
        rx: this.width * (0.14 + this.rand() * 0.16),
        ry: this.mapHeight * (0.13 + this.rand() * 0.18),
        strength: 0.72 + this.rand() * 0.46,
        falloff: 1.2 + this.rand() * 1.3
      });
    }
    return seeds;
  }

  _generateHeight() {
    const n = this.points.length;
    this.heights = new Float32Array(n);
    this.landmassSeeds = this._makeLandmassSeeds();
    for (let i = 0; i < n; i++) {
      const [x, y] = this.points[i];
      const nx = x / this.width - 0.5;
      const ny = y / this.mapHeight - 0.5;

      const edge = Math.min(
        x / this.width,
        (this.width - x) / this.width,
        y / this.mapHeight,
        (this.mapHeight - y) / this.mapHeight
      );
      const edgeMask = smoothstep(0.01, 0.16, edge);

      const warpX = nx + this.noise.noise2(nx * 2.1 + 8.3, ny * 2.1 - 3.1) * 0.19;
      const warpY = ny + this.noise.noise2(nx * 2.1 - 6.8, ny * 2.1 + 5.2) * 0.19;

      let continent = 0;
      for (let k = 0; k < this.landmassSeeds.length; k++) {
        const s = this.landmassSeeds[k];
        const dx = (x - s.x) / s.rx;
        const dy = (y - s.y) / s.ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - d);
        const mass = Math.pow(influence, s.falloff) * s.strength;
        if (mass > continent) continent = mass;
      }

      const macro = (this.noise.fbm(warpX * 1.7 + 1.1, warpY * 1.7 - 2.3, 5, 2, 0.56) + 1) / 2;
      const detail = (this.noise.fbm(warpX * 5.2 + 9.4, warpY * 5.2 + 2.5, 3, 2.1, 0.5) + 1) / 2;
      const ridges = 1 - Math.abs(this.noise.noise2(warpX * 3.4 - 2.1, warpY * 3.4 + 4.7));

      let h = continent * 0.86 + macro * 0.22 + detail * 0.1 + (ridges - 0.5) * 0.12;
      h = h * edgeMask + (macro * 0.18 - 0.44) * (1 - edgeMask);
      h -= 0.01;
      this.heights[i] = Math.max(0, Math.min(1, h));
    }
    this._smooth('heights', 0);
    this._smooth('heights', 0.1);
  }

  _adjustSeaLevel() {
    const sorted = Array.from(this.heights).sort((a, b) => a - b);
    const targetLandRatio = 0.44;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - targetLandRatio))));
    this.seaLevel = Math.max(0.18, Math.min(0.42, sorted[idx]));
  }

  _carveLakes() {
    const target = Math.max(2, Math.floor(this.cellCount / 700));
    const centers = [];
    for (let attempt = 0; attempt < target * 35 && centers.length < target; attempt++) {
      const i = Math.floor(this.rand() * this.points.length);
      if (this.heights[i] < this.seaLevel + 0.05 || this.heights[i] > 0.7) continue;
      if (this._isEdgeCell(i)) continue;
      if (this.neighbors[i].some(nb => this.heights[nb] < this.seaLevel + 0.01)) continue;
      const [x, y] = this.points[i];
      if (centers.some(c => {
        const [cx, cy] = this.points[c];
        const dx = x - cx;
        const dy = y - cy;
        return dx * dx + dy * dy < 8500;
      })) continue;
      centers.push(i);
    }

    centers.forEach(center => {
      const sink = this.seaLevel - (0.02 + this.rand() * 0.05);
      const maxSteps = 2 + Math.floor(this.rand() * 2);
      const queue = [center];
      const steps = new Int16Array(this.points.length);
      steps.fill(-1);
      steps[center] = 0;
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        const step = steps[cur];
        const targetHeight = sink + step * 0.023 + this.rand() * 0.004;
        if (this.heights[cur] > targetHeight) this.heights[cur] = targetHeight;
        if (step >= maxSteps) continue;
        const nbs = this.neighbors[cur];
        for (let k = 0; k < nbs.length; k++) {
          const nb = nbs[k];
          if (steps[nb] >= 0) continue;
          if (this.heights[nb] < this.seaLevel + 0.09) continue;
          steps[nb] = step + 1;
          queue.push(nb);
        }
      }
    });
  }

  _isEdgeCell(i) {
    const [x, y] = this.points[i];
    const m = 8;
    return x <= m || y <= m || x >= this.width - m || y >= this.mapHeight - m;
  }

  _computeWaterDistance() {
    const n = this.points.length;
    const dist = new Int16Array(n);
    dist.fill(32767);
    const q = [];
    for (let i = 0; i < n; i++) {
      if (!this.isWater[i]) continue;
      dist[i] = 0;
      q.push(i);
    }
    let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++];
      const base = dist[cur] + 1;
      const nbs = this.neighbors[cur];
      for (let k = 0; k < nbs.length; k++) {
        const nb = nbs[k];
        if (base >= dist[nb]) continue;
        dist[nb] = base;
        q.push(nb);
      }
    }
    return dist;
  }

  _classifyWater() {
    const n = this.points.length;
    this.isWater = new Uint8Array(n);
    this.waterKind = new Array(n).fill('ocean');
    for (let i = 0; i < n; i++) {
      if (this.heights[i] < this.seaLevel) this.isWater[i] = 1;
    }

    const visited = new Uint8Array(n);
    const groups = [];
    for (let i = 0; i < n; i++) {
      if (!this.isWater[i] || visited[i]) continue;
      const cells = [];
      const q = [i];
      let qi = 0;
      visited[i] = 1;
      let touchesEdge = false;
      while (qi < q.length) {
        const cur = q[qi++];
        cells.push(cur);
        if (this._isEdgeCell(cur)) touchesEdge = true;
        const nbs = this.neighbors[cur];
        for (let k = 0; k < nbs.length; k++) {
          const nb = nbs[k];
          if (!this.isWater[nb] || visited[nb]) continue;
          visited[nb] = 1;
          q.push(nb);
        }
      }
      groups.push({ cells, touchesEdge, size: cells.length });
    }

    const edgeGroups = groups.filter(g => g.touchesEdge).sort((a, b) => b.size - a.size);
    const mainOcean = edgeGroups[0];
    groups.forEach(group => {
      if (!group.touchesEdge) {
        group.cells.forEach(c => { this.waterKind[c] = 'lake'; });
        return;
      }
      if (mainOcean && group === mainOcean) {
        group.cells.forEach(c => {
          const depth = this.seaLevel - this.heights[c];
          const nearLand = this.neighbors[c].some(nb => !this.isWater[nb]);
          if (depth > 0.12 && !nearLand) this.waterKind[c] = 'deep';
          else if (nearLand || depth < 0.045) this.waterKind[c] = 'sea';
          else this.waterKind[c] = 'ocean';
        });
      } else {
        group.cells.forEach(c => { this.waterKind[c] = 'sea'; });
      }
    });

    this.waterDistance = this._computeWaterDistance();
  }

  _generateMoisture() {
    const n = this.points.length;
    this.moisture = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, y] = this.points[i];
      const nx = x / this.width, ny = y / this.mapHeight;
      let m = this.noise.fbm(nx * 4 + 3, ny * 4 - 1, 4, 2, 0.5);
      m = (m + 1) / 2;
      if (this.isWater[i]) {
        this.moisture[i] = 1;
        continue;
      }
      const shoreBoost = Math.max(0, 1 - this.waterDistance[i] / 8) * 0.38;
      m = m * 0.72 + shoreBoost;
      if (this.heights[i] > 0.75) m *= 0.6;
      this.moisture[i] = Math.max(0, Math.min(1, m));
    }
    this._smooth('moisture', this.seaLevel);
  }

  _smooth(field, landOnly) {
    const src = this[field];
    const tmp = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      if (landOnly && this.heights[i] < landOnly) { tmp[i] = src[i]; continue; }
      let sum = src[i], c = 1;
      this.neighbors[i].forEach(j => { sum += src[j]; c++; });
      tmp[i] = sum / c;
    }
    this[field] = tmp;
  }

  _assignBiomes() {
    const n = this.points.length;
    this.biome = new Array(n);
    for (let i = 0; i < n; i++) {
      const h = this.heights[i], m = this.moisture[i];
      if (this.isWater[i]) {
        this.biome[i] = this.waterKind[i] || 'ocean';
        continue;
      }
      if (h < this.seaLevel + 0.04) this.biome[i] = 'beach';
      else if (h > 0.9) this.biome[i] = 'snow';
      else if (h > 0.78) this.biome[i] = 'mountain';
      else if (h > 0.62) this.biome[i] = 'hills';
      else if (m < 0.22) this.biome[i] = 'desert';
      else if (m > 0.72 && h < 0.45) this.biome[i] = 'swamp';
      else if (m > 0.48) this.biome[i] = 'forest';
      else this.biome[i] = 'grass';
    }
    this.landCells = [];
    for (let i = 0; i < n; i++) {
      if (!this.isWater[i]) this.landCells.push(i);
    }
  }

  _generateRivers() {
    this.rivers = [];
    const used = new Set();
    const candidates = this.landCells
      .filter(i => this.heights[i] > this.seaLevel + 0.24 && this.moisture[i] > 0.38)
      .sort((a, b) => this.heights[b] - this.heights[a]);

    const maxRivers = Math.min(24, Math.max(6, Math.floor(this.landCells.length / 95)));
    for (let r = 0; r < candidates.length && this.rivers.length < maxRivers; r++) {
      const start = candidates[r];
      if (used.has(start)) continue;
      const path = [start];
      const seen = new Set([start]);
      let cur = start, guard = 0;
      while (guard++ < 180) {
        if (this.isWater[cur]) break;
        let best = null;
        let bestScore = Infinity;
        const nbs = this.neighbors[cur];
        for (let k = 0; k < nbs.length; k++) {
          const nb = nbs[k];
          if (seen.has(nb)) continue;
          let score = this.heights[nb];
          if (!this.isWater[nb] && this.heights[nb] > this.heights[cur]) {
            score += (this.heights[nb] - this.heights[cur]) * 2.6;
          }
          if (!this.isWater[nb] && this.waterDistance[nb] > this.waterDistance[cur]) {
            score += 0.04;
          }
          if (score < bestScore) {
            bestScore = score;
            best = nb;
          }
        }
        if (best == null) break;
        seen.add(best);
        path.push(best);
        cur = best;
        if (this.isWater[cur]) break;
      }

      if (path.length >= 5 && this.isWater[cur]) {
        path.forEach(p => used.add(p));
        this.rivers.push(path);
      }
    }
  }

  _generateStates() {
    const n = this.points.length;
    this.stateOf = new Int32Array(n).fill(-1);
    this.states = [];
    const habit = i => BIOMES[this.biome[i]]?.habitability || 0;

    const caps = this.landCells
      .filter(i => habit(i) > 0.5 && this.heights[i] < 0.7)
      .sort(() => this.rand() - 0.5)
      .slice(0, this.stateCount * 3);

    const chosen = [];
    caps.forEach(c => {
      if (chosen.length >= this.stateCount) return;
      if (chosen.every(ch => {
        const dx = this.points[c][0] - this.points[ch][0];
        const dy = this.points[c][1] - this.points[ch][1];
        return dx * dx + dy * dy > 3600;
      })) chosen.push(c);
    });

    let cursor = 0;
    while (chosen.length < this.stateCount && cursor < caps.length) {
      const c = caps[cursor++];
      if (!chosen.includes(c)) chosen.push(c);
    }

    chosen.forEach((cap, sid) => {
      const name = this._stateName(sid);
      const [x, y] = this.points[cap];
      this.states.push({
        id: sid, name, capital: cap, color: STATE_COLORS[sid % STATE_COLORS.length],
        cellCount: 0, centroidX: x, centroidY: y
      });
      this.stateOf[cap] = sid;
    });

    const queue = chosen.map((c, i) => c);
    const stateOfQueue = chosen.map((c, i) => i);
    let qi = 0;
    const maxCells = Math.ceil(this.landCells.length / Math.max(1, this.states.length)) * 2;

    while (qi < queue.length) {
      const cell = queue[qi];
      const state = stateOfQueue[qi];
      qi++;
      const st = this.states[state];
      if (st.cellCount >= maxCells) continue;
      st.cellCount++;
      const [px, py] = this.points[cell];
      st.centroidX += (px - st.centroidX) / st.cellCount;
      st.centroidY += (py - st.centroidY) / st.cellCount;

      const nbs = this.neighbors[cell];
      for (let k = 0; k < nbs.length; k++) {
        const nb = nbs[k];
        if (this.heights[nb] < this.seaLevel || this.stateOf[nb] >= 0) continue;
        if (this.rand() > 0.12 + habit(nb) * 0.45) continue;
        this.stateOf[nb] = state;
        queue.push(nb);
        stateOfQueue.push(state);
      }
    }

    this.landCells.forEach(i => {
      if (this.stateOf[i] >= 0) return;
      let best = -1, bestH = -1;
      const nbs = this.neighbors[i];
      for (let k = 0; k < nbs.length; k++) {
        const nb = nbs[k];
        const s = this.stateOf[nb];
        if (s >= 0 && habit(nb) > bestH) { bestH = habit(nb); best = s; }
      }
      if (best >= 0) {
        this.stateOf[i] = best;
        const st = this.states[best];
        st.cellCount++;
        const [px, py] = this.points[i];
        st.centroidX += (px - st.centroidX) / st.cellCount;
        st.centroidY += (py - st.centroidY) / st.cellCount;
      }
    });
  }

  _pick(arr) {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  _nameCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  _coinStem(minParts = 2, maxParts = 3) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const parts = minParts + Math.floor(this.rand() * (maxParts - minParts + 1));
      let lastPiece = this._pick(NAME_FRAG_START);
      let out = lastPiece;
      if (parts === 1) {
        let endPiece = this._pick(NAME_FRAG_END);
        if (endPiece === lastPiece) endPiece = this._pick(NAME_FRAG_END);
        out += endPiece;
      } else {
        for (let i = 1; i < parts; i++) {
          const pool = i === parts - 1 ? NAME_FRAG_END : NAME_FRAG_MID;
          let piece = this._pick(pool);
          if (piece === lastPiece) piece = this._pick(pool);
          if (out[out.length - 1] === piece[0]) out += piece.slice(1);
          else out += piece;
          lastPiece = piece;
        }
      }
      out = out.replace(/(.)\1\1+/g, '$1$1');
      if (out.length < 4) continue;
      if (out.length > 12) continue;
      if (/[bcdfghjklmnpqrstvwxyz]{4}/i.test(out)) continue;
      if (/([a-z]{2})\1$/i.test(out)) continue;
      return this._nameCase(out);
    }
    return this._nameCase(this._pick(WORLD_NAME_CORES));
  }

  _worldName() {
    const roll = this.rand();
    if (roll < 0.42) {
      return `${this._pick(WORLD_NAME_PREFIXES)}${this._nameCase(this._pick(WORLD_NAME_SUFFIXES))}`;
    }
    if (roll < 0.62) {
      return `${this._pick(WORLD_NAME_PREFIXES)} ${this._nameCase(this._pick(WORLD_NAME_SUFFIXES))}`;
    }
    if (roll < 0.82) {
      return `${this._pick(WORLD_NAME_CORES)} ${this._nameCase(this._pick(WORLD_NAME_SUFFIXES))}`;
    }
    return `${this._coinStem(2, 3)} ${this._nameCase(this._pick(WORLD_NAME_SUFFIXES))}`;
  }

  _stateName(idx) {
    const title = this._pick(TITLE_WORDS);
    const root = this.rand() < 0.45 ? this._pick(WORLD_NAME_CORES) : this._coinStem(2, 3);
    const noun = this._pick(STATE_NOUNS);
    const adj = this._pick(STATE_ADJECTIVES);

    const roll = this.rand();
    if (roll < 0.33) return `${title} of ${root}`;
    if (roll < 0.66) return `${adj} ${noun} of ${root}`;
    return `${title} of ${adj} ${root}`;
  }

  _generateSettlements() {
    this.settlements = [];
    const used = new Set();
    const nextUnique = factory => {
      for (let i = 0; i < 40; i++) {
        const candidate = factory();
        if (!used.has(candidate)) {
          used.add(candidate);
          return candidate;
        }
      }
      const fallback = `${factory()} ${1 + Math.floor(this.rand() * 90)}`;
      used.add(fallback);
      return fallback;
    };

    this.states.forEach(st => {
      const cap = st.capital;
      const capitalName = nextUnique(() => this._capitalName(st.name));
      this.settlements.push({
        id: `cap-${st.id}`, name: capitalName, cell: cap,
        type: 'capital', state: st.id, pop: 8000 + Math.floor(this.rand() * 12000)
      });
    });

    const byState = {};
    this.landCells.forEach(i => {
      const s = this.stateOf[i];
      if (s < 0) return;
      if (!byState[s]) byState[s] = [];
      byState[s].push(i);
    });

    Object.entries(byState).forEach(([sid, cells]) => {
      const id = +sid;
      const sorted = cells
        .filter(c => c !== this.states[id].capital)
        .filter(c => BIOMES[this.biome[c]].habitability > 0.45)
        .sort((a, b) => {
          const ha = this.heights[a], hb = this.heights[b];
          return Math.abs(ha - 0.45) - Math.abs(hb - 0.45);
        });
      const towns = Math.min(4, Math.floor(sorted.length / 40));
      for (let t = 0; t < towns; t++) {
        const cell = sorted[Math.floor(t * sorted.length / towns)];
        if (!cell || this.settlements.some(s => s.cell === cell)) continue;
        this.settlements.push({
          id: `town-${id}-${t}`, name: nextUnique(() => this._townName(id)), cell, type: 'town',
          state: id, pop: 800 + Math.floor(this.rand() * 3000)
        });
      }
    });
  }

  _capitalName(stateName) {
    const stateCore = (stateName.split(' ').pop() || '').replace(/[^a-zA-Z]/g, '');
    const core = stateCore.length >= 4 ? stateCore : this._coinStem(2, 2);
    const roll = this.rand();
    if (roll < 0.4) return `${this._pick(CAPITAL_PREFIXES)} ${core}`;
    if (roll < 0.75) return this._nameCase(`${core}${this._pick(CAPITAL_SUFFIXES)}`);
    return `${this._pick(CAPITAL_PREFIXES)} ${this._coinStem(2, 2)}`;
  }

  _townName(stateId) {
    const state = this.states[stateId];
    const stateCore = (state?.name.split(' ').pop() || '').replace(/[^a-zA-Z]/g, '');
    const localRoot = stateCore.length >= 4 ? stateCore.slice(0, Math.min(6, stateCore.length)) : this._coinStem(1, 2);
    const roll = this.rand();
    if (roll < 0.34) return this._nameCase(`${localRoot}${this._pick(TOWN_SUFFIXES)}`);
    if (roll < 0.68) return this._nameCase(`${this._coinStem(1, 2)}${this._pick(TOWN_SUFFIXES)}`);
    return `${this._pick(CAPITAL_PREFIXES)} ${this._coinStem(1, 2)}`;
  }

  _generateRoutes() {
    this.routes = [];
    const caps = this.settlements.filter(s => s.type === 'capital');
    const maxRoutes = Math.min(8, caps.length);
    let added = 0;
    for (let i = 0; i < caps.length && added < maxRoutes; i++) {
      for (let j = i + 1; j < caps.length && added < maxRoutes; j++) {
        if (this.rand() > 0.5) continue;
        const path = this._findPath(caps[i].cell, caps[j].cell);
        if (path.length > 2) { this.routes.push(path); added++; }
      }
    }
  }

  _findPath(from, to) {
    const n = this.points.length;
    const prev = new Int32Array(n);
    prev.fill(-1);
    const seen = new Uint8Array(n);
    const q = [from];
    let qi = 0;
    seen[from] = 1;
    while (qi < q.length) {
      const cur = q[qi++];
      if (cur === to) break;
      const nbs = this.neighbors[cur];
      for (let k = 0; k < nbs.length; k++) {
        const nb = nbs[k];
        if (seen[nb]) continue;
        if (this.heights[nb] < this.seaLevel || this.isWater[nb]) continue;
        seen[nb] = 1;
        prev[nb] = cur;
        q.push(nb);
      }
    }
    if (!seen[to]) return [];
    const path = [];
    let c = to;
    while (c >= 0) { path.unshift(c); c = prev[c]; }
    return path;
  }

  export() {
    return {
      version: 1,
      seed: this.seed,
      worldName: this.worldName,
      width: this.width,
      mapHeight: this.mapHeight,
      seaLevel: this.seaLevel,
      cellCount: this.points.length,
      stateCount: this.states.length,
      points: this.points.map(p => [...p]),
      heights: [...this.heights],
      moisture: [...this.moisture],
      waterKind: [...this.waterKind],
      biome: [...this.biome],
      stateOf: [...this.stateOf],
      states: this.states.map(s => ({
        id: s.id, name: s.name, capital: s.capital, color: s.color,
        cellCount: s.cellCount, centroidX: s.centroidX, centroidY: s.centroidY
      })),
      rivers: this.rivers.map(r => [...r]),
      settlements: this.settlements.map(s => ({ ...s })),
      routes: this.routes.map(r => [...r])
    };
  }

  static fromData(data) {
    const Delaunay = getDelaunayLib();
    const elev = data.heights || data.height;
    const mapH = data.mapHeight ?? (Array.isArray(elev) ? 600 : (data.height || 600));
    const g = new WorldGenerator({ seed: data.seed, width: data.width, height: mapH, seaLevel: data.seaLevel ?? DEFAULT_SEA_LEVEL });
    const states = (data.states || []).map(s => {
      if (s.centroidX != null) return s;
      if (s.cells?.length) {
        let sx = 0, sy = 0;
        s.cells.forEach(c => { sx += data.points[c][0]; sy += data.points[c][1]; });
        return { ...s, cellCount: s.cells.length, centroidX: sx / s.cells.length, centroidY: sy / s.cells.length, cells: undefined };
      }
      const cap = s.capital;
      return { ...s, centroidX: data.points[cap][0], centroidY: data.points[cap][1], cellCount: s.cellCount || 1 };
    });
    const heightsArr = Array.isArray(elev) ? elev : [];
    const moistureArr = Array.isArray(data.moisture) ? data.moisture : new Array(heightsArr.length).fill(0.5);
    Object.assign(g, {
      points: data.points,
      heights: new Float32Array(heightsArr),
      moisture: new Float32Array(moistureArr),
      biome: Array.isArray(data.biome) ? data.biome : [],
      stateOf: new Int32Array(data.stateOf),
      states,
      rivers: data.rivers,
      settlements: data.settlements,
      routes: data.routes || [],
      landCells: [],
      worldName: data.worldName,
      waterKind: Array.isArray(data.waterKind) ? data.waterKind.slice() : []
    });
    g.delaunay = Delaunay.from(g.points);
    g.voronoi = g.delaunay.voronoi([0, 0, g.width, g.mapHeight]);
    g.neighbors = g._buildNeighbors();
    g._cacheCellPaths();
    g._classifyWater();
    g._assignBiomes();
    return g;
  }
}

function getDelaunayLib() {
  if (typeof d3 !== 'undefined' && d3.Delaunay) return d3.Delaunay;
  if (typeof Delaunay !== 'undefined') return Delaunay;
  throw new Error('d3-delaunay не завантажився — перевір файл vendor/d3-delaunay.min.js');
}

window.WorldGenerator = WorldGenerator;
window.BIOMES = BIOMES;
window.STATE_COLORS = STATE_COLORS;
