"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  calendars,
  categories,
  ignoredTitles,
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

export async function ignoreTitle(formData: FormData) {
  const { userId } = await verifySession();
  const display = String(formData.get("title") ?? "").trim();
  if (!display) return;
  await db
    .insert(ignoredTitles)
    .values({ userId, title: display.toLowerCase(), display })
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
