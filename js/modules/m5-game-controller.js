/**
 * M5 - Game Flow Controller
 *
 * Integrates all modules (Game, KeyboardController, Renderer, Scoreboard)
 * into a complete playable game with:
 *   - requestAnimationFrame game loop
 *   - Game-over → score save → leaderboard display flow
 *   - Start / Pause / Restart controls
 *
 * API Contract:
 *   init(config: { canvasId, scoreElementId, leaderboardContainerId }): void
 *
 * @module m5-game-controller
 */

import { Game } from './m1-game-core.js';
import KeyboardController from './m2-keyboard.js';
import { Renderer } from './m3-renderer.js';
import { saveScore, renderLeaderboard } from './m4-scoreboard.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Game tick interval in milliseconds (controls snake speed). */
const TICK_INTERVAL = 150; // ms

/** Grid dimensions. */
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;

/** Cell size in pixels for the renderer. */
const CELL_SIZE = 24;

// ---------------------------------------------------------------------------
// Private state (module-scoped)
// ---------------------------------------------------------------------------

/** @type {Game|null} */
let _game = null;

/** @type {Renderer|null} */
let _renderer = null;

/** @type {KeyboardController|null} */
let _keyboard = null;

/** @type {boolean} */
let _running = false;

/** @type {boolean} */
let _paused = false;

/** @type {number|null} */
let _animationFrameId = null;

/** @type {number} */
let _lastTickTime = 0;

/** @type {HTMLElement|null} */
let _scoreElement = null;

/** @type {HTMLElement|null} */
let _leaderboardContainer = null;

/** @type {HTMLCanvasElement|null} */
let _canvas = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the entire game: creates Game, Renderer, KeyboardController,
 * wires the game loop, and binds UI controls.
 *
 * @param {{ canvasId: string, scoreElementId: string, leaderboardContainerId: string }} config
 * @returns {void}
 */
function initGame(config) {
  // ── Re-entrancy guard ───────────────────────────────────────────────
  if (_running || _animationFrameId !== null) {
    throw new Error(
      'initGame: game is already initialized. Call restartGame() instead.'
    );
  }

  // ── Validate config ──────────────────────────────────────────────────
  if (!config || typeof config !== 'object') {
    throw new TypeError('initGame: config object is required');
  }

  const { canvasId, scoreElementId, leaderboardContainerId } = config;

  if (typeof canvasId !== 'string' || canvasId.length === 0) {
    throw new TypeError('initGame: canvasId must be a non-empty string');
  }
  if (typeof scoreElementId !== 'string' || scoreElementId.length === 0) {
    throw new TypeError('initGame: scoreElementId must be a non-empty string');
  }
  if (
    typeof leaderboardContainerId !== 'string' ||
    leaderboardContainerId.length === 0
  ) {
    throw new TypeError(
      'initGame: leaderboardContainerId must be a non-empty string'
    );
  }

  // ── Resolve DOM elements ─────────────────────────────────────────────
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`initGame: canvas element with id "${canvasId}" not found`);
  }
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(
      `initGame: element with id "${canvasId}" is not a <canvas>`
    );
  }

  const scoreEl = document.getElementById(scoreElementId);
  if (!scoreEl) {
    throw new Error(
      `initGame: score element with id "${scoreElementId}" not found`
    );
  }

  const leaderboardEl = document.getElementById(leaderboardContainerId);
  if (!leaderboardEl) {
    throw new Error(
      `initGame: leaderboard container with id "${leaderboardContainerId}" not found`
    );
  }

  // ── Store references ─────────────────────────────────────────────────
  _canvas = canvas;
  _scoreElement = scoreEl;
  _leaderboardContainer = leaderboardEl;

  // ── Create game core ─────────────────────────────────────────────────
  _game = new Game(GRID_WIDTH, GRID_HEIGHT);
  _game.start();

  // ── Create renderer ──────────────────────────────────────────────────
  _renderer = new Renderer(_canvas, CELL_SIZE);

  // ── Create keyboard controller ───────────────────────────────────────
  _keyboard = new KeyboardController(_game);
  _keyboard.start();

  // ── Wire game-over handler ───────────────────────────────────────────
  _game.onGameOver(_onGameOver);

  // ── Do initial render (shows starting state) ─────────────────────────
  _renderScore();

  // ── Render leaderboard on init ───────────────────────────────────────
  renderLeaderboard(_leaderboardContainer);

  // ── Start the game loop ──────────────────────────────────────────────
  _running = true;
  _paused = false;
  _lastTickTime = 0;
  _animationFrameId = requestAnimationFrame(_gameLoop);

  return;
}

/**
 * Pause the game. No-op if the game is not running or already paused.
 */
function pauseGame() {
  if (!_running || _paused) {
    return;
  }
  _paused = true;
  _lastTickTime = 0;
}

