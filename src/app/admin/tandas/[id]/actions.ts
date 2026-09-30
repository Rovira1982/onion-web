"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { gorfactoryShipping } from "@/lib/supplier-batching";
import { getOnionDeliveryAddress } from "@/lib/delivery-address";
import * as gorfactory from "@/lib/gorfactory";
import * as toptex from "@/lib/toptex";

type ActionResult = { ok: true } | { error: string };

// Recalcula el envío de Gorfactory con el nº de bultos que decide el admin
// a mano (sin fórmula automática — ver plan "Tandas de pedido a proveedor").
export async function actualizarBultos(supplierOrderId: string, parcelCount: number): Promise<ActionResult> {
  await requireAdmin();
  const order = await prisma.supplierOrder.findUnique({ where: { id: supplierOrderId } });
  if (!order) return { error: "Tanda no encontrada." };
  if (order.status !== "borrador") return { error: "Solo se puede editar una tanda en borrador." };
  if (order.adapterKey !== "gorfactory") return { error: "Los bultos solo aplican a Gorfactory." };

  const shipping = gorfactoryShipping(parseFloat(order.subtotal.toString()), parcelCount);
  await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: {
      parcelCount,
      shippingCost: shipping.shippingCost,
      quoteFromAccountManager: shipping.quoteFromAccountManager,
    },
  });
  return { ok: true };
}

// Único punto de entrada que envía algo de verdad a un proveedor — nunca se
// llama automáticamente, solo cuando el admin pulsa "Confirmar" habiendo
// revisado el borrador (regla ya escrita en gorfactory.ts/toptex.ts).
export async function confirmarTanda(supplierOrderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const order = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: { lines: { include: { productVariant: true, orderLines: { select: { orderId: true } } } } },
  });
  if (!order) return { error: "Tanda no encontrada." };
  if (order.status !== "borrador") return { error: "Esta tanda ya no está en borrador." };
  if (order.lines.length === 0) return { error: "La tanda no tiene líneas." };

  if (order.adapterKey === "valento" || order.adapterKey === "cifra") {
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: { status: "confirmado", confirmedAt: new Date(), confirmedById: admin.id },
    });
    return { ok: true };
  }

  if (order.adapterKey === "gorfactory") {
    let address;
    try {
      address = getOnionDeliveryAddress();
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Dirección de entrega no configurada." };
    }
    try {
      const result = (await gorfactory.placeOrder({
        reference: order.id,
        deliveryaddress: {
          addressname: address.name,
          address: address.street,
          city: address.city,
          postcode: address.postalCode,
          countrycode: address.countryCode,
          country: address.country,
          phone: address.phone,
          email: address.email,
        },
        comments: `Tanda Onion ${order.id} — pedidos web: ${[...new Set(order.lines.flatMap((l) => l.orderLines.map((ol) => ol.orderId)))].join(", ")}`,
        lines: order.lines.map((l) => ({ itemcode: l.productVariant.supplierModelCode, quantity: String(l.orderedQuantity) })),
      })) as { ordercode?: string } | undefined;
      await prisma.supplierOrder.update({
        where: { id: supplierOrderId },
        data: {
          status: "enviado",
          placedAt: new Date(),
          confirmedAt: new Date(),
          confirmedById: admin.id,
          supplierOrderCode: result?.ordercode ?? null,
        },
      });
      await registerSurplusAsStock(order.lines);
      return { ok: true };
    } catch (err) {
      await prisma.supplierOrder.update({
        where: { id: supplierOrderId },
        data: { status: "error", notes: `Error al confirmar: ${err instanceof Error ? err.message : String(err)}` },
      });
      return { error: "Gorfactory rechazó el pedido — revisa el estado de la tanda para el detalle." };
    }
  }

  if (order.adapterKey === "toptex") {
    let address;
    try {
      address = getOnionDeliveryAddress();
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Dirección de entrega no configurada." };
    }
    try {
      const result = (await toptex.createOrder({
        orderReference: order.id,
        deliveryAddress: {
          addressTitle: address.name,
          street1: address.street,
          postCode: address.postalCode,
          city: address.city,
          country: address.countryCode,
          contactName: address.name,
          contactPhone: address.phone,
          contactEmail: address.email,
        },
        orderLines: order.lines.map((l) => ({ sku: l.productVariant.supplierModelCode, quantity: l.orderedQuantity })),
        testMode: true,
      })) as { orderReference?: string } | undefined;
      await prisma.supplierOrder.update({
        where: { id: supplierOrderId },
        data: {
          status: "enviado",
          placedAt: new Date(),
          confirmedAt: new Date(),
          confirmedById: admin.id,
          supplierOrderCode: result?.orderReference ?? null,
        },
      });
      await registerSurplusAsStock(order.lines);
      return { ok: true };
    } catch (err) {
      await prisma.supplierOrder.update({
        where: { id: supplierOrderId },
        data: { status: "error", notes: `Error al confirmar: ${err instanceof Error ? err.message : String(err)}` },
      });
      return { error: "TopTex rechazó el pedido — revisa el estado de la tanda para el detalle." };
    }
  }

  return { error: `Proveedor "${order.adapterKey}" sin flujo de confirmación definido.` };
}

// Para Valento/Cifra: tras pedirlo a mano en su web, Josep apunta aquí el
// número de pedido si quiere y lo marca como enviado.
export async function marcarPedidoManualEnviado(supplierOrderId: string, supplierOrderCode?: string): Promise<ActionResult> {
  await requireAdmin();
  const order = await prisma.supplierOrder.findUnique({ where: { id: supplierOrderId } });
  if (!order) return { error: "Tanda no encontrada." };
  if (order.status !== "confirmado") return { error: "Solo se puede marcar como enviada una tanda ya confirmada." };

  await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: { status: "enviado", placedAt: new Date(), supplierOrderCode: supplierOrderCode || null },
  });
  return { ok: true };
}

// Libera las líneas para que la siguiente tanda las recoja — solo posible
// en borrador, nunca sobre algo ya confirmado/enviado.
export async function cancelarTanda(supplierOrderId: string): Promise<ActionResult> {
  await requireAdmin();
  const order = await prisma.supplierOrder.findUnique({ where: { id: supplierOrderId } });
  if (!order) return { error: "Tanda no encontrada." };
  if (order.status !== "borrador") return { error: "Solo se puede cancelar una tanda en borrador." };

  await prisma.$transaction([
    prisma.orderLine.updateMany({
      where: { supplierOrderLine: { supplierOrderId } },
      data: { supplierOrderLineId: null },
    }),
    prisma.supplierOrder.update({ where: { id: supplierOrderId }, data: { status: "cancelado" } }),
  ]);
  return { ok: true };
}

async function registerSurplusAsStock(lines: { productVariantId: string; surplusQuantity: number; boxRounded: boolean }[]) {
  for (const line of lines) {
    if (line.boxRounded && line.surplusQuantity > 0) {
      await prisma.productVariant.update({
        where: { id: line.productVariantId },
        data: { stock: { increment: line.surplusQuantity } },
      });
    }
  }
}
