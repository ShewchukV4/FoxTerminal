(function () {
  if (window.__foxTranslateOverlayInstalled) {
    return;
  }
  window.__foxTranslateOverlayInstalled = true;

  const HOST_ID = "foxterminal-translate-overlay-host";
  const LANG_LABELS = {
    auto: "Авто",
    uk: "Українська",
    en: "English",
    pl: "Polski",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
    it: "Italiano",
    pt: "Português",
    cs: "Čeština",
    sk: "Slovenčina",
    ru: "Русский",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    tr: "Türkçe",
    ar: "العربية"
  };

  let host = null;
  let shadow = null;
  let box = null;
  let titleEl = null;
  let textEl = null;
  let notesWrap = null;
  let notesEl = null;
  let dragState = null;
  let pos = { x: null, y: null };

  function ensureUi() {
    if (host && document.documentElement.contains(host)) {
      return;
    }

    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      host.style.all = "initial";
      host.style.position = "fixed";
      host.style.inset = "0";
      host.style.zIndex = "2147483646";
      host.style.pointerEvents = "none";
      (document.documentElement || document.body).appendChild(host);
    }

    shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box {
          --accent: #6c8dff;
          --accent2: #6b53ff;
          --text: #eef3ff;
          --dim: #9bb0df;
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: min(520px, calc(100vw - 24px));
          max-height: min(62vh, 480px);
          display: flex;
          flex-direction: column;
          gap: 0;
          padding: 0;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)), rgba(12, 18, 34, 0.55);
          color: var(--text);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.2);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          font: 14px/1.4 "Segoe UI", Tahoma, sans-serif;
          pointer-events: auto;
          overflow: hidden;
          animation: fox-pop 0.28s ease both;
        }
        @keyframes fox-pop {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .box.hidden { display: none; }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          background: linear-gradient(130deg, var(--accent), var(--accent2));
          cursor: grab;
          user-select: none;
        }
        .head.dragging { cursor: grabbing; }
        .title {
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.02em;
          color: #fff;
        }
        .actions {
          display: flex;
          gap: 6px;
        }
        .btn {
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          border-radius: 10px;
          padding: 4px 8px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        .btn:hover { background: rgba(255, 255, 255, 0.2); }
        .body {
          padding: 10px 12px 8px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 15px;
          min-height: 0;
        }
        .notes {
          margin: 0 12px 8px;
          padding: 10px 11px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.22);
          color: var(--dim);
          font-size: 12.5px;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .notes-label {
          display: block;
          margin-bottom: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: color-mix(in srgb, var(--accent) 80%, #fff);
        }
        .notes.hidden { display: none; }
        .hint {
          padding: 0 12px 10px;
          color: var(--dim);
          font-size: 11px;
        }
      </style>
      <div class="box hidden" part="box">
        <div class="head">
          <div class="title">Переклад</div>
          <div class="actions">
            <button type="button" class="btn copy" title="Копіювати">Копіювати</button>
            <button type="button" class="btn close" title="Закрити">✕</button>
          </div>
        </div>
        <div class="body"></div>
        <div class="notes hidden">
          <span class="notes-label">Нотатки від ШІ</span>
          <div class="notes-text"></div>
        </div>
        <div class="hint">Перетягни заголовок, щоб перемістити</div>
      </div>
    `;

    box = shadow.querySelector(".box");
    titleEl = shadow.querySelector(".title");
    textEl = shadow.querySelector(".body");
    notesWrap = shadow.querySelector(".notes");
    notesEl = shadow.querySelector(".notes-text");
    const head = shadow.querySelector(".head");
    const copyBtn = shadow.querySelector(".btn.copy");
    const closeBtn = shadow.querySelector(".btn.close");

    closeBtn.addEventListener("click", hideBox);
    copyBtn.addEventListener("click", async () => {
      const value = textEl.textContent || "";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
        }
        copyBtn.textContent = "Ок";
        setTimeout(() => {
          copyBtn.textContent = "Копіювати";
        }, 1200);
      } catch (_) {
        copyBtn.textContent = "Помилка";
        setTimeout(() => {
          copyBtn.textContent = "Копіювати";
        }, 1200);
      }
    });

    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      if (event.target.closest(".btn")) {
        return;
      }
      const rect = box.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      head.classList.add("dragging");
      head.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    head.addEventListener("pointermove", (event) => {
      if (!dragState) {
        return;
      }
      const nextX = event.clientX - dragState.offsetX;
      const nextY = event.clientY - dragState.offsetY;
      const maxX = Math.max(8, window.innerWidth - box.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - box.offsetHeight - 8);
      pos.x = Math.min(Math.max(8, nextX), maxX);
      pos.y = Math.min(Math.max(8, nextY), maxY);
      applyPosition();
    });

    const endDrag = (event) => {
      if (!dragState) {
        return;
      }
      dragState = null;
      head.classList.remove("dragging");
      try {
        head.releasePointerCapture(event.pointerId);
      } catch (_) {
        // ignore
      }
    };

    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
  }

  function applyPosition() {
    if (!box) {
      return;
    }
    if (pos.x == null || pos.y == null) {
      box.style.left = "50%";
      box.style.top = "18px";
      box.style.transform = "translateX(-50%)";
      return;
    }
    box.style.left = `${pos.x}px`;
    box.style.top = `${pos.y}px`;
    box.style.transform = "none";
  }

  function hideBox() {
    if (box) {
      box.classList.add("hidden");
    }
  }

  function applyTheme(theme) {
    if (!box || !theme) {
      return;
    }
    box.style.setProperty("--accent", theme.accent || "#6c8dff");
    box.style.setProperty("--accent2", theme.accent2 || "#6b53ff");
    box.style.setProperty("--text", theme.text || "#eef3ff");
    box.style.setProperty("--dim", theme.dim || "#9bb0df");
  }

  function showBox(payload) {
    ensureUi();
    applyTheme(payload && payload.theme);
    const target = payload && payload.targetLang ? payload.targetLang : "uk";
    const source = payload && payload.sourceLang ? payload.sourceLang : "auto";
    const from = LANG_LABELS[source] || source;
    const to = LANG_LABELS[target] || target;
    titleEl.textContent = `Переклад · ${from} → ${to}`;
    textEl.textContent = (payload && payload.translatedText) || "";
    const notes = payload && payload.notes ? String(payload.notes).trim() : "";
    if (notes) {
      notesEl.textContent = notes;
      notesWrap.classList.remove("hidden");
    } else {
      notesEl.textContent = "";
      notesWrap.classList.add("hidden");
    }
    if (pos.x == null || pos.y == null) {
      applyPosition();
    }
    box.classList.remove("hidden");
  }

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "showTranslateOverlay") {
      return undefined;
    }
    showBox(message.payload || {});
    return Promise.resolve({ ok: true });
  });
})();
