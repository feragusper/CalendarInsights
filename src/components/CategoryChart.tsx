"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { formatDuration } from "@/lib/dates";
import type { TimeBreakdown } from "@/types";

interface CategoryChartProps {
  breakdown: TimeBreakdown[];
}

export default function CategoryChart({ breakdown }: CategoryChartProps) {
  const top10 = breakdown.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Distribución por Actividad
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={top10}
              dataKey="totalMinutes"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              paddingAngle={2}
              label={(props: PieLabelRenderProps) => {
                const name = String(props.name ?? "");
                const pct = typeof props.percent === "number"
                  ? (props.percent * 100).toFixed(1)
                  : "";
                return `${name.length > 15 ? name.slice(0, 13) + "…" : name} (${pct}%)`;
              }}
              labelLine={true}
            >
              {top10.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatDuration(Number(value))}
              contentStyle={{
                backgroundColor: "rgba(24,24,27,0.95)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend
              formatter={(value: string) =>
                value.length > 25 ? value.slice(0, 23) + "…" : value
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
