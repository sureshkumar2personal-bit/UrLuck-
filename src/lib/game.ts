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
 *   is a loss. Either way the player can immediately start a new game.
 * - The secret number is intentionally never written to storage.
 * - Best score (fewest attempts in a won game) is tracked separately per
 *   difficulty and survives new games and page refreshes.
 *
 * NOTE: best score, theme and difficulty live in `localStorage`, which is
 * convenient but not tamper-proof (users can clear site data). That is
 * acceptable for this casual frontend-only game: there is no lockout or
 * leaderboard to protect.
 */

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; max: number; hint: string }
> = {
  easy: { label: "Easy", max: 10, hint: "1–10" },
  medium: { label: "Medium", max: 25, hint: "1–25" },
  hard: { label: "Hard", max: 50, hint: "1–50" },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

export const MAX_ATTEMPTS = 5;

const BEST_KEY = "guessnum:best";
const THEME_KEY = "guessnum:theme";
const DIFFICULTY_KEY = "guessnum:difficulty";

export type Theme = "light" | "dark";

export type GuessResult = "low" | "high" | "win";

export interface GuessEntry {
  value: number;
  result: GuessResult;
}

export type ParseError = "empty" | "not-integer" | "out-of-range";

export type ParseOutcome =
  | { ok: true; value: number }
  | { ok: false; error: ParseError };

/** Best score per difficulty: fewest attempts in a won game. */
export type BestMap = Partial<Record<Difficulty, number>>;

/** Cryptographically random integer in [1, max]. Never stored. */
export function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % max) + 1;
}

/**
 * Validate raw input. Only whole numbers within range are accepted.
 * Anything else is rejected WITHOUT consuming an attempt.
 */
export function parseGuess(
  raw: string,
  max: number = DIFFICULTIES.hard.max,
): ParseOutcome {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, error: "empty" };
  const value = Number(trimmed);
  if (!Number.isInteger(value)) return { ok: false, error: "not-integer" };
  if (value < 1 || value > max) return { ok: false, error: "out-of-range" };
  return { ok: true, value };
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (e.g. private mode) -> treat as empty
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable -> game still works for the session, it just
    // won't persist across reloads.
  }
}

function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/**
 * Load best scores per difficulty. Migrates the legacy single-number format
 * (from when the game was fixed 1-50) to the "hard" slot.
 */
export function loadBestMap(): BestMap {
  const raw = readStorage(BEST_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number") {
      return isValidScore(parsed) ? { hard: parsed } : {};
    }
    if (parsed !== null && typeof parsed === "object") {
      const map: BestMap = {};
      for (const key of DIFFICULTY_ORDER) {
        const v = (parsed as Record<string, unknown>)[key];
        if (isValidScore(v)) map[key] = v;
      }
      return map;
    }
  } catch {
    // Legacy plain-string number ("3") or corrupt data.
    const n = Number(raw);
    if (isValidScore(n)) return { hard: n };
  }
  return {};
}

export function saveBestMap(map: BestMap): void {
  writeStorage(BEST_KEY, JSON.stringify(map));
}

/** Saved difficulty, defaulting to hard (the original 1-50 game). */
export function loadDifficulty(): Difficulty {
  const saved = readStorage(DIFFICULTY_KEY);
  if (saved === "easy" || saved === "medium" || saved === "hard") return saved;
  return "hard";
}

export function saveDifficulty(difficulty: Difficulty): void {
  writeStorage(DIFFICULTY_KEY, difficulty);
}

/** Saved theme, else the OS preference. Defaults to dark when undecidable. */
export function getInitialTheme(): Theme {
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

export function saveTheme(theme: Theme): void {
  writeStorage(THEME_KEY, theme);
}
