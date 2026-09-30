import { describe, expect, test } from "vitest";
import { consolidateSku, gorfactoryHandlingFee, gorfactoryShipping, type SkuCostInput } from "./supplier-batching";

function costInput(overrides: Partial<SkuCostInput>): SkuCostInput {
  return {
    costUnit: 2.0,
    costPack: 1.8,
    costBox: 1.5,
    unitsPerPack: 5,
    unitsPerCase: 100,
    incompleteData: false,
    ...overrides,
  };
}

describe("consolidateSku", () => {
  test("picks unidad below the pack threshold", () => {
    const result = consolidateSku(costInput({}), 3);
    expect(result).toMatchObject({ orderedQuantity: 3, priceTier: "unidad", unitCost: 2.0, boxRounded: false, surplusQuantity: 0 });
    expect(result.lineCost).toBeCloseTo(6.0, 2);
  });

  test("picks pack at the pack threshold", () => {
    const result = consolidateSku(costInput({}), 5);
    expect(result).toMatchObject({ orderedQuantity: 5, priceTier: "pack", unitCost: 1.8 });
  });

  test("picks caja at or above the case threshold", () => {
    const result = consolidateSku(costInput({}), 100);
    expect(result).toMatchObject({ orderedQuantity: 100, priceTier: "caja", unitCost: 1.5, boxRounded: false });
  });

  // Beagle real case from the spec: unitsPerCase=96, requesting fewer units
  // than a case is still cheaper to round up because pack pricing on the
  // full requested quantity would cost more than just buying the case.
  test("rounds up to caja when it's cheaper than the requested quantity at pack price (Beagle-style)", () => {
    const result = consolidateSku(
      costInput({ costPack: 2.0, costBox: 1.0, unitsPerPack: 10, unitsPerCase: 96 }),
      90,
    );
    // 90 * 2.00 = 180.00 >= 96 * 1.00 = 96.00 -> compensates rounding up.
    expect(result).toMatchObject({ orderedQuantity: 96, priceTier: "caja", unitCost: 1.0, boxRounded: true, surplusQuantity: 6 });
    expect(result.lineCost).toBeCloseTo(96.0, 2);
  });

  test("does not round up to caja when it would not compensate", () => {
    const result = consolidateSku(costInput({ costPack: 1.8, costBox: 1.79, unitsPerPack: 5, unitsPerCase: 100 }), 90);
    // 90 * 1.8 = 162.00 < 100 * 1.79 = 179.00 -> not worth it, stays on pack tier.
    expect(result).toMatchObject({ orderedQuantity: 90, priceTier: "pack", boxRounded: false, surplusQuantity: 0 });
  });

  test("falls back to unidad (regla de repliegue) when tier data is incomplete", () => {
    const result = consolidateSku(costInput({ incompleteData: true }), 200);
    expect(result).toMatchObject({ orderedQuantity: 200, priceTier: "unidad", unitCost: 2.0, boxRounded: false });
  });
});

describe("gorfactoryHandlingFee", () => {
  test.each([
    [4, 0],
    [5, 0],
    [6, 0.3],
    [10, 0],
    [13, 0.3],
    [1, 0],
  ])("orderedQuantity=%i -> %f", (quantity, expected) => {
    expect(gorfactoryHandlingFee(quantity)).toBeCloseTo(expected, 2);
  });
});

describe("gorfactoryShipping", () => {
  test("below 200€ with 1 bulto charges 4.50€", () => {
    expect(gorfactoryShipping(6.54, 1)).toEqual({ shippingCost: 4.5, quoteFromAccountManager: false });
  });

  test("below 200€ with 2 bultos charges 8.00€", () => {
    expect(gorfactoryShipping(150, 2)).toEqual({ shippingCost: 8.0, quoteFromAccountManager: false });
  });

  test("at or above 200€ is quoted by the account manager", () => {
    expect(gorfactoryShipping(200, 1)).toEqual({ shippingCost: 0, quoteFromAccountManager: true });
    expect(gorfactoryShipping(310.2, 3)).toEqual({ shippingCost: 0, quoteFromAccountManager: true });
  });
});
