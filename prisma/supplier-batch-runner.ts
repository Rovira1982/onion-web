// Genera las tandas de pedido a proveedor — ver especificación §4 y el plan
// "Tandas de pedido a proveedor". Corre dos veces al día (Railway Cron
// Schedule, 10:00/15:00) vía prisma/run-supplier-batch.ts. Puro cálculo en
// src/lib/supplier-batching.ts; este archivo solo hace I/O de Prisma.
//
// Run with: npx tsx prisma/run-supplier-batch.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "./_client";
import { consolidateSku, gorfactoryHandlingFee, gorfactoryShipping } from "../src/lib/supplier-batching";


// Roly y Stamina ya comparten Supplier.adapterKey="gorfactory" en el schema
// (confirmado consultando la tabla: dos filas de Supplier, un solo
// adapterKey) — agrupar directamente por adapterKey basta para que caigan
// en la misma tanda, sin remapeo aparte.
const FULFILLMENT_MODE: Record<string, "api" | "manual"> = {
  gorfactory: "api",
  toptex: "api",
  valento: "manual",
  cifra: "manual",
};

type PendingLine = {
  orderLineId: string;
  productVariantId: string;
  quantity: number;
};

export async function runBatch(batchRunAt: Date): Promise<{ created: number; skippedNoLines: string[] }> {
  const pendingLines = await prisma.orderLine.findMany({
    where: {
      order: { paymentStatus: "pagado" },
      supplierOrderLineId: null,
      productVariantId: { not: null },
    },
    select: {
      id: true,
      quantity: true,
      productVariantId: true,
      productVariant: {
        select: {
          id: true,
          costUnit: true,
          costPack: true,
          costBox: true,
          product: {
            select: {
              unitsPerPack: true,
              unitsPerCase: true,
              incompleteData: true,
              supplier: { select: { adapterKey: true } },
            },
          },
        },
      },
    },
  });

  // Agrupar por adapterKey de envío real (§4.3), luego por SKU dentro de
  // cada grupo.
  const groups = new Map<string, Map<string, { cost: NonNullable<(typeof pendingLines)[number]["productVariant"]>; lines: PendingLine[] }>>();

  for (const line of pendingLines) {
    if (!line.productVariant) continue;
    const adapterKey = line.productVariant.product.supplier.adapterKey;
    if (!groups.has(adapterKey)) groups.set(adapterKey, new Map());
    const bySku = groups.get(adapterKey)!;
    if (!bySku.has(line.productVariantId!)) {
      bySku.set(line.productVariantId!, { cost: line.productVariant, lines: [] });
    }
    bySku.get(line.productVariantId!)!.lines.push({
      orderLineId: line.id,
      productVariantId: line.productVariantId!,
      quantity: line.quantity,
    });
  }

  let created = 0;
  const skippedNoLines: string[] = [];

  for (const [adapterKey, bySku] of groups) {
    if (bySku.size === 0) {
      skippedNoLines.push(adapterKey);
      continue;
    }

    const skuResults = [...bySku.entries()].map(([productVariantId, { cost, lines }]) => {
      const requestedQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
      const consolidated = consolidateSku(
        {
          costUnit: Number(cost.costUnit ?? 0),
          costPack: cost.costPack != null ? Number(cost.costPack) : null,
          costBox: cost.costBox != null ? Number(cost.costBox) : null,
          unitsPerPack: cost.product.unitsPerPack,
          unitsPerCase: cost.product.unitsPerCase,
          incompleteData: cost.product.incompleteData,
        },
        requestedQuantity,
      );
      return { productVariantId, requestedQuantity, consolidated, lines };
    });

    const subtotal = skuResults.reduce((sum, r) => sum + r.consolidated.lineCost, 0);
    const isGorfactory = adapterKey === "gorfactory";
    const handlingFee = isGorfactory
      ? skuResults.reduce((sum, r) => sum + gorfactoryHandlingFee(r.consolidated.orderedQuantity), 0)
      : 0;
    const shipping = isGorfactory ? gorfactoryShipping(subtotal, 1) : { shippingCost: 0, quoteFromAccountManager: false };

    const roundedNotes = skuResults
      .filter((r) => r.consolidated.boxRounded)
      .map((r) => `SKU ${r.productVariantId}: redondeado a caja, sobrante ${r.consolidated.surplusQuantity} uds`)
      .join("\n");

    await prisma.$transaction(async (tx) => {
      const supplierOrder = await tx.supplierOrder.create({
        data: {
          adapterKey,
          batchRunAt,
          fulfillmentMode: FULFILLMENT_MODE[adapterKey] ?? "manual",
          subtotal: round2(subtotal),
          handlingFee: round2(handlingFee),
          shippingCost: round2(shipping.shippingCost),
          quoteFromAccountManager: shipping.quoteFromAccountManager,
          notes: roundedNotes || null,
        },
      });

      for (const r of skuResults) {
        const orderLine = await tx.supplierOrderLine.create({
          data: {
            supplierOrderId: supplierOrder.id,
            productVariantId: r.productVariantId,
            requestedQuantity: r.requestedQuantity,
            orderedQuantity: r.consolidated.orderedQuantity,
            priceTier: r.consolidated.priceTier,
            unitCost: r.consolidated.unitCost,
            lineCost: r.consolidated.lineCost,
            boxRounded: r.consolidated.boxRounded,
            surplusQuantity: r.consolidated.surplusQuantity,
            handlingFeeApplied: isGorfactory && gorfactoryHandlingFee(r.consolidated.orderedQuantity) > 0,
          },
        });

        await tx.orderLine.updateMany({
          where: { id: { in: r.lines.map((l) => l.orderLineId) } },
          data: { supplierOrderLineId: orderLine.id },
        });
      }
    });

    created++;
  }

  return { created, skippedNoLines };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function disconnect() {
  await prisma.$disconnect();
}
