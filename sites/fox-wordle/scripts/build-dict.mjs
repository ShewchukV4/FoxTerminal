#!/usr/bin/env node
/**
 * Builds compact Fox Word dictionary:
 *   words_alpha (~370k) → binary pack → dict.gz
 *   Wordle answers (~2315) → answers.gz (tiny)
 *
 * Binary format (FXWD v1):
 *   magic "FXWD" | ver u8 | minLen u8 | maxLen u8 | pad u8
 *   per length L: count u32 LE | count × L bytes (a=0 … z=25)
 */
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { createGzip, brotliCompressSync, constants as zc } from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const dataDir = join(root, "assets", "data");
const cacheDir = join(__dir, ".cache");

const ALPHA_URL =
  "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";
const ANSWERS_URL =
  "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";

mkdirSync(dataDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

async function fetchText(url, cacheName) {
  const cachePath = join(cacheDir, cacheName);
  if (existsSync(cachePath)) {
    console.log(`  cache hit: ${cacheName}`);
    return readFileSync(cachePath, "utf8");
  }
  console.log(`  fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  writeFileSync(cachePath, text, "utf8");
  return text;
}

function packLength(words, L) {
  const list = words.filter((w) => w.length === L).sort();
  const header = Buffer.alloc(8);
  header.write("FXWD", 0, 4, "ascii");
  header.writeUInt8(1, 4);
  header.writeUInt8(L, 5);
  header.writeUInt8(L, 6);
  header.writeUInt8(0, 7);
  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32LE(list.length, 0);
  const body = Buffer.alloc(list.length * L);
  let off = 0;
  for (const w of list) {
    for (let i = 0; i < L; i++) body[off++] = w.charCodeAt(i) - 97;
  }
  return Buffer.concat([header, countBuf, body]);
}

function packDict(words) {
  const byLen = new Map();
  for (const w of words) {
    if (!/^[a-z]+$/.test(w)) continue;
    let arr = byLen.get(w.length);
    if (!arr) {
      arr = [];
      byLen.set(w.length, arr);
    }
    arr.push(w);
  }

  const lengths = [...byLen.keys()].sort((a, b) => a - b);
  const minLen = lengths[0];
  const maxLen = lengths[lengths.length - 1];

  const chunks = [];
  const header = Buffer.alloc(8);
  header.write("FXWD", 0, 4, "ascii");
  header.writeUInt8(1, 4);
  header.writeUInt8(minLen, 5);
  header.writeUInt8(maxLen, 6);
  header.writeUInt8(0, 7);
  chunks.push(header);

  let total = 0;
  for (let L = minLen; L <= maxLen; L++) {
    const list = (byLen.get(L) || []).sort();
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(list.length, 0);
    chunks.push(countBuf);
    if (list.length) {
      const body = Buffer.alloc(list.length * L);
      let off = 0;
      for (const w of list) {
        for (let i = 0; i < L; i++) body[off++] = w.charCodeAt(i) - 97;
      }
      chunks.push(body);
      total += list.length;
    }
  }

  return { buffer: Buffer.concat(chunks), total, byLen, minLen, maxLen };
}

function packAnswers(answerWords, fiveLetterSorted) {
  const index = new Map(fiveLetterSorted.map((w, i) => [w, i]));
  const indices = [];
  for (const w of answerWords) {
    const lw = w.toLowerCase().trim();
    if (lw.length !== 5 || !/^[a-z]+$/.test(lw)) continue;
    const idx = index.get(lw);
    if (idx !== undefined) indices.push(idx);
  }
  indices.sort((a, b) => a - b);

  const header = Buffer.alloc(8);
  header.write("FXWA", 0, 4, "ascii");
  header.writeUInt8(1, 4);
  header.writeUInt16LE(indices.length, 6);

  const body = Buffer.alloc(indices.length * 2);
  indices.forEach((n, i) => body.writeUInt16LE(n, i * 2));

  return { buffer: Buffer.concat([header, body]), count: indices.length };
}

async function gzipBuffer(buf, outPath) {
  await pipeline(Readable.from(buf), createGzip({ level: 9 }), createWriteStream(outPath));
  return buf.length;
}

async function main() {
  console.log("Fox Word — dictionary build\n");

  const alphaRaw = await fetchText(ALPHA_URL, "words_alpha.txt");
  const words = alphaRaw.split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unique = [...new Set(words)];

  const { buffer, total, byLen } = packDict(unique);
  const dictRaw = buffer.length;
  const dictPath = join(dataDir, "dict.gz");
  const dictBrPath = join(dataDir, "dict.br");
  await gzipBuffer(buffer, dictPath);
  const brBuf = brotliCompressSync(buffer, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } });
  writeFileSync(dictBrPath, brBuf);

  const five = byLen.get(5) || [];
  const answersRaw = await fetchText(ANSWERS_URL, "wordle-answers.txt");
  const answerList = answersRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const { buffer: ansBuf, count: ansCount } = packAnswers(answerList, five);
  const ansPath = join(dataDir, "answers.gz");
  await gzipBuffer(ansBuf, ansPath);

  const gameBuf = packLength(five, 5);
  const gamePath = join(dataDir, "game.gz");
  await gzipBuffer(gameBuf, gamePath);

  const gameGz = readFileSync(gamePath);
  const ansGz = readFileSync(ansPath);
  const embedJs = `// Auto-generated by scripts/build-dict.mjs — do not edit
window.FOX_WORD_EMBED = {
  meta: ${JSON.stringify({
    version: 1,
    totalWords: total,
    fiveLetter: five.length,
    answerWords: ansCount,
    gameGzBytes: gameGz.length,
    answersGzBytes: ansGz.length,
    dictGzBytes: readFileSync(dictPath).length
  })},
  gameGz: "${gameGz.toString("base64")}",
  answersGz: "${ansGz.toString("base64")}"
};
`;
  writeFileSync(join(root, "assets", "js", "dict-embed.js"), embedJs);

  const meta = {
    version: 1,
    totalWords: total,
    fiveLetter: five.length,
    answerWords: ansCount,
    lengths: Object.fromEntries([...byLen.entries()].map(([k, v]) => [k, v.length])),
    dictRawBytes: dictRaw,
    dictGzBytes: readFileSync(dictPath).length,
    dictBrBytes: readFileSync(dictBrPath).length,
    gameGzBytes: gameGz.length,
    answersGzBytes: readFileSync(ansPath).length,
    embedJsBytes: Buffer.byteLength(embedJs)
  };
  writeFileSync(join(dataDir, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("\nDone:");
  console.log(`  words total     : ${total.toLocaleString()}`);
  console.log(`  5-letter words  : ${five.length.toLocaleString()}`);
  console.log(`  answer words    : ${ansCount.toLocaleString()}`);
  console.log(`  dict raw        : ${(dictRaw / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  dict.gz         : ${(meta.dictGzBytes / 1024).toFixed(1)} KB`);
  console.log(`  dict.br         : ${(meta.dictBrBytes / 1024).toFixed(1)} KB (primary)`);
  console.log(`  game.gz         : ${(meta.gameGzBytes / 1024).toFixed(1)} KB (runtime)`);
  console.log(`  dict-embed.js   : ${(meta.embedJsBytes / 1024).toFixed(1)} KB (file://)`);
  console.log(`  answers.gz      : ${meta.answersGzBytes} B`);
  console.log(`  ratio (br)      : ${((1 - meta.dictBrBytes / dictRaw) * 100).toFixed(1)}% saved`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
