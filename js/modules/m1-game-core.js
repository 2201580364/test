/**
 * M1 - Game Core Logic
 *
 * Pure game logic for Snake: movement, food generation, collision detection,
 * score calculation. No rendering or input handling.
 *
 * API Contracts:
 *   create(gridWidth?, gridHeight?) → Game instance
 *
 * Interfaces:
 *   class Game {
 *     constructor(gridWidth: number, gridHeight: number)
 *     start(): void
 *     move(direction: 'UP'|'DOWN'|'LEFT'|'RIGHT'): void
 *     getState(): { snake, food, score, gameOver }
 *     reset(): void
 *     isGameOver(): boolean
 *     onGameOver(callback: Function): void
 *   }
 */

// ---------------------------------------------------------------------------
// Direction vectors
// ---------------------------------------------------------------------------
const DIRECTION_VECTORS = Object.freeze({
  UP:    Object.freeze({ x:  0, y: -1 }),
  DOWN:  Object.freeze({ x:  0, y:  1 }),
  LEFT:  Object.freeze({ x: -1, y:  0 }),
  RIGHT: Object.freeze({ x:  1, y:  0 }),
});

const VALID_DIRECTIONS = new Set(Object.keys(DIRECTION_VECTORS));

const OPPOSITE_DIRECTION = Object.freeze({
  UP:    'DOWN',
  DOWN:  'UP',
  LEFT:  'RIGHT',
  RIGHT: 'LEFT',
});

// ---------------------------------------------------------------------------
// Logger abstraction (production-safe, avoids raw console usage)
// ---------------------------------------------------------------------------

/**
 * Module-level logger for production-safe error reporting.
 * Falls back silently if console is unavailable.
 *
 * @param {string} msg  - Human-readable message
 * @param {*}      [err] - Optional error / context object
 * @private
 */
