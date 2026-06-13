import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* ---------------------------------------------------------------------------
 * Auth.js tables — column names must match @auth/drizzle-adapter (pg) defaults.
 * ------------------------------------------------------------------------- */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // App preference: IANA timezone used to bucket events into days/weeks.
  timezone: text("timezone").notNull().default("UTC"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/* ---------------------------------------------------------------------------
 * Domain tables.
 * ------------------------------------------------------------------------- */

export const matchType = pgEnum("match_type", [
  "calendar",
  "title_contains",
  "title_regex",
]);

export const categorySource = pgEnum("category_source", ["rule", "manual"]);

export const blockKind = pgEnum("block_kind", ["sleep", "work", "custom"]);

export const categories = pgTable("category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#888888"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const calendars = pgTable(
  "calendar",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleCalendarId: text("google_calendar_id").notNull(),
    summary: text("summary"),
    timezone: text("timezone"),
    syncToken: text("sync_token"),
    selected: boolean("selected").notNull().default(true),
  },
  (c) => [
    uniqueIndex("calendar_user_google_idx").on(c.userId, c.googleCalendarId),
  ],
);

export const events = pgTable(
  "event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    googleEventId: text("google_event_id").notNull(),
    title: text("title"),
    startUtc: timestamp("start_utc", { withTimezone: true, mode: "date" }),
    endUtc: timestamp("end_utc", { withTimezone: true, mode: "date" }),
    durationMin: integer("duration_min"),
    status: text("status"),
    raw: jsonb("raw"),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    categorySource: categorySource("category_source"),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (e) => [
    uniqueIndex("event_calendar_google_idx").on(e.calendarId, e.googleEventId),
  ],
);

export const rules = pgTable("rule", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  matchType: matchType("match_type").notNull(),
  pattern: text("pattern").notNull(),
  // Optional scope: only apply within a given Google calendar id.
  calendarId: text("calendar_id"),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Manual time blocks (sleep, unscheduled work, etc.). Modeled in M1; the
 * generation/gap-fill logic lands in M2.
 */
export const manualBlockTemplates = pgTable("manual_block_template", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  kind: blockKind("kind").notNull(),
  // 0 = Sunday … 6 = Saturday.
  daysOfWeek: integer("days_of_week").array().notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  // If true, only fills gaps not already covered by real calendar events.
  fillGaps: boolean("fill_gaps").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
