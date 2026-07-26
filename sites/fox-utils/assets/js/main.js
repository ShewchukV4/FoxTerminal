(() => {
  const STORE_LANG = "fox-utils-lang";
  const STORE_HASH = "fox-utils-hash-history";
  const STORE_POMO = "fox-utils-pomo-stats";

  const I18N = {
    uk: {
      title: "Fox Utils",
      sub: "Utilities",
      eyebrow: "hash · text · network · pomodoro",
      hero: "Локальні утиліти FoxTerminal у браузері. Без сервера — все в пам'яті пристрою.",
      tabHash: "Hash Vault",
      tabText: "Text Tools",
      tabNet: "Network Fox",
      tabPomo: "Pomodoro",
      hashTitle: "Hash Vault",
      hashSub: "MD5, SHA, Base64 у браузері. FX1 / unhash — лише в терміналі (потрібен пароль).",
      input: "Вхідний текст",
      algo: "Алгоритм",
      run: "Обчислити",
      copy: "Копіювати",
      clear: "Очистити",
      result: "Результат",
      fx1note: "FX1 (reversible AES) → команда hash fx1 у FoxTerminal",
      history: "Історія",
      textTitle: "File Quick Tools",
      textSub: "Статистика, JSON, Base64, diff. Перетягни .txt файл у зону нижче.",
      drop: "Перетягни файл сюди або клікни",
      stats: "Статистика",
      jsonFmt: "JSON",
      b64: "Base64",
      diff: "Diff",
      textA: "Текст A",
      textB: "Текст B",
      format: "Форматувати",
      validate: "Перевірити",
      encode: "Encode",
      decode: "Decode",
      compare: "Порівняти",
      lines: "Рядків",
      words: "Слів",
      chars: "Символів",
      bytes: "Байт UTF-8",
      netTitle: "Network Fox",
      netSub: "Що можливо в браузері — тут. Wi‑Fi, ping, disk → у терміналі.",
      refresh: "Оновити",
      publicIp: "Public IP",
      weather: "Погода",
      location: "Місто (опційно)",
      terminalOnly: "Тільки в терміналі",
      pomoTitle: "Pomodoro Fox",
      pomoSub: "25 / 5 / 15 хв. Сесії зберігаються локально.",
      work: "Робота",
      break: "Перерва",
      longBreak: "Довга перерва",
      start: "Старт",
      pause: "Пауза",
      reset: "Скинути",
      sessions: "Сьогодні завершено",
      footer: "Fox Utils · sites/fox-utils/ · відкрити: sites",
      toastCopied: "Скопійовано",
      toastFail: "Не вдалося",
      loading: "Завантаження…",
      offline: "Потрібен інтернет або спробуй weather Kyiv у терміналі",
      jsonOk: "JSON валідний",
      jsonErr: "Помилка JSON",
      noir: "Noir",
      lang: "EN"
    },
    en: {
      title: "Fox Utils",
      sub: "Utilities",
      eyebrow: "hash · text · network · pomodoro",
      hero: "Local FoxTerminal utilities in the browser. No server — everything stays on your device.",
      tabHash: "Hash Vault",
      tabText: "Text Tools",
      tabNet: "Network Fox",
      tabPomo: "Pomodoro",
      hashTitle: "Hash Vault",
      hashSub: "MD5, SHA, Base64 in browser. FX1 / unhash — terminal only (password required).",
      input: "Input text",
      algo: "Algorithm",
      run: "Compute",
      copy: "Copy",
      clear: "Clear",
      result: "Result",
      fx1note: "FX1 (reversible AES) → run hash fx1 in FoxTerminal",
      history: "History",
      textTitle: "File Quick Tools",
      textSub: "Stats, JSON, Base64, diff. Drop a .txt file on the zone below.",
      drop: "Drop a file here or click",
      stats: "Statistics",
      jsonFmt: "JSON",
      b64: "Base64",
      diff: "Diff",
      textA: "Text A",
      textB: "Text B",
      format: "Format",
      validate: "Validate",
      encode: "Encode",
      decode: "Decode",
      compare: "Compare",
      lines: "Lines",
      words: "Words",
      chars: "Chars",
      bytes: "UTF-8 bytes",
      netTitle: "Network Fox",
      netSub: "Browser can do this here. Wi‑Fi, ping, disk → use the terminal.",
      refresh: "Refresh",
      publicIp: "Public IP",
      weather: "Weather",
      location: "City (optional)",
      terminalOnly: "Terminal only",
      pomoTitle: "Pomodoro Fox",
      pomoSub: "25 / 5 / 15 min. Sessions saved locally.",
      work: "Work",
      break: "Break",
      longBreak: "Long break",
      start: "Start",
      pause: "Pause",
      reset: "Reset",
      sessions: "Completed today",
      footer: "Fox Utils · sites/fox-utils/ · open: sites",
      toastCopied: "Copied",
      toastFail: "Failed",
      loading: "Loading…",
      offline: "Need internet or try: weather Kyiv in terminal",
      jsonOk: "Valid JSON",
      jsonErr: "JSON error",
      noir: "Noir",
      lang: "UK"
    }
  };

  let lang = localStorage.getItem(STORE_LANG) || "uk";
  const t = (k) => I18N[lang][k] || I18N.uk[k] || k;

  const toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("toastCopied"));
    } catch {
      showToast(t("toastFail"));
    }
  }

  /* ── i18n apply ── */
  function applyI18n() {
    document.documentElement.lang = lang === "en" ? "en" : "uk";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.getElementById("lang-toggle").textContent = t("lang");
    document.title = "Fox Utils — " + t("sub");
  }

  document.getElementById("lang-toggle")?.addEventListener("click", () => {
    lang = lang === "uk" ? "en" : "uk";
    localStorage.setItem(STORE_LANG, lang);
    applyI18n();
    renderHashHistory();
  });

  document.getElementById("noir-toggle")?.addEventListener("click", () => {
    document.body.classList.toggle("noir");
  });

  /* ── Tabs ── */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab)?.classList.add("active");
    });
  });

  /* ── MD5 (compact) ── */
  function md5(str) {
    function cmn(q, a, b, x, s, t) {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    function add32(a, b) { return (a + b) & 0xffffffff; }
    function md5blk(s) {
      const blks = [];
      for (let i = 0; i < 64; i += 4) {
        blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      }
      return blks;
    }
    function md51(s) {
      let n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= n; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      const tail = new Array(16).fill(0);
      for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) { md5cycle(state, tail); tail.fill(0); }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }
    function md5cycle(x, k) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function rhex(n) {
      let s = "", j;
      for (j = 0; j < 4; j++) s += ("0" + ((n >> (j * 8)) & 255).toString(16)).slice(-2);
      return s;
    }
    function hex(x) { return x.map(rhex).join(""); }
    const utf8 = unescape(encodeURIComponent(str));
    return hex(md51(utf8));
  }

  async function digest(algo, text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    if (algo === "b64") {
      let bin = "";
      data.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    }
    if (algo === "md5") return md5(text);
    const map = { sha1: "SHA-1", sha256: "SHA-256", sha512: "SHA-512" };
    const buf = await crypto.subtle.digest(map[algo], data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const hashInput = document.getElementById("hash-input");
  const hashOutput = document.getElementById("hash-output");
  const hashAlgo = document.getElementById("hash-algo");
  const hashHistory = document.getElementById("hash-history");

  function getHashHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_HASH) || "[]"); } catch { return []; }
  }

  function pushHashHistory(algo, preview, result) {
    const list = getHashHistory();
    list.unshift({ algo, preview: preview.slice(0, 40), result, ts: Date.now() });
    localStorage.setItem(STORE_HASH, JSON.stringify(list.slice(0, 20)));
    renderHashHistory();
  }

  function renderHashHistory() {
    if (!hashHistory) return;
    const list = getHashHistory();
    hashHistory.innerHTML = list.length
      ? list.map((h) => `<div><span class="badge">${h.algo}</span> ${h.preview} → <button type="button" class="btn btn-sm hist-copy" data-val="${encodeURIComponent(h.result)}">${t("copy")}</button></div>`).join("")
      : `<div>—</div>`;
    hashHistory.querySelectorAll(".hist-copy").forEach((btn) => {
      btn.addEventListener("click", () => copyText(decodeURIComponent(btn.dataset.val)));
    });
  }

  document.getElementById("hash-run")?.addEventListener("click", async () => {
    const text = hashInput?.value || "";
    if (!text.trim()) return;
    const algo = hashAlgo?.value || "sha256";
    try {
      const out = await digest(algo, text);
      if (hashOutput) hashOutput.textContent = out;
      pushHashHistory(algo, text, out);
    } catch (e) {
      if (hashOutput) hashOutput.textContent = String(e.message || e);
    }
  });

  document.getElementById("hash-copy")?.addEventListener("click", () => copyText(hashOutput?.textContent || ""));
  document.getElementById("hash-clear")?.addEventListener("click", () => {
    if (hashInput) hashInput.value = "";
    if (hashOutput) hashOutput.textContent = "";
  });

  /* ── Text tools ── */
  const textMain = document.getElementById("text-main");
  const dropzone = document.getElementById("dropzone");

  function updateStats(text) {
    const lines = text.length ? text.split(/\r?\n/).length : 0;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const bytes = new TextEncoder().encode(text).length;
    document.getElementById("stat-lines").textContent = lines;
    document.getElementById("stat-words").textContent = words;
    document.getElementById("stat-chars").textContent = chars;
    document.getElementById("stat-bytes").textContent = bytes;
  }

  textMain?.addEventListener("input", () => updateStats(textMain.value));

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      if (textMain) textMain.value = String(reader.result || "");
      updateStats(textMain.value);
      showToast(file.name);
    };
    reader.readAsText(file);
  }

  dropzone?.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".txt,.json,.md,.log,.csv,text/*";
    inp.onchange = () => inp.files[0] && loadFile(inp.files[0]);
    inp.click();
  });

  dropzone?.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
  dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
  dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  document.getElementById("json-format")?.addEventListener("click", () => {
    try {
      const obj = JSON.parse(textMain?.value || "{}");
      if (textMain) textMain.value = JSON.stringify(obj, null, 2);
      updateStats(textMain.value);
      showToast(t("jsonOk"));
    } catch {
      showToast(t("jsonErr"));
    }
  });

  document.getElementById("json-validate")?.addEventListener("click", () => {
    try {
      JSON.parse(textMain?.value || "");
      showToast(t("jsonOk"));
    } catch {
      showToast(t("jsonErr"));
    }
  });

  document.getElementById("b64-encode")?.addEventListener("click", async () => {
    const out = await digest("b64", textMain?.value || "");
    document.getElementById("text-side").value = out;
  });

  document.getElementById("b64-decode")?.addEventListener("click", () => {
    try {
      const raw = document.getElementById("text-side").value.trim();
      const bin = atob(raw);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      if (textMain) textMain.value = new TextDecoder().decode(bytes);
      updateStats(textMain.value);
    } catch {
      showToast(t("toastFail"));
    }
  });

  document.getElementById("diff-run")?.addEventListener("click", () => {
    const a = (document.getElementById("diff-a")?.value || "").split(/\r?\n/);
    const b = (document.getElementById("diff-b")?.value || "").split(/\r?\n/);
    const max = Math.max(a.length, b.length);
    const lines = [];
    for (let i = 0; i < max; i++) {
      const la = a[i], lb = b[i];
      if (la === lb) lines.push(`<span class="diff-same">  ${escapeHtml(la || "")}</span>`);
      else {
        if (la !== undefined) lines.push(`<span class="diff-del">- ${escapeHtml(la)}</span>`);
        if (lb !== undefined) lines.push(`<span class="diff-add">+ ${escapeHtml(lb)}</span>`);
      }
    }
    document.getElementById("diff-out").innerHTML = lines.join("\n") || "—";
  });

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ── Network ── */
  async function fetchPublicIp() {
    const el = document.getElementById("net-ip");
    if (!el) return;
    el.textContent = t("loading");
    try {
      const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const j = await r.json();
      el.textContent = j.ip || "—";
    } catch {
      el.textContent = t("offline");
    }
  }

  function formatWeatherFromJson(data) {
    const cur = data?.current_condition?.[0];
    const area = data?.nearest_area?.[0]?.areaName?.[0]?.value || "";
    if (!cur) return null;
    const temp = cur.temp_C;
    const desc = cur.weatherDesc?.[0]?.value || cur.lang_en?.[0]?.value || "";
    const feels = cur.FeelsLikeC ? ` (feels ${cur.FeelsLikeC}°C)` : "";
    const place = area ? area + ": " : "";
    return `${place}${desc}, ${temp}°C${feels}`.trim();
  }

  async function fetchWeather() {
    const el = document.getElementById("net-weather");
    const city = document.getElementById("net-city")?.value?.trim() || "";
    if (!el) return;
    el.textContent = t("loading");
    const loc = encodeURIComponent(city || "Kyiv");
    const wttrHeaders = { "User-Agent": "curl/8.0 (FoxUtils)" };

    try {
      const r = await fetch(`https://wttr.in/${loc}?format=j1`, {
        cache: "no-store",
        headers: wttrHeaders
      });
      const raw = await r.text();
      if (raw.trim().startsWith("{")) {
        const line = formatWeatherFromJson(JSON.parse(raw));
        if (line) {
          el.textContent = line;
          return;
        }
      }
    } catch { /* try plain format */ }

    try {
      const r = await fetch(`https://wttr.in/${loc}?format=3`, {
        cache: "no-store",
        headers: wttrHeaders
      });
      const text = (await r.text()).trim();
      if (!text || /^<!DOCTYPE|^<html/i.test(text)) {
        el.textContent = t("offline");
        return;
      }
      el.textContent = text.replace(/\s+/g, " ");
    } catch {
      el.textContent = t("offline");
    }
  }

  document.getElementById("net-refresh")?.addEventListener("click", () => {
    fetchPublicIp();
    fetchWeather();
  });

  document.querySelectorAll("[data-term-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.termCopy));
  });

  /* ── Pomodoro ── */
  const POMO = { work: 25 * 60, break: 5 * 60, long: 15 * 60 };
  let pomoPhase = "work";
  let pomoLeft = POMO.work;
  let pomoTimer = null;
  let pomoRunning = false;
  let pomoSessions = 0;

  function loadPomoStats() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_POMO) || "{}");
      const today = new Date().toDateString();
      if (d.date === today) pomoSessions = d.count || 0;
    } catch { /* ignore */ }
  }

  function savePomoStats() {
    localStorage.setItem(STORE_POMO, JSON.stringify({ date: new Date().toDateString(), count: pomoSessions }));
    document.getElementById("pomo-sessions").textContent = String(pomoSessions);
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function updatePomoRing() {
    const total = pomoPhase === "work" ? POMO.work : pomoPhase === "break" ? POMO.break : POMO.long;
    const pct = 1 - pomoLeft / total;
    const circle = document.getElementById("pomo-progress");
    if (circle) circle.style.strokeDashoffset = String(628 * (1 - pct));
    const timeEl = document.getElementById("pomo-time");
    if (timeEl) timeEl.textContent = fmtTime(pomoLeft);
    const phaseEl = document.getElementById("pomo-phase-label");
    if (phaseEl) {
      phaseEl.textContent = pomoPhase === "work" ? t("work") : pomoPhase === "break" ? t("break") : t("longBreak");
    }
  }

  function beep() {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 180);
    } catch { /* ignore */ }
  }

  function pomoTick() {
    if (pomoLeft > 0) {
      pomoLeft--;
      updatePomoRing();
      return;
    }
    beep();
    if (pomoPhase === "work") {
      pomoSessions++;
      savePomoStats();
      pomoPhase = pomoSessions % 4 === 0 ? "long" : "break";
      pomoLeft = pomoPhase === "long" ? POMO.long : POMO.break;
    } else {
      pomoPhase = "work";
      pomoLeft = POMO.work;
    }
    updatePomoRing();
  }

  document.getElementById("pomo-start")?.addEventListener("click", () => {
    if (pomoRunning) {
      clearInterval(pomoTimer);
      pomoRunning = false;
      document.getElementById("pomo-start").textContent = t("start");
    } else {
      pomoRunning = true;
      document.getElementById("pomo-start").textContent = t("pause");
      pomoTimer = setInterval(pomoTick, 1000);
    }
  });

  document.getElementById("pomo-reset")?.addEventListener("click", () => {
    clearInterval(pomoTimer);
    pomoRunning = false;
    pomoPhase = "work";
    pomoLeft = POMO.work;
    document.getElementById("pomo-start").textContent = t("start");
    updatePomoRing();
  });

  document.querySelectorAll("[data-pomo-phase]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearInterval(pomoTimer);
      pomoRunning = false;
      pomoPhase = btn.dataset.pomoPhase;
      pomoLeft = POMO[pomoPhase === "long" ? "long" : pomoPhase];
      document.getElementById("pomo-start").textContent = t("start");
      updatePomoRing();
    });
  });

  /* ── Boot ── */
  applyI18n();
  renderHashHistory();
  updateStats("");
  loadPomoStats();
  savePomoStats();
  updatePomoRing();
  fetchPublicIp();
  fetchWeather();
})();
