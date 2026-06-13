import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { calendars, events, users } from "@/db/schema";
import { setCalendarSelected, setIgnoreAllDay } from "@/app/lib/actions";
import { AutoToggle } from "./AutoToggle";

export default async function SettingsPage() {
  const { userId } = await verifySession();

  const [user] = await db
    .select({ ignoreAllDay: users.ignoreAllDay, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));

  const cals = await db
    .select({
      id: calendars.id,
      summary: calendars.summary,
      gid: calendars.googleCalendarId,
      selected: calendars.selected,
      n: sql<number>`count(${events.id})`,
    })
    .from(calendars)
    .leftJoin(events, eq(events.calendarId, calendars.id))
    .where(eq(calendars.userId, userId))
    .groupBy(calendars.id)
    .orderBy(sql`count(${events.id}) desc`);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      </header>

      {/* All-day toggle */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Eventos</h2>
        <form
          action={setIgnoreAllDay}
          className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div>
            <p className="text-sm font-medium">
              Ignorar eventos de día completo
            </p>
            <p className="text-sm text-zinc-500">
              Feriados, cumpleaños y tareas all-day no cuentan como tiempo
              invertido.
            </p>
          </div>
          <AutoToggle name="ignoreAllDay" defaultChecked={user.ignoreAllDay} />
        </form>
      </section>

      {/* Calendars */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Calendarios</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Elegí qué calendarios entran en los reportes.
        </p>
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {cals.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {c.summary ?? c.gid}
                </p>
                <p className="text-xs text-zinc-500">{c.n} eventos</p>
              </div>
              <form action={setCalendarSelected}>
                <input type="hidden" name="id" value={c.id} />
                <AutoToggle name="selected" defaultChecked={c.selected} />
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
