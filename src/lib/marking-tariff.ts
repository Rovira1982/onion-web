// Marking-only price tariff (sin prenda, sin IVA) — replaces
// minUnitPriceForTechnique's old cost-derived floors. Source: Finanzas'
// market-benchmarked proposal (2026-09-30), E:\onion\26\finanzas\
// propuesta-tarifas\Propuesta_Tarifas_Marcaje_v1.xlsx, sheet "Tabla_web".
// Each cell there is already max(mercado × 1.1, coste ÷ (1 − 0.3)) rounded
// up to 0.05€ — the floor logic is baked into the table, nothing to
// recompute here.
import type { Technique, PrintSize } from "./pricing";

// Quantity tiers as columns in Tabla_web, ascending. A quantity that falls
// between two tiers pays the lower one (confirmed with the business,
// 2026-09-30) — never undercharges relative to the table.
const QUANTITY_TIERS = [1, 5, 10, 25, 50, 100, 250, 500] as const;

// "consultar" = Serigrafía below 10 units has no set price (same treatment
// as REQUIRES_CONSULTATION elsewhere) — markingUnitPrice returns null.
type TierRow = readonly (number | "consultar")[];

// Tamaños renombrados 2026-10-01 (Finanzas): 23x23→22x22, 30x30→28x28 — misma
// tarifa de precios, solo cambia la etiqueta del tramo. Ver
// E:\onion\26\finanzas\propuesta-tarifas\Tabla_marcaje_tamanos_nuevos_v1.xlsx.
const DTF: Record<PrintSize, TierRow> = {
  "10x10": [5.3, 4.75, 4.15, 2.2, 1.5, 1.15, 0.95, 0.85],
  "22x22": [6.25, 5.7, 5.1, 3.1, 2.4, 2.05, 1.8, 1.7],
  "28x28": [6.95, 6.4, 5.9, 3.85, 3.15, 2.8, 2.55, 2.4],
};

const VINILO: Record<PrintSize, TierRow> = {
  "10x10": [4.85, 1.8, 1.5, 1.45, 1.4, 1.1, 1.05, 1.05],
  "22x22": [7, 3.95, 3.55, 3.4, 3.25, 3.2, 3.2, 3.2],
  "28x28": [8.25, 5.3, 5.1, 5, 4.8, 4.5, 4.5, 4.5],
};

const SUBLIMACION: Record<PrintSize, TierRow> = {
  "10x10": [8.8, 5.9, 2.3, 1.85, 1.2, 1.2, 1.15, 1.15],
  "22x22": [9.8, 6.6, 2.65, 2.4, 2.35, 2.35, 2.3, 2.3],
  "28x28": [11.25, 7.55, 3.75, 3.55, 3.5, 3.45, 3.45, 3.45],
};

// Serigrafía's tariff varies by number of colors, not print size.
const SERIGRAFIA_BY_COLORS: Record<1 | 2 | 3, TierRow> = {
  1: ["consultar", "consultar", 4.5, 2.1, 1.5, 0.95, 0.6, 0.5],
  2: ["consultar", "consultar", 7.2, 3.4, 2.4, 1.5, 0.95, 0.75],
  3: ["consultar", "consultar", 9.7, 4.55, 3.25, 2, 1.25, 1],
};

function tierValue(row: TierRow, quantity: number): number | "consultar" {
  let value: number | "consultar" = row[0];
  for (let i = 0; i < QUANTITY_TIERS.length; i++) {
    if (quantity >= QUANTITY_TIERS[i]) value = row[i];
  }
  return value;
}

// Price of marking one zone, per unit, for the given technique/size/colors
// at this quantity — null means "consultar" (no online price yet).
// Vinilo always requires consultation regardless of this table (see
// REQUIRES_CONSULTATION in AddToCartForm.tsx and the server-side check in
// checkout/actions.ts) — callers should gate that before reaching here.
export function markingUnitPrice(
  technique: Technique,
  zone: { size: PrintSize; colors: number },
  quantity: number
): number | null {
  const row =
    technique === "Serigrafia"
      ? SERIGRAFIA_BY_COLORS[Math.min(3, Math.max(1, zone.colors)) as 1 | 2 | 3]
      : technique === "DTF"
        ? DTF[zone.size]
        : technique === "Sublimacion"
          ? SUBLIMACION[zone.size]
          : VINILO[zone.size];

  const value = tierValue(row, quantity);
  return value === "consultar" ? null : value;
}

// One-time surcharge per order (not per line/unit) when the customer needs
// help preparing their design — Finanzas' proposal, decided by the owner
// 2026-09-30. DTF carries no surcharge even for non-vectorized art.
export const DESIGN_RETOUCH_SURCHARGE = 10;
