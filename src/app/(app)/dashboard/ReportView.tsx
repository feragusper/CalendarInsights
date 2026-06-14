"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RangeReport } from "@/lib/reports";
import { ignoreTitle } from "@/app/lib/actions";
import { formatDuration } from "@/lib/format";

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

  const hasUncategorized = slices.some((s) => s.uncategorized);
  const canIgnore = report.grouping === "title";

  if (slices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
        <p>No hay eventos con horario en este período ({range}).</p>
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
          Total: {formatDuration(totalMinutes)}
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
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatDuration(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex flex-col justify-center gap-2">
          {slices.map((s) => {
            const pct =
              totalMinutes > 0
                ? Math.round((s.minutes / totalMinutes) * 100)
                : 0;
            const ignorable = canIgnore && s.key !== "__others__";
            return (
              <li key={s.key} className="group flex items-center gap-3 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate">
                  {s.name}
                  {s.uncategorized && (
                    <span className="ml-1 text-xs text-zinc-400">
                      (calendario)
                    </span>
                  )}
                </span>
                {ignorable && (
                  <form action={ignoreTitle} className="shrink-0">
                    <input type="hidden" name="title" value={s.name} />
                    <button
                      type="submit"
                      title="Ignorar esta actividad"
                      className="text-zinc-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </form>
                )}
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {formatDuration(s.minutes)} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {hasUncategorized && (
        <p className="mt-6 text-xs text-zinc-400">
          Los ítems marcados <em>(calendario)</em> aún no tienen categoría — se
          agrupan por su calendario de origen. Creá{" "}
          <strong>reglas</strong> para agruparlos como quieras. Los eventos de
          día completo (feriados, cumpleaños) se excluyen.
        </p>
      )}
    </div>
  );
}
