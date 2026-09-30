import "server-only";
import { prisma } from "./db";
import { requireAdmin } from "./auth";

export type SupplierOrderSummary = {
  id: string;
  adapterKey: string;
  status: string;
  fulfillmentMode: string;
  subtotal: number;
  handlingFee: number;
  shippingCost: number;
  batchRunAt: Date;
  lineCount: number;
};

export type SupplierOrderDetail = {
  id: string;
  adapterKey: string;
  status: string;
  fulfillmentMode: string;
  subtotal: number;
  handlingFee: number;
  shippingCost: number;
  parcelCount: number | null;
  quoteFromAccountManager: boolean;
  supplierOrderCode: string | null;
  notes: string | null;
  batchRunAt: Date;
  placedAt: Date | null;
  lines: {
    id: string;
    productVariantId: string;
    supplierModelCode: string;
    productName: string;
    size: string;
    color: string;
    requestedQuantity: number;
    orderedQuantity: number;
    priceTier: string;
    unitCost: number;
    lineCost: number;
    boxRounded: boolean;
    surplusQuantity: number;
    handlingFeeApplied: boolean;
    sourceOrderIds: string[];
  }[];
};

export async function listSupplierOrders(): Promise<SupplierOrderSummary[]> {
  await requireAdmin();
  const orders = await prisma.supplierOrder.findMany({
    orderBy: { batchRunAt: "desc" },
    include: { _count: { select: { lines: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    adapterKey: o.adapterKey,
    status: o.status,
    fulfillmentMode: o.fulfillmentMode,
    subtotal: parseFloat(o.subtotal.toString()),
    handlingFee: parseFloat(o.handlingFee.toString()),
    shippingCost: parseFloat(o.shippingCost.toString()),
    batchRunAt: o.batchRunAt,
    lineCount: o._count.lines,
  }));
}

export async function getSupplierOrderById(id: string): Promise<SupplierOrderDetail | null> {
  await requireAdmin();
  const order = await prisma.supplierOrder.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          productVariant: { include: { product: true } },
          orderLines: { select: { orderId: true } },
        },
      },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    adapterKey: order.adapterKey,
    status: order.status,
    fulfillmentMode: order.fulfillmentMode,
    subtotal: parseFloat(order.subtotal.toString()),
    handlingFee: parseFloat(order.handlingFee.toString()),
    shippingCost: parseFloat(order.shippingCost.toString()),
    parcelCount: order.parcelCount,
    quoteFromAccountManager: order.quoteFromAccountManager,
    supplierOrderCode: order.supplierOrderCode,
    notes: order.notes,
    batchRunAt: order.batchRunAt,
    placedAt: order.placedAt,
    lines: order.lines.map((line) => ({
      id: line.id,
      productVariantId: line.productVariantId,
      supplierModelCode: line.productVariant.supplierModelCode,
      productName: line.productVariant.product.name,
      size: line.productVariant.size ?? "",
      color: line.productVariant.color ?? "",
      requestedQuantity: line.requestedQuantity,
      orderedQuantity: line.orderedQuantity,
      priceTier: line.priceTier,
      unitCost: parseFloat(line.unitCost.toString()),
      lineCost: parseFloat(line.lineCost.toString()),
      boxRounded: line.boxRounded,
      surplusQuantity: line.surplusQuantity,
      handlingFeeApplied: line.handlingFeeApplied,
      sourceOrderIds: [...new Set(line.orderLines.map((ol) => ol.orderId))],
    })),
  };
}
