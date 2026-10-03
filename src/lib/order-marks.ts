import type { QuoteInput, PrintSize } from "./pricing";
import { markingUnitPrice, markingTierQty, markingFactusolCode } from "./marking-tariff";

export type MarkRow = {
  zone: string;
  technique: string;
  size: string | null;
  colors: number | null;
  tierQty: number;
  quantity: number;
  unitPrice: number;
  factusolCode: string | null;
};

// Una fila por zona activa (las dos mangas van separadas) con la técnica,
// el tramo y el precio de marcaje por unidad que se aplicaron — todo lo que
// el export a FactuSol necesita (especificación de Finanzas, 2026-10-03).
// El precio sale de la misma tarifa que personalizedUnitPrice, sobre la
// cantidad TOTAL del grupo de diseño, así que la suma de zonas coincide
// con markingCost de la línea.
export function buildMarkRows(
  marking: QuoteInput,
  design: { markings: Partial<Record<string, unknown>> } | null,
  lineQuantity: number,
  groupQuantity: number
): MarkRow[] {
  const tierQty = markingTierQty(groupQuantity);
  const isSerigrafia = marking.technique === "Serigrafia";
  const row = (zone: string, z: { size: PrintSize; colors: number }): MarkRow | null => {
    const unitPrice = markingUnitPrice(marking.technique, z, groupQuantity);
    if (unitPrice === null) return null;
    return {
      zone,
      technique: marking.technique,
      size: isSerigrafia ? null : z.size,
      colors: isSerigrafia ? Math.min(3, Math.max(1, z.colors)) : null,
      tierQty,
      quantity: lineQuantity,
      unitPrice,
      factusolCode: markingFactusolCode(marking.technique, z, tierQty),
    };
  };

  const rows: (MarkRow | null)[] = [];
  if (marking.pecho.active) rows.push(row("pecho", marking.pecho));
  if (marking.espalda.active) rows.push(row("espalda", marking.espalda));
  if (marking.mangas.active) {
    const sides = Math.max(1, marking.mangas.multiplier ?? 1);
    const placed = design?.markings;
    const names =
      sides >= 2
        ? ["manga_izquierda", "manga_derecha"]
        : [placed?.manga_derecha && !placed?.manga_izquierda ? "manga_derecha" : placed?.manga_izquierda ? "manga_izquierda" : "manga"];
    for (const name of names) rows.push(row(name, marking.mangas));
  }
  return rows.filter((r): r is MarkRow => r !== null);
}

