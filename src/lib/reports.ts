import "server-only";
import { and, gte, lt, eq, isNotNull } from "drizzle-orm";
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
import { categories, events } from "@/db/schema";

export const PERIODS = ["week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  week: "Semana",
  month: "Mes",
  year: "Año",
  all: "Histórico",
};

export type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string;
  minutes: number;
};

export type RangeReport = {
  period: Period;
  startUtc: Date | null;
  endUtc: Date;
  timezone: string;
  totalMinutes: number;
  slices: CategorySlice[];
};

const UNCATEGORIZED = { name: "Sin categoría", color: "#9ca3af" };

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "week";
}

/**
 * Computes [start, end) UTC bounds for a period, anchored in the user's
 * timezone. `start` is null for "all" (no lower bound).
 */
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

/** Time spent per category for events starting within the given period. */
export async function getRangeReport(
  userId: string,
  timezone: string,
  period: Period,
  ref: Date = new Date(),
): Promise<RangeReport> {
  const { startUtc, endUtc } = periodBounds(period, timezone, ref);

  const conditions = [
    eq(events.userId, userId),
    isNotNull(events.startUtc),
    lt(events.startUtc, endUtc),
  ];
  if (startUtc) conditions.push(gte(events.startUtc, startUtc));

  const rows = await db
    .select({
      categoryId: events.categoryId,
      name: categories.name,
      color: categories.color,
      durationMin: events.durationMin,
    })
    .from(events)
    .leftJoin(categories, eq(events.categoryId, categories.id))
    .where(and(...conditions));

  const byCategory = new Map<string, CategorySlice>();
  let totalMinutes = 0;

  for (const row of rows) {
    const minutes = row.durationMin ?? 0;
    if (minutes <= 0) continue;
    totalMinutes += minutes;

    const key = row.categoryId ?? "__none__";
    const existing = byCategory.get(key);
    if (existing) {
      existing.minutes += minutes;
    } else {
      byCategory.set(key, {
        categoryId: row.categoryId,
        name: row.name ?? UNCATEGORIZED.name,
        color: row.color ?? UNCATEGORIZED.color,
        minutes,
      });
    }
  }

  const slices = [...byCategory.values()].sort((a, b) => b.minutes - a.minutes);

  return { period, startUtc, endUtc, timezone, totalMinutes, slices };
}
