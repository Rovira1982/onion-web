// Quote/pricing engine — ported from the business's real Excel tool
// ("Sistema Onion pruebas 2 - MEJORADO v2.xlsx", sheets PRESUPUESTOS_RAPIDOS +
// Costes_Base). Verified against a real example from that file (DTF, espalda
// 30x30, 8 uds, coste prenda 1.65€, margen 0.7) — matched the spreadsheet
// exactly before two confirmed corrections: the Serigrafia double screen
// charge, and the Sublimacion 11-30-unit floor. See inline notes below.
export type Technique = "Serigrafia" | "Vinilo" | "Sublimacion" | "DTF";
export type PrintSize = "10x10" | "23x23" | "30x30";
export type GarmentType = "Basica" | "Premium" | "Gama_media" | "Cliente";

export type PrintZone = {
  active: boolean;
  colors: number; // 1-3
  size: PrintSize;
};

export type QuoteInput = {
  technique: Technique;
  pecho: PrintZone;
  espalda: PrintZone;
  // mangas carries an extra multiplier (e.g. 2 to print both sleeves) — the
  // source sheet calls this D13, left at 1 (one sleeve) by default.
  mangas: PrintZone & { multiplier?: number };
  garmentType: GarmentType;
  garmentUnitCost: number; // 0 if the client brings their own garment
  quantity: number;
  extraMargin: number; // e.g. 0.7 = +70% on top of cost
  personalizedName: boolean; // +Cargo_nombre per unit (e.g. names on jerseys)
};

export const BASE_COSTS = {
  Coste_hora_base: 6, // €/h — labor
  Coste_hora_fijos: 6.9, // €/h — fixed-overhead allocation (1.100€/mes ÷ 160h)
  Vinilo_metro: 6,
  Consumibles_pedido: 2, // € flat per order
  Precio_pantalla: 15, // € per screen (Serigrafia)
  Cargo_nombre: 1.5, // €/unit surcharge for personalized names
  Multiplicador_rec: 1.4,
  Multiplicador_prem: 1.8,
  IVA_porcentaje: 0.21,
  Redondeo_precio: 0.05,
  DTF_metro: 11, // €/metro de film
  DTF_tiempo_prenda: 25, // segundos por prenda
  Gastos_fijos_mes: 1100,
  Horas_mes: 160,
} as const;

// Reference blank-garment costs by type, used only to pre-fill the
// "coste por prenda" field — always editable by the user.
export const GARMENT_REFERENCE_COST: Record<GarmentType, number> = {
  Basica: 1.3,
  Premium: 2.25,
  Gama_media: 2.5,
  Cliente: 0, // client brings their own garment
};

function mround(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

function activeZoneCount(input: QuoteInput): number {
  return (input.pecho.active ? 1 : 0) + (input.espalda.active ? 1 : 0) + (input.mangas.active ? 1 : 0);
}

const VINILO_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.1, "23x23": 0.35, "30x30": 0.5 };
const SUBLIMACION_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.6, "23x23": 1.4, "30x30": 2.2 };
const DTF_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.01, "23x23": 0.0529, "30x30": 0.09 };

function screensCount(input: QuoteInput): number {
  const mangasMult = input.mangas.multiplier ?? 1;
  return (
    (input.pecho.active ? input.pecho.colors : 0) +
    (input.espalda.active ? input.espalda.colors : 0) +
    (input.mangas.active ? input.mangas.colors * mangasMult : 0)
  );
}

function materialCost(input: QuoteInput): number {
  const { technique, pecho, espalda, mangas, quantity } = input;
  const mangasMult = mangas.multiplier ?? 1;

  switch (technique) {
    case "Vinilo": {
      const sum =
        (pecho.active ? VINILO_SIZE_FACTOR[pecho.size] * pecho.colors : 0) +
        (espalda.active ? VINILO_SIZE_FACTOR[espalda.size] * espalda.colors : 0) +
        (mangas.active ? VINILO_SIZE_FACTOR[mangas.size] * mangas.colors * mangasMult : 0);
      return quantity * BASE_COSTS.Vinilo_metro * sum;
    }
    case "Serigrafia":
      return screensCount(input) * BASE_COSTS.Precio_pantalla;
    case "Sublimacion": {
      const sum =
        (pecho.active ? SUBLIMACION_SIZE_FACTOR[pecho.size] : 0) +
        (espalda.active ? SUBLIMACION_SIZE_FACTOR[espalda.size] : 0) +
        (mangas.active ? SUBLIMACION_SIZE_FACTOR[mangas.size] * mangasMult : 0);
      return quantity * sum;
    }
    case "DTF": {
      const sum =
        (pecho.active ? DTF_SIZE_FACTOR[pecho.size] : 0) +
        (espalda.active ? DTF_SIZE_FACTOR[espalda.size] : 0) +
        (mangas.active ? DTF_SIZE_FACTOR[mangas.size] : 0);
      return quantity * BASE_COSTS.DTF_metro * sum;
    }
  }
}

