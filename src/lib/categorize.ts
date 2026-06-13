import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendars, events, rules } from "@/db/schema";

type Rule = typeof rules.$inferSelect;

function matches(rule: Rule, title: string, googleCalendarId: string): boolean {
  // Optional calendar scope.
  if (rule.calendarId && rule.calendarId !== googleCalendarId) return false;

  switch (rule.matchType) {
    case "calendar":
      return rule.pattern === googleCalendarId;
    case "title_contains":
      return title.toLowerCase().includes(rule.pattern.toLowerCase());
    case "title_regex":
      try {
        return new RegExp(rule.pattern, "i").test(title);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Applies the user's rules to all non-manually-overridden events.
 * Higher `priority` wins; first match in that order applies.
 * Returns the number of events whose category changed.
 */
export async function categorizeUser(userId: string): Promise<number> {
  const userRules = await db
    .select()
    .from(rules)
    .where(eq(rules.userId, userId))
    .orderBy(desc(rules.priority));

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      categoryId: events.categoryId,
      categorySource: events.categorySource,
      googleCalendarId: calendars.googleCalendarId,
    })
    .from(events)
    .innerJoin(calendars, eq(events.calendarId, calendars.id))
    .where(eq(events.userId, userId));

  let changed = 0;

  for (const row of rows) {
    // Never overwrite a manual assignment.
    if (row.categorySource === "manual") continue;

    const title = row.title ?? "";
    const match = userRules.find((r) =>
      matches(r, title, row.googleCalendarId),
    );

    const nextCategoryId = match ? match.categoryId : null;
    const nextSource = match ? ("rule" as const) : null;

    if (nextCategoryId === row.categoryId) continue;

    await db
      .update(events)
      .set({ categoryId: nextCategoryId, categorySource: nextSource })
      .where(and(eq(events.id, row.id), eq(events.userId, userId)));
    changed++;
  }

  return changed;
}
