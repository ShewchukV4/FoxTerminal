const spells = [
  {
    id: "cold_snap",
    name: "Cold Snap",
    combo: ["Q", "Q", "Q"],
    hint: "Quas Quas Quas",
    icon: "./assets/img/skills/invoker_cold_snap.png"
  },
  {
    id: "ghost_walk",
    name: "Ghost Walk",
    combo: ["Q", "Q", "W"],
    hint: "Quas Quas Wex",
    icon: "./assets/img/skills/invoker_ghost_walk.png"
  },
  {
    id: "ice_wall",
    name: "Ice Wall",
    combo: ["Q", "Q", "E"],
    hint: "Quas Quas Exort",
    icon: "./assets/img/skills/invoker_ice_wall.png"
  },
  {
    id: "emp",
    name: "E.M.P.",
    combo: ["W", "W", "W"],
    hint: "Wex Wex Wex",
    icon: "./assets/img/skills/invoker_emp.png"
  },
  {
    id: "tornado",
    name: "Tornado",
    combo: ["W", "W", "Q"],
    hint: "Wex Wex Quas",
    icon: "./assets/img/skills/invoker_tornado.png"
  },
  {
    id: "alacrity",
    name: "Alacrity",
    combo: ["W", "W", "E"],
    hint: "Wex Wex Exort",
    icon: "./assets/img/skills/invoker_alacrity.png"
  },
  {
    id: "sun_strike",
    name: "Sun Strike",
    combo: ["E", "E", "E"],
    hint: "Exort Exort Exort",
    icon: "./assets/img/skills/invoker_sun_strike.png"
  },
  {
    id: "forge_spirit",
    name: "Forge Spirit",
    combo: ["E", "E", "Q"],
    hint: "Exort Exort Quas",
    icon: "./assets/img/skills/invoker_forge_spirit.png"
  },
  {
    id: "chaos_meteor",
    name: "Chaos Meteor",
    combo: ["E", "E", "W"],
    hint: "Exort Exort Wex",
    icon: "./assets/img/skills/invoker_chaos_meteor.png"
  },
  {
    id: "deafening_blast",
    name: "Deafening Blast",
    combo: ["Q", "W", "E"],
    hint: "Quas Wex Exort",
    icon: "./assets/img/skills/invoker_deafening_blast.png"
  }
];

const storedSpeedrunBestMs = Number(localStorage.getItem("invoker-forge-speedrun10-best-ms") || 0);
const legacySpeedrunBestSeconds = Number(localStorage.getItem("invoker-forge-speedrun10-best") || 0);
const defaultBindings = {
  quas: "Q",
  wex: "W",
  exort: "E",
  invoke: "R",
  skip: "SPACE"
};

const actionNames = {
  quas: "Quas",
  wex: "Wex",
  exort: "Exort",
  invoke: "Invoke",
  skip: "Skip"
};

const orbActions = {
  quas: "Q",
  wex: "W",
  exort: "E"
};

const state = {
  mode: "practice",
  target: spells[0],
  input: [],
  score: 0,
  streak: 0,
  bestScore: Number(localStorage.getItem("invoker-forge-best") || 0),
  bestSpeedrunMs: storedSpeedrunBestMs || legacySpeedrunBestSeconds * 1000,
  seconds: 0,
  elapsedMs: 0,
  timerStartedAt: 0,
  sprintLeft: 60,
  intervalId: null,
  timerRunning: false,
  lastTargetId: null,
  speedrunQueue: [],
  speedrunIndex: 0,
  finished: false,
  bindings: loadBindings(),
  rebindingAction: null
};

const targetIcon = document.querySelector("#targetIcon");
const targetName = document.querySelector("#targetName");
const targetHint = document.querySelector("#targetHint");
const feedback = document.querySelector("#feedback");
const score = document.querySelector("#score");
const streak = document.querySelector("#streak");
const bestScore = document.querySelector("#bestScore");
const bestSpeedrun = document.querySelector("#bestSpeedrun");
const timer = document.querySelector("#timer");
const spellList = document.querySelector("#spellList");
const slots = [...document.querySelectorAll(".slot")];
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const bindButtons = [...document.querySelectorAll("[data-bind-action]")];
const bindNote = document.querySelector("#bindNote");

