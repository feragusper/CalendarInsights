import { eq } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { calendars, categories, rules } from "@/db/schema";
import {
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
} from "@/app/lib/actions";

const MATCH_LABELS: Record<string, string> = {
  calendar: "Calendario",
  title_contains: "Título contiene",
  title_regex: "Título (regex)",
};

export default async function RulesPage() {
  const { userId } = await verifySession();

  const [cats, userRules, cals] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(rules).where(eq(rules.userId, userId)),
    db.select().from(calendars).where(eq(calendars.userId, userId)),
  ]);

  const catName = new Map(cats.map((c) => [c.id, c]));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Categorías y reglas
        </h1>
      </header>

      {/* Categories */}
      <section className="mb-12">
        <h2 className="mb-3 text-lg font-medium">Categorías</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {cats.length === 0 && (
            <li className="text-sm text-zinc-500">Sin categorías todavía.</li>
          )}
          {cats.map((c) => (
            <li key={c.id} className="flex items-center gap-3 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              <span className="flex-1">{c.name}</span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs text-red-500 hover:underline"
                >
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={createCategory} className="flex items-center gap-2">
          <input
            name="name"
            placeholder="Nueva categoría (ej. Salud)"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="color"
            type="color"
            defaultValue="#3b82f6"
            className="h-9 w-12 rounded border border-zinc-300 dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
          >
            Agregar
          </button>
        </form>
      </section>

      {/* Rules */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Reglas</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Mayor prioridad gana. Una categoría puesta a mano nunca se pisa.
        </p>
        <ul className="mb-4 flex flex-col gap-2">
          {userRules.length === 0 && (
            <li className="text-sm text-zinc-500">Sin reglas todavía.</li>
          )}
          {userRules
            .sort((a, b) => b.priority - a.priority)
            .map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 text-sm"
              >
                <span className="tabular-nums text-zinc-400">
                  {r.priority}
                </span>
                <span className="text-zinc-500">
                  {MATCH_LABELS[r.matchType]}:
                </span>
                <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                  {r.pattern}
                </code>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        catName.get(r.categoryId)?.color ?? "#888",
                    }}
                  />
                  {catName.get(r.categoryId)?.name ?? "—"}
                </span>
                <form action={deleteRule} className="ml-auto">
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:underline"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
        </ul>

        {cats.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Creá una categoría primero para poder agregar reglas.
          </p>
        ) : (
          <form
            action={createRule}
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            <select
              name="matchType"
              className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="title_contains">Título contiene</option>
              <option value="title_regex">Título (regex)</option>
              <option value="calendar">Calendario</option>
            </select>
            <input
              name="pattern"
              list="calendar-ids"
              placeholder="patrón / id calendario"
              required
              className="col-span-2 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <datalist id="calendar-ids">
              {cals.map((c) => (
                <option key={c.id} value={c.googleCalendarId}>
                  {c.summary ?? c.googleCalendarId}
                </option>
              ))}
            </datalist>
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
              name="priority"
              type="number"
              defaultValue={0}
              title="Prioridad"
              className="rounded border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="col-span-2 rounded bg-zinc-900 px-3 py-2 text-sm text-white sm:col-span-5 dark:bg-white dark:text-black"
            >
              Agregar regla
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
