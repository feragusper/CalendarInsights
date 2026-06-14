import type { Insights } from "@/lib/reports";
import { formatDuration } from "@/lib/format";

function pctChange(current: number, prev: number): string | null {
  if (prev === 0) return current > 0 ? "nuevo" : null;
  const pct = Math.round(((current - prev) / prev) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function InsightsView({ insights }: { insights: Insights }) {
  if (!insights.hasComparison || insights.movers.length === 0) return null;

  const totalPct = pctChange(insights.currentTotal, insights.prevTotal);

  return (
    <section className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Cambios vs período anterior</h2>
        {totalPct && (
          <span className="text-sm text-zinc-500">
            Total {formatDuration(insights.currentTotal)} ({totalPct})
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {insights.movers.map((m) => {
          const up = m.deltaMin > 0;
          const pct = pctChange(m.currentMin, m.prevMin);
          return (
            <li
              key={m.key}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs dark:border-zinc-700"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="max-w-[10rem] truncate">{m.name}</span>
              <span className={up ? "text-emerald-500" : "text-red-500"}>
                {up ? "▲" : "▼"} {formatDuration(m.deltaMin)}
                {pct && pct !== "nuevo" ? ` · ${pct}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
