import Link from "next/link";
import { eq } from "drizzle-orm";
import { verifySession } from "@/app/lib/dal";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getRangeReport,
  parsePeriod,
  PERIODS,
  PERIOD_LABELS,
} from "@/lib/reports";
import { ReportView } from "./ReportView";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { userId } = await verifySession();
  const period = parsePeriod((await searchParams).period);

  const [row] = await db
    .select({ timezone: users.timezone, ignoreAllDay: users.ignoreAllDay })
    .from(users)
    .where(eq(users.id, userId));
  const timezone = row?.timezone ?? "UTC";
  const ignoreAllDay = row?.ignoreAllDay ?? true;

  const report = await getRangeReport(userId, timezone, period, new Date(), {
    ignoreAllDay,
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tu tiempo</h1>
          <p className="text-sm text-zinc-500">Zona horaria: {timezone}</p>
        </div>
      </div>

      <nav className="mb-8 flex gap-1 rounded-full border border-zinc-200 p-1 text-sm dark:border-zinc-800">
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <Link
              key={p}
              href={`/dashboard?period=${p}`}
              className={`flex-1 rounded-full px-3 py-1.5 text-center transition-colors ${
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

      <ReportView report={report} />
    </main>
  );
}
