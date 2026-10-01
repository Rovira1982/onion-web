// Verificación de firma de sesión, sin Prisma — usable desde src/proxy.ts
// (Edge runtime, no puede cargar el driver de Postgres). src/lib/auth.ts
// reexporta/reutiliza esto para el resto del server, así solo hay una
// implementación del HMAC (parche de seguridad, Guardian, 2026-10-01).
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySessionSignature(token: string, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, signature] = parts;
  const expected = createHmac("sha256", secret).update(`${userId}.${expiresAtStr}`).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Date.now() <= Number(expiresAtStr))) return null;
  return userId;
}
