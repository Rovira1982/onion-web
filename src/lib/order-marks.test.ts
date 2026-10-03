import { describe, expect, it, vi } from "vitest";

// factusol.ts importa "server-only" (no se puede cargar fuera de Next).
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ prisma: {} }));
import { buildMarkRows } from "./order-marks";
import { personalizedUnitPrice } from "./line-price";
import { exportWarning } from "./factusol";
import type { QuoteInput } from "./pricing";

const off = { active: false, colors: 1, size: "10x10" as const };

function marking(over: Partial<QuoteInput>): QuoteInput {
  return {
    technique: "DTF",
    pecho: { active: true, colors: 1, size: "22x22" },
    espalda: off,
    mangas: off,
    garmentType: "Basica",
    garmentUnitCost: 0,
    quantity: 25,
    extraMargin: 0.7,
    personalizedName: false,
    ...over,
  };
}

describe("buildMarkRows", () => {
  it("DTF delante: tramo, precio y código de la tarifa", () => {
    const rows = buildMarkRows(marking({}), null, 25, 25);
    expect(rows).toEqual([
      { zone: "pecho", technique: "DTF", size: "22x22", colors: null, tierQty: 25, quantity: 25, unitPrice: 3.1, factusolCode: "DTF22_25" },
    ]);
  });

  it("el tramo sale de la cantidad del grupo, no de la línea", () => {
    const rows = buildMarkRows(marking({}), null, 5, 60);
    expect(rows[0].tierQty).toBe(50);
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].factusolCode).toBe("DTF22_50");
  });

  it("serigrafía: sin tamaño, con colores y código SERC", () => {
    const rows = buildMarkRows(
      marking({ technique: "Serigrafia", pecho: { active: true, colors: 2, size: "22x22" } }),
      null,
      50,
      50
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ size: null, colors: 2, tierQty: 50, factusolCode: "SERC2_50", unitPrice: 2.4 });
  });

  it("serigrafía por debajo de 10 uds no genera zonas (consultar)", () => {
    expect(buildMarkRows(marking({ technique: "Serigrafia" }), null, 5, 5)).toEqual([]);
  });

  it("dos mangas salen como dos filas", () => {
    const rows = buildMarkRows(marking({ pecho: off, mangas: { active: true, colors: 1, size: "10x10", multiplier: 2 } }), null, 10, 10);
    expect(rows.map((r) => r.zone)).toEqual(["manga_izquierda", "manga_derecha"]);
  });

  it("la suma de zonas coincide con el marcaje del precio de la línea", () => {
    const m = marking({ pecho: { active: true, colors: 1, size: "22x22" }, espalda: { active: true, colors: 1, size: "10x10" } });
    const garment = 11;
    const line = personalizedUnitPrice({ ...m, quantity: 25 }, garment)!;
    const rows = buildMarkRows(m, null, 25, 25);
    const marks = rows.reduce((s, r) => s + r.unitPrice, 0);
    expect(rows).toHaveLength(2);
    expect(Math.round((garment + marks) * 100) / 100).toBe(line);
  });
});

describe("exportWarning", () => {
  const line = (marks: ReturnType<typeof buildMarkRows>, unitPrice: number) => ({
    productName: "Dublin",
    quantity: 25,
    unitPrice,
    factusolArticleCode: "ABC",
    supplierSku: "ABC",
    size: "M",
    color: "Blanco",
    garmentCost: 11,
    markingCost: unitPrice - 11,
    marks,
  });

  it("no avisa cuando prenda + marcaje cuadran con la base del pedido", () => {
    const marks = buildMarkRows(marking({}), null, 25, 25);
    const unit = Math.round((11 + 3.1) * 100) / 100;
    const base = unit * 25;
    const order = { id: "abcdef123456", total: base * 1.21 + 6, shippingCost: 6, discountAmount: 0 };
    expect(exportWarning(order, [line(marks, unit)])).toBeNull();
  });

  it("avisa cuando el marcaje se contaría dos veces", () => {
    const marks = buildMarkRows(marking({}), null, 25, 25);
    // El pedido solo cobró la prenda, pero la línea dice que incluye marcaje.
    const order = { id: "abcdef123456", total: 11 * 25 * 1.21, shippingCost: 0, discountAmount: 0 };
    expect(exportWarning(order, [line(marks, 17.1)])).toContain("Avisar a Finanzas");
  });
});
