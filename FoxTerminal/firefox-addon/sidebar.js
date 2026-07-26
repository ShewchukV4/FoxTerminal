const HOST_NAME = "com.foxterminal.bridge";

const outputEl = document.getElementById("terminal-output");
const formEl = document.getElementById("command-form");
const inputEl = document.getElementById("command-input");
const runBtnEl = document.getElementById("run-btn");
const clearBtnEl = document.getElementById("clear-btn");
const cwdEl = document.getElementById("cwd-bar");
const pillEl = document.getElementById("connection-pill");

const tabButtons = Array.from(document.querySelectorAll(".tab"));
const panels = {
  terminal: document.getElementById("panel-terminal"),
  sessions: document.getElementById("panel-sessions"),
  themes: document.getElementById("panel-themes"),
  translate: document.getElementById("panel-translate"),
  settings: document.getElementById("panel-settings")
};

const translateLangsEl = document.getElementById("translate-langs");
const translateSourceEl = document.getElementById("translate-source");
const translateResultEl = document.getElementById("translate-result");
const translateNotesEl = document.getElementById("translate-notes");
const translateStatusEl = document.getElementById("translate-status");
const translateCopyBtn = document.getElementById("translate-copy-btn");

const settingsForm = document.getElementById("settings-form");
const settingTargetLang = document.getElementById("setting-target-lang");
const settingSourceLang = document.getElementById("setting-source-lang");
const settingAiTranslate = document.getElementById("setting-ai-translate");
const settingOpenSidebar = document.getElementById("setting-open-sidebar");
const settingCopy = document.getElementById("setting-copy");
const settingNotify = document.getElementById("setting-notify");
const settingsStatusEl = document.getElementById("settings-status");

const sessionNameInput = document.getElementById("session-name-input");
const saveWindowBtn = document.getElementById("save-window-btn");
const savePinBtn = document.getElementById("save-pin-btn");
const sessionsStatusEl = document.getElementById("sessions-status");
const sessionsListEl = document.getElementById("sessions-list");
const themesGridEl = document.getElementById("themes-grid");
const themeCurrentLabel = document.getElementById("theme-current-label");
const themeCurrentSwatch = document.getElementById("theme-current-swatch");
const themeFilterChips = Array.from(document.querySelectorAll(".themes-filters .chip"));

let savedTabSets = [];
let allThemes = [];
let currentThemeId = "slate";
let themeGroupFilter = "all";

