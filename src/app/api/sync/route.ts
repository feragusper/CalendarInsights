import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { syncUser } from "@/lib/google/sync";

export const dynamic = "force-dynamic";

// Manual sync triggered by the signed-in user.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncUser(session.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Cron sync (Vercel Cron). Syncs every user that has a linked Google account.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const linked = await db
    .selectDistinct({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.provider, "google"));

  const results: Record<string, unknown> = {};
  for (const { userId } of linked) {
    try {
      results[userId] = await syncUser(userId);
    } catch (err) {
      results[userId] = {
        error: err instanceof Error ? err.message : "failed",
      };
    }
  }

  return NextResponse.json({ ok: true, users: linked.length, results });
}
