import { describe, expect, it, vi } from "vitest";

// factusol.ts importa "server-only" (falla fuera de un servidor de Next).
vi.mock("server-only", () => ({}));
import { exportWarning, groupMarks, lineaRows, shippingNet } from "./factusol";

type Line = Parameters<typeof groupMarks>[0][number];

const mark = (zone: string, quantity: number, colorName: string | null = "Blanco", size = "10x10"): Line["marks"][number] => ({
  zone,
  technique: "DTF",
  size,
  colors: null,
  tierQty: 10,
  quantity,
  unitPrice: 4.15,
  factusolCode: "DTF10_10",
  colorName,
});

const garment = (qty: number, size: string, marks: Line["marks"]): Line => ({
  productName: "Camiseta",
  quantity: qty,
  unitPrice: 14.12, // 5,82 de prenda + 2 × 4,15 de marcaje
  factusolArticleCode: "TTX-CGTU03T",
  supplierSku: null,
  size,
  color: "Blanco",
  garmentCost: 5.82,
  markingCost: 8.3,
  marks,
});

// Pedido de prueba de Finanzas: 12 camisetas (5/5/2), DTF 10x10 delante y detrás.
const lines = [
  garment(5, "S", [mark("pecho", 5), mark("espalda", 5)]),
  garment(5, "M", [mark("pecho", 5), mark("espalda", 5)]),
  garment(2, "L", [mark("pecho", 2), mark("espalda", 2)]),
];

describe("exportación a FactuSol", () => {
  it("el marcaje sale en una línea por zona sumando tallas", () => {
    const grouped = groupMarks(lines);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((m) => m.quantity)).toEqual([12, 12]);
  });

  it("distinto color o tamaño en la misma zona = líneas separadas", () => {
    const mixed = [garment(1, "S", [mark("pecho", 1, "Blanco")]), garment(1, "M", [mark("pecho", 1, "Negro")]), garment(1, "L", [mark("pecho", 1, "Blanco", "22x22")])];
    expect(groupMarks(mixed)).toHaveLength(3);
  });

  it("no modifica las líneas de origen al agrupar", () => {
    groupMarks(lines);
    expect(lines[0].marks[0].quantity).toBe(5);
  });

  it("el envío va sin IVA: 6 € → 4,96 €", () => {
    expect(shippingNet(6)).toBe(4.96);
    const rows = lineaRows(1, lines, 7);
    const ship = rows.find((r) => r.D === "SRV-PORTES")!;
    expect(ship.J).toBe(5.79);
    expect(rows).toHaveLength(3 + 2 + 1);
  });

  it("el aviso cuadra con el envío incluido (total 211,02 €)", () => {
    expect(exportWarning({ id: "abcdef12", total: 211.02, shippingCost: 6, discountAmount: 0 }, lines)).toBeNull();
  });

  it("con envío de 7 € el aviso también cuadra (total 212,02 €)", () => {
    expect(exportWarning({ id: "abcdef12", total: 212.02, shippingCost: 7, discountAmount: 0 }, lines)).toBeNull();
  });

  it("avisa si las líneas no cuadran con la base", () => {
    expect(exportWarning({ id: "abcdef12", total: 212.28, shippingCost: 6, discountAmount: 0 }, lines)).toContain("diferencia");
  });
});
