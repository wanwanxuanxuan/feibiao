(function () {
  const SIZE = 4;
  const STORAGE_KEY = "neon2048";
  const STATE = {
    board: [],
    score: 0,
    best: 0,
    history: [],
    over: false,
    won: false,
    keepGoing: false,
    nextId: 1,
    overlayMode: "intro"
  };

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const newGameBtn = document.getElementById("newGame");
  const undoBtn = document.getElementById("undo");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const overlayBtn = document.getElementById("overlayBtn");

  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY + ":best") || "0", 10);
      STATE.best = isNaN(v) ? 0 : v;
    } catch (e) { STATE.best = 0; }
    bestEl.textContent = STATE.best;
  }

  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY + ":best", String(STATE.best)); } catch (e) {}
  }

  function emptyBoard() {
    return Array.from({ length: SIZE }, function () { return Array(SIZE).fill(null); });
  }

  function cloneBoard(b) {
    return b.map(function (row) { return row.map(function (t) { return t ? { id: t.id, val: t.val } : null; }); });
  }

  function snapshot() {
    return {
      board: cloneBoard(STATE.board),
      score: STATE.score,
      nextId: STATE.nextId
    };
  }

  function restore(s) {
    STATE.board = Array.from({ length: SIZE }, function (_, r) {
      return s.board[r].map(function (t) { return t ? { id: t.id, val: t.val, row: r, col: 0 } : null; });
    });
    STATE.board.forEach(function (row, r) {
      row.forEach(function (t, c) { if (t) t.col = c; });
    });
    STATE.score = s.score;
    STATE.nextId = s.nextId;
    STATE.over = false;
  }

  function spawnInitial() {
    STATE.board = emptyBoard();
    STATE.score = 0;
    STATE.history = [];
    STATE.over = false;
    STATE.won = false;
    STATE.keepGoing = false;
    STATE.nextId = 1;
    addRandom();
    addRandom();
    updateScore();
  }

  function addRandom() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!STATE.board[r][c]) cells.push([r, c]);
      }
    }
    if (!cells.length) return;
    const [r, c] = cells[Math.floor(Math.random() * cells.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    STATE.board[r][c] = { id: STATE.nextId++, val: val, row: r, col: c, isNew: true };
  }

  function buildGridBackground() {
    const grid = document.createElement("div");
    grid.className = "grid-bg";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell-bg";
      grid.appendChild(cell);
    }
    boardEl.appendChild(grid);
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    tiles.id = "tiles";
    boardEl.appendChild(tiles);
  }

  function cellSize() {
    const tiles = document.getElementById("tiles");
    if (!tiles) return 0;
    return tiles.clientWidth;
  }

  function gap() { return 12; }

  function tilePosition(row, col) {
    const total = cellSize();
    const g = gap();
    const size = (total - g * (SIZE - 1)) / SIZE;
    return { x: col * (size + g), y: row * (size + g) };
  }

  function render() {
    const tilesEl = document.getElementById("tiles");
    tilesEl.innerHTML = "";
    const total = cellSize();
    const g = gap();
    const size = (total - g * (SIZE - 1)) / SIZE;

    const frag = document.createDocumentFragment();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const t = STATE.board[r][c];
        if (!t) continue;
        const el = document.createElement("div");
        el.className = "tile";
        if (t.isNew) el.classList.add("new");
        if (t.merged) el.classList.add("merged");
        el.dataset.val = t.val;
        el.style.width = size + "px";
        el.style.height = size + "px";
        const pos = tilePosition(r, c);
        el.style.transform = "translate(" + pos.x + "px, " + pos.y + "px)";
        const span = document.createElement("span");
        span.textContent = t.val;
        const fontSize = size * 0.42;
        el.style.fontSize = fontSize + "px";
        el.appendChild(span);
        frag.appendChild(el);
      }
    }
    tilesEl.appendChild(frag);

    STATE.board.forEach(function (row) {
      row.forEach(function (t) {
        if (t) { t.isNew = false; t.merged = false; }
      });
    });
  }

  function updateScore() {
    scoreEl.textContent = STATE.score;
    if (STATE.score > STATE.best) {
      STATE.best = STATE.score;
      bestEl.textContent = STATE.best;
      saveBest();
    }
  }

  function moveLine(line) {
    const filtered = line.filter(function (t) { return t; });
    const merged = [];
    let gained = 0;
    let didMerge = false;
    for (let i = 0; i < filtered.length; i++) {
      if (i + 1 < filtered.length && filtered[i].val === filtered[i + 1].val) {
        const v = filtered[i].val * 2;
        merged.push({ id: filtered[i].id, val: v, merged: true });
        if (v === 2048) STATE.won = true;
        gained += v;
        didMerge = true;
        i++;
      } else {
        merged.push({ id: filtered[i].id, val: filtered[i].val });
      }
    }
    while (merged.length < SIZE) merged.push(null);
    return { line: merged, gained: gained, didMerge: didMerge };
  }

  function getLines(direction) {
    const lines = [];
    if (direction === "left") {
      for (let r = 0; r < SIZE; r++) lines.push(STATE.board[r].slice());
    } else if (direction === "right") {
      for (let r = 0; r < SIZE; r++) lines.push(STATE.board[r].slice().reverse());
    } else if (direction === "up") {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = 0; r < SIZE; r++) col.push(STATE.board[r][c]);
        lines.push(col);
      }
    } else if (direction === "down") {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = SIZE - 1; r >= 0; r--) col.push(STATE.board[r][c]);
        lines.push(col);
      }
    }
    return lines;
  }

  function setLines(direction, newLines) {
    if (direction === "left") {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const t = newLines[r][c];
          STATE.board[r][c] = t ? { id: t.id, val: t.val, row: r, col: c, merged: t.merged } : null;
        }
      }
    } else if (direction === "right") {
      for (let r = 0; r < SIZE; r++) {
        const reversed = newLines[r].slice().reverse();
        for (let c = 0; c < SIZE; c++) {
          const t = reversed[c];
          STATE.board[r][c] = t ? { id: t.id, val: t.val, row: r, col: c, merged: t.merged } : null;
        }
      }
    } else if (direction === "up") {
      for (let c = 0; c < SIZE; c++) {
        for (let r = 0; r < SIZE; r++) {
          const t = newLines[c][r];
          STATE.board[r][c] = t ? { id: t.id, val: t.val, row: r, col: c, merged: t.merged } : null;
        }
      }
    } else if (direction === "down") {
      for (let c = 0; c < SIZE; c++) {
        const reversed = newLines[c].slice().reverse();
        for (let r = 0; r < SIZE; r++) {
          const t = reversed[r];
          STATE.board[r][c] = t ? { id: t.id, val: t.val, row: r, col: c, merged: t.merged } : null;
        }
      }
    }
  }

  function boardsEqual(a, b) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const ta = a[r][c], tb = b[r][c];
        if (!ta && !tb) continue;
        if (!ta || !tb) return false;
        if (ta.val !== tb.val) return false;
      }
    }
    return true;
  }

  function move(direction) {
    if (STATE.over) return;
    if (!overlay.classList.contains("hidden")) return;
    const before = cloneBoard(STATE.board);
    const lines = getLines(direction);
    let totalGained = 0;
    let didAnyMerge = false;
    const newLines = lines.map(function (line) {
      const res = moveLine(line);
      totalGained += res.gained;
      if (res.didMerge) didAnyMerge = true;
      return res.line;
    });

    setLines(direction, newLines);

    if (boardsEqual(before, STATE.board)) return;

    STATE.history.push(snapshot());
    if (STATE.history.length > 10) STATE.history.shift();
    undoBtn.disabled = false;

    STATE.score += totalGained;
    addRandom();
    updateScore();
    render();

    if (STATE.won && !STATE.keepGoing) {
      STATE.keepGoing = true;
      showOverlay("win", "你赢了！", "成功合成 2048。继续挑战更高分数？", "继续游戏");
      return;
    }

    if (isGameOver()) {
      STATE.over = true;
      showOverlay("over", "游戏结束", "本局得分 " + STATE.score + "。再试一次？", "重新开始");
    }
  }

  function isGameOver() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!STATE.board[r][c]) return false;
        const v = STATE.board[r][c].val;
        if (c + 1 < SIZE && STATE.board[r][c + 1] && STATE.board[r][c + 1].val === v) return false;
        if (r + 1 < SIZE && STATE.board[r + 1][c] && STATE.board[r + 1][c].val === v) return false;
      }
    }
    return true;
  }

  function showOverlay(mode, title, text, btn) {
    STATE.overlayMode = mode;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btn;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() { overlay.classList.add("hidden"); }

  function startNewGame() {
    spawnInitial();
    render();
    hideOverlay();
    undoBtn.disabled = true;
    STATE.overlayMode = "playing";
  }

  function undo() {
    if (!STATE.history.length) return;
    const s = STATE.history.pop();
    restore(s);
    updateScore();
    render();
    hideOverlay();
    undoBtn.disabled = STATE.history.length === 0;
  }

  const KEY_MAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right"
  };

  document.addEventListener("keydown", function (e) {
    if (overlay && !overlay.classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        overlayBtn.click();
        return;
      }
    }
    const dir = KEY_MAP[e.key];
    if (dir) {
      e.preventDefault();
      move(dir);
    }
  });

  let touchStart = null;
  boardEl.addEventListener("touchstart", function (e) {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  boardEl.addEventListener("touchend", function (e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 24;
    if (Math.max(absX, absY) < threshold) { touchStart = null; return; }
    if (absX > absY) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
    touchStart = null;
  }, { passive: true });

  let mouseStart = null;
  boardEl.addEventListener("mousedown", function (e) {
    mouseStart = { x: e.clientX, y: e.clientY };
  });
  boardEl.addEventListener("mouseup", function (e) {
    if (!mouseStart) return;
    const dx = e.clientX - mouseStart.x;
    const dy = e.clientY - mouseStart.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) { mouseStart = null; return; }
    if (absX > absY) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
    mouseStart = null;
  });

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 80);
  });

  newGameBtn.addEventListener("click", startNewGame);
  undoBtn.addEventListener("click", undo);
  overlayBtn.addEventListener("click", function () {
    if (STATE.overlayMode === "intro") {
      hideOverlay();
      STATE.overlayMode = "playing";
      boardEl.focus();
    } else if (STATE.overlayMode === "win") {
      hideOverlay();
      STATE.overlayMode = "playing";
      boardEl.focus();
    } else if (STATE.overlayMode === "over") {
      startNewGame();
      boardEl.focus();
    }
  });

  loadBest();
  buildGridBackground();
  STATE.board = emptyBoard();
  addRandom();
  addRandom();
  updateScore();
  render();
  showOverlay("intro", "准备好了吗？", "合并相同数字方块，挑战 2048。", "开始游戏");
})();
