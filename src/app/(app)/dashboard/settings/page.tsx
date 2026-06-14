import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import {
  calendars,
  categories,
  events,
  ignoredTitles,
  manualBlockTemplates,
  users,
} from "@/db/schema";
import {
  createManualBlock,
  deleteManualBlock,
  ignorePattern,
  setCalendarSelected,
  setIgnoreAllDay,
  unignoreTitle,
} from "@/app/lib/actions";
import { AutoToggle } from "./AutoToggle";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const KIND_LABELS: Record<string, string> = {
  sleep: "Sueño",
  work: "Trabajo",
  custom: "Otro",
};

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

  const cats = await db
    .select({ id: categories.id, name: categories.name, color: categories.color })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.name);

  const blocks = await db
    .select({
      id: manualBlockTemplates.id,
      kind: manualBlockTemplates.kind,
      categoryId: manualBlockTemplates.categoryId,
      daysOfWeek: manualBlockTemplates.daysOfWeek,
      startTime: manualBlockTemplates.startTime,
      endTime: manualBlockTemplates.endTime,
      fillGaps: manualBlockTemplates.fillGaps,
    })
    .from(manualBlockTemplates)
    .where(eq(manualBlockTemplates.userId, userId));
  const catById = new Map(cats.map((c) => [c.id, c]));

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

      {/* Manual blocks */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-medium">Bloques manuales</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Tiempo que no está en el calendario (sueño, trabajo no agendado).
          &quot;Rellenar huecos&quot; solo cuenta el tiempo libre no ocupado por
          eventos reales.
        </p>

        {blocks.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {blocks.map((b) => {
              const cat = catById.get(b.categoryId);
              const days = [...b.daysOfWeek]
                .sort((a, z) => a - z)
                .map((d) => DAY_LABELS[d])
                .join(" ");
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 p-4 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat?.color ?? "#888" }}
                    />
                    <span className="truncate">
                      {KIND_LABELS[b.kind]} · {cat?.name ?? "—"} ·{" "}
                      {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)} · {days}
                      {b.fillGaps && (
                        <span className="ml-1 text-xs text-zinc-400">
                          (rellena huecos)
                        </span>
                      )}
                    </span>
                  </span>
                  <form action={deleteManualBlock}>
                    <input type="hidden" name="id" value={b.id} />
                    <button
                      type="submit"
                      className="shrink-0 text-xs text-red-500 hover:underline"
                    >
                      Eliminar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {cats.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Creá una categoría primero (en Reglas) para poder agregar bloques.
          </p>
        ) : (
          <form
            action={createManualBlock}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap gap-2">
              <select
                name="kind"
                className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="sleep">Sueño</option>
                <option value="work">Trabajo</option>
                <option value="custom">Otro</option>
              </select>
              <select
                name="categoryId"
                className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="time"
                name="startTime"
                defaultValue="23:00"
                required
                className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="self-center text-sm text-zinc-500">a</span>
              <input
                type="time"
                name="endTime"
                defaultValue="07:00"
                required
                className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {DAY_LABELS.map((label, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    name="dow"
                    value={idx}
                    defaultChecked
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="fillGaps" />
                Rellenar huecos (no pisar eventos reales)
              </label>
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
              >
                Agregar bloque
              </button>
            </div>
          </form>
        )}
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
