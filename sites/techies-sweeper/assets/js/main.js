const levels = {
  lane: {
    label: "Lane",
    rows: 9,
    cols: 9,
    mines: 10,
    cellSize: 42
  },
  jungle: {
    label: "Jungle",
    rows: 12,
    cols: 12,
    mines: 24,
    cellSize: 36
  },
  ancient: {
    label: "Ancient",
    rows: 16,
    cols: 16,
    mines: 45,
    cellSize: 30
  }
};

const modes = {
  classic: {
    label: "Classic",
    description: "Techies десь поруч. Перший клік безпечний."
  },
  turbo: {
    label: "Turbo",
    description: "Turbo: розмінуй до кінця таймера, інакше Techies підриває карту.",
    timeLimits: {
      lane: 90,
      jungle: 180,
      ancient: 300
    }
  },
  noSentry: {
    label: "No Sentry",
    description: "No Sentry: прапорці вимкнені, грай тільки по пам'яті і цифрах."
  }
};

const boardElement = document.querySelector("#board");
const difficultyLabel = document.querySelector("#difficultyLabel");
const modeLabel = document.querySelector("#modeLabel");
const mineCounter = document.querySelector("#mineCounter");
const timer = document.querySelector("#timer");
const bestTime = document.querySelector("#bestTime");
const statusLine = document.querySelector("#statusLine");
const newGameBtn = document.querySelector("#newGameBtn");
const difficultyButtons = [...document.querySelectorAll(".difficulty")];
const modeButtons = [...document.querySelectorAll(".mode")];

const state = {
  levelKey: "lane",
  modeKey: "classic",
  board: [],
  started: false,
  finished: false,
  flags: 0,
  revealed: 0,
  seconds: 0,
  timeLeft: 0,
  timerId: null
};

function currentLevel() {
  return levels[state.levelKey];
}

function currentMode() {
  return modes[state.modeKey];
}

function bestKey() {
  return `techies-sweeper-best-${state.levelKey}-${state.modeKey}`;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setStatus(message, type = "") {
  statusLine.textContent = message;
  statusLine.dataset.type = type;
}

function updateHud() {
  const level = currentLevel();
  const best = Number(localStorage.getItem(bestKey()) || 0);

  difficultyLabel.textContent = level.label;
  modeLabel.textContent = currentMode().label;
  mineCounter.textContent = level.mines - state.flags;
  timer.textContent = state.modeKey === "turbo" ? formatTime(state.timeLeft) : formatTime(state.seconds);
  bestTime.textContent = best > 0 ? formatTime(best) : "--:--";
}

function startTimer() {
  if (state.started) {
    return;
  }

  state.started = true;
  state.timerId = window.setInterval(() => {
    if (state.modeKey === "turbo") {
      state.timeLeft = Math.max(0, state.timeLeft - 1);

      if (state.timeLeft === 0) {
        loseGame(null, "Час вийшов. Techies натиснув червону кнопку.");
      }
    } else {
      state.seconds += 1;
    }

    updateHud();
  }, 1000);
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
}

function createEmptyBoard() {
  const { rows, cols } = currentLevel();
  state.board = Array.from({ length: rows }, (_, row) => (
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      mine: false,
      revealed: false,
      flagged: false,
      count: 0,
      terrain: Math.floor(Math.random() * 6)
    }))
  ));
}

function neighbors(row, col) {
  const { rows, cols } = currentLevel();
  const cells = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
        cells.push(state.board[nextRow][nextCol]);
      }
    }
  }

  return cells;
}

function safeZone(row, col) {
  return new Set([
    `${row},${col}`,
    ...neighbors(row, col).map((cell) => `${cell.row},${cell.col}`)
  ]);
}

function placeMines(firstRow, firstCol) {
  const { rows, cols, mines } = currentLevel();
  const protectedCells = safeZone(firstRow, firstCol);
  let placed = 0;

  while (placed < mines) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);
    const cell = state.board[row][col];

    if (cell.mine || protectedCells.has(`${row},${col}`)) {
      continue;
    }

    cell.mine = true;
    placed += 1;
  }

  state.board.flat().forEach((cell) => {
    cell.count = neighbors(cell.row, cell.col).filter((next) => next.mine).length;
  });
}

function renderBoard() {
  const { rows, cols, cellSize } = currentLevel();

  boardElement.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  boardElement.style.setProperty("--cell-size", `${cellSize}px`);
  boardElement.style.setProperty("--cell-mobile-size", `${Math.max(24, cellSize - 5)}px`);
  boardElement.innerHTML = "";

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = state.board[row][col];
      const button = document.createElement("button");

      button.className = "cell";
      button.type = "button";
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute("aria-label", `cell ${row + 1}, ${col + 1}`);
      button.addEventListener("click", () => revealCell(row, col));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(row, col);
      });

      boardElement.append(button);
      paintCell(button, cell);
    }
  }
}

function cellElement(cell) {
  return boardElement.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
}

function paintCell(element, cell) {
  element.className = `cell terrain-${cell.terrain}`;
  element.textContent = "";

  if (cell.flagged && !cell.revealed) {
    element.classList.add("flagged");
    return;
  }

  if (!cell.revealed) {
    return;
  }

  element.classList.add("revealed");

  if (cell.mine) {
    element.classList.add("mine");
    return;
  }

  if (cell.count > 0) {
    element.classList.add(`n${cell.count}`);
    element.textContent = cell.count;
  }
}

