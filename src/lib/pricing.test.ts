import { describe, expect, test } from "vitest";
import { calculateQuote, type QuoteInput } from "./pricing";
import { personalizedUnitPrice } from "./line-price";
import { markingUnitPrice } from "./marking-tariff";
import { selectGarmentTier } from "./garment-price";

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
  // Recomputed 2026-09-30 for Coste_hora_base=13 (was 6) — the owner's
  // decision to price labor at real salary+SS cost instead of the old,
  // uncosted historical figure. 56.75 was correct for Coste_hora_base=6.
  test("matches the Excel reference case (DTF, espalda 30x30, 8 uds, prenda 1.65€)", () => {
    const result = calculateQuote(
      baseInput({
        espalda: { active: true, colors: 1, size: "30x30" },
        garmentUnitCost: 1.65,
        quantity: 8,
      })
    );
    expect(result.finalPrices.recommended).toBeCloseTo(57.65, 2);
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
  // catalog price must be added once, not run through a cost formula and
  // marked up a second time. As of 2026-09-30 the marking half comes from
  // the market-benchmarked tariff (marking-tariff.ts / Tabla_web), not
  // calculateQuote — values below are DTF pecho 10x10 straight from that
  // table (5.30 / 4.15 / 1.50 €) plus the garment (5.82€, Camiseta #E190).
  test("garment price is added once, marking priced separately, across quantity tiers", () => {
    const garmentPrice = 5.82;
    const marking = (quantity: number): QuoteInput =>
      baseInput({
        pecho: { active: true, colors: 1, size: "10x10" },
        garmentUnitCost: garmentPrice,
        quantity,
      });

    expect(personalizedUnitPrice(marking(1), garmentPrice)).toBeCloseTo(11.12, 2);
    expect(personalizedUnitPrice(marking(10), garmentPrice)).toBeCloseTo(9.97, 2);
    expect(personalizedUnitPrice(marking(50), garmentPrice)).toBeCloseTo(7.32, 2);
  });

  // Two active zones (pecho + espalda) must bill the tariff once per zone —
  // confirmed with the business, 2026-09-30.
  test("bills the marking tariff once per active zone", () => {
    const marking: QuoteInput = baseInput({
      pecho: { active: true, colors: 1, size: "10x10" },
      espalda: { active: true, colors: 1, size: "10x10" },
      garmentUnitCost: 5.82,
      quantity: 1,
    });
    // 5.82 (prenda) + 5.30 (pecho) + 5.30 (espalda)
    expect(personalizedUnitPrice(marking, 5.82)).toBeCloseTo(16.42, 2);
  });

  // Serigrafía under 10 units has no set tariff price ("consultar") — must
  // signal that with null rather than silently charging 0 or a wrong tier.
  test("returns null when the marking has no online price yet", () => {
    const marking: QuoteInput = baseInput({
      technique: "Serigrafia",
      pecho: { active: true, colors: 1, size: "10x10" },
      garmentUnitCost: 5.82,
      quantity: 5,
    });
    expect(personalizedUnitPrice(marking, 5.82)).toBeNull();
  });
});

describe("markingUnitPrice", () => {
  test("matches the tariff table at an exact tier", () => {
    expect(markingUnitPrice("DTF", { size: "10x10", colors: 1 }, 10)).toBe(4.15);
  });

  // Confirmed with the business, 2026-09-30: a quantity between two tiers
  // pays the lower tier's price — never undercharges relative to the table.
  test("rounds down to the nearest lower tier for off-grid quantities", () => {
    expect(markingUnitPrice("DTF", { size: "10x10", colors: 1 }, 7)).toBe(4.75); // tier 5, not 10
    expect(markingUnitPrice("DTF", { size: "10x10", colors: 1 }, 80)).toBe(1.5); // tier 50, not 100
  });

  test("Serigrafía under 10 units requires consultation (null)", () => {
    expect(markingUnitPrice("Serigrafia", { size: "10x10", colors: 1 }, 5)).toBeNull();
    expect(markingUnitPrice("Serigrafia", { size: "10x10", colors: 1 }, 10)).toBe(4.5);
  });
});

describe("selectGarmentTier", () => {
  const withTiers = { price: 2, pricePack: 1.8, priceBox: 1.5, unitsPerPack: 10, unitsPerCase: 100, incompleteData: false };

  test("picks unidad/pack/caja by quantity, opción A (Gorfactory)", () => {
    expect(selectGarmentTier(withTiers, 9)).toEqual({ price: 2, tier: "unidad" });
    expect(selectGarmentTier(withTiers, 10)).toEqual({ price: 1.8, tier: "pack" });
    expect(selectGarmentTier(withTiers, 99)).toEqual({ price: 1.8, tier: "pack" });
    expect(selectGarmentTier(withTiers, 100)).toEqual({ price: 1.5, tier: "caja" });
  });

  // Regla de repliegue: sin datos de tramo, siempre precio de unidad (el
  // más caro) — nunca se pierde margen ni se da precio 0.
  test("falls back to unidad when tier data is missing (repliegue)", () => {
    expect(selectGarmentTier({ ...withTiers, unitsPerPack: null, unitsPerCase: null }, 500)).toEqual({
      price: 2,
      tier: "unidad",
    });
    expect(selectGarmentTier({ ...withTiers, incompleteData: true }, 500)).toEqual({ price: 2, tier: "unidad" });
  });
});
