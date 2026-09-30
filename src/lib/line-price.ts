import type { QuoteInput } from "@/lib/pricing";
import { markingUnitPrice } from "@/lib/marking-tariff";

// Historical constant — no longer used by personalizedUnitPrice (the new
// marking-tariff.ts prices are already final sale prices, market-checked,
// not a cost×margin formula). Kept exported because callers still build a
// full QuoteInput (calculateQuote's shape, shared with the presupuesto
// pages) and pass this as its extraMargin field.
export const PERSONALIZED_EXTRA_MARGIN = 0.7;

// Unit price of a personalized cart line = the garment at its catalog price
// (already tiered by quantity — see garment-price.ts) + the marking, priced
// per active zone from the market-benchmarked tariff (marking-tariff.ts).
// Each active zone is billed separately (pecho/espalda count once, mangas
// counts once per side chosen) — confirmed with the business, 2026-09-30.
// Returns null when any active zone's technique/quantity combination has no
// set price yet (Serigrafía under 10 units) — caller must route to "pide
// presupuesto" same as REQUIRES_CONSULTATION today.
export function personalizedUnitPrice(marking: QuoteInput, garmentPrice: number): number | null {
  const zones: { active: boolean; size: QuoteInput["pecho"]["size"]; colors: number; count: number }[] = [
    { ...marking.pecho, count: 1 },
    { ...marking.espalda, count: 1 },
    { ...marking.mangas, count: marking.mangas.multiplier ?? 1 },
  ];

  let markTotal = 0;
  for (const zone of zones) {
    if (!zone.active) continue;
    const unitPrice = markingUnitPrice(marking.technique, zone, marking.quantity);
    if (unitPrice === null) return null;
    markTotal += unitPrice * zone.count;
  }

  return Math.round((garmentPrice + markTotal) * 100) / 100;
}
