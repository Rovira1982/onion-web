// Quote/pricing engine — ported from the business's real Excel tool
// ("Sistema Onion pruebas 2 - MEJORADO v2.xlsx", sheets PRESUPUESTOS_RAPIDOS +
// Costes_Base). Verified against a real example from that file (DTF, espalda
// 28x28, 8 uds, coste prenda 1.65€, margen 0.7) — matched the spreadsheet
// exactly before three confirmed corrections: the Serigrafia double screen
// charge, the Sublimacion 11-30-unit floor, and the DTF_coste_m2 fix below.
// See inline notes below.
//
// Note on minUnitPriceForTechnique: the garment's own margin is a separate,
// flexible lever (the business may sell the garment closer to cost on large
// orders) — it does not belong inside this floor. The floor only needs to
// guarantee the technique's own material+time cost is covered, which the
// Excel-sourced minimums already do with headroom (checked: DTF's 5€ floor
// at the ≤10-unit tier vs. ~1.08€ of actual material+labor for a 28x28 mark).
export type Technique = "Serigrafia" | "Vinilo" | "Sublimacion" | "DTF";
// Tamaños renombrados 2026-10-01 (Finanzas): 23x23→22x22, 30x30→28x28 — misma
// tabla de precios, solo cambia la etiqueta del tramo (ver marking-tariff.ts).
export type PrintSize = "10x10" | "22x22" | "28x28";
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
  Coste_hora_base: 13, // €/h — labor (dueño, 2026-09-30: salario + SS del operario; antes 6€, coste histórico sin cotización)
  Coste_hora_fijos: 6.9, // €/h — fixed-overhead allocation (1.100€/mes ÷ 160h)
  Vinilo_metro: 6,
  Consumibles_pedido: 2, // € flat per order
  Precio_pantalla: 15, // € per screen (Serigrafia)
  Cargo_nombre: 1.5, // €/unit surcharge for personalized names
  Multiplicador_rec: 1.4,
  Multiplicador_prem: 1.8,
  IVA_porcentaje: 0.21,
  Redondeo_precio: 0.05,
  // Coste real del film DTF por m² — corregido 2026-10-01 (Finanzas): la
  // bobina real mide 0,55m de ancho, así que "1 metro" de rollo son 0,55m²
  // reales, no 1m². Antes esta constante se llamaba DTF_metro=11 y el código
  // la trataba como si fueran 11€/m², cuando en realidad son 11€ por
  // 0,55m² (= 20€/m² real) — infravaloraba el coste del film en ~45%. Solo
  // corrige el coste/margen interno de calculateQuote (función ya sustituida
  // por marking-tariff.ts para el precio real al cliente) — no cambia nada
  // de cara al cliente.
  DTF_coste_m2: 20, // €/m² real de film (11€ ÷ 0,55m²)
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

const VINILO_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.1, "22x22": 0.35, "28x28": 0.5 };
const SUBLIMACION_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.6, "22x22": 1.4, "28x28": 2.2 };
const DTF_SIZE_FACTOR: Record<PrintSize, number> = { "10x10": 0.01, "22x22": 0.0529, "28x28": 0.09 };

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
      return quantity * BASE_COSTS.DTF_coste_m2 * sum;
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

// ---------------------------------------------------------------------------
// Multi-mark model (Anexo A of docs/blueprint.md) — for team/sportswear-style
// orders where pecho and espalda each carry several independent marks instead
// of one zone. Additive to the model above: calculateQuote/QuoteInput above
// are untouched and still power the general-merchandise presupuestador.
//
// Rules (Anexo A, closed with the business):
// - Pecho: up to 3 independent marks — bolsillo_izq (10x10), bolsillo_der
//   (10x10), diafragma (22x22).
// - Espalda: up to 3 independent marks — nombre, dorsal, logo_espalda.
// - Each active mark is billed in full (its own material+labor cost) even if
//   production could share a pass — explicit business decision, not an
//   optimization target.
// - Main logo marks (pecho + logo_espalda) → DTF: cost = area_m2 ×
//   DTF_coste_m2 (20€/m² real, ver BASE_COSTS).
// - Nombre → Vinilo (in-house), flat 2€/unit. Dorsal → Vinilo, flat 3€/unit.
//   Both flat charges stack (5€/unit combined), added after the margin
//   pipeline — the same treatment calculateQuote gives personalizedName.
// - Mangas is unchanged from the model above: same PrintZone shape, same
//   per-technique formulas, its own technique choice.
export type DtfMarkPosition = "bolsillo_izq" | "bolsillo_der" | "diafragma" | "logo_espalda";