let port = null;
let isBusy = false;
let queue = [];
let inflight = null;
let currentCwd = "";
let lastEventSeq = 0;
let pollTimer = null;
let currentMode = "local";
let langLabels = {
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

function setBusy(next) {
  isBusy = next;
  inputEl.disabled = next;
  runBtnEl.disabled = next;
}

function setConnection(connected, message) {
  pillEl.textContent = connected ? "online" : "offline";
  pillEl.classList.toggle("connected", connected);
  pillEl.classList.toggle("disconnected", !connected);
  if (message) {
    appendLine(message, connected ? "info" : "error");
  }
}

function setCwd(cwd) {
  if (!cwd) {
    return;
  }
  currentCwd = cwd;
  cwdEl.textContent = `cwd: ${cwd}`;
}

function appendLine(text, cls = "success") {
  if (!text) {
    return;
  }
  const cleaned = String(text)
    // Strip OSC sequences (e.g. terminal title/color controls)
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    // Strip CSI color/control sequences
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
  const lines = cleaned.split(/\r?\n/);
  for (const line of lines) {
    const row = document.createElement("div");
    row.className = `line ${cls}`;
    row.textContent = line;
    outputEl.appendChild(row);
  }
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
  outputEl.textContent = "";
}

function appendRemoteEvent(event) {
  if (!event || typeof event.seq !== "number") {
    return;
  }

  if (event.seq > lastEventSeq) {
    lastEventSeq = event.seq;
  }

  const source = String(event.source || "");
  if (source === "sidebar") {
    return;
  }

  const line = String(event.line || "").trim();
  if (line) {
    appendLine(`[sync] ${event.cwd || "~"}> ${line}`, "command");
  }

  if (event.clear) {
    clearOutput();
  }

  if (event.cwd) {
    setCwd(event.cwd);
  }

  if (event.output) {
    appendLine(String(event.output), event.ok === false ? "error" : "success");
  }
}

function connectHost() {
  port = browser.runtime.connectNative(HOST_NAME);
  setConnection(true, "Native host connected.");

  port.onMessage.addListener((message) => {
    if (!inflight) {
      appendLine(`host: ${JSON.stringify(message)}`, "info");
      return;
    }
    const active = inflight;
    inflight = null;
    active.resolve(message);
    pumpQueue();
  });

  port.onDisconnect.addListener(() => {
    const reason = browser.runtime.lastError ? browser.runtime.lastError.message : "Native host disconnected.";
    setConnection(false, reason);
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (inflight) {
      inflight.reject(new Error(reason));
      inflight = null;
    }
    while (queue.length > 0) {
      const pending = queue.shift();
      pending.reject(new Error(reason));
    }
    port = null;
  });
}

async function pollSharedEvents() {
  if (!port) {
    return;
  }

  try {
    const response = await requestHost({
      type: "terminalPoll",
      afterSeq: lastEventSeq
    });

    if (!response || response.ok !== true || !Array.isArray(response.events)) {
      return;
    }

    for (const event of response.events) {
      appendRemoteEvent(event);
    }
  } catch (_) {
    // Ignore transient poll issues.
  }
}

function pumpQueue() {
  if (!port || inflight || queue.length === 0) {
    return;
  }

  inflight = queue.shift();
  try {
    port.postMessage(inflight.payload);
  } catch (error) {
    const active = inflight;
    inflight = null;
    active.reject(error);
    pumpQueue();
  }
}

function requestHost(payload) {
  return new Promise((resolve, reject) => {
    if (!port) {
      reject(new Error("Native host is not connected."));
      return;
    }
    queue.push({ payload, resolve, reject });
    pumpQueue();
  });
}

async function executeCommand(line) {
  const command = line.trim();
  if (!command) {
    return;
  }

  appendLine(`${currentCwd || "~"}> ${command}`, "command");
  setBusy(true);

  try {
    if (/^(?:ff\s+)?history\s+-clear$/i.test(command)) {
      const cleared = await browser.runtime.sendMessage({ type: "clearFirefoxHistory" });
      if (cleared && cleared.ok) {
        appendLine(cleared.output || "Firefox history cleared.", "success");
      } else {
        appendLine("Failed to clear Firefox history.", "error");
      }
      return;
    }

    const response = await requestHost({
      type: "terminalExec",
      line: command
    });

    if (response.cwd) {
      setCwd(response.cwd);
    }

    if (response.mode && response.mode !== currentMode) {
      currentMode = response.mode;
      appendLine(`Mode: ${currentMode}`, "info");
    }

    if (response.clear) {
      clearOutput();
    }

    if (response.output) {
      appendLine(response.output, response.ok === false ? "error" : "success");
    }

    if (response.ok === false && response.error) {
      appendLine(response.error, "error");
    }
  } catch (error) {
    appendLine(error.message || String(error), "error");
  } finally {
    setBusy(false);
    inputEl.focus();
  }
}

function switchTab(tabName) {
  const name = panels[tabName] ? tabName : "terminal";
  for (const button of tabButtons) {
    const on = button.dataset.tab === name;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (const [key, panel] of Object.entries(panels)) {
    panel.classList.toggle("active", key === name);
  }
  if (name === "terminal") {
    inputEl.focus();
  }
  if (name === "sessions") {
    loadSavedTabSets().catch(() => {});
  }
  if (name === "themes") {
    renderThemesGrid();
  }
}

function paintSwatch(el, theme) {
  if (!el || !theme) {
    return;
  }
  el.style.background = theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
}

function setCurrentThemeUi(theme) {
  if (!theme) {
    return;
  }
  currentThemeId = theme.id;
  if (window.FoxThemes && FoxThemes.applyFoxTheme) {
    FoxThemes.applyFoxTheme(theme);
  }
  if (themeCurrentLabel) {
    themeCurrentLabel.textContent = theme.label;
  }
  paintSwatch(themeCurrentSwatch, theme);
  renderThemesGrid();
}

function renderThemesGrid() {
  if (!themesGridEl) {
    return;
  }
  themesGridEl.textContent = "";
  const list = (allThemes.length ? allThemes : (window.FoxThemes ? FoxThemes.listFoxThemes() : []))
    .filter((theme) => themeGroupFilter === "all" || theme.group === themeGroupFilter);

  for (const theme of list) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `theme-card${theme.id === currentThemeId ? " active" : ""}`;
    card.style.animationDelay = `${Math.min(list.indexOf(theme), 12) * 0.03}s`;

    const swatch = document.createElement("div");
    swatch.className = "theme-swatch";
    paintSwatch(swatch, theme);

    const title = document.createElement("div");
    title.className = "theme-card-title";
    title.textContent = theme.label;

    const group = document.createElement("div");
    group.className = "theme-card-group";
    group.textContent = theme.group;

    card.appendChild(swatch);
    card.appendChild(title);
    card.appendChild(group);
    card.addEventListener("click", () => selectTheme(theme.id));
    themesGridEl.appendChild(card);
  }
}

async function selectTheme(themeId) {
  const local = window.FoxThemes ? FoxThemes.getFoxTheme(themeId) : null;
  if (local) {
    setCurrentThemeUi(local);
    if (themeCurrentLabel) {
      themeCurrentLabel.textContent = `${local.label} · застосовуємо…`;
    }
  }
  try {
    const theme = await browser.runtime.sendMessage({ type: "setUiTheme", themeId });
    setCurrentThemeUi(theme);
    const apiOk = theme && theme.applied && theme.applied.themeApi;
    const zenOk = theme && theme.applied && theme.applied.zenChrome;
    if (themeCurrentLabel) {
      if (zenOk) {
        themeCurrentLabel.textContent = `${theme.label} · Zen перезапускається…`;
      } else if (apiOk) {
        themeCurrentLabel.textContent = `${theme.label} · theme API ok`;
      } else {
        themeCurrentLabel.textContent = `${theme.label} · лише панель (нема theme/native)`;
      }
    }
  } catch (error) {
    if (themeCurrentLabel) {
      themeCurrentLabel.textContent = `Помилка: ${error.message || error}`;
    }
  }
}

async function loadUiTheme() {
  try {
    allThemes = await browser.runtime.sendMessage({ type: "listUiThemes" }) || [];
    const theme = await browser.runtime.sendMessage({ type: "getUiTheme" });
    setCurrentThemeUi(theme);
  } catch (_) {
    if (window.FoxThemes) {
      allThemes = FoxThemes.listFoxThemes();
      setCurrentThemeUi(FoxThemes.getFoxTheme(currentThemeId));
    }
  }
}

function setSessionsStatus(text) {
  sessionsStatusEl.textContent = text;
}

function renderSavedTabSets() {
  sessionsListEl.textContent = "";
  if (!savedTabSets.length) {
    const empty = document.createElement("p");
    empty.className = "sessions-empty";
    empty.textContent = "Поки порожньо. Збережи сесію або закріпи вкладку.";
    sessionsListEl.appendChild(empty);
    return;
  }

  for (const set of savedTabSets) {
    const card = document.createElement("article");
    card.className = `session-card${set.pinned ? " pinned" : ""}`;
    card.dataset.id = set.id;

    const head = document.createElement("div");
    head.className = "session-head";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "session-title";
    title.textContent = `${set.pinned ? "★ " : ""}${set.name || "Без назви"}`;
    const meta = document.createElement("p");
    meta.className = "session-meta";
    const kind = set.kind === "pin" ? "закріплена вкладка" : "сесія";
    meta.textContent = `${(set.tabs || []).length} сайт(ів) · ${kind}`;
    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);

    head.appendChild(titleWrap);
    card.appendChild(head);

    const controls = document.createElement("div");
    controls.className = "session-controls";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "open-btn";
    openBtn.textContent = "Відкрити";
    openBtn.addEventListener("click", () => openSet(set.id, "current"));

    const newWinBtn = document.createElement("button");
    newWinBtn.type = "button";
    newWinBtn.textContent = "Нове вікно";
    newWinBtn.addEventListener("click", () => openSet(set.id, "new"));

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.textContent = set.pinned ? "Відкріпити" : "Закріпити";
    pinBtn.addEventListener("click", () => togglePin(set.id));

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "Перейменувати";
    renameBtn.addEventListener("click", () => showRenameRow(card, set));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Видалити";
    deleteBtn.addEventListener("click", () => showDeleteConfirm(card, set, controls));

    controls.appendChild(openBtn);
    controls.appendChild(newWinBtn);
    controls.appendChild(pinBtn);
    controls.appendChild(renameBtn);
    controls.appendChild(deleteBtn);
    card.appendChild(controls);

    const links = document.createElement("div");
    links.className = "session-links";
    (set.tabs || []).forEach((tab, index) => {
      const linkBtn = document.createElement("button");
      linkBtn.type = "button";
      linkBtn.className = "session-link";
      linkBtn.title = tab.url;
      linkBtn.textContent = tab.title || tab.url;
      linkBtn.addEventListener("click", () => openOne(set.id, index));
      links.appendChild(linkBtn);
    });
    card.appendChild(links);

    sessionsListEl.appendChild(card);
  }
}

