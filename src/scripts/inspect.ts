/** Read-only inspection of synced data. Run: npx tsx --env-file=.env.local src/scripts/inspect.ts */
import { sql, eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { calendars, events, users } from "@/db/schema";

async function main() {
  const us = await db.select({ id: users.id, email: users.email, tz: users.timezone }).from(users);
  console.log("USERS:", us);

  for (const u of us) {
    if (u.id === "dev-user") continue;
    console.log(`\n=== user ${u.email} (${u.id}) tz=${u.tz} ===`);

    const cals = await db
      .select({ id: calendars.id, gid: calendars.googleCalendarId, sum: calendars.summary, tz: calendars.timezone })
      .from(calendars)
      .where(eq(calendars.userId, u.id));
    console.log(`calendars: ${cals.length}`);

    const [tot] = await db
      .select({ n: sql<number>`count(*)`, mins: sql<number>`coalesce(sum(${events.durationMin}),0)` })
      .from(events)
      .where(eq(events.userId, u.id));
    console.log(`events total=${tot.n} sumMin=${tot.mins} (~${Math.round(Number(tot.mins) / 60)}h)`);

    // all-day = duration multiple of 1440 (24h)
    const [allday] = await db
      .select({ n: sql<number>`count(*)`, mins: sql<number>`coalesce(sum(${events.durationMin}),0)` })
      .from(events)
      .where(and(eq(events.userId, u.id), isNotNull(events.durationMin), sql`${events.durationMin} % 1440 = 0`, sql`${events.durationMin} >= 1440`));
    console.log(`all-day-ish (dur%1440=0,>=1440): n=${allday.n} mins=${allday.mins} (~${Math.round(Number(allday.mins) / 60)}h)`);

    // per calendar
    const perCal = await db
      .select({ cid: events.calendarId, n: sql<number>`count(*)`, mins: sql<number>`coalesce(sum(${events.durationMin}),0)` })
      .from(events)
      .where(eq(events.userId, u.id))
      .groupBy(events.calendarId);
    const calMap = new Map(cals.map((c) => [c.id, c.sum ?? c.gid]));
    console.log("per calendar:");
    for (const r of perCal.sort((a, b) => Number(b.mins) - Number(a.mins))) {
      console.log(`  ${calMap.get(r.cid)}: n=${r.n} ~${Math.round(Number(r.mins) / 60)}h`);
    }

    // duration histogram buckets
    const buckets = await db
      .select({
        b: sql<string>`case
          when ${events.durationMin} is null then 'null'
          when ${events.durationMin} <= 0 then '<=0'
          when ${events.durationMin} <= 30 then '1-30m'
          when ${events.durationMin} <= 60 then '31-60m'
          when ${events.durationMin} <= 240 then '1-4h'
          when ${events.durationMin} < 1440 then '4-24h'
          when ${events.durationMin} = 1440 then '=24h'
          else '>24h' end`,
        n: sql<number>`count(*)`,
      })
      .from(events)
      .where(eq(events.userId, u.id))
      .groupBy(sql`1`);
    console.log("duration buckets:", buckets);

    // top titles by count
    const titles = await db
      .select({ t: events.title, n: sql<number>`count(*)`, mins: sql<number>`coalesce(sum(${events.durationMin}),0)` })
      .from(events)
      .where(eq(events.userId, u.id))
      .groupBy(events.title)
      .orderBy(sql`count(*) desc`)
      .limit(20);
    console.log("top 20 titles:");
    for (const r of titles) console.log(`  ${r.n}x ~${Math.round(Number(r.mins) / 60)}h  ${r.t}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
