"use client";

import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import DateRangeSelector from "@/components/DateRangeSelector";
import StatsCards from "@/components/StatsCards";
import CategoryChart from "@/components/CategoryChart";
import DailyChart from "@/components/DailyChart";
import ActivityTable from "@/components/ActivityTable";
import { getDateRange } from "@/lib/dates";
import type { DateRange, TimeBreakdown, DailyBreakdown } from "@/types";
import { LogOut, RefreshCw } from "lucide-react";

interface CalendarData {
  events: number;
  totalMinutes: number;
  totalHours: number;
  breakdown: TimeBreakdown[];
  daily: DailyBreakdown[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [range, setRange] = useState<DateRange>("week");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevParamsRef = useRef<string>("");

  const { startDate, endDate, label } = getDateRange(range, offset);

  const fetchData = useCallback(async (start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ timeMin: start, timeMax: end });
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al obtener datos");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  const paramsKey = `${startDate}|${endDate}|${status}`;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (prevParamsRef.current === paramsKey) return;
    prevParamsRef.current = paramsKey;
    fetchData(startDate, endDate);
  });

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            📊 Cal Insights
          </h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {session?.user?.email}
            </span>
            <button
              onClick={() => fetchData(startDate, endDate)}
              disabled={loading}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Refrescar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <DateRangeSelector
          range={range}
          offset={offset}
          label={label}
          onRangeChange={setRange}
          onOffsetChange={setOffset}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {data && (
          <>
            <StatsCards
              totalMinutes={data.totalMinutes}
              eventCount={data.events}
              breakdown={data.breakdown}
              dailyCount={data.daily.length}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <CategoryChart breakdown={data.breakdown} />
              <DailyChart daily={data.daily} />
            </div>

            <ActivityTable breakdown={data.breakdown} />
          </>
        )}
      </main>
    </div>
  );
}
