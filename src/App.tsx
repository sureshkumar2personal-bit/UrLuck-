import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Confetti from "./components/Confetti";
import FlyingNumber from "./components/FlyingNumber";
import GameStats from "./components/GameStats";
import GuessHistory from "./components/GuessHistory";
import ThemeToggle from "./components/ThemeToggle";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  LOCK_DURATION_MS,
  MAX_ATTEMPTS,
  clearLockedUntil,
  getInitialTheme,
  loadBestMap,
  loadDifficulty,
  loadLockedUntil,
  parseGuess,
  randomInt,
  saveBestMap,
  saveDifficulty,
  saveLockedUntil,
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

function winTitle(attemptsUsed: number): string {
  switch (attemptsUsed) {
    case 1:
      return "Brilliant! Today is yours — peak guessing! 🔥";
    case 2:
      return "Nice! Today is yours! 🎉";
    case 3:
      return "Good! You got it! 👍";
    case 4:
      return "Smile! You found it! 😊";
    default:
      return "Satisfied! Don't guess anything more today. 😌";
  }
}

function formatLockRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

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
  const [levelOpen, setLevelOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(loadLockedUntil);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const levelWrapRef = useRef<HTMLDivElement>(null);
  const dayWrapRef = useRef<HTMLDivElement>(null);

  const max = DIFFICULTIES[difficulty].max;
  const best = bestMap[difficulty] ?? null;

  const won = result === "win";
  const used = history.length;
  const lost = !won && used >= MAX_ATTEMPTS;
  const gameOver = won || lost;

  // Lives: start full (all red). Each failed guess turns one red -> white.
  // A correct guess restores +1 life (capped at MAX_ATTEMPTS).
  const fails = won ? used - 1 : used;
  const livesRed = Math.max(
    0,
    Math.min(MAX_ATTEMPTS, MAX_ATTEMPTS - fails + (won ? 1 : 0)),
  );

  // Retry lock: 12h after a win or a loss.
  const lockRemainingMs = (lockedUntil ?? 0) - now;
  const isLocked = lockedUntil !== null && lockRemainingMs > 0;

  // Apply + persist theme on <html> (class-based dark mode).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    saveTheme(theme);
  }, [theme]);

  // Close the Level menu on outside click / Escape (click-to-toggle only).
  useEffect(() => {
    if (!levelOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!levelWrapRef.current?.contains(e.target as Node)) {
        setLevelOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLevelOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [levelOpen]);

  // Close the day-mood popup on outside click / Escape.
  useEffect(() => {
    if (!dayOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!dayWrapRef.current?.contains(e.target as Node)) {
        setDayOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDayOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dayOpen]);

  // Tick the countdown while locked.
  useEffect(() => {
    if (!isLocked) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLocked, lockedUntil]);

  // Lock retry for 12h when the game ends (win or 5 failed attempts).
  useEffect(() => {
    if (!gameOver) return;
    if (lockedUntil !== null && lockedUntil > Date.now()) return;
    const until = Date.now() + LOCK_DURATION_MS;
    setLockedUntil(until);
    saveLockedUntil(until);
  }, [gameOver, lockedUntil]);

  function newGame(next: Difficulty) {
    if (isLocked) return;
    clearLockedUntil();
    setLockedUntil(null);
    setSecret(randomInt(DIFFICULTIES[next].max));
    setInput("");
    setHistory([]);
    setFeedback("");
    setResult(null);
    inputRef.current?.focus();
  }

  function changeDifficulty(next: Difficulty) {
    setLevelOpen(false);
    if (isLocked) return;
    if (next === difficulty) return;
    setDifficulty(next);
    saveDifficulty(next);
    newGame(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (gameOver || isLocked) return;

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
      setFeedback(winTitle(attemptsUsed));
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
    <div className="theme-smooth relative flex min-h-dvh w-full overflow-x-clip p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-sans text-slate-900 sm:p-6 dark:text-slate-100">
      {won && <Confetti />}
      {won && <FlyingNumber value={secret} />}

      <div
        aria-hidden="true"
        className="bg3d-stage pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {/* 3D perspective grid floor for depth */}
        <div className="grid-floor" />
        {/* soft ambient glows */}
        <div className="bg-float absolute -top-24 -left-24 h-80 w-80 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20" />
        <div
          className="bg-float absolute top-1/4 -right-28 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-400/15"
          style={{ animationDelay: "-2.5s" }}
        />
        {/* floating 3D cubes */}
        <div className="cube3d-wrap absolute top-[30%] left-[12%]">
          <div className="cube3d">
            <div className="face face-front" />
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
        </div>
        <div
          className="cube3d-wrap cube3d-small absolute right-[10%] bottom-[12%]"
          style={{ animationDelay: "-3s" }}
        >
          <div className="cube3d">
            <div className="face face-front" />
            <div className="face face-back" />
            <div className="face face-right" />
            <div className="face face-left" />
            <div className="face face-top" />
            <div className="face face-bottom" />
          </div>
        </div>
        {/* many floating numbers — one per grid cell so all stay separate */}
        {Array.from({ length: 20 }, (_, i) => {
          const n = ((i * 13 + 7) % 50) + 1;
          const col = i % 5;
          const row = Math.floor(i / 5);
          const left = 2 + col * 19 + ((i * 37) % 9) - 4;
          const top = 3 + row * 21 + ((i * 53) % 7) - 3;
          const size = 16 + ((i * 29) % 25);
          return (
            <span
              key={i}
              className="float-num absolute font-black tabular-nums select-none"
              style={{
                left: `${Math.min(93, Math.max(1, left))}%`,
                top: `${Math.min(88, Math.max(2, top))}%`,
                fontSize: size,
                animationDelay: `${-((i * 1.37) % 8)}s`,
                animationDuration: `${5 + ((i * 47) % 40) / 10}s`,
              }}
            >
              {n}
            </span>
          );
        })}
      </div>

      <main className="relative z-10 m-auto w-full max-w-md animate-[rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both] rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-2xl dark:backdrop-blur-xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-4xl leading-none" aria-hidden="true">
              🎯
            </div>
            <h1 className="mt-3 leading-none">
              <span className="block text-[11px] font-medium tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                Secret Number
              </span>
              <span className="hero-gradient-text mt-1 block text-[25px] leading-tight font-black tracking-tight">
                Yours Ego
              </span>
            </h1>
          </div>
          <ThemeToggle
            theme={theme}
            onToggle={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div ref={levelWrapRef} className="relative min-w-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={levelOpen}
            onClick={() => setLevelOpen((o) => !o)}
            className="inline-flex shrink-0 cursor-pointer touch-manipulation items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-sm whitespace-nowrap select-none transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:bg-white/[0.06] dark:hover:bg-white/10"
          >
            <span>
              <span className="font-medium text-slate-500 dark:text-slate-400">
                Level:{" "}
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {DIFFICULTIES[difficulty].label}
              </span>{" "}
              <span className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
                ({DIFFICULTIES[difficulty].hint})
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`text-xs text-slate-500 transition-transform duration-200 dark:text-slate-400 ${
                levelOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          <div
            role="menu"
            aria-label="Difficulty"
            className={`absolute top-full left-0 z-20 mt-1.5 w-48 origin-top rounded-xl border border-slate-200 bg-white p-1 shadow-lg transition-all duration-150 dark:border-white/10 dark:bg-[#151d33] dark:shadow-2xl ${
              levelOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-1 opacity-0"
            }`}
          >
            {DIFFICULTY_ORDER.map((d) => {
              const active = d === difficulty;
              return (
                <button
                  key={d}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => changeDifficulty(d)}
                  tabIndex={levelOpen ? 0 : -1}
                  className={`flex w-full cursor-pointer touch-manipulation items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left select-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
                    active
                      ? "bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-md"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  <span>
                    <span className="block text-[13px] leading-tight font-bold">
                      {DIFFICULTIES[d].label}
                    </span>
                    <span
                      className={`block whitespace-nowrap text-[11px] tabular-nums ${
                        active
                          ? "text-white/85"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {DIFFICULTIES[d].hint}
                    </span>
                  </span>
                  {active && (
                    <span aria-hidden="true" className="text-sm leading-none">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          </div>

          <div
            aria-label={`Life: ${livesRed} of ${MAX_ATTEMPTS} hearts remaining`}
            title={`${livesRed} of ${MAX_ATTEMPTS} hearts remaining`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 whitespace-nowrap select-none dark:bg-white/[0.06]"
          >
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Life
            </span>
            <span className="flex items-center gap-[1px] text-sm leading-none">
              {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                <span
                  key={`${i}-${i < livesRed ? "red" : "white"}`}
                  aria-hidden="true"
                  className={i >= livesRed ? "animate-[pop_0.35s_ease]" : ""}
                >
                  {i < livesRed ? "❤️" : "🤍"}
                </span>
              ))}
            </span>
          </div>
        </div>

        <GameStats used={used} max={MAX_ATTEMPTS} best={best} />

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
            placeholder={`Your guess (1-${max})`}
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={gameOver || isLocked}
            autoFocus
            className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] sm:text-lg dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="submit"
            disabled={gameOver || isLocked || input.trim() === ""}
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
              {winTitle(used)}
            </h2>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200/90">
              Solved in {used} of {MAX_ATTEMPTS}{" "}
              {used === 1 ? "attempt" : "attempts"}
              {best !== null && ` · Best (${DIFFICULTIES[difficulty].label}): ${best}`}
            </p>
            {isLocked ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className={`${primaryButton} cursor-not-allowed opacity-60`}
                >
                  🔒 Retry in {formatLockRemaining(lockRemainingMs)}
                </button>
                <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200/80">
                  Unlocked — retry after 12 hrs.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => newGame(difficulty)}
                className={`${primaryButton} mt-4`}
              >
                Play again
              </button>
            )}
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
            {isLocked ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className={`${primaryButton} cursor-not-allowed opacity-60`}
                >
                  🔒 Retry in {formatLockRemaining(lockRemainingMs)}
                </button>
                <p className="mt-2 text-xs text-rose-800 dark:text-rose-200/80">
                  Unlocked — retry after 12 hrs.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => newGame(difficulty)}
                className={`${primaryButton} mt-4`}
              >
                Play again
              </button>
            )}
          </section>
        ) : isLocked ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 min-h-[52px] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
          >
            🔒 Locked. Retry in {formatLockRemaining(lockRemainingMs)} —
            unlocked after 12 hrs.
          </div>
        ) : (
          <>
            {!gameOver && history.length === MAX_ATTEMPTS - 1 && (
              <div
                role="status"
                aria-live="assertive"
                className={`mt-4 rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${feedbackStyles["error"]}`}
              >
                ⚠️ Last attempt — choose carefully!
              </div>
            )}
            <div
              role="status"
              aria-live="polite"
              className={`mt-4 rounded-2xl border px-4 py-3 text-center font-semibold transition ${
                result
                  ? `min-h-[52px] ${feedbackStyles[result]}`
                  : "border-slate-200 bg-slate-50 font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
              }`}
            >
              {feedback || "Make your first guess to begin."}
            </div>
          </>
        )}

        <GuessHistory history={history} />

        <div ref={dayWrapRef} className="relative mt-6">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>!you can test how is your&apos;s day</span>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={dayOpen}
              onClick={() => setDayOpen((o) => !o)}
              className="inline-flex h-6 w-6 cursor-pointer touch-manipulation items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Show how your day goes by attempts"
            >
              <span
                aria-hidden="true"
                className={`text-sm font-bold transition-transform duration-200 ${
                  dayOpen ? "rotate-90 text-violet-500" : ""
                }`}
              >
                →
              </span>
            </button>
          </div>

          <div
            role="dialog"
            aria-label="How your day goes by attempts"
            className={`absolute bottom-full left-1/2 z-30 mb-3 w-72 -translate-x-1/2 origin-bottom rounded-2xl border border-slate-200/70 bg-white/85 p-4 text-xs shadow-2xl backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-[#131a2e]/90 dark:shadow-[0_24px_70px_-18px_rgba(0,0,0,0.65)] ${
              dayOpen
                ? "visible translate-y-0 scale-100 opacity-100"
                : "invisible translate-y-2 scale-95 opacity-0 pointer-events-none"
            }`}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-sm text-white shadow-md shadow-violet-500/30">
                📅
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                  Your day by attempts
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  What each attempt count really means
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {[
                {
                  n: 1,
                  emoji: "🔥",
                  title: "1st attempt",
                  desc: "Guess everything — peak confidence",
                  tone: "from-emerald-500 to-teal-500",
                },
                {
                  n: 2,
                  emoji: "🎉",
                  title: "2nd attempt",
                  desc: "Very nice — strong read on it",
                  tone: "from-sky-500 to-indigo-500",
                },
                {
                  n: 3,
                  emoji: "✨",
                  title: "3rd attempt",
                  desc: "Don't get too excited just yet",
                  tone: "from-violet-500 to-fuchsia-500",
                },
                {
                  n: 4,
                  emoji: "😅",
                  title: "4th attempt",
                  desc: "Poor chances — but still alive",
                  tone: "from-amber-500 to-orange-500",
                },
                {
                  n: 5,
                  emoji: "👀",
                  title: "5th attempt",
                  desc: "Don't guess — just see what happens",
                  tone: "from-rose-500 to-pink-500",
                },
              ].map((item) => (
                <li
                  key={item.n}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-violet-200 hover:bg-violet-50/60 dark:border-white/5 dark:bg-white/[0.04] dark:hover:border-violet-400/30 dark:hover:bg-violet-500/10"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.tone} text-[13px] font-black text-white shadow-sm`}
                  >
                    {item.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      <span aria-hidden="true">{item.emoji}</span>
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
