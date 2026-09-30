"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
