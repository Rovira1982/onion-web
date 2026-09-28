"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type DiscountCodeInput = {
  code: string;
  type: "un_solo_uso" | "cliente_habitual";
  percentage: number;
  expiresAt: string;
  active: boolean;
  customerEmail: string;
  maxUses: string; // "" = ilimitado
};

export type DiscountCodeResult = { id: string } | { error: string };

function validate(input: DiscountCodeInput): string | null {
  if (!input.code.trim()) return "El código es obligatorio.";
  if (!Number.isFinite(input.percentage) || input.percentage < 1 || input.percentage > 100) {
    return "El porcentaje debe estar entre 1 y 100.";
  }
  if (input.type === "cliente_habitual" && !input.customerEmail.trim()) {
    return "Los códigos de cliente habitual necesitan un email.";
  }
  return null;
}

function toData(input: DiscountCodeInput) {
  const isSingleUse = input.type === "un_solo_uso";
  return {
    code: input.code.trim().toUpperCase(),
    type: input.type,
    percentage: input.percentage,
    maxUses: isSingleUse ? 1 : input.maxUses.trim() ? parseInt(input.maxUses, 10) : null,
    customerEmail: isSingleUse ? null : input.customerEmail.trim() || null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    active: input.active,
  };
}

export async function crearCodigo(input: DiscountCodeInput): Promise<DiscountCodeResult> {
  await requireAdmin();
  const error = validate(input);
  if (error) return { error };

  try {
    const created = await prisma.discountCode.create({ data: toData(input) });
    return { id: created.id };
  } catch {
    return { error: "Ese código ya existe." };
  }
}

export async function actualizarCodigo(id: string, input: DiscountCodeInput): Promise<DiscountCodeResult> {
  await requireAdmin();
  const error = validate(input);
  if (error) return { error };

  try {
    const updated = await prisma.discountCode.update({ where: { id }, data: toData(input) });
    return { id: updated.id };
  } catch {
    return { error: "Ese código ya existe." };
  }
}

export async function eliminarCodigo(id: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  await prisma.discountCode.delete({ where: { id } });
  return { ok: true };
}
