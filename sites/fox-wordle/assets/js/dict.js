(() => {
  "use strict";

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function gunzipBytes(buf) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function gunzipUrl(url) {
    return gunzipBytes(await fetchBytes(url));
  }

  function decodeDict(bytes) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== "FXWD") throw new Error("Bad dict magic");
    const minLen = bytes[5];
    const maxLen = bytes[6];
    let off = 8;
    const byLength = {};
    let total = 0;

    for (let L = minLen; L <= maxLen; L++) {
      const count =
        bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24);
      off += 4;
      if (!count) continue;
      const words = new Array(count);
      for (let i = 0; i < count; i++) {
        let w = "";
        for (let j = 0; j < L; j++) w += String.fromCharCode(97 + bytes[off++]);
        words[i] = w;
      }
      byLength[L] = words;
      total += count;
    }

    const five = byLength[5] || [];
    const valid5 = new Set(five);
    return { byLength, valid5, fiveSorted: five, total, minLen, maxLen };
  }

  function decodeAnswers(bytes, fiveSorted) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== "FXWA") throw new Error("Bad answers magic");
    const count = bytes[6] | (bytes[7] << 8);
    const answers = new Array(count);
    let off = 8;
    for (let i = 0; i < count; i++) {
      const idx = bytes[off] | (bytes[off + 1] << 8);
      off += 2;
      answers[i] = fiveSorted[idx];
    }
    return answers;
  }

  function parseLoaded(dictBytes, ansBytes, meta) {
    const dict = decodeDict(dictBytes);
    const answers = decodeAnswers(ansBytes, dict.fiveSorted);
    return { ...dict, answers, meta };
  }

  async function loadViaEmbed() {
    const emb = window.FOX_WORD_EMBED;
    if (!emb?.gameGz || !emb?.answersGz) {
      throw new Error("dict-embed.js не знайдено — перезапусти build-dict.mjs");
    }
    const [dictBytes, ansBytes] = await Promise.all([
      gunzipBytes(b64ToBytes(emb.gameGz)),
      gunzipBytes(b64ToBytes(emb.answersGz))
    ]);
    return parseLoaded(dictBytes, ansBytes, emb.meta);
  }

  async function loadViaFetch(base) {
    const [dictBytes, ansBytes, meta] = await Promise.all([
      gunzipUrl(`${base}/game.gz`),
      gunzipUrl(`${base}/answers.gz`),
      fetch(`${base}/meta.json`).then((r) => r.json())
    ]);
    return parseLoaded(dictBytes, ansBytes, meta);
  }

  async function loadDictionary(base = "assets/data") {
    const isFile = location.protocol === "file:";
    if (isFile) return loadViaEmbed();

    try {
      return await loadViaFetch(base);
    } catch (err) {
      if (window.FOX_WORD_EMBED) return loadViaEmbed();
      throw err;
    }
  }

  window.FoxWordDict = { loadDictionary, decodeDict, decodeAnswers };
})();
