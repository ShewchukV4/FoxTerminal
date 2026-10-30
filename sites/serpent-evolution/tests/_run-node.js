/* Node runner for logic-tests.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function stubCanvas(w, h) {
  const c = {
    width: w || 1,
    height: h || 1,
    getContext: function () {
      return {
        fillRect: function () {},
        strokeRect: function () {},
        clearRect: function () {},
        beginPath: function () {},
        closePath: function () {},
        moveTo: function () {},
        lineTo: function () {},
        arc: function () {},
        arcTo: function () {},
        ellipse: function () {},
        quadraticCurveTo: function () {},
        fill: function () {},
        stroke: function () {},
        save: function () {},
        restore: function () {},
        translate: function () {},
        rotate: function () {},
        fillText: function () {},
        strokeText: function () {},
        setLineDash: function () {},
        measureText: function () { return { width: 0 }; },
        createLinearGradient: function () { return { addColorStop: function () {} }; },
        drawImage: function () {},
        canvas: null,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        font: "",
        textAlign: "",
        lineCap: ""
      };
    }
  };
  c.getContext("2d").canvas = c;
  return c;
}

const els = Object.create(null);
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Date: Date,
  Error: Error,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isFinite: isFinite,
  isNaN: isNaN,
  performance: { now: function () { return Date.now(); } },
  localStorage: {
    _d: {},
    getItem: function (k) { return this._d[k] || null; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  },
  requestAnimationFrame: function (f) { return setTimeout(f, 16); },
  cancelAnimationFrame: clearTimeout,
  navigator: { userAgent: "node" },
  Image: function () {},
  Audio: function () { this.play = function () { return Promise.resolve(); }; },
  HTMLCanvasElement: function () {},
  document: {
    getElementById: function (id) {
      if (!els[id]) {
        els[id] = {
          id: id,
          style: {},
          innerHTML: "",
          classList: { toggle: function () {}, add: function () {}, remove: function () {}, contains: function () { return false; } },
          appendChild: function (c) { this._kids = this._kids || []; this._kids.push(c); },
          removeChild: function () {},
          querySelector: function () { return null; },
          querySelectorAll: function () { return []; },
          addEventListener: function () {},
          removeEventListener: function () {},
          getContext: function () { return stubCanvas(640, 360).getContext("2d"); },
          width: 640,
          height: 360,
          getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 360 }; }
        };
      }
      return els[id];
    },
    createElement: function (tag) {
      if (tag === "canvas") return stubCanvas(1, 1);
      return {
        style: {},
        className: "",
        innerHTML: "",
        appendChild: function () {},
        addEventListener: function () {},
        classList: { toggle: function () {}, add: function () {}, remove: function () {} }
      };
    },
    body: { appendChild: function () {} },
    hidden: false,
    addEventListener: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  },
  process: process
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

const root = path.join(__dirname, "..");
const files = [
  "data.js", "core.js", "economy.js", "tiles.js", "generate.js", "grid.js", "input.js", "snake.js",
  "food-director.js", "farms.js", "allies.js", "storage.js", "settlement.js", "worlds.js", "layers.js", "caves.js",
  "craft.js", "specs.js", "raids.js", "mine.js",
  "build.js", "art.js", "world.js", "ai.js",
  "talents.js", "progression.js", "audio.js", "save.js", "draw.js", "guide.js", "renderer.js", "ui.js", "main.js"
];
const ctx = vm.createContext(sandbox);
files.forEach(function (f) {
  const p = path.join(root, "assets/js", f);
  if (!fs.existsSync(p)) return;
  vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "logic-tests.js"), "utf8"), ctx, { filename: "logic-tests.js" });
const outEl = els.out;
if (outEl && outEl.innerHTML) {
  const text = String(outEl.innerHTML)
    .replace(/<\/div>/g, "\n")
    .replace(/<[^>]+>/g, "");
  console.log(text);
}
console.log("exitCode=", process.exitCode || 0);
