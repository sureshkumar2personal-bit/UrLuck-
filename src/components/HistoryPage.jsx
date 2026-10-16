import { loadHistory } from "../lib/game";

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage({ onBack, onPlayAgain }) {
  const history = loadHistory();

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="text-4xl mb-3" aria-hidden="true">
          📭
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          No games yet
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Play a game and your results will appear here.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10"
        >
          ← Back to game
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Game History
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10"
        >
          ← Back to game
        </button>
      </div>

      <div className="space-y-2">
        {history.map((game) => {
          const won = game.guesses.some((g) => g.result === "win");
          const failedGuesses = game.guesses.filter(
            (g) => g.result !== "win"
          );
          return (
            <div
              key={game.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(game.date)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {game.difficulty} &bull; 1 - {game.max}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    won
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200"
                  }`}
                >
                  {won ? "Won" : "Lost"}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-2 text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Secret:{" "}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {game.secret}
                  </span>
                </span>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Attempts:{" "}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {game.attempts}
                  </span>
                </span>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Failed:{" "}
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {failedGuesses.length}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {game.guesses.slice().reverse().map((g, i) => {
                  const attemptNum = game.guesses.length - i;
                  const isWin = g.result === "win";
                  return (
                    <span
                      key={`${game.id}-${i}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${
                        isWin
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-400/15 dark:text-emerald-100"
                          : g.result === "low"
                            ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100"
                            : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100"
                      }`}
                    >
                      {attemptNum}. {g.value}{g.result === "win" ? " ✓" : ""}
                    </span>
                  );
                })}
              </div>

              {!won && (
                <button
                  type="button"
                  onClick={() => onPlayAgain(game.difficulty)}
                  className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium"
                >
                  Play again on {game.difficulty}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
