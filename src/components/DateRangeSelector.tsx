"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DateRange } from "@/types";

const RANGES: { value: DateRange; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

interface DateRangeSelectorProps {
  range: DateRange;
  offset: number;
  label: string;
  onRangeChange: (range: DateRange) => void;
  onOffsetChange: (offset: number) => void;
}

export default function DateRangeSelector({
  range,
  offset,
  label,
  onRangeChange,
  onOffsetChange,
}: DateRangeSelectorProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => {
              onRangeChange(r.value);
              onOffsetChange(0);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.value
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onOffsetChange(offset - 1)}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-[180px] text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        <button
          onClick={() => onOffsetChange(offset + 1)}
          disabled={offset >= 0}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
