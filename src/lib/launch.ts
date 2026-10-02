// Cuenta atrás de prelanzamiento — Operaciones/Josep, 2026-10-02: el
// dominio real vive detrás de esta pantalla durante 24-48h antes de abrir
// al público, para poder probar todo (pago con tarjeta, Meta Pixel/CAPI,
// verificación de dominio) con la URL definitiva sin que entre nadie más.
//
// LAUNCH_AT (variable de entorno en Railway, ISO 8601, ej.
// "2026-10-10T09:00:00+02:00") es la única fuente de verdad — sin ella, o
// con un valor que no se puede parsear, el sitio se considera ABIERTO
// (fail-open a propósito: nunca debe quedar la web bloqueada por accidente
// solo porque alguien olvidó poner la variable).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function isLaunched(): boolean {
  return launchDate() === null || Date.now() >= launchDate()!.getTime();
}

export function launchDate(): Date | null {
  const raw = process.env.LAUNCH_AT;
  if (!raw) return null;
  const t = new Date(raw);
  return Number.isNaN(t.getTime()) ? null : t;
}

// Cookie que pone el enlace secreto del equipo (?preview=TOKEN) — una vez
// puesta, salta la cuenta atrás en todas las páginas sin tener que repetir
// el token cada vez. No depende de ninguna página nueva que pudiera acabar
// en el sitemap.
export const LAUNCH_BYPASS_COOKIE = "oab_launch_bypass";
export const LAUNCH_BYPASS_QUERY_PARAM = "preview";

// Guardian, 2026-10-02: la cookie valía literalmente "1" (falsificable sin
// conocer el token) y el token se comparaba con ===. Ahora la cookie lleva
// un HMAC derivado del token (inviable de falsificar, y rotar el token
// invalida todas las cookies emitidas) y ambas comparaciones son de tiempo
// constante (se hashean a longitud fija para no filtrar la longitud).
export function bypassCookieValue(token: string): string {
  return createHmac("sha256", token).update("oab-launch-bypass-v1").digest("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
