/**
 * M2 - Keyboard Control Module
 *
 * Listens to arrow key presses and translates them into game.move(direction)
 * calls. Prevents reverse direction and input during game over.
 *
 * @module m2-keyboard
 *
 * API Contracts:
 *   attach({ game }) → KeyboardController
 *
 * Interfaces:
 *   class KeyboardController {
 *     constructor(game: Game)
 *     start(): void   // attach keydown listener
 *     stop(): void    // remove listener
 *   }
 */

// ---------------------------------------------------------------------------
// Direction maps
// ---------------------------------------------------------------------------

/**
 * Maps keyboard event codes to game directions.
 * Direction values MUST be uppercase to match M1 Game.move() contract:
 *   move(direction: 'UP'|'DOWN'|'LEFT'|'RIGHT'): void
 */
const KEY_TO_DIRECTION = Object.freeze({
  ArrowUp:    'UP',
  ArrowDown:  'DOWN',
  ArrowLeft:  'LEFT',
  ArrowRight: 'RIGHT',
});

/**
 * Reverse direction map — used to prevent 180-degree turns.
 */
const REVERSE_DIRECTION = Object.freeze({
  UP:    'DOWN',
  DOWN:  'UP',
  LEFT:  'RIGHT',
  RIGHT: 'LEFT',
});

// ---------------------------------------------------------------------------
// KeyboardController
// ---------------------------------------------------------------------------

/**
 * Keyboard controller that bridges browser key events to a Game instance.
 *
 * Usage:
 *   const controller = new KeyboardController(game);
 *   controller.start();   // begin listening
 *   controller.stop();    // stop listening
 *
 * The Game instance must expose:
 *   - game.move(direction: 'UP'|'DOWN'|'LEFT'|'RIGHT'): void
 *   - game.getState(): { snake, food, score, gameOver }
 */
class KeyboardController {
  /**
   * @param {Object} game - Game instance (from M1) with move() and getState().
   * @throws {Error} If game is not provided or doesn't implement move().
   */
  constructor(game) {
    if (!game) {
      throw new Error('KeyboardController requires a valid game instance');
    }
    if (typeof game.move !== 'function') {
      throw new Error('game instance must implement move(direction)');
    }
    if (typeof game.getState !== 'function') {
      throw new Error('game instance must implement getState()');
    }

    /** @private */ this._game = game;

    /** @private {string|null} Last direction sent to the game. */
    this._currentDirection = null;

    /** @private {boolean} Whether the listener is currently active. */
    this._active = false;

    /** @private {Function|null} Bound handler for safe add/remove. */
    this._boundHandler = null;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Attaches the keydown event listener on document.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start() {
    if (this._active) {
      return;
    }

    this._boundHandler = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._boundHandler);
    this._active = true;
  }

  /**
   * Removes the keydown event listener from document.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  stop() {
    if (!this._active) {
      return;
    }

    document.removeEventListener('keydown', this._boundHandler);
    this._boundHandler = null;
    this._active = false;
    this._currentDirection = null;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Internal keydown handler.
   * @param {KeyboardEvent} event
   * @private
   */
  _onKeyDown(event) {
    const direction = KEY_TO_DIRECTION[event.key];

    // Ignore non-arrow keys
    if (!direction) {
      return;
    }

    // Prevent default browser scrolling on arrow keys
    event.preventDefault();

    // Block input during game over
    if (this._isGameOver()) {
      return;
    }

    // Block reverse direction (180-degree turn)
    if (
      this._currentDirection &&
      direction === REVERSE_DIRECTION[this._currentDirection]
    ) {
      return;
    }

    // Send the move command — wrap in try/catch so a game error never
    // takes down the keyboard listener.
    try {
      this._game.move(direction);
      this._currentDirection = direction;
    } catch (_err) {
      // Silently swallow — the game is responsible for its own error
      // reporting.  We keep listening so subsequent key presses still work.
    }
  }

  /**
   * Checks whether the game is in a game-over state.
   *
   * Uses the M1 Game interface contract: getState() returns an object
   * with a { gameOver } boolean field. If getState() is unavailable or
   * returns a falsy value, defaults to false (allow input).
   *
   * @returns {boolean}
   * @private
   */
  _isGameOver() {
    try {
      const state = this._game.getState();
      return Boolean(state && state.gameOver);
    } catch (_err) {
      // If getState() throws (unexpected), default to false to keep
      // the keyboard operational rather than locking the user out.
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — matches the api_contracts "attach" method
// ---------------------------------------------------------------------------

/**
 * Create a KeyboardController, optionally starting it immediately.
 *
 * Matches API contract:
 *   POST /keyboard/KeyboardController
 *   Body: { game: Game instance (from M1) }
 *   Returns: KeyboardController instance with start/stop methods
 *
 * @param {{ game: Object, autoStart?: boolean }} params
 * @param {Object}  params.game - Game instance (from M1)
 * @param {boolean} [params.autoStart=true] - Whether to call start() immediately
 * @returns {KeyboardController}
 * @throws {Error} If params or params.game is missing/invalid
 */
function attach({ game, autoStart = true } = {}) {
  if (!game) {
    throw new Error('attach: game instance is required');
  }
  if (typeof game.move !== 'function') {
    throw new Error('attach: game instance must implement move(direction)');
  }

  const controller = new KeyboardController(game);

  if (autoStart) {
    controller.start();
  }

  return controller;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { KeyboardController, attach };
export default KeyboardController;