function clearInlineEditors(card) {
  const renameRow = card.querySelector(".session-rename-row");
  if (renameRow) {
    renameRow.remove();
  }
}

function showRenameRow(card, set) {
  clearInlineEditors(card);
  const existing = card.querySelector(".session-rename-row");
  if (existing) {
    existing.remove();
    return;
  }

  const row = document.createElement("div");
  row.className = "session-rename-row";

  const input = document.createElement("input");
  input.type = "text";
  input.value = set.name || "";
  input.maxLength = 120;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "OK";
  saveBtn.addEventListener("click", async () => {
    await renameSet(set.id, input.value);
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Скасувати";
  cancelBtn.addEventListener("click", () => row.remove());

  row.appendChild(input);
  row.appendChild(saveBtn);
  row.appendChild(cancelBtn);
  card.insertBefore(row, card.querySelector(".session-links"));
  input.focus();
  input.select();
}

function showDeleteConfirm(card, set, controls) {
  clearInlineEditors(card);
  if (controls.dataset.confirmDelete === "1") {
    renderSavedTabSets();
    return;
  }

  controls.dataset.confirmDelete = "1";
  controls.textContent = "";

  const label = document.createElement("button");
  label.type = "button";
  label.disabled = true;
  label.textContent = "Точно видалити?";

  const yesBtn = document.createElement("button");
  yesBtn.type = "button";
  yesBtn.className = "delete-confirm-btn";
  yesBtn.textContent = "Так, видалити";
  yesBtn.addEventListener("click", () => deleteSet(set.id));

  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.textContent = "Ні";
  noBtn.addEventListener("click", () => {
    renderSavedTabSets();
  });

  controls.appendChild(label);
  controls.appendChild(yesBtn);
  controls.appendChild(noBtn);
}

async function loadSavedTabSets() {
  const list = await browser.runtime.sendMessage({ type: "listSavedTabSets" });
  savedTabSets = Array.isArray(list) ? list : [];
  renderSavedTabSets();
}

async function openSet(id, mode) {
  try {
    const result = await browser.runtime.sendMessage({ type: "openSavedTabSet", id, mode });
    setSessionsStatus(`Відкрито ${result.opened || 0} сайт(ів)${mode === "new" ? " у новому вікні" : ""}.`);
  } catch (error) {
    setSessionsStatus(`Помилка відкриття: ${error.message || error}`);
  }
}

async function openOne(id, index) {
  try {
    await browser.runtime.sendMessage({ type: "openSavedTabUrl", id, index });
    setSessionsStatus("Сайт відкрито.");
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
}

async function togglePin(id) {
  try {
    const updated = await browser.runtime.sendMessage({ type: "toggleSavedTabSetPinned", id });
    setSessionsStatus(updated.pinned ? "Закріплено зверху списку." : "Відкріплено.");
    await loadSavedTabSets();
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
}

async function renameSet(id, nextName) {
  try {
    await browser.runtime.sendMessage({ type: "renameSavedTabSet", id, name: nextName });
    setSessionsStatus("Перейменовано.");
    await loadSavedTabSets();
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
}

async function deleteSet(id) {
  try {
    const result = await browser.runtime.sendMessage({ type: "deleteSavedTabSet", id });
    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || "Не вдалося видалити.");
    }
    setSessionsStatus("Видалено.");
    await loadSavedTabSets();
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
}

function langLabel(code) {
  return langLabels[code] || code || "?";
}

function fillLangSelect(selectEl, includeAuto) {
  selectEl.textContent = "";
  const codes = Object.keys(langLabels).filter((code) => includeAuto || code !== "auto");
  for (const code of codes) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = langLabels[code];
    selectEl.appendChild(option);
  }
}

function showTranslation(payload) {
  if (!payload) {
    return;
  }
  translateSourceEl.value = payload.sourceText || "";
  translateResultEl.value = payload.translatedText || "";
  if (translateNotesEl) {
    translateNotesEl.value = payload.notes || "";
  }
  translateLangsEl.textContent = `${langLabel(payload.sourceLang || "auto")} → ${langLabel(payload.targetLang || "uk")}`;
  const when = payload.at ? new Date(payload.at).toLocaleTimeString() : "";
  const engineMap = {
    ollama: "AI · за сенсом",
    google: "Google · дослівно",
    mymemory: "MyMemory · дослівно"
  };
  const engine = payload.engine ? ` · ${engineMap[payload.engine] || payload.engine}` : "";
  translateStatusEl.textContent = when
    ? `Оновлено о ${when}${engine}`
    : `Готово${engine}`;
}

async function loadSettingsIntoForm() {
  const settings = await browser.runtime.sendMessage({ type: "getTranslateSettings" });
  if (!settings) {
    return;
  }
  settingTargetLang.value = settings.targetLang || "uk";
  settingSourceLang.value = settings.sourceLang || "auto";
  if (settingAiTranslate) {
    settingAiTranslate.checked = settings.preferAiTranslate !== false;
  }
  settingOpenSidebar.checked = settings.openSidebarOnTranslate !== false;
  settingCopy.checked = settings.copyTranslation === true;
  settingNotify.checked = settings.notifyOnTranslate !== false;
  translateLangsEl.textContent = `${langLabel(settings.sourceLang || "auto")} → ${langLabel(settings.targetLang || "uk")}`;
}

async function loadLastTranslation(switchToTranslate) {
  const last = await browser.runtime.sendMessage({ type: "getLastTranslation" });
  if (!last) {
    return;
  }
  showTranslation(last);
  const isFresh = typeof last.at === "number" && (Date.now() - last.at) < 60000;
  if (switchToTranslate || isFresh) {
    switchTab("translate");
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const line = inputEl.value;
  inputEl.value = "";
  await executeCommand(line);
});

clearBtnEl.addEventListener("click", () => {
  clearOutput();
  inputEl.focus();
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
  });
}

translateCopyBtn.addEventListener("click", async () => {
  const text = translateResultEl.value.trim();
  if (!text) {
    translateStatusEl.textContent = "Немає перекладу для копіювання.";
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      translateResultEl.focus();
      translateResultEl.select();
      document.execCommand("copy");
    }
    translateStatusEl.textContent = "Скопійовано в буфер.";
  } catch (error) {
    translateStatusEl.textContent = `Не вдалося скопіювати: ${error.message || error}`;
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsStatusEl.textContent = "Зберігаю...";
  try {
    const saved = await browser.runtime.sendMessage({
      type: "saveTranslateSettings",
      settings: {
        targetLang: settingTargetLang.value,
        sourceLang: settingSourceLang.value,
        preferAiTranslate: !settingAiTranslate || settingAiTranslate.checked,
        openSidebarOnTranslate: settingOpenSidebar.checked,
        copyTranslation: settingCopy.checked,
        notifyOnTranslate: settingNotify.checked
      }
    });
    translateLangsEl.textContent = `${langLabel(saved.sourceLang)} → ${langLabel(saved.targetLang)}`;
    settingsStatusEl.textContent = "Збережено. Меню «Перекласти» оновлено.";
  } catch (error) {
    settingsStatusEl.textContent = `Помилка збереження: ${error.message || error}`;
  }
});

saveWindowBtn.addEventListener("click", async () => {
  setSessionsStatus("Зберігаю вікно...");
  try {
    const saved = await browser.runtime.sendMessage({
      type: "saveCurrentWindowTabs",
      name: sessionNameInput.value
    });
    sessionNameInput.value = "";
    setSessionsStatus(`Збережено «${saved.name}» (${saved.tabs.length}).`);
    await loadSavedTabSets();
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
});

savePinBtn.addEventListener("click", async () => {
  setSessionsStatus("Закріплюю активну вкладку...");
  try {
    const saved = await browser.runtime.sendMessage({
      type: "saveActiveTabPin",
      name: sessionNameInput.value
    });
    sessionNameInput.value = "";
    setSessionsStatus(`Закріплено «${saved.name}».`);
    await loadSavedTabSets();
  } catch (error) {
    setSessionsStatus(`Помилка: ${error.message || error}`);
  }
});

for (const chip of themeFilterChips) {
  chip.addEventListener("click", () => {
    themeGroupFilter = chip.dataset.group || "all";
    for (const item of themeFilterChips) {
      item.classList.toggle("active", item === chip);
    }
    renderThemesGrid();
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (changes.lastTranslation && changes.lastTranslation.newValue) {
    showTranslation(changes.lastTranslation.newValue);
    switchTab("translate");
  }
  if (changes.translateSettings && changes.translateSettings.newValue) {
    const settings = changes.translateSettings.newValue;
    settingTargetLang.value = settings.targetLang || "uk";
    settingSourceLang.value = settings.sourceLang || "auto";
    if (settingAiTranslate) {
      settingAiTranslate.checked = settings.preferAiTranslate !== false;
    }
    settingOpenSidebar.checked = settings.openSidebarOnTranslate !== false;
    settingCopy.checked = settings.copyTranslation === true;
    settingNotify.checked = settings.notifyOnTranslate !== false;
    translateLangsEl.textContent = `${langLabel(settings.sourceLang || "auto")} → ${langLabel(settings.targetLang || "uk")}`;
  }
  if (changes.savedTabSets) {
    savedTabSets = Array.isArray(changes.savedTabSets.newValue) ? changes.savedTabSets.newValue : [];
    renderSavedTabSets();
  }
  if (changes.uiThemeId && changes.uiThemeId.newValue) {
    const theme = window.FoxThemes
      ? FoxThemes.getFoxTheme(changes.uiThemeId.newValue)
      : null;
    if (theme) {
      setCurrentThemeUi(theme);
    }
  }
});

async function bootstrapUi() {
  try {
    const labels = await browser.runtime.sendMessage({ type: "getTranslateLangLabels" });
    if (labels && typeof labels === "object") {
      langLabels = labels;
    }
  } catch (_) {
    // Keep local fallback labels.
  }

  fillLangSelect(settingTargetLang, false);
  fillLangSelect(settingSourceLang, true);
  await loadUiTheme();
  await loadSettingsIntoForm();
  await loadLastTranslation(false);
  await loadSavedTabSets();
}

async function bootstrapTerminal() {
  connectHost();
  try {
    const hello = await requestHost({ type: "terminalHello" });
    if (hello.cwd) {
      setCwd(hello.cwd);
    }
    if (hello.mode) {
      currentMode = hello.mode;
    }
    if (hello.output) {
      appendLine(hello.output, "info");
    }
    appendLine(`Mode: ${currentMode}`, "info");
    if (hello.shared === true) {
      appendLine("Sync bridge is active: terminal + sidebar share one session.", "info");
    } else {
      appendLine("Sync bridge is off. Run 'ffsync start' and use 'ffsync shell'.", "info");
    }
    appendLine("Type command and press Enter.", "info");
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    pollTimer = setInterval(() => {
      pollSharedEvents();
    }, 900);
  } catch (error) {
    appendLine(error.message || String(error), "error");
  } finally {
    if (panels.terminal.classList.contains("active")) {
      inputEl.focus();
    }
  }
}

bootstrapUi().catch(() => {});
bootstrapTerminal();
