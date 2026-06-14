import Link from "next/link";
import { and, eq, gt, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { calendars, categories, events, ignoredTitles, users } from "@/db/schema";
import { computeManualIntervals } from "@/lib/manual";
import { formatDuration } from "@/lib/format";

const HOUR_PX = 44;

type Block = {
  startMin: number;
  endMin: number;
  label: string;
  color: string;
  manual: boolean;
  lane: number;
  lanes: number;
};

// Greedy interval-graph coloring: assign lanes and per-cluster column counts.
function packLanes(
  items: Array<Omit<Block, "lane" | "lanes">>,
): Block[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const result: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length;
    for (const b of cluster) b.lanes = lanes;
    result.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length > 0 && it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMin);
    } else {
      laneEnds[lane] = it.endMin;
    }
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length > 0) flush();
  return result;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { userId } = await verifySession();
  const sp = await searchParams;

  const [user] = await db
    .select({ timezone: users.timezone, ignoreAllDay: users.ignoreAllDay })
    .from(users)
    .where(eq(users.id, userId));
  const tz = user?.timezone ?? "UTC";
  const ignoreAllDay = user?.ignoreAllDay ?? true;

  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "")
    ? (sp.date as string)
    : today;

  // Day bounds in the user's timezone → UTC instants.
  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, tz);
  const baseUtc = new Date(`${dateStr}T00:00:00Z`);
  const nextStr = ymd(new Date(baseUtc.getTime() + 86400000));
  const prevStr = ymd(new Date(baseUtc.getTime() - 86400000));
  const dayEndUtc = fromZonedTime(`${nextStr}T00:00:00`, tz);
  const dayMin = Math.round((dayEndUtc.getTime() - dayStartUtc.getTime()) / 60000);

  // Ignored titles.
  const ignored = await db
    .select({ title: ignoredTitles.title, matchType: ignoredTitles.matchType })
    .from(ignoredTitles)
    .where(eq(ignoredTitles.userId, userId));
  const exact = ignored.filter((i) => i.matchType !== "contains").map((i) => i.title);
  const contains = ignored.filter((i) => i.matchType === "contains");

  const conditions = [
    eq(events.userId, userId),
    eq(calendars.selected, true),
    gt(events.durationMin, 0),
    isNotNull(events.startUtc),
    isNotNull(events.endUtc),
    lt(events.startUtc, dayEndUtc),
    gt(events.endUtc, dayStartUtc),
  ];
  if (ignoreAllDay) {
    conditions.push(sql`(${events.raw} -> 'start' ->> 'date') is null`);
  }
  if (exact.length > 0) {
    conditions.push(notInArray(sql`lower(coalesce(${events.title}, ''))`, exact));
  }
  for (const c of contains) {
    conditions.push(
      sql`lower(coalesce(${events.title}, '')) not like ${"%" + c.title + "%"}`,
    );
  }

  const rows = await db
    .select({
      title: events.title,
      startUtc: events.startUtc,
      endUtc: events.endUtc,
      catColor: categories.color,
      calName: calendars.summary,
    })
    .from(events)
    .innerJoin(calendars, eq(events.calendarId, calendars.id))
    .leftJoin(categories, eq(events.categoryId, categories.id))
    .where(and(...conditions));

  const toMin = (d: Date) =>
    Math.max(
      0,
      Math.min(dayMin, (d.getTime() - dayStartUtc.getTime()) / 60000),
    );

  const rawBlocks: Array<Omit<Block, "lane" | "lanes">> = [];

  for (const r of rows) {
    if (!r.startUtc || !r.endUtc) continue;
    const startMin = toMin(r.startUtc);
    const endMin = toMin(r.endUtc);
    if (endMin <= startMin) continue;
    rawBlocks.push({
      startMin,
      endMin,
      label: r.title ?? r.calName ?? "(sin título)",
      color: r.catColor ?? "#94a3b8",
      manual: false,
    });
  }

  const manual = await computeManualIntervals(userId, tz, dayStartUtc, dayEndUtc);
  for (const m of manual) {
    const startMin = toMin(m.startUtc);
    const endMin = toMin(m.endUtc);
    if (endMin <= startMin) continue;
    rawBlocks.push({
      startMin,
      endMin,
      label: m.name,
      color: m.color,
      manual: true,
    });
  }

  const blocks = packLanes(rawBlocks);
  const hours = Math.round(dayMin / 60);
  const height = hours * HOUR_PX;

  const dayLabel = formatInTimeZone(dayStartUtc, tz, "EEEE d 'de' MMMM yyyy");
  const totalMin = rawBlocks.reduce((s, b) => s + (b.endMin - b.startMin), 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight capitalize">
            {dayLabel}
          </h1>
          <p className="text-sm text-zinc-500">
            {blocks.length} bloques · {formatDuration(totalMin)} · {tz}
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={`/dashboard/day?date=${prevStr}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ←
          </Link>
          <Link
            href="/dashboard/day"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Hoy
          </Link>
          <Link
            href={`/dashboard/day?date=${nextStr}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            →
          </Link>
        </nav>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
          No hay eventos con horario este día.
        </div>
      ) : (
        <div className="relative" style={{ height }}>
          {/* Hour gridlines */}
          {Array.from({ length: hours + 1 }, (_, h) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: h * HOUR_PX }}
            >
              <span className="w-12 shrink-0 -translate-y-2 text-right text-xs text-zinc-400">
                {String(h).padStart(2, "0")}:00
              </span>
              <span className="ml-2 h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}

          {/* Blocks */}
          <div className="absolute inset-y-0 left-14 right-0">
            {blocks.map((b, i) => {
              const top = (b.startMin / 60) * HOUR_PX;
              const h = Math.max(16, ((b.endMin - b.startMin) / 60) * HOUR_PX);
              const width = 100 / b.lanes;
              const left = b.lane * width;
              return (
                <div
                  key={i}
                  className="absolute overflow-hidden rounded-md px-2 py-0.5 text-xs text-white"
                  style={{
                    top,
                    height: h - 2,
                    left: `${left}%`,
                    width: `calc(${width}% - 2px)`,
                    backgroundColor: b.color,
                    opacity: b.manual ? 0.7 : 1,
                    border: b.manual ? "1px dashed rgba(255,255,255,.6)" : "none",
                  }}
                  title={b.label}
                >
                  <span className="line-clamp-2 font-medium">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
