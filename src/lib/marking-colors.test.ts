import { describe, expect, it } from "vitest";
import { isDarkGarmentColor } from "./marking-colors";

describe("isDarkGarmentColor", () => {
  it("prendas oscuras", () => {
    for (const c of ["Negro", "Black", "Azul marino", "Navy", "Burdeos", "Verde botella", "Rojo", "Gris oscuro"]) {
      expect(isDarkGarmentColor(c), c).toBe(true);
    }
  });

  it("prendas claras o desconocidas", () => {
    for (const c of ["Blanco", "White", "Crudo", "Amarillo", "Gris", "Azul claro", "Rosa", "Beige", "", "Multicolor"]) {
      expect(isDarkGarmentColor(c), c).toBe(false);
    }
  });
});
