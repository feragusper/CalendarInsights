import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { calendars, events, ignoredTitles, users } from "@/db/schema";
import {
  ignorePattern,
  setCalendarSelected,
  setIgnoreAllDay,
  unignoreTitle,
} from "@/app/lib/actions";
import { AutoToggle } from "./AutoToggle";

export default async function SettingsPage() {
  const { userId } = await verifySession();

  const [user] = await db
    .select({ ignoreAllDay: users.ignoreAllDay, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));

  const ignored = await db
    .select({
      id: ignoredTitles.id,
      display: ignoredTitles.display,
      matchType: ignoredTitles.matchType,
    })
    .from(ignoredTitles)
    .where(eq(ignoredTitles.userId, userId))
    .orderBy(ignoredTitles.display);

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

      {/* Ignored activities */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium">Actividades ignoradas</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Eventos ocultados desde el dashboard. Reactivá para volver a contarlos.
        </p>
        <form action={ignorePattern} className="mb-3 flex items-center gap-2">
          <input
            name="pattern"
            placeholder="Ignorar títulos que contengan… (ej. cambiar remera)"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Ignorar patrón
          </button>
        </form>
        {ignored.length === 0 ? (
          <p className="text-sm text-zinc-400">Ninguna.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {ignored.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-2 p-4 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{i.display}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                      i.matchType === "contains"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    {i.matchType === "contains" ? "contiene" : "exacto"}
                  </span>
                </span>
                <form action={unignoreTitle}>
                  <input type="hidden" name="id" value={i.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Reactivar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
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
