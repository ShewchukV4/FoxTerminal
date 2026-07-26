'use strict';

/** Seedable RNG (mulberry32) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

/** 2D value noise з фрактальними октавами */
const Noise2D = {
  create(seed) {
    const rand = mulberry32(hashSeed(String(seed)));
    const perm = new Uint8Array(512);
    const grad = new Float32Array(512 * 2);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      const a = rand() * Math.PI * 2;
      grad[i * 2] = Math.cos(a);
      grad[i * 2 + 1] = Math.sin(a);
    }

    function dot(gx, gy, x, y) {
      return gx * x + gy * y;
    }

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

    function lerp(a, b, t) { return a + t * (b - a); }

    function noise2(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = fade(xf);
      const v = fade(yf);
      const aa = perm[X + perm[Y]];
      const ab = perm[X + perm[Y + 1]];
      const ba = perm[X + 1 + perm[Y]];
      const bb = perm[X + 1 + perm[Y + 1]];
      const x1 = lerp(dot(grad[aa * 2], grad[aa * 2 + 1], xf, yf),
        dot(grad[ba * 2], grad[ba * 2 + 1], xf - 1, yf), u);
      const x2 = lerp(dot(grad[ab * 2], grad[ab * 2 + 1], xf, yf - 1),
        dot(grad[bb * 2], grad[bb * 2 + 1], xf - 1, yf - 1), u);
      return lerp(x1, x2, v);
    }

    function fbm(x, y, octaves = 5, lac = 2, gain = 0.5) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        sum += noise2(x * freq, y * freq) * amp;
        norm += amp;
        amp *= gain;
        freq *= lac;
      }
      return sum / norm;
    }

    return { noise2, fbm, rand };
  }
};

window.Noise2D = Noise2D;
window.mulberry32 = mulberry32;
window.hashSeed = hashSeed;
