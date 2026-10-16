const cardClass =
  "min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center sm:px-4 dark:border-white/10 dark:bg-white/[0.04]";

const labelClass =
  "block truncate text-[9px] font-medium uppercase tracking-wider text-slate-500 sm:text-[11px] sm:tracking-widest dark:text-slate-400";

const valueClass = "mt-1 block text-lg tabular-nums sm:text-xl";

export default function GameStats({ used, max, best }) {
  return (
    <div
      className="my-5 grid grid-cols-2 gap-2 sm:gap-3"
      aria-label="Game statistics"
    >
      <div className={cardClass}>
        <span className={labelClass}>Used</span>
        <strong className={`${valueClass} text-slate-900 dark:text-slate-100`}>
          {used}/{max}
        </strong>
      </div>
      <div className={cardClass}>
        <span className={labelClass}>Best score</span>
        <strong className={`${valueClass} text-slate-900 dark:text-slate-100`}>
          {best ?? "—"}
        </strong>
      </div>
    </div>
  );
}
