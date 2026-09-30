import { describe, expect, test } from "vitest";
import { calculateQuote, type QuoteInput } from "./pricing";
import { personalizedUnitPrice } from "./line-price";

const INACTIVE = { active: false, colors: 1, size: "10x10" } as const;

function baseInput(overrides: Partial<QuoteInput>): QuoteInput {
  return {
    technique: "DTF",
    pecho: { ...INACTIVE },
    espalda: { ...INACTIVE },
    mangas: { ...INACTIVE },
    garmentType: "Cliente",
    garmentUnitCost: 0,
    quantity: 1,
    extraMargin: 0.7,
    personalizedName: false,
    ...overrides,
  };
}

describe("calculateQuote", () => {
  // Real example from the source Excel ("Sistema Onion pruebas 2 - MEJORADO
  // v2.xlsx"), used to verify this port didn't drift from the spreadsheet.
  test("matches the Excel reference case (DTF, espalda 30x30, 8 uds, prenda 1.65€)", () => {
    const result = calculateQuote(
      baseInput({
        espalda: { active: true, colors: 1, size: "30x30" },
        garmentUnitCost: 1.65,
        quantity: 8,
      })
    );
    expect(result.finalPrices.recommended).toBeCloseTo(56.75, 2);
  });

  // Below ~10 units, DTF's own per-unit floor (5€) is above what the
  // formula would otherwise charge — the floor must win.
  test("applies the per-technique floor when the formula price falls under it", () => {
    const result = calculateQuote(
      baseInput({
        pecho: { active: true, colors: 1, size: "10x10" },
        quantity: 10,
      })
    );
    expect(result.finalUnitPrices.recommended).toBe(5);
  });

  // Serigrafía's screen cost must only be counted once (a bug in the source
  // sheet double-counted it) — 2 colors on pecho + 1 on espalda = 3 screens
  // at 15€ each, not 6 screens.
  test("counts Serigrafia screens once, not twice", () => {
    const result = calculateQuote(
      baseInput({
        technique: "Serigrafia",
        pecho: { active: true, colors: 2, size: "10x10" },
        espalda: { active: true, colors: 1, size: "10x10" },
        quantity: 1,
      })
    );
    expect(result.costs.material).toBe(45); // 3 screens x 15€, not 6 x 15€
  });
});

describe("personalizedUnitPrice", () => {
  // Regression guard for the "prenda cobrada dos veces" bug: the garment's
  // catalog price must be added once, not fed into calculateQuote as a cost
  // and marked up a second time. Verified by hand and in the browser against
  // a real catalog product (Camiseta #E190 hombre, 5.82€, DTF pecho 10x10).
  test("garment price is added once, marking priced separately, across quantity tiers", () => {
    const garmentPrice = 5.82;
    const marking = (quantity: number): QuoteInput =>
      baseInput({
        pecho: { active: true, colors: 1, size: "10x10" },
        garmentUnitCost: garmentPrice,
        quantity,
      });

    expect(personalizedUnitPrice(marking(1), garmentPrice)).toBeCloseTo(11.07, 2);
    expect(personalizedUnitPrice(marking(10), garmentPrice)).toBeCloseTo(10.82, 2);
    expect(personalizedUnitPrice(marking(50), garmentPrice)).toBeCloseTo(8.82, 2);
  });
});
