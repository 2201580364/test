/**
 * M5 - Game Flow Controller
 *
 * Integrates all modules (Game, KeyboardController, Renderer, Scoreboard)
 * into a complete playable game with:
 *   - requestAnimationFrame game loop
 *   - Game-over → score save → leaderboard display flow
 *   - Start / Pause / Restart controls via data-action buttons
 *
 * API Contract:
 *   POST /controller/init
 *     Body: { canvasId: string, scoreElementId: string, leaderboardContainerId: string }
 *     Returns: void
 *
 * Interface:
 *   function initGame(config: {
 *     canvasId: string,
 *     scoreElementId: string,
 *     leaderboardContainerId: string
 *   }): void;
 *
 * @module m5-game-controller
 */

import { Game } from './m1-game-core.js';
import { KeyboardController } from './m2-keyboard.js';
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

/** @type {boolean} Whether the game loop is actively requesting frames. */
let _running = false;

/** @type {boolean} Whether the game is currently paused. */
let _paused = false;

/** @type {number|null} Current requestAnimationFrame handle. */
let _animationFrameId = null;

/** @type {number} Timestamp of the last game tick (ms). */
let _lastTickTime = 0;

/** @type {HTMLElement|null} */
let _scoreElement = null;

/** @type {HTMLElement|null} */
let _leaderboardContainer = null;

/** @type {HTMLCanvasElement|null} */
let _canvas = null;

/** @type {Object|null} Stored config for restart. */
let _config = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the entire game: creates Game, Renderer, KeyboardController,
 * wires the game loop, and binds UI controls (start / pause / restart).
 *
 * Matches API contract:
 *   POST /controller/init
 *   Body: { canvasId: string, scoreElementId: string, leaderboardContainerId: string }
 *
 * @param {{ canvasId: string, scoreElementId: string, leaderboardContainerId: string }} config
 * @returns {void}
 */
function initGame(config) {
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
  _config = config;
  _canvas = canvas;
  _scoreElement = scoreEl;
  _leaderboardContainer = leaderboardEl;

  // ── Wire UI buttons (data-action attributes) ─────────────────────────
  _bindUIControls();

  // ── Build the game world ─────────────────────────────────────────────
  _buildGame();

  // ── Render leaderboard on init ───────────────────────────────────────
  try {
    renderLeaderboard(_leaderboardContainer);
  } catch (_err) {
    // Leaderboard rendering is non-critical; log and continue.
    console.error('initGame: failed to render leaderboard', _err);
  }

  // ── Start the game loop ──────────────────────────────────────────────
  _startLoop();
}

// ---------------------------------------------------------------------------
// Public control methods (accessible via data-action buttons)
// ---------------------------------------------------------------------------

/**
 * Start (or restart) the game. If a previous game was running it is
 * torn down cleanly first.
 *
 * @returns {void}
 */
function startGame() {
  // If a game is currently running, stop and rebuild
  if (_game) {
    _teardownGame();
  }
  _buildGame();
  _startLoop();
}

/**
 * Toggle pause state.
 *
 * @returns {void}
 */
function togglePause() {
  if (!_game) {
    return;
  }

  _paused = !_paused;

  if (!_paused) {
    // Resuming: reset last-tick so we don't get a huge time delta
    _lastTickTime = 0;
    if (!_running && !_game.gameOver) {
      _startLoop();
    }
  }
}

/**
 * Restart the game from scratch (full reset).
 *
 * @returns {void}
 */
function restartGame() {
  _teardownGame();
  _buildGame();
  _startLoop();
}

// ---------------------------------------------------------------------------
// Internal: game lifecycle
// ---------------------------------------------------------------------------

/**
 * Create fresh Game, Renderer, and KeyboardController instances.
 * @private
 */
function _buildGame() {
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

  // ── Initial render ───────────────────────────────────────────────────
  _renderFrame();
  _renderScore();

  _paused = false;
}

/**
 * Tear down current game resources (stop keyboard, cancel animation).
 * @private
 */
