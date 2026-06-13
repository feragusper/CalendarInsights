import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
// Refresh a bit early to avoid edge-of-expiry failures.
const EXPIRY_SKEW_SEC = 60;

type GoogleAccount = typeof accounts.$inferSelect;

async function getGoogleAccount(userId: string): Promise<GoogleAccount> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
    );

  if (!account) {
    throw new Error(`No Google account linked for user ${userId}`);
  }
  return account;
}

async function refreshAccessToken(
  account: GoogleAccount,
): Promise<string> {
  if (!account.refresh_token) {
    throw new Error(
      "Missing Google refresh_token — user must re-consent (prompt=consent).",
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };

  const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

  await db
    .update(accounts)
    .set({ access_token: data.access_token, expires_at: expiresAt })
    .where(
      and(
        eq(accounts.provider, "google"),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );

  return data.access_token;
}

/**
 * Returns a valid Google access token for the user, refreshing it if expired.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const account = await getGoogleAccount(userId);
  const now = Math.floor(Date.now() / 1000);

  if (
    account.access_token &&
    account.expires_at &&
    account.expires_at - EXPIRY_SKEW_SEC > now
  ) {
    return account.access_token;
  }

  return refreshAccessToken(account);
}
