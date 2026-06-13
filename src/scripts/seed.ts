/**
 * Seeds a demo user with categories, rules and ~4 weeks of events so the app
 * can be explored locally without Google OAuth.
 *
 * Run: npm run seed   (loads .env.local)
 * Then set DEV_USER_ID=dev-user in .env.local and `npm run dev`.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendars, categories, events, rules, users } from "@/db/schema";

const USER_ID = "dev-user";
const TZ = "America/Argentina/Buenos_Aires"; // UTC-3, no DST
const CAL_ID = "primary";

// Category definitions (stable ids so re-seeding is idempotent).
const CATS = [
  { id: "cat-trabajo", name: "Trabajo", color: "#3b82f6" },
  { id: "cat-salud", name: "Salud", color: "#22c55e" },
  { id: "cat-social", name: "Social", color: "#f59e0b" },
  { id: "cat-personal", name: "Personal", color: "#a855f7" },
];

// title substring -> category id
const TITLE_TO_CAT: Array<[string, string]> = [
  ["standup", "cat-trabajo"],
  ["project", "cat-trabajo"],
  ["meeting", "cat-trabajo"],
  ["1:1", "cat-trabajo"],
  ["gym", "cat-salud"],
  ["run", "cat-salud"],
  ["lunch", "cat-personal"],
  ["errands", "cat-personal"],
  ["brunch", "cat-social"],
  ["dinner", "cat-social"],
];

function catFor(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [needle, cat] of TITLE_TO_CAT) {
    if (lower.includes(needle)) return cat;
  }
  return null;
}

/** Build a UTC Date from a BA-local day + HH:MM (UTC-3). */
function baTime(day: Date, hour: number, min: number): Date {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(min).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00-03:00`);
}

type Slot = { title: string; sh: number; sm: number; eh: number; em: number };

function slotsForDay(date: Date): Slot[] {
  const dow = date.getDay(); // 0 Sun .. 6 Sat
  const weekday = dow >= 1 && dow <= 5;
  const slots: Slot[] = [];

  if (weekday) {
    slots.push({ title: "Daily standup", sh: 9, sm: 0, eh: 9, em: 15 });
    slots.push({ title: "Project work", sh: 10, sm: 0, eh: 12, em: 0 });
    slots.push({ title: "Lunch", sh: 13, sm: 0, eh: 14, em: 0 });
    slots.push({ title: "Project work", sh: 14, sm: 30, eh: 17, em: 0 });
    if (dow === 2 || dow === 4) {
      slots.push({ title: "1:1 meeting", sh: 17, sm: 0, eh: 17, em: 30 });
    }
    if (dow === 1 || dow === 3 || dow === 5) {
      slots.push({ title: "Gym", sh: 18, sm: 30, eh: 19, em: 30 });
    }
  } else {
    slots.push({ title: "Morning run", sh: 9, sm: 0, eh: 10, em: 0 });
    slots.push({ title: "Errands", sh: 11, sm: 0, eh: 12, em: 30 });
    if (dow === 6) {
      slots.push({ title: "Brunch con amigos", sh: 12, sm: 30, eh: 14, em: 30 });
      slots.push({ title: "Dinner out", sh: 21, sm: 0, eh: 23, em: 0 });
    } else {
      slots.push({ title: "Family lunch", sh: 13, sm: 0, eh: 15, em: 0 });
    }
  }
  return slots;
}

async function main() {
  console.log("Seeding demo user…");

  // Reset (cascades to dependent rows).
  await db.delete(users).where(eq(users.id, USER_ID));

  await db.insert(users).values({
    id: USER_ID,
    name: "Dev User",
    email: "dev@local",
    timezone: TZ,
  });

  await db.insert(categories).values(
    CATS.map((c) => ({ id: c.id, userId: USER_ID, name: c.name, color: c.color })),
  );

  await db.insert(rules).values([
    { userId: USER_ID, matchType: "title_contains", pattern: "standup", categoryId: "cat-trabajo", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "project", categoryId: "cat-trabajo", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "meeting", categoryId: "cat-trabajo", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "gym", categoryId: "cat-salud", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "run", categoryId: "cat-salud", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "brunch", categoryId: "cat-social", priority: 10 },
    { userId: USER_ID, matchType: "title_contains", pattern: "dinner", categoryId: "cat-social", priority: 10 },
  ]);

  const [cal] = await db
    .insert(calendars)
    .values({
      userId: USER_ID,
      googleCalendarId: CAL_ID,
      summary: "Demo calendar",
      timezone: TZ,
      selected: true,
    })
    .returning({ id: calendars.id });

  // Last 28 days of events.
  const rows: (typeof events.$inferInsert)[] = [];
  const today = new Date();
  for (let i = 0; i < 28; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    for (const s of slotsForDay(day)) {
      const start = baTime(day, s.sh, s.sm);
      const end = baTime(day, s.eh, s.em);
      const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
      const categoryId = catFor(s.title);
      rows.push({
        userId: USER_ID,
        calendarId: cal.id,
        googleEventId: `seed-${i}-${s.title}-${s.sh}${s.sm}`.replace(/\s/g, "_"),
        title: s.title,
        startUtc: start,
        endUtc: end,
        durationMin,
        status: "confirmed",
        categoryId,
        categorySource: categoryId ? "rule" : null,
      });
    }
  }

  await db.insert(events).values(rows);

  console.log(
    `Done: user=${USER_ID}, ${CATS.length} categories, ${rows.length} events over 28 days.`,
  );
  console.log("Set DEV_USER_ID=dev-user in .env.local, then `npm run dev`.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
