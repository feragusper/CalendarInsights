import Link from "next/link";
import { eq } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getInsights,
  getRangeReport,
  parseGrouping,
  parsePeriod,
  GROUPINGS,
  GROUPING_LABELS,
  PERIODS,
  PERIOD_LABELS,
} from "@/lib/reports";
import { ReportView } from "./ReportView";
import { InsightsView } from "./InsightsView";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; group?: string }>;
}) {
  const { userId } = await verifySession();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const grouping = parseGrouping(sp.group);

  const [row] = await db
    .select({ timezone: users.timezone, ignoreAllDay: users.ignoreAllDay })
    .from(users)
    .where(eq(users.id, userId));
  const timezone = row?.timezone ?? "UTC";
  const ignoreAllDay = row?.ignoreAllDay ?? true;

  const now = new Date();
  const [report, insights] = await Promise.all([
    getRangeReport(userId, timezone, period, now, { ignoreAllDay, grouping }),
    getInsights(userId, timezone, period, now, { ignoreAllDay, grouping }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tu tiempo</h1>
        <p className="text-sm text-zinc-500">Zona horaria: {timezone}</p>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-full border border-zinc-200 p-1 text-sm dark:border-zinc-800">
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <Link
                key={p}
                href={`/dashboard?period=${p}&group=${grouping}`}
                className={`rounded-full px-3 py-1.5 text-center transition-colors ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            );
          })}
        </nav>

        <nav className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Agrupar por:</span>
          <div className="flex gap-1 rounded-full border border-zinc-200 p-1 dark:border-zinc-800">
            {GROUPINGS.map((g) => {
              const active = g === grouping;
              return (
                <Link
                  key={g}
                  href={`/dashboard?period=${period}&group=${g}`}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {GROUPING_LABELS[g]}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <InsightsView insights={insights} grouping={grouping} />
      <ReportView report={report} />
    </main>
  );
}
