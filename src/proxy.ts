import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic auth gate. Real verification happens in the Data Access Layer
// (src/app/lib/dal.ts) — here we only check for the session cookie's presence
// to avoid a DB hit on every request (per Next.js auth guidance).
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function proxy(request: NextRequest) {
  // Dev-only bypass mirrors the DAL (src/app/lib/dal.ts).
  if (process.env.NODE_ENV !== "production" && process.env.DEV_USER_ID) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );

  if (!hasSession) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
