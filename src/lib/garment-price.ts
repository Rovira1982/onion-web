// Garment tier pricing (unidad/pack/caja) — maestro de precios, Finanzas
// 2026-09-30. Opción A: la misma regla de tramo que aplica Gorfactory,
// verificada contra su portal con varios modelos (pack 5/caja 100, pack
// 10/caja 100, pack 5/caja 50) — el tramo se decide por la cantidad total
// de la línea y se aplica a TODAS sus unidades, no solo al exceso.
export type GarmentTier = "unidad" | "pack" | "caja";

export type GarmentPricing = {
  price: number;
  tier: GarmentTier;
};

export type GarmentPriceInput = {
  price: number; // precio de unidad — ProductVariant.price, siempre presente
  pricePack: number | null;
  priceBox: number | null;
  unitsPerPack: number | null;
  unitsPerCase: number | null;
  incompleteData: boolean;
};

// Regla de repliegue (Finanzas + dueño, 30/09/2026): si falta el dato de
// tramo del modelo, no se evalúa ningún tramo — precio de unidad siempre,
// que es el más caro, así nunca se pierde margen ni se da precio 0.
export function selectGarmentTier(variant: GarmentPriceInput, quantity: number): GarmentPricing {
  if (
    variant.incompleteData ||
    !variant.unitsPerPack ||
    !variant.unitsPerCase ||
    variant.pricePack == null ||
    variant.priceBox == null
  ) {
    return { price: variant.price, tier: "unidad" };
  }

  if (quantity >= variant.unitsPerCase) {
    return { price: variant.priceBox, tier: "caja" };
  }
  if (quantity >= variant.unitsPerPack) {
    return { price: variant.pricePack, tier: "pack" };
  }
  return { price: variant.price, tier: "unidad" };
}
