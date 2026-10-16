import { useMemo } from "react";

const COLORS = [
  "#7c5cff",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
  "#f472b6",
];

/** Lightweight CSS-only confetti. No dependencies, pointer-transparent. */
export default function Confetti({ count = 70 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 97.3 + 13) % 100,
        delay: ((i * 137) % 900) / 1000,
        duration: 2.4 + ((i * 53) % 1200) / 1000,
        size: 6 + ((i * 29) % 7),
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
        drift: ((i * 41) % 120) - 60,
      })),
    [count],
  );

  return (
    <div
      aria-hidden="true"
      className="confetti pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : 2,
            "--drift": `${p.drift}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
          className="confetti-piece absolute -top-4"
        />
      ))}
    </div>
  );
}
