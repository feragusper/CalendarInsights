/**
 * Removes the linked Google OAuth account and all sessions so the next login
 * re-consents and stores a fresh token (with the calendar scope). Preserves
 * users, categories, rules and events.
 *
 * Run: npx tsx --env-file=.env.local src/scripts/clear-oauth.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions } from "@/db/schema";

async function main() {
  const a = await db
    .delete(accounts)
    .where(eq(accounts.provider, "google"))
    .returning({ p: accounts.provider });
  const s = await db.delete(sessions).returning({ t: sessions.sessionToken });
  console.log(`deleted google_accounts=${a.length} sessions=${s.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