function loadBindings() {
  try {
    return {
      ...defaultBindings,
      ...JSON.parse(localStorage.getItem("invoker-forge-bindings") || "{}")
    };
  } catch {
    return { ...defaultBindings };
  }
}

function normalizeCombo(combo) {
  return [...combo].sort().join("");
}

function shuffleSpells() {
  const queue = [...spells];

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]];
  }

  return queue;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatPreciseTime(totalMs) {
  const safeMs = Math.max(0, Math.floor(totalMs));
  const minutes = Math.floor(safeMs / 60000).toString().padStart(2, "0");
  const seconds = Math.floor((safeMs % 60000) / 1000).toString().padStart(2, "0");
  const milliseconds = (safeMs % 1000).toString().padStart(3, "0");
  return `${minutes}:${seconds}.${milliseconds}`;
}

function formatBestSpeedrun() {
  return state.bestSpeedrunMs > 0 ? formatPreciseTime(state.bestSpeedrunMs) : "--:--.---";
}

function setFeedback(message, type = "") {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`.trim();
}

function normalizePressedKey(event) {
  if (event.code === "Space") {
    return "SPACE";
  }

  if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key)) {
    return "";
  }

  return event.key.length === 1 ? event.key.toUpperCase() : event.key.toUpperCase();
}

function displayKey(key) {
  if (key === "SPACE") {
    return "Space";
  }

  return key
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function saveBindings() {
  localStorage.setItem("invoker-forge-bindings", JSON.stringify(state.bindings));
}

function renderBindings() {
  document.querySelectorAll("[data-key-label]").forEach((element) => {
    const action = element.dataset.keyLabel;
    element.textContent = displayKey(state.bindings[action]);
  });

  bindButtons.forEach((button) => {
    button.classList.toggle("listening", button.dataset.bindAction === state.rebindingAction);
  });

  if (!bindNote) {
    return;
  }

  bindNote.textContent = state.rebindingAction
    ? `Натисни нову клавішу для ${actionNames[state.rebindingAction]}. Esc скасовує.`
    : "Клікни на дію, потім натисни нову клавішу. Esc скасовує.";
}

function setBinding(action, newKey) {
  const previousKey = state.bindings[action];
  const conflictAction = Object.keys(state.bindings).find((key) => (
    key !== action && state.bindings[key] === newKey
  ));

  state.bindings[action] = newKey;

  if (conflictAction) {
    state.bindings[conflictAction] = previousKey;
  }

  saveBindings();
  renderBindings();
}

function drawSlots() {
  slots.forEach((slot, index) => {
    const orb = state.input[index];
    slot.textContent = orb || "-";
    slot.className = `slot ${orb ? `filled ${orb.toLowerCase()}` : ""}`.trim();
  });
}

function drawStats() {
  score.textContent = state.score;
  streak.textContent = state.streak;
  bestScore.textContent = state.bestScore;
  bestSpeedrun.textContent = formatBestSpeedrun();
  if (state.mode === "sprint") {
    timer.textContent = formatTime(state.sprintLeft);
  } else if (state.mode === "speedrun10") {
    timer.textContent = formatPreciseTime(state.elapsedMs);
  } else {
    timer.textContent = formatTime(state.seconds);
  }
}

function drawTarget() {
  targetIcon.src = state.target.icon;
  targetIcon.alt = state.target.name;
  targetName.textContent = state.target.name;
  if (state.mode === "quiz") {
    targetHint.textContent = "Комбо приховано";
  } else if (state.mode === "speedrun10" && state.finished) {
    targetHint.textContent = "10/10 · готово";
  } else if (state.mode === "speedrun10") {
    targetHint.textContent = `${state.speedrunIndex + 1}/10 · ${state.target.hint}`;
  } else {
    targetHint.textContent = state.target.hint;
  }

  document.querySelectorAll(".spell-item").forEach((item) => {
    item.classList.toggle("current", item.dataset.spell === state.target.id);
  });
}

function drawSpellList() {
  spellList.innerHTML = spells.map((spell) => {
    const keys = spell.combo.map((key) => `<span>${key}</span>`).join("");

    return `
      <button class="spell-item" data-spell="${spell.id}" type="button">
        <img src="${spell.icon}" alt="${spell.name}">
        <span>
          <strong>${spell.name}</strong>
          <span class="combo">${spell.hint}</span>
        </span>
        <span class="keys">${keys}</span>
      </button>
    `;
  }).join("");

  spellList.querySelectorAll(".spell-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (state.mode === "speedrun10") {
        setFeedback("У Speedrun 10 цілі йдуть тільки з рандомної черги без повторів.", "bad");
        return;
      }

      state.target = spells.find((spell) => spell.id === item.dataset.spell);
      state.input = [];
      setFeedback(`Ціль змінено на ${state.target.name}.`);
      draw();
    });
  });
}

function pickTarget() {
  let next = spells[Math.floor(Math.random() * spells.length)];

  if (spells.length > 1) {
    while (next.id === state.lastTargetId) {
      next = spells[Math.floor(Math.random() * spells.length)];
    }
  }

  state.target = next;
  state.lastTargetId = next.id;
}

function prepareSpeedrun() {
  state.speedrunQueue = shuffleSpells();
  state.speedrunIndex = 0;

  if (!speedrunHasUniqueSpells()) {
    throw new Error("Speedrun 10 queue must contain each Invoker spell exactly once.");
  }

  state.target = state.speedrunQueue[state.speedrunIndex];
  state.lastTargetId = state.target.id;
}

function speedrunHasUniqueSpells() {
  return state.speedrunQueue.length === spells.length
    && new Set(state.speedrunQueue.map((spell) => spell.id)).size === spells.length;
}

function advanceTarget() {
  if (state.mode !== "speedrun10") {
    pickTarget();
    return;
  }

  state.speedrunIndex += 1;

  if (state.speedrunIndex >= state.speedrunQueue.length) {
    finishSpeedrun();
    return;
  }

  state.target = state.speedrunQueue[state.speedrunIndex];
  state.lastTargetId = state.target.id;
}

function saveBestScore() {
  if (state.score <= state.bestScore) {
    return;
  }

  state.bestScore = state.score;
  localStorage.setItem("invoker-forge-best", String(state.bestScore));
}

function saveBestSpeedrun() {
  if (state.elapsedMs <= 0) {
    return;
  }

  if (state.bestSpeedrunMs > 0 && state.elapsedMs >= state.bestSpeedrunMs) {
    return;
  }

  state.bestSpeedrunMs = Math.floor(state.elapsedMs);
  localStorage.setItem("invoker-forge-speedrun10-best-ms", String(state.bestSpeedrunMs));
}

function startTimer() {
  if (state.timerRunning || state.finished) {
    return;
  }

  state.timerRunning = true;
  state.timerStartedAt = performance.now() - state.elapsedMs;

  const intervalDelay = state.mode === "speedrun10" ? 16 : 1000;

  state.intervalId = window.setInterval(() => {
    if (state.mode === "sprint") {
      state.sprintLeft = Math.max(0, state.sprintLeft - 1);

      if (state.sprintLeft === 0) {
        stopTimer();
        saveBestScore();
        setFeedback(`Час вийшов. Результат: ${state.score}.`, "good");
      }
    } else if (state.mode === "speedrun10") {
      state.elapsedMs = performance.now() - state.timerStartedAt;
    } else {
      state.seconds += 1;
    }

    drawStats();
  }, intervalDelay);
}

function stopTimer() {
  if (state.mode === "speedrun10" && state.timerRunning) {
    state.elapsedMs = performance.now() - state.timerStartedAt;
  }

  window.clearInterval(state.intervalId);
  state.intervalId = null;
  state.timerRunning = false;
}

function finishSpeedrun() {
  state.finished = true;
  stopTimer();
  saveBestScore();
  saveBestSpeedrun();
  setFeedback(`Speedrun готово: 10/10 за ${formatPreciseTime(state.elapsedMs)}. Best: ${formatBestSpeedrun()}.`, "good");
}

function addOrb(orb) {
  if (!["Q", "W", "E"].includes(orb)) {
    return;
  }

  if (state.mode === "sprint" && state.sprintLeft <= 0) {
    setFeedback("Sprint завершено. Натисни Скинути, щоб почати знову.", "bad");
    return;
  }

  if (state.finished) {
    setFeedback("Забіг завершено. Натисни Скинути, щоб почати знову.", "good");
    return;
  }

  startTimer();

  state.input.push(orb);

  if (state.input.length > 3) {
    state.input.shift();
  }

  setFeedback(`${orb} додано. Тепер Invoke.`);
  drawSlots();
}

function invoke() {
  if (state.mode === "sprint" && state.sprintLeft <= 0) {
    setFeedback("Sprint завершено. Натисни Скинути, щоб почати знову.", "bad");
    return;
  }

  if (state.finished) {
    setFeedback("Забіг завершено. Натисни Скинути, щоб почати знову.", "good");
    return;
  }

  if (state.input.length < 3) {
    setFeedback("Потрібно три орби перед Invoke.", "bad");
    return;
  }

  const current = normalizeCombo(state.input);
  const expected = normalizeCombo(state.target.combo);

  if (current === expected) {
    const bonus = state.mode === "quiz" ? 15 : state.mode === "sprint" ? 12 : state.mode === "speedrun10" ? 20 : 10;
    state.streak += 1;
    state.score += bonus + Math.min(state.streak, 10);
    saveBestScore();
    setFeedback(`Правильно: ${state.target.name}. Серія x${state.streak}.`, "good");
    state.input = [];
    advanceTarget();
  } else {
    state.streak = 0;
    state.score = Math.max(0, state.score - 5);
    setFeedback(`Не те комбо. Треба: ${state.target.hint}.`, "bad");
    state.input = [];
  }

  draw();
}

function skipTarget() {
  if (state.mode === "speedrun10") {
    setFeedback("У Speedrun 10 не можна пропускати: треба кастанути всі 10.", "bad");
    return;
  }

  state.streak = 0;
  state.input = [];
  pickTarget();
  setFeedback("Ціль пропущено.");
  draw();
}

function resetGame(mode = state.mode) {
  stopTimer();
  state.mode = mode;
  state.input = [];
  state.score = 0;
  state.streak = 0;
  state.seconds = 0;
  state.elapsedMs = 0;
  state.timerStartedAt = 0;
  state.sprintLeft = 60;
  state.lastTargetId = null;
  state.speedrunQueue = [];
  state.speedrunIndex = 0;
  state.finished = false;

  if (mode === "speedrun10") {
    prepareSpeedrun();
  } else {
    pickTarget();
  }

  if (mode === "sprint") {
    setFeedback("Sprint готовий: таймер стартує з першого Q/W/E.");
  } else if (mode === "speedrun10") {
    setFeedback("Speedrun 10 готовий: 10 скілів у рандомному порядку, старт з першого Q/W/E.");
  } else {
    setFeedback("Гру скинуто. Таймер стартує з першого Q/W/E.");
  }
  draw();
}

function setMode(mode) {
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  resetGame(mode);
}

function draw() {
  drawSlots();
  drawStats();
  drawTarget();
}

document.querySelectorAll("[data-orb]").forEach((button) => {
  button.addEventListener("click", () => addOrb(button.dataset.orb));
});

document.querySelector("#invokeBtn").addEventListener("click", invoke);
document.querySelector("#skipBtn").addEventListener("click", skipTarget);
document.querySelector("#resetBtn").addEventListener("click", () => resetGame());

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

bindButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.rebindingAction = button.dataset.bindAction;
    setFeedback(`Натисни нову клавішу для ${actionNames[state.rebindingAction]}.`);
    renderBindings();
  });
});

window.addEventListener("keydown", (event) => {
  const key = normalizePressedKey(event);

  if (!key) {
    return;
  }

  if (state.rebindingAction) {
    event.preventDefault();

    if (key === "ESCAPE") {
      setFeedback("Перебінд скасовано.");
    } else {
      setBinding(state.rebindingAction, key);
      setFeedback(`${actionNames[state.rebindingAction]} тепер на ${displayKey(key)}.`, "good");
    }

    state.rebindingAction = null;
    renderBindings();
    return;
  }

  const action = Object.keys(state.bindings).find((bindingAction) => state.bindings[bindingAction] === key);

  if (orbActions[action]) {
    event.preventDefault();
    addOrb(orbActions[action]);
    return;
  }

  if (action === "invoke") {
    event.preventDefault();
    invoke();
    return;
  }

  if (action === "skip") {
    event.preventDefault();
    skipTarget();
  }
});

drawSpellList();
renderBindings();
resetGame("practice");
