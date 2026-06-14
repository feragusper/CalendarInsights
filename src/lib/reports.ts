import "server-only";
import { and, gte, lt, eq, gt, sql, notInArray } from "drizzle-orm";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { db } from "@/db";
import { calendars, categories, events, ignoredTitles } from "@/db/schema";
import { computeManualMinutes } from "@/lib/manual";

export const PERIODS = ["week", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  week: "Semana",
  month: "Mes",
  year: "Año",
  all: "Histórico",
};

export const GROUPINGS = ["category", "title"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const GROUPING_LABELS: Record<Grouping, string> = {
  category: "Categoría",
  title: "Actividad",
};

// Cap slices so the chart/legend stay readable; the tail becomes "Otros".
const MAX_SLICES = 12;
const OTHERS_COLOR = "#cbd5e1";

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
  grouping: Grouping;
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

export function parseGrouping(value: string | undefined): Grouping {
  return GROUPINGS.includes(value as Grouping)
    ? (value as Grouping)
    : "category";
}

/** Sort by time desc and collapse the long tail into a single "Otros" slice. */
function capSlices(slices: CategorySlice[]): CategorySlice[] {
  const sorted = [...slices].sort((a, b) => b.minutes - a.minutes);
  if (sorted.length <= MAX_SLICES) return sorted;

  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);
  const otherMinutes = tail.reduce((s, x) => s + x.minutes, 0);
  if (otherMinutes > 0) {
    head.push({
      key: "__others__",
      name: `Otros (${tail.length})`,
      color: OTHERS_COLOR,
      minutes: otherMinutes,
      uncategorized: false,
    });
  }
  return head;
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
  options: { ignoreAllDay?: boolean; grouping?: Grouping } = {},
): Promise<RangeReport> {
  const { ignoreAllDay = true, grouping = "category" } = options;
  const { startUtc, endUtc } = periodBounds(period, timezone, ref);

  const conditions = [
    eq(events.userId, userId),
    gt(events.durationMin, 0),
    // Only include events from calendars the user has enabled.
    eq(calendars.selected, true),
    lt(events.startUtc, endUtc),
  ];
  if (ignoreAllDay) {
    // All-day events: Google sets `start.date` (not `start.dateTime`).
    conditions.push(sql`(${events.raw} -> 'start' ->> 'date') is null`);
  }
  if (startUtc) conditions.push(gte(events.startUtc, startUtc));

  // Exclude user-ignored event titles (case-insensitive): exact + contains.
  const ignored = await db
    .select({ title: ignoredTitles.title, matchType: ignoredTitles.matchType })
    .from(ignoredTitles)
    .where(eq(ignoredTitles.userId, userId));
  const exact = ignored.filter((i) => i.matchType !== "contains");
  const contains = ignored.filter((i) => i.matchType === "contains");
  if (exact.length > 0) {
    conditions.push(
      notInArray(
        sql`lower(coalesce(${events.title}, ''))`,
        exact.map((i) => i.title),
      ),
    );
  }
  for (const c of contains) {
    conditions.push(
      sql`lower(coalesce(${events.title}, '')) not like ${"%" + c.title + "%"}`,
    );
  }

  const rows = await db
    .select({
      categoryId: events.categoryId,
      catName: categories.name,
      catColor: categories.color,
      calendarId: events.calendarId,
      calName: calendars.summary,
      title: events.title,
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

    let key: string;
    let name: string;
    let color: string;
    let uncategorized = false;

    if (grouping === "title") {
      const title = row.title?.trim() || "Sin título";
      key = `title:${title.toLowerCase()}`;
      name = title;
      color = colorFor(key);
    } else {
      const categorized = row.categoryId != null;
      key = categorized ? `cat:${row.categoryId}` : `cal:${row.calendarId}`;
      name = categorized
        ? (row.catName ?? "Categoría")
        : (row.calName ?? "Sin calendario");
      color = categorized ? (row.catColor ?? "#888888") : colorFor(row.calendarId);
      uncategorized = !categorized;
    }

    const existing = byKey.get(key);
    if (existing) {
      existing.minutes += minutes;
    } else {
      byKey.set(key, { key, name, color, minutes, uncategorized });
    }
  }

  // Add manual blocks (sleep, unscheduled work, …) as time not on the calendar.
  const manual = await computeManualMinutes(userId, timezone, startUtc, endUtc);
  for (const m of manual) {
    if (m.minutes <= 0) continue;
    totalMinutes += m.minutes;
    // Merge into the category slice when grouping by category; otherwise show
    // the block as its own activity-like slice.
    const key = grouping === "category" ? `cat:${m.categoryId}` : `manual:${m.categoryId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.minutes += m.minutes;
    } else {
      byKey.set(key, {
        key,
        name: m.name,
        color: m.color,
        minutes: m.minutes,
        uncategorized: false,
      });
    }
  }

  const slices = capSlices([...byKey.values()]);
  return { period, grouping, startUtc, endUtc, timezone, totalMinutes, slices };
}

export type Mover = {
  key: string;
  name: string;
  color: string;
  currentMin: number;
  prevMin: number;
  deltaMin: number;
};

export type Insights = {
  hasComparison: boolean;
  currentTotal: number;
  prevTotal: number;
  movers: Mover[];
};

/** Reference date for the period immediately before `ref`. */
function previousRef(period: Period, ref: Date): Date | null {
  switch (period) {
    case "week":
      return subDays(ref, 7);
    case "month":
      return subMonths(ref, 1);
    case "year":
      return subYears(ref, 1);
    case "all":
      return null;
  }
}

/**
 * Compares the current period against the previous equivalent one and returns
 * the activities/categories that moved the most. No comparison for "all".
 */
export async function getInsights(
  userId: string,
  timezone: string,
  period: Period,
  ref: Date = new Date(),
  options: { ignoreAllDay?: boolean; grouping?: Grouping } = {},
): Promise<Insights> {
  const prev = previousRef(period, ref);
  if (!prev) {
    return { hasComparison: false, currentTotal: 0, prevTotal: 0, movers: [] };
  }

  const [cur, before] = await Promise.all([
    getRangeReport(userId, timezone, period, ref, options),
    getRangeReport(userId, timezone, period, prev, options),
  ]);

  const merged = new Map<string, Mover>();
  for (const s of cur.slices) {
    if (s.key === "__others__") continue;
    merged.set(s.key, {
      key: s.key,
      name: s.name,
      color: s.color,
      currentMin: s.minutes,
      prevMin: 0,
      deltaMin: s.minutes,
    });
  }
  for (const s of before.slices) {
    if (s.key === "__others__") continue;
    const m = merged.get(s.key);
    if (m) {
      m.prevMin = s.minutes;
      m.deltaMin = m.currentMin - s.minutes;
    } else {
      merged.set(s.key, {
        key: s.key,
        name: s.name,
        color: s.color,
        currentMin: 0,
        prevMin: s.minutes,
        deltaMin: -s.minutes,
      });
    }
  }

  const movers = [...merged.values()]
    .filter((m) => m.deltaMin !== 0)
    .sort((a, b) => Math.abs(b.deltaMin) - Math.abs(a.deltaMin))
    .slice(0, 6);

  return {
    hasComparison: true,
    currentTotal: cur.totalMinutes,
    prevTotal: before.totalMinutes,
    movers,
  };
}
