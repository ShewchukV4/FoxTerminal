const actionSelect = document.getElementById("action-select");
const inputValue = document.getElementById("input-value");
const runButton = document.getElementById("run-button");
const statusBox = document.getElementById("status-box");
const themeRow = document.getElementById("theme-row");
const openSidebarBtn = document.getElementById("open-sidebar-btn");

const POPUP_THEME_QUICK = [
  "slate", "orange", "blue", "purple", "cyan", "noir",
  "arthas-dark", "apple", "pride-gay", "neon", "ruby", "gold"
];

function setStatus(message, state = "") {
  statusBox.textContent = message;
  statusBox.classList.remove("success", "error");
  if (state) {
    statusBox.classList.add(state);
  }
}

function updatePlaceholder() {
  const action = actionSelect.value;
  switch (action) {
    case "ai-command-parser":
      inputValue.placeholder = "будь-який запит: очисти історію за сьогодні / відео про X на ютубі / хочу телеграм";
      break;
    case "open-side-terminal":
      inputValue.placeholder = "порожньо";
      break;
    case "clear-history":
      inputValue.placeholder = "порожньо";
      break;
    case "clean-page":
      inputValue.placeholder = "порожньо";
      break;
    case "open-youtube":
      inputValue.placeholder = "порожньо";
      break;
    case "ff-open":
      inputValue.placeholder = "youtube або https://developer.mozilla.org";
      break;
    case "search-google":
      inputValue.placeholder = "наприклад: powershell array sort";
      break;
    case "ask-chatgpt":
      inputValue.placeholder = "напиши питання";
      break;
    case "open-site-hub":
      inputValue.placeholder = "порожньо";
      break;
    case "open-site-editor":
      inputValue.placeholder = "назва папки із sites/, напр. fox-utils";
      break;
    case "raw-command":
      inputValue.placeholder = "ff open youtube або ser firefox profiles";
      break;
    default:
      inputValue.placeholder = "";
      break;
  }
}

function looksLikeCommandLine(value) {
  return /^(ff|ser|gask|youtube|sites)\b/i.test(value.trim());
}

