"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RangeReport } from "@/lib/reports";

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ReportView({ report }: { report: RangeReport }) {
  const { slices, totalMinutes, startUtc, endUtc, timezone } = report;

  const fmt = new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
  const range = startUtc
    ? `${fmt.format(startUtc)} – ${fmt.format(endUtc)}`
    : `Hasta ${fmt.format(endUtc)}`;

  if (slices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        <p>No hay eventos en este período ({range}).</p>
        <p className="mt-1 text-sm">
          Tocá <strong>Sincronizar</strong> para traer tu Google Calendar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm text-zinc-500">{range}</span>
        <span className="text-sm font-medium">
          Total: {formatHours(totalMinutes)}
        </span>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="minutes"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {slices.map((s) => (
                  <Cell key={s.categoryId ?? "none"} fill={s.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatHours(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex flex-col justify-center gap-2">
          {slices.map((s) => {
            const pct =
              totalMinutes > 0
                ? Math.round((s.minutes / totalMinutes) * 100)
                : 0;
            return (
              <li
                key={s.categoryId ?? "none"}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1">{s.name}</span>
                <span className="tabular-nums text-zinc-500">
                  {formatHours(s.minutes)} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
