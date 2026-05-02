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

/** @constant {number} Maximum number of leaderboard entries to keep and display. */
const MAX_LEADERBOARD_ENTRIES = 10;

// ---------------------------------------------------------------------------
// Logger abstraction (avoids raw console.error usage in production paths)
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
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    if (err !== undefined) {
      console.error(msg, err);
    } else {
      console.error(msg);
    }
  }
};

// ---------------------------------------------------------------------------
// Feature detection: localStorage availability
// ---------------------------------------------------------------------------

/**
 * Whether localStorage is available and writable in the current environment.
 * Detects cases like private browsing in older Safari where the API exists
 * but throws on write.
 *
 * @constant {boolean}
 * @private
 */
const _storageAvailable = (() => {
  try {
    const testKey = '__snake_ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
})();

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Filters out malformed entries from an array of leaderboard candidates.
 * Each valid entry must be an object with a finite numeric score and a
 * non-empty date string.
 *
 * @param {Array<*>} entries - Raw array parsed from JSON or constructed elsewhere
 * @returns {LeaderboardEntry[]} Entries that pass the structural checks
 * @private
 */
const _filterValidEntries = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof entry.score === 'number' &&
      Number.isFinite(entry.score) &&
      typeof entry.date === 'string' &&
      entry.date.length > 0
  );
};

/**
 * Deduplicates leaderboard entries by score+date composite key.
 * Keeps the first occurrence of each unique combination.
 *
 * @param {LeaderboardEntry[]} entries
 * @returns {LeaderboardEntry[]} Deduplicated array
 * @private
 */
const _deduplicateEntries = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.score}::${entry.date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

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
 * @param {number} score - The score to save (must be non-negative)
 * @throws {RangeError} If score is negative
 * @throws {TypeError}  If score is not a finite number
 */
function saveScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new TypeError('score must be a finite number');
  }

  // Guard against negative scores — the game never produces them, and the
  // public API should not allow leaderboard pollution via the browser console.
  if (score < 0) {
    throw new RangeError('score must be non-negative');
  }

  // Bail early if localStorage is unavailable (no user-facing feedback
  // required by the module contract, but we avoid a wasted parse round-trip).
  if (!_storageAvailable) {
    _log('[Scoreboard] localStorage is not available — score not saved');
    return;
  }

  /** @type {LeaderboardEntry[]} */
  let entries;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    // Corrupted data — start fresh
    entries = [];
  }

  // Filter out malformed entries before adding the new one so that manually
  // tampered localStorage data is cleaned up on the very next saveScore call.
  entries = _filterValidEntries(entries);

  const newEntry = {
    score: score,
    date: new Date().toISOString(),
  };

  entries.push(newEntry);

  // Deduplicate entries by score+date composite key to prevent duplicate
  // records from polluting localStorage (QA #2 fix).
  entries = _deduplicateEntries(entries);

  // Sort descending by score, keep only the top N, and persist.
  // JSON.stringify is wrapped in the same try/catch so that serialisation
  // errors (e.g. future code introducing BigInt or circular references)
  // are handled gracefully instead of throwing to the caller.
  entries.sort((a, b) => b.score - a.score);
  entries = entries.slice(0, MAX_LEADERBOARD_ENTRIES);

  try {
    const serialized = JSON.stringify(entries);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    // Storage full, quota exceeded, or serialisation error — degrade gracefully
    _log('[Scoreboard] Failed to save score to localStorage:', err);
  }
}

/**
 * Retrieve the leaderboard, sorted descending by score, limited to the top N.
 * Duplicate entries (same score + same timestamp) are collapsed to a single
 * entry to prevent flooding.
 *
 * Matches API contract:
 *   POST /scoreboard/getLeaderboard
 *   Body: {}
 *   Returns: Array<{score: number, date: string}>  (top N, sorted desc)
 *
 * @returns {LeaderboardEntry[]} Sorted array of leaderboard entries (highest score first)
 */
function getLeaderboard() {
  if (!_storageAvailable) {
    return [];
  }

  /** @type {LeaderboardEntry[]} */
  let entries;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    // Corrupted data — return empty
    return [];
  }

  // Filter out any malformed entries (missing score or date)
  entries = _filterValidEntries(entries);

  // Sort descending by score
  entries.sort((a, b) => b.score - a.score);

  // Deduplicate: collapse entries with identical score + timestamp.
  entries = _deduplicateEntries(entries);

  // Enforce top-N limit (API contract: "top N entries")
  entries = entries.slice(0, MAX_LEADERBOARD_ENTRIES);

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
 * @throws {TypeError} If container is not a valid HTMLElement
 */
function renderLeaderboard(container) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new TypeError('container must be a valid HTMLElement');
  }

  const entries = getLeaderboard();

  // Clear existing content using the modern, safe DOM API that does not
  // invoke the HTML parser. Unlike innerHTML = '', replaceChildren()
  // removes child nodes directly, avoiding security-sensitive innerHTML
  // and potential memory-leak scenarios where event listeners remain
  // attached to detached DOM subtrees.
  container.replaceChildren();

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

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const item = document.createElement('li');
      item.className = 'snake-leaderboard__item';

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'snake-leaderboard__score';
      scoreSpan.textContent = String(entry.score);

      const dateSpan = document.createElement('span');
      dateSpan.className = 'snake-leaderboard__date';

      // Format the date in a user-friendly way.
      // Uses toLocaleString so both date and time portions are displayed.
      // Wrapped in try/catch as a safeguard for environments where the
      // Intl API is unavailable (exotic or restricted runtimes).
      const dateObj = new Date(entry.date);
      if (isNaN(dateObj.getTime())) {
        dateSpan.textContent = entry.date;
      } else {
        let formattedDate;
        try {
          formattedDate = dateObj.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          formattedDate = entry.date;
        }
        dateSpan.textContent = formattedDate;
      }

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
