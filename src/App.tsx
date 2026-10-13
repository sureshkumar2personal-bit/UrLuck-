import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Confetti from "./components/Confetti";
import GameStats from "./components/GameStats";
import GuessHistory from "./components/GuessHistory";
import ThemeToggle from "./components/ThemeToggle";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MAX_ATTEMPTS,
  getInitialTheme,
  loadBestMap,
  loadDifficulty,
  parseGuess,
  randomInt,
  saveBestMap,
  saveDifficulty,
  saveTheme,
} from "./lib/game";
import type {
  BestMap,
  Difficulty,
  GuessEntry,
  GuessResult,
  Theme,
} from "./lib/game";

type FeedbackKind = GuessResult | "error";

const feedbackStyles: Record<FeedbackKind, string> = {
  low: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100",
  high: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100",
  win: "border-emerald-400 bg-emerald-50 text-emerald-800 animate-[pop_0.35s_ease] dark:border-emerald-400/50 dark:bg-emerald-400/15 dark:text-emerald-100",
  error:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100",
};

const primaryButton =
  "w-full cursor-pointer touch-manipulation rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 py-3.5 font-semibold text-white select-none transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 active:translate-y-px";

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);
  const [secret, setSecret] = useState<number>(() =>
    randomInt(DIFFICULTIES[loadDifficulty()].max),
  );
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<GuessEntry[]>([]);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<FeedbackKind | null>(null);
  const [bestMap, setBestMap] = useState<BestMap>(loadBestMap);
  const inputRef = useRef<HTMLInputElement>(null);

  const max = DIFFICULTIES[difficulty].max;
  const best = bestMap[difficulty] ?? null;

  // Apply + persist theme on <html> (class-based dark mode).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    saveTheme(theme);
  }, [theme]);

  function newGame(next: Difficulty) {
    setSecret(randomInt(DIFFICULTIES[next].max));
    setInput("");
    setHistory([]);
    setFeedback("");
    setResult(null);
    inputRef.current?.focus();
  }

  function changeDifficulty(next: Difficulty) {
    if (next === difficulty) return;
    setDifficulty(next);
    saveDifficulty(next);
    newGame(next);
  }

  const won = result === "win";
  const used = history.length;
  const remaining = MAX_ATTEMPTS - used;
  const lost = !won && used >= MAX_ATTEMPTS;
  const gameOver = won || lost;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (gameOver) return;

    const parsed = parseGuess(input, max);
    if (!parsed.ok) {
      setResult("error");
      if (parsed.error === "empty") {
        setFeedback("Please enter a number first.");
      } else if (parsed.error === "not-integer") {
        setFeedback("Invalid input. Please enter a whole number.");
      } else {
        setFeedback(`Please enter a whole number between 1 and ${max}.`);
      }
      return;
    }

    const guess = parsed.value;
    if (history.some((entry) => entry.value === guess)) {
      // Duplicate guesses never consume an attempt.
      setResult("error");
      setFeedback(`You already guessed ${guess}. Try a different number.`);
      setInput("");
      inputRef.current?.focus();
      return;
    }

    const attemptsUsed = history.length + 1;

    if (guess === secret) {
      setResult("win");
      setFeedback("Correct! You found the secret number!");
      setHistory((h) => [{ value: guess, result: "win" }, ...h]);
      if (best === null || attemptsUsed < best) {
        const next = { ...bestMap, [difficulty]: attemptsUsed };
        setBestMap(next);
        saveBestMap(next);
      }
    } else {
      const outcome: GuessResult = guess > secret ? "high" : "low";
      setResult(outcome);
      setFeedback(
        outcome === "high"
          ? "Too high! Try a lower number."
          : "Too low! Try a higher number.",
      );
      setHistory((h) => [{ value: guess, result: outcome }, ...h]);
    }

    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="theme-smooth flex min-h-dvh w-full overflow-x-clip p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-sans text-slate-900 sm:p-6 dark:text-slate-100">
      {won && <Confetti />}

      <main className="m-auto w-full max-w-md animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-2xl dark:backdrop-blur-xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-4xl leading-none" aria-hidden="true">
              🎯
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[26px]">
              Secret Number
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              I picked a number between{" "}
              <b className="text-slate-900 dark:text-slate-100">1</b> and{" "}
              <b className="text-slate-900 dark:text-slate-100">{max}</b>.
              You have {MAX_ATTEMPTS} attempts.
            </p>
          </div>
          <ThemeToggle
            theme={theme}
            onToggle={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
          />
        </div>

        <div
          className="mt-4 grid grid-cols-3 gap-2"
          role="group"
          aria-label="Difficulty"
        >
          {DIFFICULTY_ORDER.map((d) => {
            const active = d === difficulty;
            return (
              <button
                key={d}
                type="button"
                onClick={() => changeDifficulty(d)}
                aria-pressed={active}
                className={`cursor-pointer touch-manipulation rounded-2xl border px-2 py-2.5 text-center select-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
                  active
                    ? "border-transparent bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-md"
                    : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                <span className="block text-sm font-bold">
                  {DIFFICULTIES[d].label}
                </span>
                <span
                  className={`block text-[11px] tabular-nums ${
                    active
                      ? "text-white/85"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {DIFFICULTIES[d].hint}
                </span>
              </button>
            );
          })}
        </div>

        <GameStats
          used={used}
          remaining={remaining}
          max={MAX_ATTEMPTS}
          best={best}
        />

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="guess-input" className="sr-only">
            Your guess, a whole number between 1 and {max}
          </label>
          <input
            ref={inputRef}
            id="guess-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            placeholder="Your guess"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={gameOver}
            autoFocus
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] sm:text-lg dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="submit"
            disabled={gameOver || input.trim() === ""}
            className="cursor-pointer touch-manipulation rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 px-5 py-3.5 font-semibold whitespace-nowrap text-white select-none transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
          >
            Guess
          </button>
        </form>

        {won ? (
          <section
            aria-label="You won"
            className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-5 text-center animate-[pop_0.35s_ease] dark:border-emerald-400/50 dark:bg-emerald-400/10"
          >
            <div className="text-4xl leading-none" aria-hidden="true">
              🏆
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
              Correct! You found the secret number!
            </h2>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200/90">
              Solved in {used} of {MAX_ATTEMPTS}{" "}
              {used === 1 ? "attempt" : "attempts"}
              {best !== null && ` · Best (${DIFFICULTIES[difficulty].label}): ${best}`}
            </p>
            <button
              type="button"
              onClick={() => newGame(difficulty)}
              className={`${primaryButton} mt-4`}
            >
              Play again
            </button>
          </section>
        ) : lost ? (
          <section
            aria-label="Out of attempts"
            className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-5 text-center dark:border-rose-400/40 dark:bg-rose-400/10"
          >
            <div className="text-4xl leading-none" aria-hidden="true">
              😞
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-rose-900 dark:text-rose-100">
              Out of attempts!
            </h2>
            <p className="mt-1 text-sm text-rose-800 dark:text-rose-200/90">
              The secret number was <b>{secret}</b>. Better luck next time!
            </p>
            <button
              type="button"
              onClick={() => newGame(difficulty)}
              className={`${primaryButton} mt-4`}
            >
              Play again
            </button>
          </section>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 min-h-[52px] rounded-2xl border px-4 py-3 text-center font-semibold transition ${
              result
                ? feedbackStyles[result]
                : "border-slate-200 bg-slate-50 font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
            }`}
          >
            {feedback || "Make your first guess to begin."}
          </div>
        )}

        <GuessHistory history={history} />

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {won
            ? "Nice work! Play again or try a harder difficulty."
            : lost
              ? "No waiting — start a new game any time."
              : "Press Enter to submit. Invalid and repeated guesses are free."}
        </p>
      </main>
    </div>
  );
}