function splitCommandLine(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("Введи команду, напр. ff open youtube.");
  }

  // Supports quoted parts: ff open "https://example.com/q a"
  const parts = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return parts.map((part) => part.replace(/^['"]|['"]$/g, ""));
}

function buildCommand(action, rawValue) {
  const value = rawValue.trim();
  switch (action) {
    case "ai-command-parser":
      if (!value) {
        throw new Error("Введи фразу для AI parser, напр. 'відкрий youtube'.");
      }
      return { type: "aiCommandParser", input: value };
    case "open-side-terminal":
      return { type: "openSidebar" };
    case "clear-history":
      return { type: "clearHistory" };
    case "clean-page":
      return { type: "cleanPage" };
    case "open-youtube":
      return { command: "youtube", args: [] };
    case "ff-open":
      return { command: "ff", args: ["open", value || "youtube"] };
    case "search-google":
      if (!value) {
        throw new Error("Для Google пошуку введи текст.");
      }
      if (looksLikeCommandLine(value)) {
        throw new Error("Схоже на повну команду. Для цього обери: 'Виконати команду як у терміналі'.");
      }
      return { command: "ser", args: [value] };
    case "ask-chatgpt":
      if (!value) {
        throw new Error("Для ChatGPT введи питання.");
      }
      if (looksLikeCommandLine(value)) {
        throw new Error("Схоже на повну команду. Для цього обери: 'Виконати команду як у терміналі'.");
      }
      return { command: "gask", args: [value] };
    case "open-site-hub":
      return { command: "sites", args: ["-Main"] };
    case "open-site-editor":
      if (!value) {
        throw new Error("Вкажи назву site folder, напр. fox-stack.");
      }
      return { command: "sites", args: ["-open", value] };
    case "raw-command": {
      const parts = splitCommandLine(value);
      const command = (parts.shift() || "").toLowerCase();
      if (command === "clean" || command === "clean-page") {
        return { type: "cleanPage" };
      }
      if (command === "history" && parts[0] && parts[0].toLowerCase() === "-clear") {
        return { type: "clearHistory" };
      }
      if (command === "ff" && parts[0] && parts[0].toLowerCase() === "clean") {
        return { type: "cleanPage" };
      }
      if (command === "ff" && parts[0] && parts[0].toLowerCase() === "history" && parts[1] && parts[1].toLowerCase() === "-clear") {
        return { type: "clearHistory" };
      }
      return { command, args: parts };
    }
    default:
      throw new Error("Невідома дія.");
  }
}

async function runAction() {
  const action = actionSelect.value;
  let request;

  try {
    request = buildCommand(action, inputValue.value);
  } catch (error) {
    setStatus(error.message || "Невірні параметри.", "error");
    return;
  }

  runButton.disabled = true;
  setStatus("Виконую дію...");

  try {
    if (request.type === "aiCommandParser") {
      setStatus("Думаю через Ollama (автозапуск через Native Host)...");
      const response = await browser.runtime.sendMessage({
        type: "runAiCommand",
        input: request.input
      });
      if (!response) {
        throw new Error("Немає відповіді від background script. Натисни Reload в about:debugging.");
      }
      if (response.ok !== true) {
        const message = response && response.error ? response.error : "AI parser не зміг виконати дію.";
        throw new Error(message);
      }
      const details = response.output ? `\n${response.output}` : "";
      setStatus(`AI -> ${response.interpretation || "команда розпізнана"}${details}`, "success");
      return;
    }

    if (request.type === "clearHistory") {
      const response = await browser.runtime.sendMessage({ type: "clearFirefoxHistory" });
      if (!response || response.ok !== true) {
        throw new Error("Не вдалося очистити Firefox history.");
      }
      setStatus(response.output || "Firefox history очищено.", "success");
      return;
    }

    if (request.type === "cleanPage") {
      const response = await browser.runtime.sendMessage({ type: "cleanActivePage" });
      if (!response) {
        throw new Error("Немає відповіді від background script. Натисни Reload в about:debugging.");
      }
      if (response.ok !== true) {
        const message = response && response.error ? response.error : "Не вдалося очистити сторінку.";
        throw new Error(message);
      }
      setStatus(response.output || "Сторінку очищено.", "success");
      return;
    }

    const response = await browser.runtime.sendMessage({
      type: "runFoxTerminalCommand",
      command: request.command,
      args: request.args
    });

    if (!response || response.ok !== true) {
      const message = response && response.error ? response.error : "Команда завершилась з помилкою.";
      setStatus(message, "error");
      return;
    }

    const output = response.output ? `\n\n${response.output}` : "";
    setStatus(`Готово: ${request.command} ${request.args.join(" ")}` + output, "success");
  } catch (error) {
    setStatus(`Помилка виконання:\n${error.message}`, "error");
  } finally {
    runButton.disabled = false;
  }
}

actionSelect.addEventListener("change", updatePlaceholder);

function openSideTerminalFromGesture() {
  // MUST call open() synchronously in the click stack — no await/sendMessage before it.
  if (!browser.sidebarAction || !browser.sidebarAction.open) {
    return Promise.reject(new Error("Sidebar API unavailable."));
  }
  return browser.sidebarAction.open();
}

runButton.addEventListener("click", () => {
  if (actionSelect.value === "open-side-terminal") {
    let openPromise;
    try {
      openPromise = openSideTerminalFromGesture();
    } catch (error) {
      setStatus(`Помилка виконання:\n${error.message || error}`, "error");
      return;
    }
    setStatus("Відкриваю side terminal...");
    openPromise
      .then(() => setStatus("Side terminal відкрито.", "success"))
      .catch((error) => setStatus(`Помилка виконання:\n${error.message || error}`, "error"));
    return;
  }
  runAction();
});

async function renderPopupThemes(activeId) {
  if (!themeRow || !window.FoxThemes) {
    return;
  }
  themeRow.textContent = "";
  for (const id of POPUP_THEME_QUICK) {
    const theme = FoxThemes.getFoxTheme(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `theme-mini${theme.id === activeId ? " active" : ""}`;
    btn.title = theme.label;
    btn.setAttribute("aria-label", theme.label);
    btn.style.background = theme.gradient || `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`;
    btn.addEventListener("click", async () => {
      // Apply instantly in popup, then persist.
      FoxThemes.applyFoxTheme(theme);
      renderPopupThemes(theme.id);
      setStatus(`Тема: ${theme.label}`, "success");
      try {
        const saved = await browser.runtime.sendMessage({ type: "setUiTheme", themeId: theme.id });
        if (saved && saved.id) {
          FoxThemes.applyFoxTheme(saved);
          renderPopupThemes(saved.id);
        }
      } catch (error) {
        setStatus(`Тему показано, але не збережено: ${error.message || error}`, "error");
      }
    });
    themeRow.appendChild(btn);
  }
}

async function bootstrapPopupTheme() {
  try {
    const theme = await browser.runtime.sendMessage({ type: "getUiTheme" });
    if (theme && window.FoxThemes) {
      FoxThemes.applyFoxTheme(theme);
      await renderPopupThemes(theme.id);
      return;
    }
  } catch (_) {
    // ignore
  }
  if (window.FoxThemes) {
    FoxThemes.applyFoxTheme("slate");
    await renderPopupThemes("slate");
  }
}

if (openSidebarBtn) {
  openSidebarBtn.addEventListener("click", () => {
    let openPromise;
    try {
      openPromise = openSideTerminalFromGesture();
    } catch (error) {
      setStatus(`Помилка виконання:\n${error.message || error}`, "error");
      return;
    }
    setStatus("Відкриваю side terminal...");
    openPromise
      .then(() => setStatus("Side terminal відкрито.", "success"))
      .catch((error) => setStatus(`Помилка виконання:\n${error.message || error}`, "error"));
  });
}

updatePlaceholder();
bootstrapPopupTheme();
