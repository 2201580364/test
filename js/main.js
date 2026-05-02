/**
 * Main entry point for the Snake game.
 *
 * Imports M5 (Game Flow Controller) and initialises the game once the
 * DOM is fully loaded.  Wires UI controls for Pause / Resume / Restart.
 */

import {
  initGame,
  pauseGame,
  resumeGame,
  restartGame,
} from './modules/m5-game-controller.js';

// ---------------------------------------------------------------------------
// DOM-ready bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // ── Initialise the game ──────────────────────────────────────────────
  initGame({
    canvasId: 'game-canvas',
    scoreElementId: 'score-display',
    leaderboardContainerId: 'leaderboard-container',
  });

  // ── Wire UI control buttons ──────────────────────────────────────────
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnRestart = document.getElementById('btn-restart');

  if (btnPause) {
    btnPause.addEventListener('click', () => {
      pauseGame();
    });
  }

  if (btnResume) {
    btnResume.addEventListener('click', () => {
      resumeGame();
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      restartGame();
    });
  }
});