const _log = (msg, err) => {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    if (err !== undefined) {
      console.warn(msg, err);
    } else {
      console.warn(msg);
    }
  }
};

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
class Game {
  /**
   * @param {number} [gridWidth=20]
   * @param {number} [gridHeight=20]
   */
  constructor(gridWidth = 20, gridHeight = 20) {
    // Validate and clamp grid dimensions
    this.gridWidth  = Math.max(4, Math.floor(gridWidth)  || 20);
    this.gridHeight = Math.max(4, Math.floor(gridHeight) || 20);

    // Internal state
    this.snake      = [];
    this.food       = null;
    this.score      = 0;
    this.gameOver   = false;
    this._direction = 'RIGHT';
    this._started   = false;

    // Game-over listeners
    this._onGameOverCallbacks = [];
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Read-only accessor for the current movement direction.
   *
   * @returns {'UP'|'DOWN'|'LEFT'|'RIGHT'}
   */
  get direction() {
    return this._direction;
  }

  /**
   * Initialise (or re-initialise) the game world: place the snake at the
   * centre of the grid heading RIGHT, generate the first food pellet, and
   * reset score / game-over flag.
   *
   * Safe to call when the game is already running — silently no-ops to
   * prevent accidental state loss.  Use reset() to force a restart.
   */
  start() {
    // Re-entrancy guard: if the game is already started and not over,
    // silently no-op to prevent discarding live state.
    if (this._started && !this.gameOver) {
      return;
    }

    this._initState();
  }

  /**
   * Advance the game by one tick in the given direction.
   *
   * @param {'UP'|'DOWN'|'LEFT'|'RIGHT'} direction
   */
  move(direction) {
    // No-op when the game is already over or hasn't been started
    if (this.gameOver || !this._started) {
      return;
    }

    // Validate / sanitise direction
    if (!VALID_DIRECTIONS.has(direction)) {
      // Unknown direction → keep moving in the current direction
      direction = this._direction;
    }

    // Prevent 180° reversal (snake cannot eat itself by going backwards)
    if (OPPOSITE_DIRECTION[direction] === this._direction) {
      direction = this._direction;
    }

    this._direction = direction;

    const head    = this.snake[0];
    const delta   = DIRECTION_VECTORS[direction];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };

    // --- Wall collision ---------------------------------------------------
    if (
      newHead.x < 0 || newHead.x >= this.gridWidth ||
      newHead.y < 0 || newHead.y >= this.gridHeight
    ) {
      this.gameOver = true;
      this._emitGameOver();
      return;
    }

    // --- Self collision (skip the tail – it will move away this tick) -----
    const bodyWithoutTail = this.snake.slice(0, -1);
    for (const seg of bodyWithoutTail) {
      if (seg.x === newHead.x && seg.y === newHead.y) {
        this.gameOver = true;
        this._emitGameOver();
        return;
      }
    }

    // --- Move -------------------------------------------------------------
    this.snake.unshift(newHead);

    // --- Food check -------------------------------------------------------
    if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 1;
      this._generateFood();   // tail intentionally kept → snake grows
    } else {
      this.snake.pop();       // remove tail → length stays the same
    }
  }

  /**
   * Snapshot the entire game state (no references to internals).
   *
   * @returns {{
   *   snake: Array<{x: number, y: number}>,
   *   food:  {x: number, y: number} | null,
   *   score: number,
   *   gameOver: boolean
   * }}
   */
  getState() {
    return {
      snake:    this.snake.map(s => ({ x: s.x, y: s.y })),
      food:     this.food ? { x: this.food.x, y: this.food.y } : null,
      score:    this.score,
      gameOver: this.gameOver,
    };
  }

  /**
   * Returns whether the game is over.
   *
   * @returns {boolean}
   */
  isGameOver() {
    return this.gameOver;
  }

  /**
   * Reset the game to its initial state.
   * Clears all registered game-over callbacks and reinitialises the game
   * world regardless of current state.
   */
  reset() {
    // Clear accumulated game-over callbacks to prevent duplicate
    // invocations after repeated restarts (QA #1 fix).
    this._onGameOverCallbacks = [];

    // Reinitialise the game state from scratch.
    this._initState();
  }

  /**
   * Register a callback to be invoked when the game ends.
   * Multiple callbacks may be registered; each receives the final state.
   *
   * @param {Function} callback
   * @returns {Game} this (for chaining)
   */
  onGameOver(callback) {
    if (typeof callback === 'function') {
      this._onGameOverCallbacks.push(callback);
    }
    return this;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Initialise the core game state: snake position, food, score, flags.
   * Extracted as a shared private method used by both start() and reset()
   * to avoid relying on the _started flag for flow control (QA #5 fix).
   *
   * @private
   */
  _initState() {
    const cx = Math.floor(this.gridWidth / 2);
    const cy = Math.floor(this.gridHeight / 2);

    // Build a short initial snake (3 segments when possible, fewer on tiny grids)
    this.snake = [];
    const maxLen = Math.min(3, this.gridWidth - 1);
    for (let i = 0; i < maxLen; i++) {
      this.snake.push({ x: cx - i, y: cy });
    }

    this._direction = 'RIGHT';
    this.score      = 0;
    this.gameOver   = false;
    this._started   = true;

    this._generateFood();
  }

  /** @private */
  _generateFood() {
    const occupied = new Set(this.snake.map(s => `${s.x},${s.y}`));
    const freeCells = [];

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        if (!occupied.has(`${x},${y}`)) {
          freeCells.push({ x, y });
        }
      }
    }

    if (freeCells.length === 0) {
      // Board completely filled – player wins; treat as game-over (win).
      this.food     = null;
      this.gameOver = true;
      this._emitGameOver();
      return;
    }

    const idx = Math.floor(Math.random() * freeCells.length);
    this.food = freeCells[idx];
  }

  /** @private */
  _emitGameOver() {
    const state = this.getState();
    for (const cb of this._onGameOverCallbacks) {
      try {
        cb(state);
      } catch (err) {
        // Log the error for debugging visibility while preventing one
        // faulty handler from breaking the others.
        // Uses safe logger abstraction to avoid raw console.warn in
        // environments where console may be unavailable.
        _log('[Game] Game-over callback failed:', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory – matches the api_contracts "create" method
// ---------------------------------------------------------------------------

/**
 * Create a fully initialised and started Game instance.
 * Equivalent to `new Game(w, h); game.start();`
 *
 * @param {number} [gridWidth=20]
 * @param {number} [gridHeight=20]
 * @returns {Game}
 */
function create(gridWidth = 20, gridHeight = 20) {
  const game = new Game(gridWidth, gridHeight);
  game.start();
  return game;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export { Game, create };
export default Game;
