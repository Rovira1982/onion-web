"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { archiveFile } from "@/lib/storage";

// Único punto de entrada para marcar un pedido como pagado — hoy no
// cobramos online (se manda el enlace de pago por email), así que esto es
// manual. Dispara la elegibilidad de un pedido para las tandas de pedido a
// proveedor (ver plan "Tandas de pedido a proveedor").
export async function marcarPedidoPagado(orderId: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, status: true },
  });
  if (!order) return { error: "Pedido no encontrado." };
  if (order.paymentStatus === "pagado") return { error: "Ya está marcado como pagado." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "pagado",
      // No pisar el progreso si ya se había movido manualmente más allá
      // del estado inicial (ej. ya está en_diseno).
      status: order.status === "pendiente_pago" ? "pagado" : order.status,
    },
  });
  return { ok: true };
}

// Copia el logo de esta línea de pedido a logos-archivo/ (sin caducidad),
// para poder reutilizarlo si el cliente vuelve a pedir. Acción deliberada
// del admin, nunca automática. P8, 2026-10-02.
export async function archivarDisenoDeLinea(orderLineId: string): Promise<{ ok: true; url: string } | { error: string }> {
  await requireAdmin();

  const design = await prisma.designConfig.findUnique({ where: { orderLineId } });
  if (!design) return { error: "Esta línea no tiene diseño subido." };

  const key = design.logoFileUrl.replace(/^\/api\/uploads\//, "");
  if (!key.startsWith("logos/")) return { error: "Este archivo no es un logo de cliente archivable." };

  const archivedKey = await archiveFile(key);
  return { ok: true, url: `/api/uploads/${archivedKey}` };
}
