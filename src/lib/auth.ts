// Server-only admin session helpers. Password hashing via Node's built-in
// scrypt (no extra dependency); session token is a signed, timestamped
// cookie value (HMAC-SHA256) rather than a DB-backed session table — simple
// enough for a single-admin tool, and stateless so nothing to clean up.
import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE } from "./auth-constants";
import { signSessionPayload, verifySessionSignature } from "./session-token";

export { SESSION_COOKIE };
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET no configurado en .env.local");
  return s;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function createSessionToken(userId: string, sessionVersion: number): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return signSessionPayload(userId, sessionVersion, expiresAt, secret());
}

export async function createAdminSession(userId: string, sessionVersion: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

// userId se lo pasa quien llama (vía getAdminUser(), que ya lo tiene) — el
// incremento de sessionVersion invalida cualquier token previo, copiado o
// no, en vez de solo borrar la cookie de este navegador. Parche de
// seguridad, Guardian P7, 2026-10-02.
export async function destroyAdminSession(userId: string) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

// Returns the logged-in admin User, or null. Safe to call from any Server
// Component/Server Function — never throws on a missing/invalid session.
export async function getAdminUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const parsed = verifySessionSignature(token, secret());
  if (!parsed) return null;
  const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  if (!user || user.role !== "admin") return null;
  if (user.sessionVersion !== parsed.sessionVersion) return null; // token de una sesión ya cerrada
  return user;
}

// Guard for admin Server Actions — Proxy already gates page navigation
// under /admin, but Server Functions are their own POST endpoints and the
// official Next.js guidance is to never rely on Proxy alone for them.
// Throws (rather than returning null) so a caller that forgets to check
// fails loudly instead of silently running unauthenticated.
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("No autorizado");
  return user;
}
