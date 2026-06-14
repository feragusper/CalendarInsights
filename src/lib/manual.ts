import "server-only";
import { and, eq, gt, gte, isNotNull, lt, sql } from "drizzle-orm";
import { addDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { db } from "@/db";
import { categories, events, manualBlockTemplates } from "@/db/schema";

// Bound generation so "all" / huge ranges stay cheap.
const MAX_DAYS = 1100;

export type ManualSlice = {
  categoryId: string;
  name: string;
  color: string;
  minutes: number;
};

/** Minutes inside [s, e] not covered by any blocker interval. */
function freeMinutes(s: Date, e: Date, blockers: Array<[Date, Date]>): number {
  const start = s.getTime();
  const end = e.getTime();
  let cursor = start;
  let free = 0;
  const sorted = blockers
    .map(([bs, be]): [number, number] => [
      Math.max(bs.getTime(), start),
      Math.min(be.getTime(), end),
    ])
    .filter(([bs, be]) => be > bs)
    .sort((a, b) => a[0] - b[0]);
  for (const [bs, be] of sorted) {
    if (bs > cursor) free += bs - cursor;
    cursor = Math.max(cursor, be);
  }
  if (cursor < end) free += end - cursor;
  return Math.round(free / 60000);
}

/** Sub-intervals of [s, e] not covered by any blocker. */
function freeIntervals(
  s: Date,
  e: Date,
  blockers: Array<[Date, Date]>,
): Array<[number, number]> {
  const start = s.getTime();
  const end = e.getTime();
  const sorted = blockers
    .map(([bs, be]): [number, number] => [
      Math.max(bs.getTime(), start),
      Math.min(be.getTime(), end),
    ])
    .filter(([bs, be]) => be > bs)
    .sort((a, b) => a[0] - b[0]);
  const res: Array<[number, number]> = [];
  let cursor = start;
  for (const [bs, be] of sorted) {
    if (bs > cursor) res.push([cursor, bs]);
    cursor = Math.max(cursor, be);
  }
  if (cursor < end) res.push([cursor, end]);
  return res;
}

function parseHM(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [h ?? 0, m ?? 0];
}

/**
 * Expands the user's manual block templates (sleep, unscheduled work, etc.)
 * into per-category minutes within [rangeStartUtc, rangeEndUtc], anchored in
 * the user's timezone. `fillGaps` templates only count time not already
 * covered by real calendar events.
 */
export async function computeManualMinutes(
  userId: string,
  tz: string,
  rangeStartUtc: Date | null,
  rangeEndUtc: Date,
): Promise<ManualSlice[]> {
  const templates = await db
    .select({
      categoryId: manualBlockTemplates.categoryId,
      daysOfWeek: manualBlockTemplates.daysOfWeek,
      startTime: manualBlockTemplates.startTime,
      endTime: manualBlockTemplates.endTime,
      fillGaps: manualBlockTemplates.fillGaps,
      catName: categories.name,
      catColor: categories.color,
    })
    .from(manualBlockTemplates)
    .innerJoin(categories, eq(manualBlockTemplates.categoryId, categories.id))
    .where(eq(manualBlockTemplates.userId, userId));
  if (templates.length === 0) return [];

  let start = rangeStartUtc ?? addDays(rangeEndUtc, -MAX_DAYS);
  if ((rangeEndUtc.getTime() - start.getTime()) / 86400000 > MAX_DAYS) {
    start = addDays(rangeEndUtc, -MAX_DAYS);
  }

  let realEvents: Array<[Date, Date]> = [];
  if (templates.some((t) => t.fillGaps)) {
    const rows = await db
      .select({ s: events.startUtc, e: events.endUtc })
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          isNotNull(events.startUtc),
          isNotNull(events.endUtc),
          gt(events.durationMin, 0),
          sql`(${events.raw} -> 'start' ->> 'date') is null`,
          gte(events.endUtc, start),
          lt(events.startUtc, rangeEndUtc),
        ),
      );
    realEvents = rows
      .filter((r) => r.s && r.e)
      .map((r) => [r.s as Date, r.e as Date]);
  }

  const byCat = new Map<string, ManualSlice>();

  const localStart = startOfDay(toZonedTime(start, tz));
  const localEnd = toZonedTime(rangeEndUtc, tz);
  const dayCount =
    Math.ceil((localEnd.getTime() - localStart.getTime()) / 86400000) + 1;

  for (let i = 0; i <= dayCount; i++) {
    const day = addDays(localStart, i);
    const dow = day.getDay();
    for (const t of templates) {
      if (!t.daysOfWeek.includes(dow)) continue;

      const [sh, sm] = parseHM(t.startTime);
      const [eh, em] = parseHM(t.endTime);
      const bStartLocal = new Date(day);
      bStartLocal.setHours(sh, sm, 0, 0);
      const bEndLocal = new Date(day);
      bEndLocal.setHours(eh, em, 0, 0);
      // Overnight block (e.g. 23:00–07:00) ends the next day.
      if (bEndLocal.getTime() <= bStartLocal.getTime()) {
        bEndLocal.setTime(bEndLocal.getTime() + 86400000);
      }

      const bStart = fromZonedTime(bStartLocal, tz);
      const bEnd = fromZonedTime(bEndLocal, tz);
      const s = new Date(Math.max(bStart.getTime(), start.getTime()));
      const e = new Date(Math.min(bEnd.getTime(), rangeEndUtc.getTime()));
      if (e.getTime() <= s.getTime()) continue;

      const minutes = t.fillGaps
        ? freeMinutes(s, e, realEvents)
        : Math.round((e.getTime() - s.getTime()) / 60000);
      if (minutes <= 0) continue;

      const cur = byCat.get(t.categoryId);
      if (cur) cur.minutes += minutes;
      else
        byCat.set(t.categoryId, {
          categoryId: t.categoryId,
          name: t.catName,
          color: t.catColor,
          minutes,
        });
    }
  }

  return [...byCat.values()];
}