/**
 * Resume the game from a paused state. No-op if not running or not paused.
 *
 * Cancels any pending animation frame from the paused loop before
 * requesting a fresh one to prevent duplicate _gameLoop callbacks
 * from being queued in the same frame (QA #4 fix).
 */
function resumeGame() {
  if (!_running || !_paused) {
    return;
  }

  // Cancel the paused-loop animation frame so that only one
  // _gameLoop callback is scheduled after resume.
  if (_animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }

  _paused = false;
  _lastTickTime = 0;
  _animationFrameId = requestAnimationFrame(_gameLoop);
}

/**
 * Restart the game: stop current keyboard listener and animation loop,
 * reset the game state, create a fresh keyboard controller, and start
 * a new game loop.  Can be called at any time (running, paused, or after
 * game-over).
 *
 * Requires initGame() to have been called first (QA #3 fix).
 */
function restartGame() {
  // Guard: game must be initialised before restart (QA #3 fix).
  if (!_game) {
    throw new Error(
      'restartGame: game not initialized. Call initGame() first.'
    );
  }

  // Clean up keyboard controller
  if (_keyboard) {
    _keyboard.stop();
    _keyboard = null;
  }

  // Cancel any pending animation frame
  if (_animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }

  // Reset game state. M1 Game.reset() now clears _onGameOverCallbacks
  // so we must re-register the handler below (QA #1 fix).
  _game.reset();

  // Create fresh keyboard controller
  _keyboard = new KeyboardController(_game);
  _keyboard.start();

  // Re-wire game-over handler — required because reset() clears the
  // callback list. This registration is the sole registration for the
  // new game session, preventing duplicate invocations (QA #1 fix).
  _game.onGameOver(_onGameOver);

  // Reset module-scoped flags
  _running = true;
  _paused = false;
  _lastTickTime = 0;

  // Immediate visual refresh
  _renderFrame();
  _renderScore();
  renderLeaderboard(_leaderboardContainer);

  // Start new game loop
  _animationFrameId = requestAnimationFrame(_gameLoop);
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

/**
 * Main game loop driven by requestAnimationFrame.
 * Advances the game by one tick every TICK_INTERVAL ms.
 *
 * @param {DOMHighResTimeStamp} timestamp
 * @private
 */
function _gameLoop(timestamp) {
  if (!_running) {
    return;
  }

  // When paused, keep the loop alive without processing ticks so that
  // resumeGame() can restart processing immediately.
  if (_paused) {
    _animationFrameId = requestAnimationFrame(_gameLoop);
    return;
  }

  // Initialise last-tick on first frame after resume
  if (_lastTickTime === 0) {
    _lastTickTime = timestamp;
    _animationFrameId = requestAnimationFrame(_gameLoop);
    return;
  }

  const elapsed = timestamp - _lastTickTime;

  if (elapsed >= TICK_INTERVAL) {
    // Advance game state
    if (_game && !_game.gameOver) {
      _game.move(_game.direction);
    }

    // Render current state
    _renderFrame();

    // Update score display
    _renderScore();

    // Reset tick timer (carry over excess to avoid drift)
    _lastTickTime = timestamp - (elapsed % TICK_INTERVAL);
  }

  // If game just ended, stop the animation loop and clean up keyboard
  if (_game && _game.gameOver && _animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
    _running = false;

    if (_keyboard) {
      _keyboard.stop();
    }

    return;
  }

  // Schedule next frame
  _animationFrameId = requestAnimationFrame(_gameLoop);
}

/**
 * Render a single frame.
 * @private
 */
function _renderFrame() {
  if (!_game || !_renderer) {
    return;
  }

  const state = _game.getState();

  // Augment state with grid dimensions the renderer expects
  const renderState = {
    snake: state.snake,
    food: state.food,
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    isGameOver: state.gameOver,
  };

  _renderer.render(renderState);
}

/**
 * Update the score element text content.
 * @private
 */
function _renderScore() {
  if (!_scoreElement || !_game) {
    return;
  }
  _scoreElement.textContent = String(_game.score);
}

// ---------------------------------------------------------------------------
// Game-over handler
// ---------------------------------------------------------------------------

/**
 * Called when the game ends (via Game.onGameOver callback).
 * Saves the score and re-renders the leaderboard.
 *
 * @param {Object} finalState - The final game state from M1
 * @private
 */
function _onGameOver(finalState) {
  // Save the final score
  if (finalState && typeof finalState.score === 'number') {
    saveScore(finalState.score);
  }

  // Re-render leaderboard with the new entry
  if (_leaderboardContainer) {
    renderLeaderboard(_leaderboardContainer);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { initGame, pauseGame, resumeGame, restartGame };