export type DtfMark = {
  position: DtfMarkPosition;
  active: boolean;
  size: PrintSize; // diafragma should use "22x22"
};

export const CARGO_NOMBRE_EQUIPACION = 2; // €/unit, vinilo — Anexo A
export const CARGO_DORSAL_EQUIPACION = 3; // €/unit, vinilo — Anexo A

export type TeamGarmentQuoteInput = {
  pechoMarks: DtfMark[]; // up to 3: bolsillo_izq, bolsillo_der, diafragma
  espaldaLogo?: DtfMark; // the 4th possible DTF mark, on the back
  nombre: boolean; // +2€/ud
  dorsal: boolean; // +3€/ud
  mangas: PrintZone & { multiplier?: number; technique: Technique };
  garmentType: GarmentType;
  garmentUnitCost: number;
  quantity: number;
  extraMargin: number;
};

export type TeamGarmentQuoteResult = QuoteResult & {
  activeDtfMarks: DtfMarkPosition[];
  nombreDorsalSurcharge: number;
};

const INACTIVE_ZONE: PrintZone = { active: false, colors: 1, size: "10x10" };

export function calculateTeamGarmentQuote(input: TeamGarmentQuoteInput): TeamGarmentQuoteResult {
  const { quantity } = input;

  const activeDtfMarks: DtfMark[] = [
    ...input.pechoMarks.filter((m) => m.active),
    ...(input.espaldaLogo?.active ? [input.espaldaLogo] : []),
  ];

  // Reuse the verified single-zone engine to get mangas' own material/labor/
  // overhead contribution, instead of re-deriving its per-technique formulas.
  // garmentUnitCost/extraMargin are zeroed out here — this shim is only read
  // for its .costs.{material,labor,overhead}, everything else is discarded.
  const mangasCosts = input.mangas.active
    ? calculateQuote({
        technique: input.mangas.technique,
        pecho: INACTIVE_ZONE,
        espalda: INACTIVE_ZONE,
        mangas: input.mangas,
        garmentType: input.garmentType,
        garmentUnitCost: 0,
        quantity,
        extraMargin: 0,
        personalizedName: false,
      }).costs
    : { material: 0, labor: 0, overhead: 0 };

  const dtfMaterial = activeDtfMarks.reduce(
    (sum, m) => sum + quantity * BASE_COSTS.DTF_coste_m2 * DTF_SIZE_FACTOR[m.size],
    0
  );
  const dtfLabor = activeDtfMarks.length * (BASE_COSTS.DTF_tiempo_prenda / 3600) * quantity * BASE_COSTS.Coste_hora_base;
  const dtfOverhead =
    activeDtfMarks.length * (BASE_COSTS.DTF_tiempo_prenda / 3600) * quantity * BASE_COSTS.Coste_hora_fijos;

  const garments = input.garmentUnitCost * quantity;
  const material = mangasCosts.material + dtfMaterial;
  const labor = mangasCosts.labor + dtfLabor;
  const overhead = mangasCosts.overhead + dtfOverhead;
  const consumables = BASE_COSTS.Consumibles_pedido;
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

  // Floor: the highest minimum among techniques actually in play. Not part of
  // the closed spec (which only defines per-mark pricing, not a combined
  // floor) — this is a conservative interpretation, kept explicit so it's
  // easy to revisit: never sell below the strictest applicable technique
  // minimum rather than averaging or ignoring it.
  const floors = [
    activeDtfMarks.length > 0 ? minUnitPriceForTechnique("DTF", quantity) : 0,
    input.mangas.active ? minUnitPriceForTechnique(input.mangas.technique, quantity) : 0,
  ];
  const techFloor = Math.max(...floors);

  const nombreDorsalSurcharge =
    (input.nombre ? CARGO_NOMBRE_EQUIPACION : 0) + (input.dorsal ? CARGO_DORSAL_EQUIPACION : 0);

  const finalUnitPrices = {
    min: mround(Math.max(finalPrices.min / quantity, techFloor) + nombreDorsalSurcharge, BASE_COSTS.Redondeo_precio),
    recommended: mround(
      Math.max(finalPrices.recommended / quantity, techFloor) + nombreDorsalSurcharge,
      BASE_COSTS.Redondeo_precio
    ),
    premium: mround(
      Math.max(finalPrices.premium / quantity, techFloor) + nombreDorsalSurcharge,
      BASE_COSTS.Redondeo_precio
    ),
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
    activeDtfMarks: activeDtfMarks.map((m) => m.position),
    nombreDorsalSurcharge,
  };
}