function _teardownGame() {
  // Cancel animation loop
  if (_animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }
  _running = false;
  _paused = false;
  _lastTickTime = 0;

  // Stop keyboard listener
  if (_keyboard) {
    _keyboard.stop();
    _keyboard = null;
  }

  // Drop references
  _game = null;
  _renderer = null;
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------

/**
 * Begin (or resume) the requestAnimationFrame loop.
 * @private
 */
function _startLoop() {
  if (_running) {
    return;
  }
  _running = true;
  _paused = false;
  _lastTickTime = 0;
  _animationFrameId = requestAnimationFrame(_gameLoop);
}

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

  _animationFrameId = requestAnimationFrame(_gameLoop);

  // Do nothing if paused
  if (_paused) {
    return;
  }

  // Initialise last-tick on first frame after resume / start
  if (_lastTickTime === 0) {
    _lastTickTime = timestamp;
    return;
  }

  // If the game is already over, stop requesting frames
  if (_game && _game.gameOver) {
    _stopLoop();
    return;
  }

  const elapsed = timestamp - _lastTickTime;

  if (elapsed >= TICK_INTERVAL) {
    // Advance game state
    if (_game && !_game.gameOver) {
      try {
        _game.move(_game.direction);
      } catch (_err) {
        console.error('Game.move() threw an error:', _err);
      }
    }

    // Render current state
    _renderFrame();

    // Update score display
    _renderScore();

    // Reset tick timer (carry over excess to avoid drift)
    _lastTickTime = timestamp - (elapsed % TICK_INTERVAL);
  }

  // Double-check: if game just ended during this tick, stop the loop
  if (_game && _game.gameOver) {
    _stopLoop();
  }
}

/**
 * Halt the animation loop gracefully.
 * @private
 */
function _stopLoop() {
  if (_animationFrameId !== null) {
    cancelAnimationFrame(_animationFrameId);
    _animationFrameId = null;
  }
  _running = false;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

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

  try {
    _renderer.render(renderState);
  } catch (_err) {
    console.error('Renderer.render() threw an error:', _err);
  }
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
// UI bindings
// ---------------------------------------------------------------------------

/**
 * Find all elements with [data-game-action] attributes and bind click
 * handlers for start, pause, and restart actions.
 *
 * Supported actions:
 *   data-game-action="start"   – calls startGame()
 *   data-game-action="pause"   – calls togglePause()
 *   data-game-action="restart" – calls restartGame()
 *
 * @private
 */
function _bindUIControls() {
  const actionButtons = document.querySelectorAll('[data-game-action]');

  for (const btn of actionButtons) {
    // Avoid double-binding
    if (btn.dataset.gameActionBound === 'true') {
      continue;
    }
    btn.dataset.gameActionBound = 'true';

    const action = btn.dataset.gameAction;

    btn.addEventListener('click', (event) => {
      event.preventDefault();

      switch (action) {
        case 'start':
          startGame();
          break;
        case 'pause':
          togglePause();
          // Update button text to reflect toggle state
          _updatePauseButtonLabel();
          break;
        case 'restart':
          restartGame();
          // Reset pause button label if it was changed
          _updatePauseButtonLabel();
          break;
        default:
          console.warn(
            `Unknown data-game-action "${action}". Supported: start, pause, restart.`
          );
      }
    });
  }
}

/**
 * Update the text content of any pause button to reflect current state.
 * @private
 */
function _updatePauseButtonLabel() {
  const pauseButtons = document.querySelectorAll('[data-game-action="pause"]');
  const label = _paused ? 'Resume' : 'Pause';
  for (const btn of pauseButtons) {
    btn.textContent = label;
  }
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
    try {
      saveScore(finalState.score);
    } catch (_err) {
      console.error('Failed to save score:', _err);
    }
  }

  // Re-render leaderboard with the new entry
  if (_leaderboardContainer) {
    try {
      renderLeaderboard(_leaderboardContainer);
    } catch (_err) {
      console.error('Failed to render leaderboard after game over:', _err);
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { initGame, startGame, togglePause, restartGame };
