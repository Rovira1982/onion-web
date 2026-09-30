import { describe, expect, test } from "vitest";
import { groupQuantityTotals } from "./design-group";

describe("groupQuantityTotals", () => {
  test("sums quantities across lines sharing a designGroupId", () => {
    const items = [
      { quantity: 10, designGroupId: "g1" },
      { quantity: 15, designGroupId: "g1" },
      { quantity: 5, designGroupId: "g1" },
    ];
    expect(groupQuantityTotals(items)).toEqual([30, 30, 30]);
  });

  test("treats items without a designGroupId as their own group", () => {
    const items = [{ quantity: 3 }, { quantity: 7 }];
    expect(groupQuantityTotals(items)).toEqual([3, 7]);
  });

  test("does not merge different groups", () => {
    const items = [
      { quantity: 10, designGroupId: "a" },
      { quantity: 20, designGroupId: "b" },
      { quantity: 5, designGroupId: "a" },
    ];
    expect(groupQuantityTotals(items)).toEqual([15, 20, 15]);
  });
});
