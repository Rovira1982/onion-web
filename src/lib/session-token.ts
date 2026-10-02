// Verificación de firma de sesión, sin Prisma — usable desde src/proxy.ts
// (Edge runtime, no puede cargar el driver de Postgres). src/lib/auth.ts
// reexporta/reutiliza esto para el resto del server, así solo hay una
// implementación del HMAC (parche de seguridad, Guardian, 2026-10-01).
//
// El payload lleva sessionVersion desde el parche de revocación de sesión
// (Guardian P7, 2026-10-02) — un logout incrementa la versión guardada en
// el usuario, lo que invalida cualquier token firmado antes (copiado o no),
// sin tener que mantener una lista de tokens revocados.
import { createHmac, timingSafeEqual } from "node:crypto";

export function signSessionPayload(userId: string, sessionVersion: number, expiresAt: number, secret: string): string {
  const payload = `${userId}.${sessionVersion}.${expiresAt}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function verifySessionSignature(
  token: string,
  secret: string
): { userId: string; sessionVersion: number } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionVersionStr, expiresAtStr, signature] = parts;
  const payload = `${userId}.${sessionVersionStr}.${expiresAtStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Date.now() <= Number(expiresAtStr))) return null;
  const sessionVersion = Number(sessionVersionStr);
  if (!Number.isInteger(sessionVersion)) return null;
  return { userId, sessionVersion };
}
