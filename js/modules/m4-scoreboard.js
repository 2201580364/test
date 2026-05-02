/**
 * M4 - Score & Leaderboard Module
 *
 * Handles score persistence with localStorage, retrieves sorted leaderboard,
 * and provides DOM-based rendering of the leaderboard.
 *
 * API Contracts:
 *   POST /scoreboard/saveScore          – saveScore(score: number): void
 *   POST /scoreboard/getLeaderboard     – getLeaderboard(): LeaderboardEntry[]
 *   POST /scoreboard/renderLeaderboard  – renderLeaderboard(container: HTMLElement): void
 *
 * Interfaces:
 *   function saveScore(score: number): void;
 *   function getLeaderboard(): LeaderboardEntry[];
 *   function renderLeaderboard(container: HTMLElement): void;
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

/** @constant {number} Maximum number of top entries kept in the leaderboard. */
const MAX_ENTRIES = 10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save a score to the persistent leaderboard.
 *
 * Matches API contract:
 *   POST /scoreboard/saveScore
 *   Body: { score: number }
 *   Returns: void
 *
 * Internally reads existing entries from localStorage, appends the new entry
 * (with an ISO 8601 timestamp), truncates to the top MAX_ENTRIES (sorted
 * descending by score), and writes back.
 *
 * @param {number} score - The score to save (must be a finite number)
 * @throws {TypeError} If score is not a finite number
 */
function saveScore(score) {
  // ── Validate ──────────────────────────────────────────────────────────
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new TypeError('score must be a finite number');
  }

  // ── Load existing entries ─────────────────────────────────────────────
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

  // ── Append new entry ──────────────────────────────────────────────────
  const newEntry = {
    score: score,
    date: new Date().toISOString(),
  };
  entries.push(newEntry);

  // ── Sort descending by score & trim to MAX_ENTRIES ──────────────────
  entries.sort((a, b) => b.score - a.score);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  // ── Persist ───────────────────────────────────────────────────────────
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
 *   Returns: Array<{score: number, date: string}> — top N entries (highest first)
 *
 * Filters out any malformed entries and returns at most MAX_ENTRIES records.
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
      return [];
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

  // Limit to top N
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  return entries;
}

/**
 * Render the leaderboard list inside the given container element.
 *
 * Appends a styled ordered list of top scores. Replaces any existing content
 * inside the container.
 *
 * Matches API contract:
 *   POST /scoreboard/renderLeaderboard
 *   Body: { container: HTMLElement }
 *   Returns: void
 *
 * @param {HTMLElement} container - The DOM element to render the leaderboard into
 * @throws {TypeError} If container is not a valid HTMLElement
 */
function renderLeaderboard(container) {
  // ── Validate ──────────────────────────────────────────────────────────
  if (!container || !(container instanceof HTMLElement)) {
    throw new TypeError('container must be a valid HTMLElement');
  }

  const entries = getLeaderboard();

  // Clear existing content
  container.innerHTML = '';

  // ── Build leaderboard DOM ─────────────────────────────────────────────
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

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

export { saveScore, getLeaderboard, renderLeaderboard };
