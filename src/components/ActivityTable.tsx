"use client";

import { formatDuration } from "@/lib/dates";
import type { TimeBreakdown } from "@/types";

interface ActivityTableProps {
  breakdown: TimeBreakdown[];
}

export default function ActivityTable({ breakdown }: ActivityTableProps) {
  if (breakdown.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-zinc-400">
        No hay actividades
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        Detalle por Actividad
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-2 font-medium">Actividad</th>
              <th className="px-4 py-2 font-medium text-right">Eventos</th>
              <th className="px-4 py-2 font-medium text-right">Tiempo</th>
              <th className="px-4 py-2 font-medium text-right">%</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">
                Distribución
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr
                key={item.category}
                className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-zinc-800 dark:text-zinc-200">
                      {item.category}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                  {item.eventCount}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-zinc-800 dark:text-zinc-200">
                  {formatDuration(item.totalMinutes)}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400">
                  {item.percentage}%
                </td>
                <td className="hidden px-4 py-2.5 sm:table-cell">
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