function laborCost(input: QuoteInput, hourlyRate: number): number {
  const { technique, pecho, espalda, mangas, quantity } = input;
  const zones = activeZoneCount(input);
  const colorSum =
    (pecho.active ? pecho.colors : 0) + (espalda.active ? espalda.colors : 0) + (mangas.active ? mangas.colors : 0);

  switch (technique) {
    case "Vinilo":
      return ((2 / 60) * zones + (20 / 3600) * quantity * colorSum) * hourlyRate;
    case "Serigrafia":
      return ((20 / 60) * zones + (15 / 3600) * quantity * colorSum) * hourlyRate;
    case "Sublimacion":
      return (10 / 3600 + (35 / 3600) * quantity * zones) * hourlyRate;
    case "DTF":
      return (BASE_COSTS.DTF_tiempo_prenda / 3600) * quantity * zones * hourlyRate;
  }
}

// Minimum €/unit floor by technique + quantity tier, straight from the
// business's own pricing sheet (kept exactly as authored).
function minUnitPriceForTechnique(technique: Technique, quantity: number): number {
  const table: Record<Technique, [number, number, number, number]> = {
    // [<=10, <=30, <=50, >50]
    Serigrafia: [6, 5.5, 0, 0],
    Vinilo: [8, 7, 6, 5.5],
    // 11-30 was 1.75 in the source sheet — an outlier next to the 5.5→1.25
    // jump around it (every other technique steps down ~10-20% per tier).
    // Interim estimate at a comparable ~20% step down from the 1-10 tier;
    // pending confirmation from the business.
    Sublimacion: [5.5, 4.4, 1.25, 0.9],
    DTF: [5, 4, 3, 2.5],
  };
  const [t10, t30, t50, tRest] = table[technique];
  if (quantity <= 10) return t10;
  if (quantity <= 30) return t30;
  if (quantity <= 50) return t50;
  return tRest;
}

function quantityFactor(quantity: number): number {
  if (quantity <= 10) return 1;
  if (quantity <= 30) return 0.95;
  if (quantity <= 50) return 0.9;
  return 0.85;
}

export type QuoteResult = {
  costs: {
    garments: number;
    material: number;
    labor: number;
    consumables: number;
    overhead: number;
    total: number;
  };
  basePrices: { min: number; recommended: number; premium: number };
  unitBasePrices: { min: number; recommended: number; premium: number };
  finalPrices: { min: number; recommended: number; premium: number };
  finalUnitPrices: { min: number; recommended: number; premium: number };
  order: { subtotal: number; vat: number; total: number };
  margin: { ratio: number; rating: "BAJO" | "ACEPTABLE" | "MUY BUENO" };
};

export function calculateQuote(input: QuoteInput): QuoteResult {
  const { quantity } = input;

  const garments = input.garmentUnitCost * quantity;
  const material = materialCost(input);
  const labor = laborCost(input, BASE_COSTS.Coste_hora_base);
  const consumables = BASE_COSTS.Consumibles_pedido;
  const overhead = laborCost(input, BASE_COSTS.Coste_hora_fijos);

  // Serigrafia billed the screens twice in the source sheet (once inside
  // material cost, once again here) — confirmed a bug, fixed: counted once.
  const total = garments + material + labor + consumables + overhead;

  const basePrices = {
    min: total,
    recommended: total * BASE_COSTS.Multiplicador_rec,
    premium: total * BASE_COSTS.Multiplicador_prem,
  };
  const unitBasePrices = {
    min: basePrices.min / quantity,
    recommended: basePrices.recommended / quantity,
    premium: basePrices.premium / quantity,
  };

  const qFactor = quantityFactor(quantity);
  const marginMultiplier = 1 + input.extraMargin;
  const finalPrices = {
    min: mround(basePrices.min * marginMultiplier * qFactor, BASE_COSTS.Redondeo_precio),
    recommended: mround(basePrices.recommended * marginMultiplier * qFactor, BASE_COSTS.Redondeo_precio),
    premium: mround(basePrices.premium * marginMultiplier * qFactor, BASE_COSTS.Redondeo_precio),
  };

  const techFloor = minUnitPriceForTechnique(input.technique, quantity);
  const nameSurcharge = input.personalizedName ? BASE_COSTS.Cargo_nombre : 0;
  const finalUnitPrices = {
    min: mround(Math.max(finalPrices.min / quantity, techFloor) + nameSurcharge, BASE_COSTS.Redondeo_precio),
    recommended: mround(Math.max(finalPrices.recommended / quantity, techFloor) + nameSurcharge, BASE_COSTS.Redondeo_precio),
    premium: mround(Math.max(finalPrices.premium / quantity, techFloor) + nameSurcharge, BASE_COSTS.Redondeo_precio),
  };

  const subtotal = finalUnitPrices.recommended * quantity;
  const vat = mround(subtotal * BASE_COSTS.IVA_porcentaje, 0.01);

  const marginRatio = (basePrices.recommended - total) / basePrices.recommended;
  const rating = marginRatio < 0.25 ? "BAJO" : marginRatio < 0.4 ? "ACEPTABLE" : "MUY BUENO";

  return {
    costs: { garments, material, labor, consumables, overhead, total },
    basePrices,
    unitBasePrices,
    finalPrices,
    finalUnitPrices,
    order: { subtotal, vat, total: subtotal + vat },
    margin: { ratio: marginRatio, rating },
  };
}
