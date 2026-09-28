// Gates /admin/* behind a login. Proxy alone isn't enough for the Server
// Actions those pages call (see requireAdmin() in src/lib/auth.ts) — this
// only stops unauthenticated *page* navigation and gives a clean redirect
// to /admin/login instead of a raw error.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
