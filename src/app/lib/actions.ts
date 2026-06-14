"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  calendars,
  categories,
  ignoredTitles,
  manualBlockTemplates,
  rules,
  users,
} from "@/db/schema";
import { categorizeUser } from "@/lib/categorize";
import { verifySession } from "@/app/lib/dal";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color hex inválido")
    .default("#888888"),
});

const ruleSchema = z.object({
  matchType: z.enum(["calendar", "title_contains", "title_regex"]),
  pattern: z.string().trim().min(1, "Patrón requerido"),
  categoryId: z.string().min(1),
  priority: z.coerce.number().int().default(0),
});

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rules");
  revalidatePath("/dashboard/settings");
}

export async function setIgnoreAllDay(formData: FormData) {
  const { userId } = await verifySession();
  const ignore = formData.get("ignoreAllDay") === "on";
  await db
    .update(users)
    .set({ ignoreAllDay: ignore })
    .where(eq(users.id, userId));
  revalidate();
}

// Suggested starter set based on common Google Calendar patterns.
const DEFAULT_CATEGORIES: Array<{ name: string; color: string }> = [
  { name: "Trabajo", color: "#3b82f6" },
  { name: "Salud", color: "#22c55e" },
  { name: "Personal", color: "#a855f7" },
  { name: "Pareja", color: "#ec4899" },
  { name: "Social", color: "#f59e0b" },
];

const DEFAULT_RULES: Array<{ pattern: string; category: string }> = [
  { pattern: "Fer:", category: "Trabajo" },
  { pattern: "Pilates", category: "Salud" },
  { pattern: "Bicicleta", category: "Salud" },
  { pattern: "Gym", category: "Salud" },
  { pattern: "Terapia", category: "Salud" },
  { pattern: "Piano", category: "Personal" },
  { pattern: "Canto", category: "Personal" },
  { pattern: "Ensayo", category: "Personal" },
  { pattern: "Momento pareja", category: "Pareja" },
  { pattern: "Brunch", category: "Social" },
  { pattern: "Cumple", category: "Social" },
  { pattern: "Cena", category: "Social" },
];

/** Creates a suggested set of categories + rules (idempotent), then recategorizes. */
export async function seedDefaultRules() {
  const { userId } = await verifySession();

  const existingCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));
  const catByName = new Map(existingCats.map((c) => [c.name, c.id]));

  for (const c of DEFAULT_CATEGORIES) {
    if (catByName.has(c.name)) continue;
    const [created] = await db
      .insert(categories)
      .values({ userId, name: c.name, color: c.color })
      .returning({ id: categories.id });
    catByName.set(c.name, created.id);
  }

  const existingRules = await db
    .select({ matchType: rules.matchType, pattern: rules.pattern })
    .from(rules)
    .where(eq(rules.userId, userId));
  const ruleKeys = new Set(
    existingRules.map((r) => `${r.matchType}:${r.pattern.toLowerCase()}`),
  );

  for (const r of DEFAULT_RULES) {
    const key = `title_contains:${r.pattern.toLowerCase()}`;
    if (ruleKeys.has(key)) continue;
    const categoryId = catByName.get(r.category);
    if (!categoryId) continue;
    await db.insert(rules).values({
      userId,
      matchType: "title_contains",
      pattern: r.pattern,
      categoryId,
      priority: 10,
    });
  }

  await categorizeUser(userId);
  revalidate();
}

export async function ignoreTitle(formData: FormData) {
  const { userId } = await verifySession();
  const display = String(formData.get("title") ?? "").trim();
  if (!display) return;
  await db
    .insert(ignoredTitles)
    .values({
      userId,
      title: display.toLowerCase(),
      display,
      matchType: "exact",
    })
    .onConflictDoNothing({
      target: [ignoredTitles.userId, ignoredTitles.title],
    });
  revalidate();
}

export async function ignorePattern(formData: FormData) {
  const { userId } = await verifySession();
  const display = String(formData.get("pattern") ?? "").trim();
  if (!display) return;
  await db
    .insert(ignoredTitles)
    .values({
      userId,
      title: display.toLowerCase(),
      display,
      matchType: "contains",
    })
    .onConflictDoNothing({
      target: [ignoredTitles.userId, ignoredTitles.title],
    });
  revalidate();
}

export async function unignoreTitle(formData: FormData) {
  const { userId } = await verifySession();
  const id = String(formData.get("id"));
  await db
    .delete(ignoredTitles)
    .where(and(eq(ignoredTitles.id, id), eq(ignoredTitles.userId, userId)));
  revalidate();
}

const blockSchema = z.object({
  kind: z.enum(["sleep", "work", "custom"]),
  categoryId: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  fillGaps: z.boolean(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
});

export async function createManualBlock(formData: FormData) {
  const { userId } = await verifySession();
  const days = formData
    .getAll("dow")
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n));

  const parsed = blockSchema.safeParse({
    kind: formData.get("kind"),
    categoryId: formData.get("categoryId"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    fillGaps: formData.get("fillGaps") === "on",
    daysOfWeek: days,
  });
  if (!parsed.success) return;

  // Ensure the category belongs to the user.
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, parsed.data.categoryId),
        eq(categories.userId, userId),
      ),
    );
  if (!cat) return;

  await db.insert(manualBlockTemplates).values({
    userId,
    categoryId: parsed.data.categoryId,
    kind: parsed.data.kind,
    daysOfWeek: parsed.data.daysOfWeek,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    fillGaps: parsed.data.fillGaps,
  });
  revalidate();
}

export async function deleteManualBlock(formData: FormData) {
  const { userId } = await verifySession();
  const id = String(formData.get("id"));
  await db
    .delete(manualBlockTemplates)
    .where(
      and(
        eq(manualBlockTemplates.id, id),
        eq(manualBlockTemplates.userId, userId),
      ),
    );
  revalidate();
}

export async function setCalendarSelected(formData: FormData) {
  const { userId } = await verifySession();
  const id = String(formData.get("id"));
  const selected = formData.get("selected") === "on";
  await db
    .update(calendars)
    .set({ selected })
    .where(and(eq(calendars.id, id), eq(calendars.userId, userId)));
  revalidate();
}

export async function createCategory(formData: FormData) {
  const { userId } = await verifySession();
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "#888888",
  });
  if (!parsed.success) return;

  await db.insert(categories).values({ userId, ...parsed.data });
  revalidate();
}

export async function deleteCategory(formData: FormData) {
  const { userId } = await verifySession();
  const id = String(formData.get("id"));
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  await categorizeUser(userId);
  revalidate();
}

export async function createRule(formData: FormData) {
  const { userId } = await verifySession();
  const parsed = ruleSchema.safeParse({
    matchType: formData.get("matchType"),
    pattern: formData.get("pattern"),
    categoryId: formData.get("categoryId"),
    priority: formData.get("priority") || 0,
  });
  if (!parsed.success) return;

  // Ensure the category belongs to the user before linking.
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, parsed.data.categoryId),
        eq(categories.userId, userId),
      ),
    );
  if (!cat) return;

  await db.insert(rules).values({ userId, ...parsed.data });
  await categorizeUser(userId);
  revalidate();
}

export async function deleteRule(formData: FormData) {
  const { userId } = await verifySession();
  const id = String(formData.get("id"));
  await db
    .delete(rules)
    .where(and(eq(rules.id, id), eq(rules.userId, userId)));
  await categorizeUser(userId);
  revalidate();
}
