// ==UserScript==
// @name         FoxTerminal ChatGPT auto-send
// @namespace    foxterminal
// @version      1.0
// @description  Auto-submit ChatGPT message from ?q= param
// @match        https://chatgpt.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
  const LANG_STORAGE_KEY = "foxterminal_lang";
  const DOUBLE_TAP_MS = 300;
  const OPEN_PICKER_KEY = "l";
  let lastTriggerAt = 0;
  let pickerOpen = false;
  let pickerIndex = 0;
  let pickerEl = null;
  let pickerListEl = null;

  const getSystemLanguages = () => {
    const langs = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language].filter(Boolean);
    return Array.from(new Set(langs));
  };

  const getLangDisplayName = (code) => {
    try {
      const display = new Intl.DisplayNames(undefined, { type: "language" });
      return display.of(code) || code;
    } catch {
      return code;
    }
  };

  const ensurePickerDom = () => {
    if (pickerEl) return;
    pickerEl = document.createElement("div");
    pickerEl.id = "foxterminal-lang-picker";
    pickerEl.style.cssText = [
      "position:fixed",
      "top:80px",
      "right:16px",
      "z-index:999999",
      "min-width:240px",
      "max-width:320px",
      "max-height:60vh",
      "overflow:auto",
      "background:#111",
      "color:#fff",
      "border:1px solid #333",
      "border-radius:8px",
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)",
      "padding:8px",
      "font:14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif",
      "display:none",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Language";
    title.style.cssText = "font-weight:600;margin:4px 8px 8px 8px;";
    pickerEl.appendChild(title);

    pickerListEl = document.createElement("div");
    pickerEl.appendChild(pickerListEl);

    const hint = document.createElement("div");
    hint.textContent = "Arrows to choose, Enter to select, Esc to close";
    hint.style.cssText = "opacity:0.75;margin:8px;";
    pickerEl.appendChild(hint);

    const mount = () => {
      if (!document.body) return false;
      document.body.appendChild(pickerEl);
      return true;
    };
    if (!mount()) {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    }
  };

  const renderPicker = (langs) => {
    if (!pickerListEl) return;
    pickerListEl.innerHTML = "";
    langs.forEach((code, idx) => {
      const item = document.createElement("div");
      const name = getLangDisplayName(code);
      item.textContent = `${name} (${code})`;
      item.dataset.lang = code;
      item.style.cssText = [
        "padding:6px 8px",
        "border-radius:6px",
        "cursor:default",
        idx === pickerIndex ? "background:#2d4bff" : "background:transparent",
      ].join(";");
      pickerListEl.appendChild(item);
    });
  };

  const openPicker = () => {
    const langs = getSystemLanguages();
    if (!langs.length) return;
    ensurePickerDom();
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    const savedIndex = saved ? langs.indexOf(saved) : -1;
    pickerIndex = savedIndex >= 0 ? savedIndex : 0;
    renderPicker(langs);
    pickerEl.style.display = "block";
    pickerOpen = true;
  };

  const closePicker = () => {
    if (!pickerEl) return;
    pickerEl.style.display = "none";
    pickerOpen = false;
  };

  const movePicker = (delta) => {
    const langs = getSystemLanguages();
    if (!langs.length) return;
    pickerIndex = (pickerIndex + delta + langs.length) % langs.length;
    renderPicker(langs);
  };

  const selectPicker = () => {
    const langs = getSystemLanguages();
    if (!langs.length) return;
    const code = langs[pickerIndex];
    localStorage.setItem(LANG_STORAGE_KEY, code);
    closePicker();
  };

  const isTypingTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return (
      target.isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    );
  };

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    if (pickerOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        movePicker(1);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        movePicker(-1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectPicker();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
      }
      return;
    }

    if (isTypingTarget(event.target)) return;

    if (event.key.toLowerCase() === OPEN_PICKER_KEY) {
      const now = Date.now();
      if (now - lastTriggerAt <= DOUBLE_TAP_MS) {
        event.preventDefault();
        openPicker();
        lastTriggerAt = 0;
        return;
      }
      lastTriggerAt = now;
    }
  });

  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (!q) return;

  // URLSearchParams already decodes %xx; only convert '+' to spaces.
  const decoded = q.replace(/\+/g, " ");

  const setNativeValue = (el, value) => {
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    if (desc && desc.set) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const sendOnce = () => {
    const textarea =
      document.querySelector('textarea[data-testid="prompt-textarea"]') ||
      document.querySelector("textarea");
    if (!textarea) return;
    textarea.focus();
    setNativeValue(textarea, decoded);
    const keyEventInit = {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      keyCode: 13,
      which: 13,
    };
    textarea.dispatchEvent(new KeyboardEvent("keydown", keyEventInit));
    textarea.dispatchEvent(new KeyboardEvent("keypress", keyEventInit));
    textarea.dispatchEvent(new KeyboardEvent("keyup", keyEventInit));
  };

  setTimeout(sendOnce, 1000);
})();
