"use client";

import { Clock, Calendar, BarChart3, TrendingUp } from "lucide-react";
import { formatDuration } from "@/lib/dates";
import type { TimeBreakdown } from "@/types";

interface StatsCardsProps {
  totalMinutes: number;
  eventCount: number;
  breakdown: TimeBreakdown[];
  dailyCount: number;
}

export default function StatsCards({
  totalMinutes,
  eventCount,
  breakdown,
  dailyCount,
}: StatsCardsProps) {
  const avgPerDay = dailyCount > 0 ? totalMinutes / dailyCount : 0;
  const topCategory = breakdown[0]?.category ?? "—";

  const stats = [
    {
      label: "Tiempo Total",
      value: formatDuration(totalMinutes),
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Eventos",
      value: String(eventCount),
      icon: Calendar,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Promedio/Día",
      value: formatDuration(avgPerDay),
      icon: TrendingUp,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
    {
      label: "Top Actividad",
      value: topCategory.length > 20 ? topCategory.slice(0, 18) + "…" : topCategory,
      icon: BarChart3,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <div className={`rounded-lg p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stat.value}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
