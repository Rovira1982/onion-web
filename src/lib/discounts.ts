import "server-only";
import { prisma } from "./db";
import { requireAdmin } from "./auth";

export type DiscountCode = {
  id: string;
  code: string;
  type: "un_solo_uso" | "cliente_habitual";
  percentage: number;
  maxUses: number | null;
  usesCount: number;
  customerEmail: string | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
};

export type DiscountCheckResult =
  | { valid: true; codeId: string; percentage: number; discountAmount: number }
  | { valid: false; error: string };

// Read-only check — used for the checkout preview and re-validated (with an
// atomic use-claim) inside the transaction in crearPedido. Never mutates
// usesCount itself.
export async function validateDiscountCode(
  code: string,
  subtotal: number,
  email?: string
): Promise<DiscountCheckResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Introduce un código." };

  const found = await prisma.discountCode.findUnique({ where: { code: normalized } });
  if (!found || !found.active) return { valid: false, error: "Código no válido." };
  if (found.expiresAt && found.expiresAt < new Date()) {
    return { valid: false, error: "Este código ha caducado." };
  }
  if (found.maxUses !== null && found.usesCount >= found.maxUses) {
    return { valid: false, error: "Este código ya no está disponible." };
  }
  if (found.type === "cliente_habitual" && found.customerEmail) {
    if (!email || email.trim().toLowerCase() !== found.customerEmail.toLowerCase()) {
      return { valid: false, error: "Este código no está asociado a tu email." };
    }
  }

  return {
    valid: true,
    codeId: found.id,
    percentage: found.percentage,
    discountAmount: subtotal * (found.percentage / 100),
  };
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  await requireAdmin();
  return prisma.discountCode.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getDiscountCodeById(id: string): Promise<DiscountCode | null> {
  await requireAdmin();
  return prisma.discountCode.findUnique({ where: { id } });
}
