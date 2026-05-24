"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatDuration } from "@/lib/dates";
import type { DailyBreakdown } from "@/types";

interface DailyChartProps {
  daily: DailyBreakdown[];
}

export default function DailyChart({ daily }: DailyChartProps) {
  if (daily.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Horas por Día
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              label={{
                value: "Horas",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#a1a1aa" },
              }}
            />
            <Tooltip
              formatter={(value) => [formatDuration(Number(value) * 60), "Tiempo"]}
              contentStyle={{
                backgroundColor: "rgba(24,24,27,0.95)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Bar
              dataKey="totalHours"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
