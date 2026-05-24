import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  format,
} from "date-fns";
import type { DateRange } from "@/types";

export function getDateRange(
  range: DateRange,
  offset = 0
): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  let label: string;

  switch (range) {
    case "day": {
      const target = subDays(now, -offset);
      start = startOfDay(target);
      end = endOfDay(target);
      label = format(target, "EEEE, d 'de' MMMM yyyy");
      break;
    }
    case "week": {
      const target = subWeeks(now, -offset);
      start = startOfWeek(target, { weekStartsOn: 1 });
      end = endOfWeek(target, { weekStartsOn: 1 });
      label = `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
      break;
    }
    case "month": {
      const target = subMonths(now, -offset);
      start = startOfMonth(target);
      end = endOfMonth(target);
      label = format(target, "MMMM yyyy");
      break;
    }
    case "year": {
      const target = new Date(now.getFullYear() + offset, 0, 1);
      start = startOfYear(target);
      end = endOfYear(target);
      label = format(target, "yyyy");
      break;
    }
    default: {
      start = startOfDay(now);
      end = endOfDay(now);
      label = format(now, "d MMMM yyyy");
    }
  }

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    label,
  };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
