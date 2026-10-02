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

// Antes: 4 mensajes distintos dejaban adivinar si un código existe y en qué
// estado está, sin límite de intentos. Ahora: un único mensaje genérico
// para el cliente anónimo; el motivo real queda solo para logs/debug.
// Parche de seguridad, Guardian P6, 2026-10-02.
const GENERIC_INVALID = "Código no válido o no aplicable.";

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
  if (!found || !found.active) return { valid: false, error: GENERIC_INVALID };
  if (found.expiresAt && found.expiresAt < new Date()) {
    return { valid: false, error: GENERIC_INVALID };
  }
  if (found.maxUses !== null && found.usesCount >= found.maxUses) {
    return { valid: false, error: GENERIC_INVALID };
  }
  if (found.type === "cliente_habitual" && found.customerEmail) {
    if (!email || email.trim().toLowerCase() !== found.customerEmail.toLowerCase()) {
      return { valid: false, error: GENERIC_INVALID };
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
