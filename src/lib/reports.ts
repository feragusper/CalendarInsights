import "server-only";
import { and, gte, lt, eq, gt, sql } from "drizzle-orm";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { db } from "@/db";
import { calendars, categories, events } from "@/db/schema";

export const PERIODS = ["week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  week: "Semana",
  month: "Mes",
  year: "Año",
  all: "Histórico",
};

export type CategorySlice = {
  key: string;
  name: string;
  color: string;
  minutes: number;
  /** true when this slice is an uncategorized group (by source calendar). */
  uncategorized: boolean;
};

export type RangeReport = {
  period: Period;
  startUtc: Date | null;
  endUtc: Date;
  timezone: string;
  totalMinutes: number;
  slices: CategorySlice[];
};

// Stable palette for uncategorized calendar groups.
const CAL_PALETTE = [
  "#64748b", "#0ea5e9", "#14b8a6", "#84cc16", "#eab308",
  "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#6366f1",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return CAL_PALETTE[Math.abs(h) % CAL_PALETTE.length];
}

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "week";
}

export function periodBounds(
  period: Period,
  timezone: string,
  ref: Date = new Date(),
): { startUtc: Date | null; endUtc: Date } {
  const local = toZonedTime(ref, timezone);
  switch (period) {
    case "week":
      return {
        startUtc: fromZonedTime(startOfWeek(local, { weekStartsOn: 1 }), timezone),
        endUtc: fromZonedTime(endOfWeek(local, { weekStartsOn: 1 }), timezone),
      };
    case "month":
      return {
        startUtc: fromZonedTime(startOfMonth(local), timezone),
        endUtc: fromZonedTime(endOfMonth(local), timezone),
      };
    case "year":
      return {
        startUtc: fromZonedTime(startOfYear(local), timezone),
        endUtc: fromZonedTime(endOfYear(local), timezone),
      };
    case "all":
      return { startUtc: null, endUtc: ref };
  }
}

/**
 * Time spent per category within a period. All-day events (holidays,
 * birthdays, all-day recurring tasks) are excluded — they aren't "time spent".
 * Events without a category are grouped by their source calendar instead of a
 * single "uncategorized" blob, so the breakdown is useful before any rules.
 */
export async function getRangeReport(
  userId: string,
  timezone: string,
  period: Period,
  ref: Date = new Date(),
): Promise<RangeReport> {
  const { startUtc, endUtc } = periodBounds(period, timezone, ref);

  const conditions = [
    eq(events.userId, userId),
    gt(events.durationMin, 0),
    // Exclude all-day events: Google sets `start.date` (not `start.dateTime`).
    sql`(${events.raw} -> 'start' ->> 'date') is null`,
    lt(events.startUtc, endUtc),
  ];
  if (startUtc) conditions.push(gte(events.startUtc, startUtc));

  const rows = await db
    .select({
      categoryId: events.categoryId,
      catName: categories.name,
      catColor: categories.color,
      calendarId: events.calendarId,
      calName: calendars.summary,
      durationMin: events.durationMin,
    })
    .from(events)
    .innerJoin(calendars, eq(events.calendarId, calendars.id))
    .leftJoin(categories, eq(events.categoryId, categories.id))
    .where(and(...conditions));

  const byKey = new Map<string, CategorySlice>();
  let totalMinutes = 0;

  for (const row of rows) {
    const minutes = row.durationMin ?? 0;
    if (minutes <= 0) continue;
    totalMinutes += minutes;

    const categorized = row.categoryId != null;
    const key = categorized ? `cat:${row.categoryId}` : `cal:${row.calendarId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.minutes += minutes;
    } else {
      byKey.set(key, {
        key,
        name: categorized
          ? (row.catName ?? "Categoría")
          : (row.calName ?? "Sin calendario"),
        color: categorized
          ? (row.catColor ?? "#888888")
          : colorFor(row.calendarId),
        minutes,
        uncategorized: !categorized,
      });
    }
  }

  const slices = [...byKey.values()].sort((a, b) => b.minutes - a.minutes);
  return { period, startUtc, endUtc, timezone, totalMinutes, slices };
}
