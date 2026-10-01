// Gates /admin/* behind a login. Proxy alone isn't enough for the Server
// Actions those pages call (see requireAdmin() in src/lib/auth.ts) — this
// only stops unauthenticated *page* navigation and gives a clean redirect
// to /admin/login instead of a raw error.
//
// Valida la firma/expiración de la cookie, no solo que exista — un cookie
// con el nombre correcto pero cualquier valor pasaba antes (parche de
// seguridad, Guardian, 2026-10-01). Usa session-token.ts (sin Prisma) en vez
// de auth.ts porque el proxy corre en Edge runtime, que no puede cargar el
// driver de Postgres.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { verifySessionSignature } from "@/lib/session-token";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;
  const valid = !!token && !!secret && verifySessionSignature(token, secret) !== null;
  if (!valid) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
