import type { CalendarEvent, TimeBreakdown, DailyBreakdown } from "@/types";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const CATEGORY_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

const FALLBACK_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

function getColorForCategory(name: string, colorId?: string): string {
  if (colorId && CATEGORY_COLORS[colorId]) {
    return CATEGORY_COLORS[colorId];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const calendarsRes = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!calendarsRes.ok) {
    throw new Error(`Failed to fetch calendars: ${calendarsRes.status}`);
  }

  const calendarsData = await calendarsRes.json();
  const calendars = calendarsData.items || [];

  const allEvents: CalendarEvent[] = [];

  for (const calendar of calendars) {
    const calId = encodeURIComponent(calendar.id);
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
    });

    const eventsRes = await fetch(
      `${CALENDAR_API_BASE}/calendars/${calId}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!eventsRes.ok) continue;

    const eventsData = await eventsRes.json();
    const events = eventsData.items || [];

    for (const event of events) {
      if (!event.start?.dateTime || !event.end?.dateTime) continue;

      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      const durationMs = end.getTime() - start.getTime();
      if (durationMs <= 0) continue;

      allEvents.push({
        id: event.id,
        summary: event.summary || "(Sin título)",
        start: event.start.dateTime,
        end: event.end.dateTime,
        duration: durationMs / (1000 * 60),
        colorId: event.colorId,
        calendarId: calendar.id,
      });
    }
  }

  return allEvents;
}

export function buildTimeBreakdown(events: CalendarEvent[]): TimeBreakdown[] {
  const categoryMap = new Map<
    string,
    { totalMinutes: number; colorId?: string; eventCount: number }
  >();

  for (const event of events) {
    const existing = categoryMap.get(event.summary);
    if (existing) {
      existing.totalMinutes += event.duration;
      existing.eventCount += 1;
    } else {
      categoryMap.set(event.summary, {
        totalMinutes: event.duration,
        colorId: event.colorId,
        eventCount: 1,
      });
    }
  }

  const totalMinutes = events.reduce((sum, e) => sum + e.duration, 0);

  const breakdown: TimeBreakdown[] = [];
  for (const [category, data] of categoryMap) {
    breakdown.push({
      category,
      totalMinutes: Math.round(data.totalMinutes * 100) / 100,
      totalHours: Math.round((data.totalMinutes / 60) * 100) / 100,
      percentage:
        totalMinutes > 0
          ? Math.round((data.totalMinutes / totalMinutes) * 10000) / 100
          : 0,
      color: getColorForCategory(category, data.colorId),
      eventCount: data.eventCount,
    });
  }

  return breakdown.sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function buildDailyBreakdown(events: CalendarEvent[]): DailyBreakdown[] {
  const dayMap = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateKey = event.start.split("T")[0];
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      dayMap.set(dateKey, [event]);
    }
  }

  const days: DailyBreakdown[] = [];
  const sortedKeys = Array.from(dayMap.keys()).sort();

  for (const dateKey of sortedKeys) {
    const dayEvents = dayMap.get(dateKey)!;
    const totalMinutes = dayEvents.reduce((sum, e) => sum + e.duration, 0);

    days.push({
      date: dateKey,
      label: new Date(dateKey + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      totalMinutes: Math.round(totalMinutes * 100) / 100,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      categories: buildTimeBreakdown(dayEvents),
    });
  }

  return days;
}
