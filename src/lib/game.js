/**
 * Shared game rules, validation and browser-storage helpers for the
 * Secret Number Guessing Game (frontend-only, `localStorage` persistence).
 *
 * Game rules:
 * - The player picks a difficulty: Easy (1-10), Medium (1-25), Hard (1-50).
 * - The secret is an integer between 1 and the difficulty max (inclusive).
 * - Each game allows MAX_ATTEMPTS valid, unique guesses.
 * - Invalid input (empty, non-integer, out-of-range) and duplicate guesses
 *   never consume an attempt.
 * - Guessing correctly within the limit is a WIN; exhausting all attempts
 *   is a loss. Either way the game locks for 12 hours before retry.
 * - The secret number is intentionally never written to storage.
 * - Best score (fewest attempts in a won game) is tracked separately per
 *   difficulty and survives new games and page refreshes.
 * - Retry lock (`lockedUntil` timestamp) also survives page refreshes.
 *
 * NOTE: best score, theme, difficulty and retry lock live in `localStorage`, which is
 * convenient but not tamper-proof (users can clear site data). That is
 * acceptable for this casual frontend-only game: there is no lockout or
 * leaderboard to protect.
 */

const DIFFICULTIES = {
  easy: { label: "Easy", max: 10, hint: "1–10" },
  medium: { label: "Medium", max: 25, hint: "1–25" },
  hard: { label: "Hard", max: 50, hint: "1–50" },
};

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

const MAX_ATTEMPTS = 5;

/** Retry lockout after a win or a loss (12 hours). */
const LOCK_DURATION_MS = 12 * 60 * 60 * 1000;

const BEST_KEY = "guessnum:best";
const THEME_KEY = "guessnum:theme";
const LOCK_KEY = "guessnum:lockedUntil";
const HISTORY_KEY = "guessnum:history";

/** Cryptographically random integer in [1, max]. Never stored. */
function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % max) + 1;
}

/**
 * Validate raw input. Only whole numbers within range are accepted.
 * Anything else is rejected WITHOUT consuming an attempt.
 */
function parseGuess(raw, max = DIFFICULTIES.hard.max) {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return { ok: false, error: "not-integer" };
  if (value < 1 || value > max) return { ok: false, error: "out-of-range" };
  return { ok: true, value };
}

function readStorage(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable -> game still works for the session, it just
    // won't persist across reloads.
  }
}

function removeStorage(key) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function isValidScore(n) {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/**
 * Load best scores per difficulty. Migrates the legacy single-number format
 * (from when the game was fixed 1-50) to the "hard" slot.
 */
function loadBestMap() {
  const raw = readStorage(BEST_KEY);
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "number") {
      return isValidScore(parsed) ? { hard: parsed } : {};
    }
    if (parsed !== null && typeof parsed === "object") {
      const map = {};
      for (const key of DIFFICULTY_ORDER) {
        const v = parsed[key];
        if (isValidScore(v)) map[key] = v;
      }
      return map;
    }
  } catch {
    const n = Number(raw);
    if (isValidScore(n)) return { hard: n };
  }
  return {};
}

function saveBestMap(map) {
  writeStorage(BEST_KEY, JSON.stringify(map));
}

/** Always start fresh on Hard (1-50). */
function loadDifficulty() {
  return "hard";
}

function saveDifficulty() {
  // difficulty always starts fresh on Hard; nothing to persist
}

/** Saved theme, else the OS preference. Defaults to dark when undecidable. */
function getInitialTheme() {
  const saved = readStorage(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    // ignore, fall through to default
  }
  return "dark";
}

function saveTheme(theme) {
  writeStorage(THEME_KEY, theme);
}

/** Timestamp (ms) when retry unlocks, or null if not locked. */
function loadLockedUntil() {
  const raw = readStorage(LOCK_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function saveLockedUntil(timestamp) {
  writeStorage(LOCK_KEY, String(timestamp));
}

function clearLockedUntil() {
  removeStorage(LOCK_KEY);
}

/** ---------- Game history (past games) ---------- */

function loadHistory() {
  const raw = readStorage(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  writeStorage(HISTORY_KEY, JSON.stringify(history));
}

function addHistoryRecord(record) {
  const history = loadHistory();
  history.unshift(record);
  saveHistory(history.slice(0, 50));
}

export {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
  clearLockedUntil,
  getInitialTheme,
  loadBestMap,
  loadDifficulty,
  loadLockedUntil,
  loadHistory,
  addHistoryRecord,
  parseGuess,
  randomInt,
  saveBestMap,
  saveDifficulty,
  saveLockedUntil,
  saveTheme,
};
