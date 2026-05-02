/**
 * Main entry point for the Snake game.
 *
 * Imports M5 (Game Flow Controller) and initialises the game once the
 * DOM is fully loaded.  All module wiring, game-loop scheduling, and
 * UI control binding is delegated to initGame().
 *
 * @module main
 */

import { initGame } from './modules/m5-game-controller.js';

// ---------------------------------------------------------------------------
// DOM-ready bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initGame({
    canvasId: 'game-canvas',
    scoreElementId: 'score-display',
    leaderboardContainerId: 'leaderboard-container',
  });
});