function paintAll() {
  state.board.flat().forEach((cell) => {
    const element = cellElement(cell);

    if (element) {
      paintCell(element, cell);
    }
  });
}

function floodReveal(startCell) {
  const queue = [startCell];

  while (queue.length > 0) {
    const cell = queue.shift();

    if (cell.revealed || cell.flagged) {
      continue;
    }

    cell.revealed = true;
    state.revealed += 1;

    if (cell.count === 0) {
      neighbors(cell.row, cell.col).forEach((next) => {
        if (!next.revealed && !next.flagged && !next.mine) {
          queue.push(next);
        }
      });
    }
  }
}

function highlightNeighbors(cell) {
  if (!cell.revealed || cell.count === 0) {
    return;
  }

  const hiddenNeighbors = neighbors(cell.row, cell.col).filter((next) => (
    !next.revealed && !next.flagged
  ));

  hiddenNeighbors.forEach((next) => {
    const element = cellElement(next);

    if (!element) {
      return;
    }

    element.classList.remove("hinted");
    void element.offsetWidth;
    element.classList.add("hinted");

    window.setTimeout(() => {
      element.classList.remove("hinted");
    }, 430);
  });

  setStatus(`Цифра ${cell.count} зачіпає ${hiddenNeighbors.length} закритих клітинок навколо.`);
}

function revealAroundNumber(cell) {
  if (!cell.revealed || cell.count === 0) {
    return;
  }

  const nearby = neighbors(cell.row, cell.col);
  const flaggedCount = nearby.filter((next) => next.flagged).length;
  const hiddenNeighbors = nearby.filter((next) => !next.revealed && !next.flagged);

  if (flaggedCount !== cell.count) {
    highlightNeighbors(cell);
    setStatus(`Для ${cell.count} треба ${cell.count} Minefield Sign навколо. Зараз стоїть ${flaggedCount}.`);
    return;
  }

  for (const next of hiddenNeighbors) {
    if (next.mine) {
      loseGame(next, "Неправильний Minefield Sign. Techies підловив тебе.");
      return;
    }

    floodReveal(next);
  }

  paintAll();
  setStatus(`Цифра ${cell.count} підтверджена: сусідні клітинки відкриті.`);
  checkWin();
}

function revealCell(row, col) {
  if (state.finished) {
    return;
  }

  const cell = state.board[row][col];

  if (cell.revealed) {
    revealAroundNumber(cell);
    return;
  }

  if (cell.flagged) {
    return;
  }

  if (!state.started) {
    placeMines(row, col);
    startTimer();
    if (state.modeKey === "turbo") {
      setStatus("Turbo стартував. Розмінуй до нуля на таймері.");
    } else if (state.modeKey === "noSentry") {
      setStatus("No Sentry стартував. Без прапорців, тільки читання поля.");
    } else {
      setStatus("Міни Techies активовані. Читай числа і не підривайся.");
    }
  }

  if (cell.mine) {
    loseGame(cell);
    return;
  }

  floodReveal(cell);
  paintAll();
  checkWin();
}

function toggleFlag(row, col) {
  if (state.finished) {
    return;
  }

  if (state.modeKey === "noSentry") {
    setStatus("No Sentry режим: Minefield Sign вимкнений.");
    return;
  }

  const cell = state.board[row][col];

  if (cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  state.flags += cell.flagged ? 1 : -1;
  paintCell(cellElement(cell), cell);
  updateHud();
}

function revealMines(explodedCell) {
  state.board.flat().forEach((cell) => {
    if (cell.mine) {
      cell.revealed = true;
      const element = cellElement(cell);
      paintCell(element, cell);

      if (cell === explodedCell) {
        element.classList.add("exploded");
      }
    }
  });
}

function loseGame(cell, message = "BOOM! Techies забрав тебе у таверну.") {
  state.finished = true;
  stopTimer();
  revealMines(cell);
  setStatus(message, "lost");
  updateHud();
}

function checkWin() {
  const { rows, cols, mines } = currentLevel();
  const safeCells = rows * cols - mines;

  if (state.revealed < safeCells) {
    return;
  }

  state.finished = true;
  stopTimer();

  const previousBest = Number(localStorage.getItem(bestKey()) || 0);
  const resultTime = state.modeKey === "turbo"
    ? currentMode().timeLimits[state.levelKey] - state.timeLeft
    : state.seconds;

  if (previousBest === 0 || resultTime < previousBest) {
    localStorage.setItem(bestKey(), String(resultTime));
  }

  state.board.flat().forEach((cell) => {
    if (cell.mine && !cell.flagged) {
      cell.flagged = true;
      state.flags += 1;
    }
  });

  paintAll();
  setStatus("Перемога! Minefield розміновано, Techies плаче.", "won");
  updateHud();
}

function resetGame(levelKey = state.levelKey, modeKey = state.modeKey) {
  stopTimer();
  state.levelKey = levelKey;
  state.modeKey = modeKey;
  state.started = false;
  state.finished = false;
  state.flags = 0;
  state.revealed = 0;
  state.seconds = 0;
  state.timeLeft = state.modeKey === "turbo" ? currentMode().timeLimits[state.levelKey] : 0;

  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.level === state.levelKey);
  });

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.modeKey);
  });

  createEmptyBoard();
  renderBoard();
  setStatus(currentMode().description);
  updateHud();
}

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => resetGame(button.dataset.level, state.modeKey));
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => resetGame(state.levelKey, button.dataset.mode));
});

newGameBtn.addEventListener("click", () => resetGame());

resetGame();
