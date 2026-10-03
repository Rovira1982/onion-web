// Gates /admin/* behind a login. Proxy alone isn't enough for the Server
// Actions those pages call (see requireAdmin() in src/lib/auth.ts) — this
// only stops unauthenticated *page* navigation and gives a clean redirect
// to /admin/login instead of a raw error.
//
// Valida la firma/expiración de la cookie, no solo que exista — un cookie
// con el nombre correcto pero cualquier valor pasaba antes (parche de
// seguridad, Guardian, 2026-10-01). Usa session-token.ts (sin Prisma) en vez
// de auth.ts porque esta parte corría pensada para Edge runtime.
//
// Prelaunch (Operaciones/Josep, 2026-10-02): mientras no pase LAUNCH_AT
// (ver src/lib/launch.ts), todo el resto del sitio se reescribe a
// /proximamente. /admin sigue funcionando siempre — el equipo necesita
// poder gestionar pedidos durante la cuenta atrás — y un enlace secreto
// (?preview=<LAUNCH_BYPASS_TOKEN>) deja pasar a quien lo tenga, guardado en
// una cookie para no repetirlo en cada visita.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { verifySessionSignature } from "@/lib/session-token";
import {
  bypassCookieValue,
  constantTimeEquals,
  isLaunched,
  LAUNCH_BYPASS_COOKIE,
  LAUNCH_BYPASS_QUERY_PARAM,
} from "@/lib/launch";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
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

  // /email/: imágenes de los correos automáticos, que se descargan desde fuera
  // (sin cookie) también antes del lanzamiento.
  if (isLaunched() || request.nextUrl.pathname.startsWith("/proximamente") || request.nextUrl.pathname.startsWith("/email/")) {
    return NextResponse.next();
  }

  const previewToken = process.env.LAUNCH_BYPASS_TOKEN;
  if (previewToken) {
    const cookieValue = request.cookies.get(LAUNCH_BYPASS_COOKIE)?.value;
    if (cookieValue && constantTimeEquals(cookieValue, bypassCookieValue(previewToken))) {
      return NextResponse.next();
    }

    const queryToken = request.nextUrl.searchParams.get(LAUNCH_BYPASS_QUERY_PARAM);
    if (queryToken && constantTimeEquals(queryToken, previewToken)) {
      // Cookie + redirección a la misma URL SIN el parámetro: el token no
      // se queda en la barra de direcciones, el historial, ni en el
      // Referer de lo que se cargue después (Guardian, 2026-10-02).
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete(LAUNCH_BYPASS_QUERY_PARAM);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(LAUNCH_BYPASS_COOKIE, bypassCookieValue(previewToken), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 60, // 60 días — más que de sobra para toda la cuenta atrás
      });
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  // Cabecera para que el layout raíz sepa que esto es la pantalla de
  // prelanzamiento y se salte Header/Footer/CookieBanner/Pixel/WhatsApp —
  // son del sitio real, no tienen sentido (ni deberían ser visibles)
  // delante de la cuenta atrás.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-prelaunch", "1");
  return NextResponse.rewrite(new URL("/proximamente", request.url), { request: { headers: requestHeaders } });
}

export const config = {
  // Todo menos assets estáticos, imágenes optimizadas y los propios
  // ficheros de metadatos (robots/sitemap ya gestionan su propio bloqueo).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
