import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const CALENDAR_SCOPE =
  "openid email profile https://www.googleapis.com/auth/calendar.readonly";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      // Safe with a single OAuth provider: links the Google account to an
      // existing user with the same (Google-verified) email instead of
      // failing with OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: CALENDAR_SCOPE,
          // Required to receive a refresh_token for background (cron) syncs.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
