import { describe, expect, it } from "vitest";
import { cleanDescription, cleanName } from "./text-clean";
import { parseColorLabel, sizeTailPattern } from "./import-makito";

describe("limpieza de textos de proveedor", () => {
  it("quita HTML y dobles espacios de un nombre", () => {
    expect(cleanName("Calzado de seguridad Climb GTX<br/>")).toBe("Calzado de seguridad Climb GTX");
    expect(cleanName("Sudadera  ecorresponsable de cuello redondo")).toBe("Sudadera ecorresponsable de cuello redondo");
    expect(cleanName("EUROPA  ")).toBe("EUROPA");
  });

  it("deja un nombre normal igual", () => {
    expect(cleanName("Camiseta algodón 160g")).toBe("Camiseta algodón 160g");
  });

  it("limpia HTML y entidades de una descripción conservando los saltos de línea", () => {
    expect(cleanDescription("Línea 1<br/>Línea&nbsp;2 &amp; más")).toBe("Línea 1\nLínea 2 & más");
  });

  it("no toca null ni descripciones sin HTML", () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("  texto simple ")).toBe("texto simple");
  });
});

describe("tallas de Makito escritas con otro nombre", () => {
  it("reconoce 2XL como XXL y XXXL como 3XL", () => {
    expect(sizeTailPattern("XXL").test("Blanco 2XL")).toBe(true);
    expect(sizeTailPattern("3XL").test("Amarillo XXXL")).toBe(true);
    expect(sizeTailPattern("M").test("Blanco XL")).toBe(false);
  });

  it("deja el color limpio al quitar el sufijo", () => {
    expect(parseColorLabel("Epika", "Camiseta Epika Blanco 2XL", "XXL")).toBe("Blanco");
    expect(parseColorLabel("Rauric", "Polo Rauric Amarillo XXXL", "3XL")).toBe("Amarillo");
    expect(parseColorLabel("Dretius", "Sudadera Dretius Gris L", "L")).toBe("Gris");
  });
});

describe("helpers compartidos de CSV", () => {
  it("csvEscape protege comas, comillas y saltos de línea", async () => {
    const { csvEscape } = await import("./_util");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('di "hola"')).toBe('"di ""hola"""');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(3.5)).toBe("3.5");
  });

  it("writeCsv escribe con BOM y saltos de línea \n, igual que antes", async () => {
    const { writeCsv } = await import("./_util");
    const { readFileSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const file = join(mkdtempSync(join(tmpdir(), "csv-")), "x.csv");
    writeCsv(file, ["a,b", "1,2"]);
    expect(readFileSync(file).toString("utf8")).toBe("﻿a,b\n1,2");
  });
});

describe("nombres repetidos de proveedor", () => {
  const item = (id: string, sku: string, category: string, color: string, supplier = "Valento") => ({
    id, name: "THUNDER", base: "THUNDER", sku, supplierId: "s", supplier, category, color,
  });

  it("separa por categoría cuando la categoría distingue", async () => {
    const { suffixesFor } = await import("./disambiguate-names");
    const s = suffixesFor([item("1", "A", "polos", ""), item("2", "B", "PANTALONES", "")]);
    expect(s.get("1")).toBe("Polos");
    expect(s.get("2")).toBe("Pantalones");
  });

  it("si la categoría coincide usa el color de un solo color; el otro queda con el nombre base", async () => {
    const { suffixesFor } = await import("./disambiguate-names");
    const s = suffixesFor([item("1", "A", "polos", "azul"), item("2", "B", "polos", "")]);
    expect(s.get("1")).toBe("Azul");
    expect(s.get("2")).toBe("");
  });

  it("en Cifra distingue por color y no por la categoría", async () => {
    const { suffixesFor } = await import("./disambiguate-names");
    const s = suffixesFor([
      item("1", "10552", "Bolsas", "Rojo", "Cifra"),
      item("2", "10552-2", "Otros artículos", "Negro", "Cifra"),
    ]);
    expect(s.get("1")).toBe("Rojo");
    expect(s.get("2")).toBe("Negro");
  });

  it("ningún nombre final se repite aunque todo coincida", async () => {
    const { suffixesFor } = await import("./disambiguate-names");
    const s = suffixesFor([item("1", "A", "polos", ""), item("2", "B", "polos", "")]);
    expect(new Set([...s.values()]).size).toBe(2);
  });
});
