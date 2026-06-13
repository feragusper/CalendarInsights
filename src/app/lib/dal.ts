import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Verifies the current session and returns the authenticated user id.
 * Redirects to /login when there is no valid session. Memoized per request.
 */
export const verifySession = cache(async () => {
  // Dev-only bypass: lets you browse seeded data without Google OAuth.
  // Never active in production.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
    return {
      userId: process.env.DEV_USER_ID,
      user: { id: process.env.DEV_USER_ID, email: "dev@local" },
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return { userId: session.user.id, user: session.user };
});
