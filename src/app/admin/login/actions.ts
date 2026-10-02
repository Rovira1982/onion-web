"use server";

import { prisma } from "@/lib/db";
import { verifyPassword, createAdminSession } from "@/lib/auth";

export type LoginResult = { ok: true } | { error: string };

export async function loginAdmin(email: string, password: string): Promise<LoginResult> {
  if (!email.trim() || !password) return { error: "Introduce email y contraseña." };

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.passwordHash || user.role !== "admin") {
    return { error: "Credenciales incorrectas." };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return { error: "Credenciales incorrectas." };
  }

  await createAdminSession(user.id, user.sessionVersion);
  return { ok: true };
}
