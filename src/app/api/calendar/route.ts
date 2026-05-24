import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchCalendarEvents,
  buildTimeBreakdown,
  buildDailyBreakdown,
} from "@/lib/calendar";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  if (!timeMin || !timeMax) {
    return Response.json(
      { error: "timeMin and timeMax are required" },
      { status: 400 }
    );
  }

  try {
    const events = await fetchCalendarEvents(
      session.accessToken,
      timeMin,
      timeMax
    );
    const breakdown = buildTimeBreakdown(events);
    const daily = buildDailyBreakdown(events);

    const totalMinutes = events.reduce((sum, e) => sum + e.duration, 0);

    return Response.json({
      events: events.length,
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      breakdown,
      daily,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch calendar data";
    return Response.json({ error: message }, { status: 500 });
  }
}