export type ManualInterval = {
  startUtc: Date;
  endUtc: Date;
  name: string;
  color: string;
};

/**
 * Like computeManualMinutes but returns concrete intervals (for the daily
 * timeline). Intended for small ranges (a single day).
 */
export async function computeManualIntervals(
  userId: string,
  tz: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
): Promise<ManualInterval[]> {
  const templates = await db
    .select({
      categoryId: manualBlockTemplates.categoryId,
      daysOfWeek: manualBlockTemplates.daysOfWeek,
      startTime: manualBlockTemplates.startTime,
      endTime: manualBlockTemplates.endTime,
      fillGaps: manualBlockTemplates.fillGaps,
      catName: categories.name,
      catColor: categories.color,
    })
    .from(manualBlockTemplates)
    .innerJoin(categories, eq(manualBlockTemplates.categoryId, categories.id))
    .where(eq(manualBlockTemplates.userId, userId));
  if (templates.length === 0) return [];

  let realEvents: Array<[Date, Date]> = [];
  if (templates.some((t) => t.fillGaps)) {
    const rows = await db
      .select({ s: events.startUtc, e: events.endUtc })
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          isNotNull(events.startUtc),
          isNotNull(events.endUtc),
          gt(events.durationMin, 0),
          sql`(${events.raw} -> 'start' ->> 'date') is null`,
          gte(events.endUtc, rangeStartUtc),
          lt(events.startUtc, rangeEndUtc),
        ),
      );
    realEvents = rows
      .filter((r) => r.s && r.e)
      .map((r) => [r.s as Date, r.e as Date]);
  }

  const out: ManualInterval[] = [];
  // Iterate the day before through the day after to catch overnight overlaps.
  const localStart = startOfDay(toZonedTime(rangeStartUtc, tz));
  for (let i = -1; i <= 1; i++) {
    const day = addDays(localStart, i);
    const dow = day.getDay();
    for (const t of templates) {
      if (!t.daysOfWeek.includes(dow)) continue;
      const [sh, sm] = parseHM(t.startTime);
      const [eh, em] = parseHM(t.endTime);
      const bStartLocal = new Date(day);
      bStartLocal.setHours(sh, sm, 0, 0);
      const bEndLocal = new Date(day);
      bEndLocal.setHours(eh, em, 0, 0);
      if (bEndLocal.getTime() <= bStartLocal.getTime()) {
        bEndLocal.setTime(bEndLocal.getTime() + 86400000);
      }
      const bStart = fromZonedTime(bStartLocal, tz);
      const bEnd = fromZonedTime(bEndLocal, tz);
      const s = new Date(Math.max(bStart.getTime(), rangeStartUtc.getTime()));
      const e = new Date(Math.min(bEnd.getTime(), rangeEndUtc.getTime()));
      if (e.getTime() <= s.getTime()) continue;

      const pieces = t.fillGaps
        ? freeIntervals(s, e, realEvents)
        : [[s.getTime(), e.getTime()] as [number, number]];
      for (const [ps, pe] of pieces) {
        if (pe <= ps) continue;
        out.push({
          startUtc: new Date(ps),
          endUtc: new Date(pe),
          name: t.catName,
          color: t.catColor,
        });
      }
    }
  }
  return out;
}
