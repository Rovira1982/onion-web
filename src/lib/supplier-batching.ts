// Consolidación de tandas de pedido a proveedor — ver especificación
// E:\onion\26\finanzas\especificaciones\ESPECIFICACION_precios_y_pedidos_a_proveedor_v1.md
// §4. Puro, sin Prisma — el runner impuro vive en prisma/supplier-batch-runner.ts.
import { selectGarmentTier, type GarmentTier } from "./garment-price";

export type SkuCostInput = {
  costUnit: number;
  costPack: number | null;
  costBox: number | null;
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
};

export type ConsolidatedSku = {
  orderedQuantity: number;
  priceTier: GarmentTier;
  unitCost: number;
  lineCost: number;
  boxRounded: boolean;
  surplusQuantity: number;
};

// §4.3 (tramo por cantidad total) + §4.4 (redondeo a caja cuando compensa
// por precio, ej. Beagle desde 96 uds: q < Uds_caja pero q × precio_pack >=
// Uds_caja × precio_caja). El sobrante se registra como stock propio por
// quien llama a esta función, no aquí (efecto en BD, no en cálculo puro).
export function consolidateSku(cost: SkuCostInput, requestedQuantity: number): ConsolidatedSku {
  const base = selectGarmentTier(
    {
      price: cost.costUnit,
      pricePack: cost.costPack,
      priceBox: cost.costBox,
      unitsPerPack: cost.unitsPerPack,
      unitsPerCase: cost.unitsPerCase,
      incompleteData: cost.incompleteData,
    },
    requestedQuantity,
  );

  const canRoundToBox =
    !cost.incompleteData &&
    cost.unitsPerCase != null &&
    cost.costPack != null &&
    cost.costBox != null &&
    requestedQuantity < cost.unitsPerCase &&
    requestedQuantity * cost.costPack >= cost.unitsPerCase * cost.costBox;

  if (canRoundToBox) {
    const unitsPerCase = cost.unitsPerCase!;
    const costBox = cost.costBox!;
    return {
      orderedQuantity: unitsPerCase,
      priceTier: "caja",
      unitCost: costBox,
      lineCost: round2(unitsPerCase * costBox),
      boxRounded: true,
      surplusQuantity: unitsPerCase - requestedQuantity,
    };
  }

  return {
    orderedQuantity: requestedQuantity,
    priceTier: base.tier,
    unitCost: base.price,
    lineCost: round2(requestedQuantity * base.price),
    boxRounded: false,
    surplusQuantity: 0,
  };
}

// §4.5 — pedir fuera de múltiplos de 5 obliga a abrir una bolsa: 0,30 €
// por línea cuya cantidad pedida es >= 5 y no múltiplo de 5.
export function gorfactoryHandlingFee(orderedQuantity: number): number {
  return orderedQuantity >= 5 && orderedQuantity % 5 !== 0 ? 0.3 : 0;
}

export type GorfactoryShipping = {
  shippingCost: number;
  quoteFromAccountManager: boolean;
};

// §4.6 — envío estándar del portal: <200€ de subtotal según bultos (1→4,50€,
// 2→8,00€); desde 200€ aparece "a cotizar por tu comercial" (0€, a confirmar).
export function gorfactoryShipping(subtotal: number, parcelCount: number): GorfactoryShipping {
  if (subtotal >= 200) {
    return { shippingCost: 0, quoteFromAccountManager: true };
  }
  return { shippingCost: parcelCount >= 2 ? 8.0 : 4.5, quoteFromAccountManager: false };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
