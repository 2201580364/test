(function() {
  'use strict';

  const STORAGE_KEY = 'snake_highscores';
  const MAX_SCORES = 10;

  /**
   * Load score array from localStorage.
   * @returns {Array<{score: number, date: string}>}
   */
  function loadScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load scores from localStorage', e);
      return [];
    }
  }

  /**
   * Save scores array to localStorage.
   * @param {Array<{score: number, date: string}>} scores
   */
  function saveScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
      console.error('Failed to save scores to localStorage', e);
    }
  }

  let currentContainer = null;

  const scoreboard = {
    /**
     * Add a new score and keep only the top 10.
     * @param {number} score - The score to add.
     */
    addScore(score) {
      if (typeof score !== 'number') return;

      const scores = loadScores();
      scores.push({ score, date: new Date().toISOString() });
      // sort descending
      scores.sort((a, b) => b.score - a.score);
      // keep top N
      saveScores(scores.slice(0, MAX_SCORES));
    },

    /**
     * Get all saved high scores, sorted descending.
     * @returns {Array<{score: number, date: string}>}
     */
    getScores() {
      const scores = loadScores();
      // guarantee sort order
      scores.sort((a, b) => b.score - a.score);
      return scores;
    },

    /**
     * Render the high score list into the given container.
     * @param {HTMLElement} containerElement
     */
    show(containerElement) {
      if (!containerElement || !(containerElement instanceof HTMLElement)) return;
      currentContainer = containerElement;

      // clear previous content
      containerElement.innerHTML = '';

      const scores = this.getScores();
      const ol = document.createElement('ol');

      scores.forEach(s => {
        const li = document.createElement('li');
        li.textContent = `${s.score} - ${s.date}`;
        ol.appendChild(li);
      });

      containerElement.appendChild(ol);
    },

    /**
     * Remove the high score list from the last shown container.
     */
    hide() {
      if (currentContainer) {
        currentContainer.innerHTML = '';
        currentContainer = null;
      }
    }
  };

  // Expose to global namespace
  window.SnakeGame = window.SnakeGame || {};
  window.SnakeGame.scoreboard = scoreboard;
})();
