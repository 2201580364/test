/**
 * M4 - Score & Leaderboard Module
 *
 * Handles score persistence with localStorage, retrieves sorted leaderboard,
 * and provides DOM-based rendering of the leaderboard.
 *
 * @module m4-scoreboard
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {number} score - The player's score
 * @property {string} date  - ISO 8601 date string of when the score was recorded
 */

/** @constant {string} Storage key used for persisting leaderboard entries. */
const STORAGE_KEY = 'snake_leaderboard';

/**
 * Save a score to the persistent leaderboard.
 *
 * Matches API contract:
 *   POST /scoreboard/saveScore
 *   Body: { score: number }
 *   Returns: void
 *
 * @param {number} score - The score to save
 * @throws {TypeError} If score is not a finite number
 */
function saveScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new TypeError('score must be a finite number');
  }

  /** @type {LeaderboardEntry[]} */
  let entries;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) {
      entries = [];
    }
  } catch (_err) {
    // Corrupted data — start fresh
    entries = [];
  }

  const newEntry = {
    score: score,
    date: new Date().toISOString(),
  };

  entries.push(newEntry);

  // Persist back to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    // Storage full or unavailable — degrade gracefully
    console.error('Failed to save score to localStorage:', err);
  }
}

/**
 * Retrieve the leaderboard, sorted descending by score.
 *
 * Matches API contract:
 *   POST /scoreboard/getLeaderboard
 *   Body: {}
 *   Returns: Array<{score: number, date: string}>
 *
 * @returns {LeaderboardEntry[]} Sorted array of leaderboard entries (highest score first)
 */
function getLeaderboard() {
  /** @type {LeaderboardEntry[]} */
  let entries;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) {
      entries = [];
    }
  } catch (_err) {
    // Corrupted data — return empty
    return [];
  }

  // Filter out any malformed entries (missing score or date)
  entries = entries.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.score === 'number' &&
      Number.isFinite(entry.score) &&
      typeof entry.date === 'string' &&
      entry.date.length > 0
  );

  // Sort descending by score
  entries.sort((a, b) => b.score - a.score);

  return entries;
}

/**
 * Render the leaderboard list inside the given container element.
 * Appends a styled ordered list of top scores. Replaces any existing
 * content inside the container.
 *
 * Matches API contract:
 *   POST /scoreboard/renderLeaderboard
 *   Body: { container: HTMLElement }
 *   Returns: void
 *
 * @param {HTMLElement} container - The DOM element to render the leaderboard into
 */
function renderLeaderboard(container) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new TypeError('container must be a valid HTMLElement');
  }

  const entries = getLeaderboard();

  // Clear existing content
  container.innerHTML = '';

  // Build leaderboard DOM
  const wrapper = document.createElement('div');
  wrapper.className = 'snake-leaderboard';

  const title = document.createElement('h3');
  title.className = 'snake-leaderboard__title';
  title.textContent = 'Leaderboard';

  wrapper.appendChild(title);

  if (entries.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'snake-leaderboard__empty';
    emptyMsg.textContent = 'No scores yet. Play a game to get on the board!';
    wrapper.appendChild(emptyMsg);
  } else {
    const list = document.createElement('ol');
    list.className = 'snake-leaderboard__list';

    // Display all entries (caller can limit via CSS or pass a pre-filtered container)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const item = document.createElement('li');
      item.className = 'snake-leaderboard__item';

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'snake-leaderboard__score';
      scoreSpan.textContent = String(entry.score);

      const dateSpan = document.createElement('span');
      dateSpan.className = 'snake-leaderboard__date';
      // Format the date in a user-friendly way
      const dateObj = new Date(entry.date);
      dateSpan.textContent = isNaN(dateObj.getTime())
        ? entry.date
        : dateObj.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

      item.appendChild(scoreSpan);
      item.appendChild(dateSpan);
      list.appendChild(item);
    }

    wrapper.appendChild(list);
  }

  container.appendChild(wrapper);
}

// Module exports
export { saveScore, getLeaderboard, renderLeaderboard };
