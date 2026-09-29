import { calculateQuote, type QuoteInput } from "@/lib/pricing";

// Fixed business margin — the customer never sets their own margin, this
// mirrors the default already used across the presupuestador (Excel's own
// default, Margen_extra = 0.7). Shared by client and server so checkout
// never depends on a margin sent from the browser.
export const PERSONALIZED_EXTRA_MARGIN = 0.7;

// Unit price of a personalized cart line = the garment at its catalog price
// (variant.price, which already carries the supplier ×2 from the importers)
// + the marking priced on its own by calculateQuote with the garment cost
// zeroed out. Previously the catalog price was fed into calculateQuote as
// the garment cost, so the garment got marked up a second time
// (×1.4 × (1 + extraMargin) × quantity factor), ~4.8× its real cost.
export function personalizedUnitPrice(marking: QuoteInput, garmentPrice: number): number {
  const marks = calculateQuote({ ...marking, garmentUnitCost: 0 }).finalUnitPrices.recommended;
  return Math.round((garmentPrice + marks) * 100) / 100;
}
