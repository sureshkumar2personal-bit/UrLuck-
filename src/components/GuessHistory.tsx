import type { GuessEntry, GuessResult } from "../lib/game";

interface Props {
  history: GuessEntry[];
}

const chipStyles: Record<GuessResult, string> = {
  low: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-transparent dark:text-sky-300",
  high: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-transparent dark:text-rose-300",
  win: "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-transparent dark:text-emerald-300",
};

const marker: Record<GuessResult, string> = {
  low: " ▲ too low",
  high: " ▼ too high",
  win: " ✓",
};

export default function GuessHistory({ history }: Props) {
  if (history.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
        Your guesses
      </p>
      <div className="flex flex-wrap gap-2">
        {history.map((entry, i) => (
          <span
            key={`${entry.value}-${i}`}
            title={
              entry.result === "win"
                ? `${entry.value} — correct!`
                : entry.result === "low"
                  ? `${entry.value} — too low`
                  : `${entry.value} — too high`
            }
            className={`rounded-full border px-3 py-1 text-[13px] tabular-nums ${chipStyles[entry.result]}`}
          >
            {entry.value}
            <span aria-hidden="true">{marker[entry.result]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
