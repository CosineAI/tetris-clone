(() => {
  const $ = (id) => document.getElementById(id);

  // Canvas and UI
  const boardEl = $("board");
  const nextEl = $("next");
  const holdEl = $("hold");
  const scoreEl = $("score");
  const linesEl = $("lines");
  const levelEl = $("level");
  const highScoreEl = $("highScore");
  const startBtn = $("startBtn");
  const pauseBtn = $("pauseBtn");
  const themeSelect = $("themeSelect");
  const overlay = $("overlay");
  const overlayBtn = $("overlayBtn");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");

  const ctx = boardEl.getContext("2d");
  const nextCtx = nextEl.getContext("2d");
  const holdCtx = holdEl.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  nextCtx.imageSmoothingEnabled = false;
  holdCtx.imageSmoothingEnabled = false;

  // Panels
  const sidebarEl = document.querySelector(".sidebar");
  const statsPanelEl = document.querySelector(".panel.stats");
  const buttonsPanelEl = document.querySelector(".panel.buttons");
  const nextPanelEl = nextEl.parentElement;
  const holdPanelEl = holdEl.parentElement;

  // Game constants
  const COLS = 10;
  const ROWS = 20;
  let BLOCK = 30; // dynamically resized
  let nextCell = 22; // dynamically resized
  let holdCell = 24; // dynamically resized
  let nextItemsToShow = 5; // dynamically adjusted to fit

  // Shapes
  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  };

  // Palettes
  const PALETTE_DARK = {
    I: "#00e5ff",
    O: "#ffd000",
    T: "#b400ff",
    S: "#00d66b",
    Z: "#ff4d4d",
    J: "#3b82f6",
    L: "#ff9800"
  };
  const PALETTE_LIGHT = {
    I: "#00bcd4",
    O: "#e4b700",
    T: "#8a2be2",
    S: "#1faa59",
    Z: "#ef5350",
    J: "#3949ab",
    L: "#f57c00"
  };

  // State
  let board = createMatrix(COLS, ROWS);
  let queue = [];
  let holdType = null;
  let canHold = true;
  let piece = null;

  let score = 0;
  let lines = 0;
  let level = 0;
  let highScore = 0;

  let running = false;
  let paused = false;

  let lastTime = 0;
  let dropCounter = 0;
  let softDropping = false;
  let baseDrop = 1000;
  let animTime = 0; // used for crazy color hue shift

  let theme = "dark";

  // Utilities
  function createMatrix(w, h) {
    const m = [];
    for (let i = 0; i < h; i++) m.push(new Array(w).fill(0));
    return m;
  }

  function cloneMatrix(m) {
    return m.map(r => r.slice());
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function brightColor() {
    const h = (Math.random() * 360) | 0;
    return `hsl(${h} 85% 50%)`;
  }

  let CRAZY_PALETTE = null;
  function refreshCrazyPalette() {
    CRAZY_PALETTE = { I: brightColor(), J: brightColor(), L: brightColor(), O: brightColor(), S: brightColor(), T: brightColor(), Z: brightColor() };
  }

  function getPalette() {
    return theme === "dark" ? PALETTE_DARK : PALETTE_LIGHT;
  }

  function getPieceColor(t) {
    if (document.body.classList.contains("theme-crazy")) {
      if (!CRAZY_PALETTE) refreshCrazyPalette();
      return CRAZY_PALETTE[t];
    }
    return getPalette()[t];
  }

  // Color to use for a newly spawned active piece
  function getNewPieceColor(t) {
    if (document.body.classList.contains("theme-crazy")) return brightColor();
    return getPalette()[t];
  }

  // Dynamic crazy color that hue-shifts over time, similar to background animation
  const TYPE_HUE_OFFSETS = { I: 0, J: 52, L: 104, O: 156, S: 208, T: 260, Z: 312 };
  const CRAZY_HUE_SPEED = 0.03; // deg per ms => 360deg in ~12s

  function crazyColorFor(type) {
    const base = TYPE_HUE_OFFSETS[type] || 0;
    const hue = (animTime * CRAZY_HUE_SPEED + base) % 360;
    return `hsl(${hue} 85% 55%)`;
  }

  // Queue / Bag
  function refillQueueIfNeeded() {
    if (queue.length < 7) {
      queue.push(...shuffle(["I","J","L","O","S","T","Z"]));
    }
  }

  function nextType() {
    refillQueueIfNeeded();
    return queue.shift();
  }

  // Pieces
  function spawnPiece() {
    const type = nextType();
    const matrix = cloneMatrix(SHAPES[type]);
    const color = getNewPieceColor(type);

    const p = {
      type,
      matrix,
      x: ((COLS / 2) | 0) - ((matrix[0].length / 2) | 0),
      y: -getTopPadding(matrix),
      color
    };
    if (collide(board, p)) {
      gameOver();
      return;
    }
    piece = p;
    canHold = true;
    drawHold();
    drawNext();
  }

  function getTopPadding(m) {
    for (let y = 0; y < m.length; y++) {
      if (m[y].some(v => v)) return y;
    }
    return 0;
  }

  function rotateMatrix(m, dir) {
    const N = m.length;
    const res = Array.from({ length: N }, () => new Array(m[0].length).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (dir > 0) {
          res[x][N - 1 - y] = m[y][x];
        } else {
          res[m[y].length - 1 - x][y] = m[y][x];
        }
      }
    }
    return res;
  }

  function tryRotate(dir) {
    const rotated = rotateMatrix(piece.matrix, dir);
    const kicks = [0, 1, -1, 2, -2];
    for (const off of kicks) {
      const test = { ...piece, x: piece.x + off, matrix: rotated };
      if (!collide(board, test)) {
        piece.matrix = rotated;
        piece.x = test.x;
        return;
      }
    }
  }

  // Board ops
  function collide(grid, p) {
    const m = p.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const nx = p.x + x;
        const ny = p.y + y;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge(grid, p) {
    const m = p.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const ny = p.y + y;
          const nx = p.x + x;
          if (ny >= 0) {
            grid[ny][nx] = document.body.classList.contains("theme-crazy")
              ? { type: p.type, color: p.color }
              : p.type;
          }
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue outer;
      }
      board.splice(y, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      y++;
    }
    if (cleared > 0) {
      const pts = [0, 40, 100, 300, 1200][cleared] * (level + 1);
      addScore(pts);
      lines += cleared;
      const newLevel = Math.floor(lines / 10);
      if (newLevel > level) {
        level = newLevel;
        updateSpeed();
      }
      updateHUD();
    }
  }

  function updateSpeed() {
    baseDrop = Math.max(80, 1000 - level * 80);
  }

  // Movement
  function move(dx, dy) {
    const test = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (!collide(board, test)) {
      piece.x = test.x;
      piece.y = test.y;
      return true;
    }
    return false;
  }

  function softDropStep() {
    if (move(0,1)) {
      addScore(1); // reward soft drop
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    let dropped = 0;
    while (move(0,1)) dropped++;
    addScore(dropped * 2);
    lockPiece();
  }

  function lockPiece() {
    merge(board, piece);
    clearLines();
    spawnPiece();
  }

  // Hold
  function hold() {
    if (!canHold || !piece) return;
    const currentType = piece.type;
    if (holdType === null) {
      holdType = currentType;
      spawnPiece();
    } else {
      const swap = holdType;
      holdType = currentType;
      const matrix = cloneMatrix(SHAPES[swap]);
      piece = {
        type: swap,
        matrix,
        x: ((COLS / 2) | 0) - ((matrix[0].length / 2) | 0),
        y: -getTopPadding(matrix),
        color: getNewPieceColor(swap)
      };
      if (collide(board, piece)) {
        gameOver();
        return;
      }
    }
    canHold = false;
    drawHold();
  }

  // Rendering
  function clearCanvas(c, w, h) {
    c.clearRect(0, 0, w, h);
  }

  function drawCell(c, x, y, color, size = BLOCK, alpha = 1) {
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x, y, size, size);
    c.globalAlpha = 1;
    c.strokeStyle = "rgba(0,0,0,0.18)";
    c.lineWidth = Math.max(1, size * 0.06);
    c.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawBoard() {
    clearCanvas(ctx, boardEl.width, boardEl.height);
    // grid
    ctx.save();
    ctx.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK + 0.5, 0);
      ctx.lineTo(x * BLOCK + 0.5, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK + 0.5);
      ctx.lineTo(COLS * BLOCK, y * BLOCK + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = board[y][x];
        if (!cell) continue;
        let color;
        const tcell = typeof cell === "object" ? cell.type : cell;
        if (document.body.classList.contains("theme-crazy")) {
          color = crazyColorFor(tcell);
        } else {
          color = getPalette()[tcell];
        }
        drawCell(ctx, x * BLOCK, y * BLOCK, color);
      }
    }
    if (piece) drawGhost();
    if (piece) drawPiece();
  }

  function drawPiece() {
    const m = piece.matrix;
    const color = document.body.classList.contains("theme-crazy")
      ? crazyColorFor(piece.type)
      : piece.color;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const px = (piece.x + x) * BLOCK;
        const py = (piece.y + y) * BLOCK;
        if (py + BLOCK <= 0) continue;
        drawCell(ctx, px, py, color);
      }
    }
  }

  function dropDistance() {
    let dist = 0;
    const test = { ...piece };
    while (!collide(board, { ...test, y: test.y + 1 })) {
      test.y++;
      dist++;
    }
    return dist;
  }

  function drawGhost() {
    const d = dropDistance();
    const m = piece.matrix;
    const gx = piece.x;
    const gy = piece.y + d;
    const color = document.body.classList.contains("theme-crazy")
      ? crazyColorFor(piece.type)
      : piece.color;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const px = (gx + x) * BLOCK;
        const py = (gy + y) * BLOCK;
        if (py + BLOCK <= 0) continue;
        drawCell(ctx, px, py, color, BLOCK, 0.18);
      }
    }
  }

  function drawNext() {
    clearCanvas(nextCtx, nextEl.width, nextEl.height);
    const items = queue.slice(0, nextItemsToShow);
    const cell = nextCell;
    let yOff = 6;

    for (const t of items) {
      drawMini(nextCtx, SHAPES[t], t, 6, yOff, cell);
      yOff += cell * 4 + 12;
    }
  }

  function drawHold() {
    clearCanvas(holdCtx, holdEl.width, holdEl.height);
    if (holdType == null) return;
    drawMini(holdCtx, SHAPES[holdType], holdType, 6, 6, holdCell);
  }

  function drawMini(c, m, type, ox, oy, s) {
    const w = m[0].length;
    const h = m.length;
    const color = getPieceColor(type);

    // Centering within a 4x4 box
    const box = 4;
    const offsetX = ox + Math.floor((box - w) / 2) * s;
    const offsetY = oy + Math.floor((box - h) / 2) * s;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!m[y][x]) continue;
        drawCell(c, offsetX + x * s, offsetY + y * s, color, s);
      }
    }
  }

  // HUD
  function addScore(pts) {
    score += pts;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("tetrisHighScore", String(highScore));
    }
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
    highScoreEl.textContent = String(highScore);
  }

  // Game control
  function newGame() {
    board = createMatrix(COLS, ROWS);
    queue = [];
    holdType = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 0;
    updateSpeed();
    running = true;
    paused = false;
    hideOverlay();
    refillQueueIfNeeded();
    spawnPiece();
    updateHUD();
  }

  function gameOver() {
    running = false;
    paused = false;
    showOverlay("Game Over", `Score: ${score}\nLines: ${lines}`);
  }

  // Loop
  function update(t = 0) {
    const dt = t - lastTime;
    lastTime = t;
    animTime = t;

    if (running && !paused) {
      dropCounter += dt;
      const interval = softDropping ? Math.max(30, baseDrop / 6) : baseDrop;
      if (dropCounter > interval) {
        dropCounter = 0;
        if (!move(0, 1)) {
          lockPiece();
        }
      }
      drawBoard();
    } else if (document.body.classList.contains("theme-crazy")) {
      // keep animating colors even when idle to match background
      drawBoard();
    }
    requestAnimationFrame(update);
  }

  // Input
  function onKeyDown(e) {
    if (!running || paused) {
      if (e.key === "p" || e.key === "P") togglePause();
      return;
    }
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        move(-1, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        move(1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        softDropping = true;
        break;
      case "ArrowUp":
        e.preventDefault();
        hardDrop();
        break;
      case "z":
      case "Z":
        e.preventDefault();
        tryRotate(-1);
        break;
      case "x":
      case "X":
        e.preventDefault();
        tryRotate(1);
        break;
      case " ":
        e.preventDefault();
        hold();
        break;
      case "p":
      case "P":
        e.preventDefault();
        togglePause();
        break;
    }
  }

  function onKeyUp(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      softDropping = false;
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    if (paused) showOverlay("Paused", "Press Resume or P to continue");
    else hideOverlay();
  }

  // Overlay
  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text || "";
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // Theme
  function setTheme(name) {
    document.body.classList.remove("theme-light", "theme-dark", "theme-crazy");
    document.body.classList.add(`theme-${name}`);
    theme = name === "dark" ? "dark" : "light";
    if (name === "crazy") {
      refreshCrazyPalette();
      applyCrazyColorsToBoard();
    } else {
      CRAZY_PALETTE = null;
    }
    if (piece) {
      piece.color = name === "crazy" ? brightColor() : getPalette()[piece.type];
    }
    localStorage.setItem("tetrisTheme", name);
  }

  function initTheme() {
    const saved = localStorage.getItem("tetrisTheme") || "dark";
    themeSelect.value = saved;
    setTheme(saved);
  }

  function applyCrazyColorsToBoard() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = board[y][x];
        if (!v) continue;
        if (typeof v !== "object") {
          board[y][x] = { type: v, color: brightColor() };
        }
      }
    }
  }

  // Responsive sizing for board and side canvases
  function resize() {
    // Target about 80% of viewport height for the board
    const desiredBoardHeight = Math.floor(window.innerHeight * 0.80);
    const newBlock = Math.floor(desiredBoardHeight / ROWS);
    BLOCK = Math.max(20, Math.min(48, newBlock));

    // Set board canvas size
    boardEl.width = COLS * BLOCK;
    boardEl.height = ROWS * BLOCK;

    // Initial guesses for mini-cells
    nextCell = Math.max(12, Math.floor(BLOCK * 0.64));
    holdCell = Math.max(12, Math.floor(BLOCK * 0.70));

    // Measure static parts of the sidebar
    const gapPx = sidebarEl ? parseFloat(getComputedStyle(sidebarEl).gap) || 0 : 0;
    const statsH = statsPanelEl ? statsPanelEl.offsetHeight : 0;
    const buttonsH = buttonsPanelEl ? buttonsPanelEl.offsetHeight : 0;

    // Overheads (panel padding + h2 heights etc.) computed as total minus canvas
    const overheadNext = nextPanelEl ? (nextPanelEl.offsetHeight - nextEl.offsetHeight) : 0;
    const overheadHold = holdPanelEl ? (holdPanelEl.offsetHeight - holdEl.offsetHeight) : 0;

    // Available height budget for the two canvases combined
    const gapsCount = 3; // between 4 panels in the sidebar
    const availableForCanvases = Math.max(
      0,
      boardEl.height - statsH - buttonsH - overheadNext - overheadHold - gapsCount * gapPx
    );

    // Start with up to 5 next items and adjust to fit
    let items = 5;
    const minItems = 3;

    const nextHeightFor = (n, cell) => n * (cell * 4 + 12) + 6;
    const holdSizeFor = (cell) => cell * 4 + 16;

    let nextH = nextHeightFor(items, nextCell);
    let holdH = holdSizeFor(holdCell);

    // Reduce items first if needed
    while (items > minItems && nextH + holdH > availableForCanvases) {
      items--;
      nextH = nextHeightFor(items, nextCell);
    }

    // If still doesn't fit, scale down mini-cell sizes proportionally
    if (nextH + holdH > availableForCanvases && availableForCanvases > 0) {
      const scale = Math.max(0.5, Math.min(1, availableForCanvases / (nextH + holdH)));
      nextCell = Math.max(10, Math.floor(nextCell * scale));
      holdCell = Math.max(10, Math.floor(holdCell * scale));
      nextH = nextHeightFor(items, nextCell);
      holdH = holdSizeFor(holdCell);
    }

    // Ensure not exceeding available height
    if (nextH + holdH > availableForCanvases) {
      // Final clamp: reduce next items to min and shrink a bit more
      items = minItems;
      nextCell = Math.max(10, Math.floor(nextCell * 0.92));
      holdCell = Math.max(10, Math.floor(holdCell * 0.92));
      nextH = nextHeightFor(items, nextCell);
      holdH = holdSizeFor(holdCell);
    }

    nextItemsToShow = items;

    // Set canvases to computed sizes
    nextEl.width = nextCell * 4 + 16;
    nextEl.height = nextH;

    holdEl.width = holdH;
    holdEl.height = holdH;

    // Redraw with new sizes
    drawBoard();
    drawNext();
    drawHold();
  }

  // Init
  function init() {
    resize();

    highScore = parseInt(localStorage.getItem("tetrisHighScore") || "0", 10);
    updateHUD();

    initTheme();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", resize);
    startBtn.addEventListener("click", newGame);
    pauseBtn.addEventListener("click", togglePause);
    overlayBtn.addEventListener("click", newGame);
    themeSelect.addEventListener("change", (e) => setTheme(e.target.value));

    // First draw
    drawBoard();
    requestAnimationFrame(update);
  }

  init();
})();