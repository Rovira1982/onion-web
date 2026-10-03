import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { markingFactusolCode, markingTierQty, markingUnitPrice } from "./marking-tariff";
import type { Technique, PrintSize } from "./pricing";

// Tabla de códigos de FactuSol de Finanzas (copia de E:\onion\26\finanzas\
// especificaciones\Mapa_marcaje_codigos_FACTUSOL.csv). Si la tarifa o la regla
// de códigos cambian en la web sin cambiar la tabla de FactuSol (o al revés),
// este test lo detecta.
const rows = readFileSync(join(__dirname, "marking-codes.fixture.csv"), "utf8")
  .replace(/^﻿/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split(";"));

describe("mapa de marcaje FactuSol", () => {
  it("tiene las 138 filas de la especificación", () => {
    expect(rows).toHaveLength(138);
  });

  // 23x23 y 30x30 siguen en FactuSol por pedidos antiguos pero la web ya no
  // los ofrece (ahora 22x22 y 28x28, mismos precios).
  const current = rows.filter(([, size]) => size !== "23x23" && size !== "30x30");

  for (const [tecnica, size, colores, tramo, codigo, , precio] of current) {
    it(`${codigo}: código y precio coinciden con la tarifa`, () => {
      const technique = tecnica as Technique;
      const zone = { size: (size || "10x10") as PrintSize, colors: Number(colores || 1) };
      const tier = Number(tramo);
      expect(markingTierQty(tier)).toBe(tier);
      expect(markingFactusolCode(technique, zone, tier)).toBe(codigo);
      expect(markingUnitPrice(technique, zone, tier)).toBeCloseTo(Number(precio), 2);
    });
  }

  it("una cantidad intermedia paga el tramo inferior", () => {
    expect(markingTierQty(24)).toBe(10);
    expect(markingTierQty(499)).toBe(250);
    expect(markingTierQty(1000)).toBe(500);
  });

  it("serigrafía por debajo de 10 uds no tiene código ni precio", () => {
    expect(markingFactusolCode("Serigrafia", { size: "10x10", colors: 2 }, 5)).toBeNull();
    expect(markingUnitPrice("Serigrafia", { size: "10x10", colors: 2 }, 9)).toBeNull();
  });
});
