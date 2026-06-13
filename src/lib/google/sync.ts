import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendars, events, users } from "@/db/schema";
import { getAccessToken } from "./client";
import { categorizeUser } from "@/lib/categorize";

const API = "https://www.googleapis.com/calendar/v3";

type GCalListEntry = {
  id: string;
  summary?: string;
  timeZone?: string;
  selected?: boolean;
  primary?: boolean;
};

type GCalEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

async function gfetch<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T & { status?: number }> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 410) {
    // syncToken expired — caller must do a full resync.
    return { status: 410 } as T & { status?: number };
  }
  if (!res.ok) {
    throw new Error(
      `Google Calendar API ${res.status}: ${await res.text()}`,
    );
  }
  return (await res.json()) as T & { status?: number };
}

/** Parse a Google event start/end into a UTC Date. All-day events use `date`. */
function toDate(slot?: { dateTime?: string; date?: string }): Date | null {
  if (!slot) return null;
  if (slot.dateTime) return new Date(slot.dateTime);
  if (slot.date) return new Date(`${slot.date}T00:00:00Z`);
  return null;
}

async function upsertCalendars(userId: string, token: string) {
  const data = await gfetch<{ items?: GCalListEntry[] }>(
    "/users/me/calendarList",
    token,
  );
  let primaryTz: string | undefined;
  for (const item of data.items ?? []) {
    if (item.primary && item.timeZone) primaryTz = item.timeZone;
    await db
      .insert(calendars)
      .values({
        userId,
        googleCalendarId: item.id,
        summary: item.summary,
        timezone: item.timeZone,
        selected: item.selected ?? item.primary ?? true,
      })
      .onConflictDoUpdate({
        target: [calendars.userId, calendars.googleCalendarId],
        set: { summary: item.summary, timezone: item.timeZone },
      });
  }

  // Adopt the primary calendar's timezone for reporting if still default.
  if (primaryTz) {
    await db
      .update(users)
      .set({ timezone: primaryTz })
      .where(and(eq(users.id, userId), eq(users.timezone, "UTC")));
  }
}

async function syncCalendarEvents(
  userId: string,
  calendar: typeof calendars.$inferSelect,
  token: string,
) {
  let pageToken: string | undefined;
  let syncToken = calendar.syncToken ?? undefined;
  let newSyncToken: string | undefined;
  let fullResync = !syncToken;

  do {
    const params: Record<string, string> = {
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
    };
    if (pageToken) params.pageToken = pageToken;
    if (syncToken) params.syncToken = syncToken;
    else {
      // First sync: last 12 months forward.
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      params.timeMin = since.toISOString();
    }

    const data = await gfetch<{
      items?: GCalEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
      status?: number;
    }>(
      `/calendars/${encodeURIComponent(calendar.googleCalendarId)}/events`,
      token,
      params,
    );

    if (data.status === 410) {
      // Expired token: clear and restart full sync.
      syncToken = undefined;
      pageToken = undefined;
      fullResync = true;
      await db
        .update(calendars)
        .set({ syncToken: null })
        .where(eq(calendars.id, calendar.id));
      continue;
    }

    for (const ev of data.items ?? []) {
      if (ev.status === "cancelled") {
        await db
          .delete(events)
          .where(
            and(
              eq(events.calendarId, calendar.id),
              eq(events.googleEventId, ev.id),
            ),
          );
        continue;
      }

      const start = toDate(ev.start);
      const end = toDate(ev.end);
      const durationMin =
        start && end
          ? Math.round((end.getTime() - start.getTime()) / 60000)
          : null;

      await db
        .insert(events)
        .values({
          userId,
          calendarId: calendar.id,
          googleEventId: ev.id,
          title: ev.summary ?? null,
          startUtc: start,
          endUtc: end,
          durationMin,
          status: ev.status ?? null,
          raw: ev,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [events.calendarId, events.googleEventId],
          set: {
            title: ev.summary ?? null,
            startUtc: start,
            endUtc: end,
            durationMin,
            status: ev.status ?? null,
            raw: ev,
            updatedAt: new Date(),
          },
        });
    }

    pageToken = data.nextPageToken;
    if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
  } while (pageToken);

  if (newSyncToken) {
    await db
      .update(calendars)
      .set({ syncToken: newSyncToken })
      .where(eq(calendars.id, calendar.id));
  }

  return { fullResync };
}

/** Sync all selected calendars for a user, then re-run categorization. */
export async function syncUser(userId: string) {
  const token = await getAccessToken(userId);
  await upsertCalendars(userId, token);

  const userCalendars = await db
    .select()
    .from(calendars)
    .where(and(eq(calendars.userId, userId), eq(calendars.selected, true)));

  for (const calendar of userCalendars) {
    await syncCalendarEvents(userId, calendar, token);
  }

  const categorized = await categorizeUser(userId);
  return { calendars: userCalendars.length, categorized };
}
