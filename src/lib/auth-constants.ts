// Shared between src/lib/auth.ts (server-only, pulls in Prisma) and
// src/proxy.ts (its own bundle) — kept tiny and free of "server-only" so
// neither has to pull in the other's dependencies just for this constant.
export const SESSION_COOKIE = "admin_session";
