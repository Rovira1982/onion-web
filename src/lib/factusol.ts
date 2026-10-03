import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import type { OrderDetail } from "./orders";

// Generates the files FactuSol needs to import web orders as "Pedido de
// cliente": CLI.xlsx (customer), PCL.xlsx (order header), LPC.xlsx (order
// lines) — either for one order (buildCliente/buildPedido/buildLineas, used
// by the per-order "Descargar ZIP" button) or for every not-yet-exported
// order at once (buildClientesBulk/buildPedidosBulk/buildLineasBulk, used
// by the "Exportar pedidos nuevos" button on /admin/pedidos).
//
// Column positions below come from E:\onion\26\finanzas\factusol-import\pedido_prueba\
// (CLI/PCL/LPC.xlsx) — Finanzas' own hand-corrected files for a real test
// order (197937, 02/10/2026), read cell-by-cell to confirm exact column
// letters. FactuSol imports by column POSITION, not header name — the
// original version of this file wrote columns back-to-back with no gaps,
// which produced 3 real import errors (PCL col O, PCL col Q, LPC col H)
// because FactuSol expects specific blank columns in between (e.g. PCL's
// "Importe neto 1" is column S, not column O). Diagnosed by Finanzas,
// 2026-10-02, via Operaciones.
//
// Open assumptions, flagged for review rather than guessed silently:
// - Client code (CLI col. A, PCL col. G): follows Josep's real FactuSol
//   numbering (confirmed 2026-10-02 via Finanzas — his highest existing
//   code is 181), not a hash. See resolveFactusolClientCode() below.
// - Document number (PCL & LPC col. B): correlativo desde 1 (Josep,
//   2026-10-02 — su FactuSol no tiene ningún pedido de cliente creado
//   todavía, así que no hace falta seguir ninguna numeración existente).
//   Asignado la primera vez que el pedido se exporta (individual o en
//   bloque) y conservado después — ver resolveFactusolDocNumber().
// - Forma de pago (PCL col. BL): "TAR"/"BIZ"/"TRA" — matches the reference
//   file's "TAR" for a card order; confirm these exist in FactuSol's
//   Formas de pago (FPA) table for BIZ/TRA too.
// - Artículo (LPC col. D): uses the product's factusolCode, falling back to
//   supplierCode, then to the raw supplierSku if the maestro de precios
//   hasn't reached that product yet (import-maestro-precios.ts populates
//   both factusolCode/supplierCode — ~7.5k of ~14k products covered as of
//   2026-10-02). A line whose product never got a maestro code will export
//   with its supplierSku, which likely won't match any FactuSol Artículo.
// - Marcaje: deliberately NOT exported as separate lines yet (Finanzas,
//   2026-10-02) — the technique (DTF/Serigrafía/Vinilo/Sublimación) chosen
//   per line isn't persisted anywhere today, only used transiently to
//   price the order. Exporting a guessed generic code would be worse than
//   omitting it. Once that field exists, each marking zone should become
//   its own LPC line using FactuSol's own tiered article codes (prefix +
//   size + "_" + quantity tier, e.g. "DTF22_25", "SERC2_50" for 2-color
//   serigraphy) — see tarifas/completo/LTA.xlsx. Until then, Josep adds
//   marcaje to the FactuSol order by hand after import.
// - IVA: every line/order is treated as a single 21% tier (tipo 1). We
//   don't currently support mixed VAT rates within one order.

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const PAYMENT_CODE: Record<string, string> = { tarjeta: "TAR", bizum: "BIZ", transferencia: "TRA" };

// No existe un artículo "GASTOS-ENVIO" en FACTUSOL — el envío va como el
// servicio puntual SRV-PORTES (Finanzas, 2026-10-02).
const SHIPPING_ARTICLE = "SRV-PORTES";

// Último código real confirmado por Josep (2026-10-02): 181 — el contador
// no vive en una fila aparte, se deriva del máximo ya guardado (o 181 si la
// tabla está vacía) para no arrastrar un contador que se desincronice.
const LAST_KNOWN_FACTUSOL_CODE = 181;

// Resuelve el código de cliente de FactuSol para un NIF: reutiliza el que
// ya tuviera asignado (asignado automáticamente en un pedido anterior, o
// corregido a mano por Josep desde la página del pedido), o asigna el
// siguiente libre y lo guarda. `isNew` indica si este NIF no tenía código
// hasta ahora mismo — el llamador decide si eso basta para incluir
// CLI.xlsx, o si fuerza incluirlo igualmente (interruptor "Incluir CLI.xlsx
// aunque el cliente ya tenga código", Finanzas 2026-10-02: Josep puede
// borrar un cliente de prueba en FactuSol sin que la web se entere).
export async function resolveFactusolClientCode(nif: string): Promise<{ code: number; isNew: boolean }> {
  const existing = await prisma.factusolClient.findUnique({ where: { nif } });
  if (existing) return { code: existing.code, isNew: false };

  const highest = await prisma.factusolClient.aggregate({ _max: { code: true } });
  const nextCode = Math.max(highest._max.code ?? LAST_KNOWN_FACTUSOL_CODE, LAST_KNOWN_FACTUSOL_CODE) + 1;
  await prisma.factusolClient.create({ data: { nif, code: nextCode } });
  return { code: nextCode, isNew: true };
}

// Solo lectura, sin efecto secundario — para mostrarlo en el admin sin
// gastar un número de la secuencia solo por abrir la página del pedido
// (resolveFactusolClientCode() de arriba SÍ asigna uno si no existe, pero
// eso debe pasar únicamente al generar el ZIP de verdad).
export async function getFactusolClientCode(nif: string): Promise<number | null> {
  const existing = await prisma.factusolClient.findUnique({ where: { nif } });
  return existing?.code ?? null;
}

// Permite a Josep corregir/fijar el código de un NIF concreto desde el
// admin — p.ej. un cliente que ya existía en FactuSol con un código bajo
// (81) antes de que existiera la web. Se guarda para ese NIF y se reutiliza
// en todos sus pedidos futuros, no solo el que se está editando.
export async function setFactusolClientCode(nif: string, code: number): Promise<void> {
  await prisma.factusolClient.upsert({
    where: { nif },
    update: { code },
    create: { nif, code },
  });
}

// Número de documento correlativo desde 1 — asignado la primera vez que el
// pedido se exporta (individual o en bloque), conservado en Order
// (factusolDocNumber) a partir de entonces. NO marca el pedido como
// exportado por sí solo (ver markOrdersExported) — se puede asignar un
// número y seguir sin "exportar" de verdad si algo falla a medio camino.
export async function resolveFactusolDocNumber(orderId: string): Promise<number> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { factusolDocNumber: true } });
  if (order.factusolDocNumber != null) return order.factusolDocNumber;

  const highest = await prisma.order.aggregate({ _max: { factusolDocNumber: true } });
  const nextNumber = (highest._max.factusolDocNumber ?? 0) + 1;
  await prisma.order.update({ where: { id: orderId }, data: { factusolDocNumber: nextNumber } });
  return nextNumber;
}

// Pedidos todavía no exportados a FactuSol — entran todos, pagados o no
// (Finanzas, 2026-10-02: incluso los de transferencia sin cobrar todavía,
// para no retrasar la preparación del documento).
export async function listUnexportedOrderIds(): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: { factusolExportedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return orders.map((o) => o.id);
}

export async function markOrdersExported(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { factusolExportedAt: new Date() } });
}

// Escribe una fila por letra de columna en vez de por posición consecutiva
// — el layout real de FactuSol tiene huecos grandes entre columnas (ver
// PCL/LPC más abajo), así que un array posicional sin más se desalinea en
// cuanto falta una.
function writeRowByColumn(ws: ExcelJS.Worksheet, rowNumber: number, values: Record<string, string | number>) {
  for (const [col, value] of Object.entries(values)) {
    ws.getCell(`${col}${rowNumber}`).value = value;
  }
}

function newWorkbook(): ExcelJS.Worksheet {
  const wb = new ExcelJS.Workbook();
  return wb.addWorksheet("Hoja1");
}

function sheetFrom(headers: Record<string, string>, rows: Record<string, string | number>[]): Promise<ExcelJS.Buffer> {
  const ws = newWorkbook();
  writeRowByColumn(ws, 1, headers);
  rows.forEach((row, i) => writeRowByColumn(ws, i + 2, row));
  return ws.workbook.xlsx.writeBuffer();
}

type ClienteSource = {
  invoiceTaxId: string;
  invoiceName: string;
  invoiceAddress: string;
  invoiceCity: string;
  invoicePostalCode: string;
  invoiceProvince: string;
  contactPhone: string | null;
  contactEmail: string;
};

type PedidoSource = {
  id: string;
  createdAt: Date;
  total: number;
  paymentMethod: string;
  invoiceName: string;
  invoiceAddress: string;
  invoiceCity: string;
  invoicePostalCode: string;
  invoiceProvince: string;
  invoiceTaxId: string;
  contactPhone: string | null;
};

type LineaSource = {
  productName: string;
  quantity: number;
  unitPrice: number;
  factusolArticleCode: string | null;
  supplierSku: string | null;
  size: string;
  color: string;
  garmentCost: number | null;
  markingCost: number | null;
  marks: {
    zone: string;
    technique: string;
    size: string | null;
    colors: number | null;
    tierQty: number;
    quantity: number;
    unitPrice: number;
    factusolCode: string | null;
    colorName: string | null;
  }[];
};

// --- CLI.xlsx — Clientes ----------------------------------------------------
const CLI_HEADERS: Record<string, string> = {
  A: "Código",
  B: "Código para contabilidad",
  C: "NIF",
  D: "Nombre fiscal",
  E: "Nombre comercial",
  F: "Domicilio",
  G: "Población",
  H: "Código postal",
  I: "Provincia",
  J: "País",
  K: "Teléfono",
  AP: "E-mail",
};

function clienteRow(order: ClienteSource, clientCode: number): Record<string, string | number> {
  return {
    A: clientCode,
    C: order.invoiceTaxId,
    D: order.invoiceName,
    E: order.invoiceName,
    F: order.invoiceAddress,
    G: order.invoiceCity,
    H: order.invoicePostalCode,
    I: order.invoiceProvince,
    J: "España",
    K: order.contactPhone ?? "",
    AP: order.contactEmail,
  };
}

export function buildCliente(order: ClienteSource, clientCode: number): Promise<ExcelJS.Buffer> {
  return sheetFrom(CLI_HEADERS, [clienteRow(order, clientCode)]);
}

export function buildClientesBulk(rows: { order: ClienteSource; clientCode: number }[]): Promise<ExcelJS.Buffer> {
  return sheetFrom(
    CLI_HEADERS,
    rows.map(({ order, clientCode }) => clienteRow(order, clientCode))
  );
}

// --- PCL.xlsx — Pedido de cliente (cabecera) --------------------------------
const PCL_HEADERS: Record<string, string> = {
  A: "Tipo de documento",
  B: "Número de documento",
  C: "Referencia",
  D: "Fecha",
  G: "Código de cliente",
  H: "Nombre del cliente",
  I: "Domicilio del cliente",
  J: "Población",
  K: "Código postal",
  L: "Provincia",
  M: "N.I.F.",
  N: "Tipo de IVA",
  O: "Recargo de equivalencia",
  P: "Teléfono del cliente",
  Q: "Estado",
  S: "Importe neto 1",
  AT: "Base imponible 1",
  AW: "Porcentaje de IVA 1",
  AZ: "Importe de IVA 1",
  BK: "Total",
  BL: "Forma de pago",
  BS: "Pedido por",
};

function pedidoRow(order: PedidoSource, clientCode: number, docNumber: number): Record<string, string | number> {
  const subtotal = Math.round((order.total / 1.21) * 100) / 100;
  const vatAmount = Math.round((order.total - subtotal) * 100) / 100;
  return {
    A: 1,
    B: docNumber,
    C: order.id.slice(0, 8),
    D: formatDate(order.createdAt),
    G: clientCode,
    H: order.invoiceName,
    I: order.invoiceAddress,
    J: order.invoiceCity,
    K: order.invoicePostalCode,
    L: order.invoiceProvince,
    M: order.invoiceTaxId,
    N: 0,
    O: 0,
    P: order.contactPhone ?? "",
    Q: 0,
    S: subtotal,
    AT: subtotal,
    AW: 21,
    AZ: vatAmount,
    BK: order.total,
    BL: PAYMENT_CODE[order.paymentMethod] ?? "",
    BS: "Web",
  };
}

export function buildPedido(order: PedidoSource, clientCode: number, docNumber: number): Promise<ExcelJS.Buffer> {
  return sheetFrom(PCL_HEADERS, [pedidoRow(order, clientCode, docNumber)]);
}

export function buildPedidosBulk(
  rows: { order: PedidoSource; clientCode: number; docNumber: number }[]
): Promise<ExcelJS.Buffer> {
  return sheetFrom(
    PCL_HEADERS,
    rows.map(({ order, clientCode, docNumber }) => pedidoRow(order, clientCode, docNumber))
  );
}

// --- LPC.xlsx — Líneas de pedido de cliente ---------------------------------
const LPC_HEADERS: Record<string, string> = {
  A: "Tipo de documento",
  B: "Número de documento",
  C: "Posición de la línea",
  D: "Artículo",
  E: "Descripción",
  F: "Cantidad",
  J: "Precio del artículo",
  K: "Total",
  L: "Pendiente",
  M: "Tipo de IVA",
};

// La posición (col. C) reinicia en 1 por cada pedido/documento — son líneas
// dentro de SU documento, no un correlativo global.
const TECHNIQUE_LABEL: Record<string, string> = {
  DTF: "DTF",
  Vinilo: "Vinilo",
  Sublimacion: "Sublimación",
  Serigrafia: "Serigrafía",
};
const ZONE_LABEL: Record<string, string> = {
  pecho: "delante",
  espalda: "detrás",
  manga: "manga",
  manga_izquierda: "manga izq.",
  manga_derecha: "manga der.",
};
const TIER_RANGE: Record<number, string> = {
  1: "1-4",
  5: "5-9",
  10: "10-24",
  25: "25-49",
  50: "50-99",
  100: "100-249",
  250: "250-499",
  500: "500+",
};

// Descripción de una línea de marcaje: la del artículo de la tarifa
// ("DTF 22x22 cm 25-49 uds") más la zona. Máx. 50 caracteres.
function markDescription(m: LineaSource["marks"][number]): string {
  const tech = TECHNIQUE_LABEL[m.technique] ?? m.technique;
  const spec = m.technique === "Serigrafia" ? `${m.colors ?? 1} col.` : `${m.size ?? ""} cm`;
  const base = `${tech} ${spec} ${TIER_RANGE[m.tierQty] ?? m.tierQty} uds - ${ZONE_LABEL[m.zone] ?? m.zone}`;
  // El color que pidió el cliente va al final si cabe en los 50 caracteres.
  const withColor = m.colorName ? `${base} (${m.colorName.toLowerCase()})` : base;
  return (withColor.length <= 50 ? withColor : base).slice(0, 50);
}

// Precio de la línea de prenda tal y como sale en FactuSol: si la línea trae
// zonas de marcaje guardadas, la prenda va SOLA (el marcaje sale en sus
// propias líneas, si no se cobraría dos veces); si no las trae (pedidos
// anteriores al 2026-10-03) se mantiene el precio guardado, que ya incluye
// el marcaje, y se avisa en la descripción.
function garmentLineUnitPrice(line: LineaSource): number {
  if (line.marks.length === 0) return line.unitPrice;
  const marksPerUnit = line.marks.reduce((sum, m) => sum + m.unitPrice, 0);
  return Math.round((line.unitPrice - marksPerUnit) * 100) / 100;
}

// El marcaje sale en UNA línea por combinación de código de tarifa, zona,
// técnica, tamaño, colores, tramo, color pedido y precio unitario, sumando las
// cantidades de todas las prendas (Finanzas, 2026-10-03). Distinto color o
// tamaño en la misma zona = líneas separadas.
export function groupMarks(lines: LineaSource[]): LineaSource["marks"] {
  const groups = new Map<string, LineaSource["marks"][number]>();
  for (const line of lines) {
    for (const m of line.marks) {
      const key = [m.factusolCode, m.zone, m.technique, m.size, m.colors, m.tierQty, m.colorName?.toLowerCase() ?? "", m.unitPrice].join("|");
      const existing = groups.get(key);
      if (existing) existing.quantity += m.quantity;
      else groups.set(key, { ...m });
    }
  }
  return [...groups.values()];
}

// El envío se cobra con IVA incluido (7 €); FactuSol lleva las líneas sin IVA.
export const shippingNet = (shippingCost: number) => Math.round((shippingCost / 1.21) * 100) / 100;

export function lineaRows(
  docNumber: number,
  lines: LineaSource[],
  shippingCost: number | undefined
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = lines.map((line, i) => {
    const unitPrice = garmentLineUnitPrice(line);
    const total = Math.round(unitPrice * line.quantity * 100) / 100;
    const description =
      [line.productName, line.size, line.color].filter(Boolean).join(" ") +
      (line.marks.length === 0 && (line.markingCost ?? 0) > 0 ? " (incluye marcaje)" : "");
    return {
      A: 1,
      B: docNumber,
      C: i + 1,
      D: line.factusolArticleCode ?? line.supplierSku ?? "",
      E: description,
      F: line.quantity,
      J: unitPrice,
      K: total,
      L: line.quantity,
      M: 0,
    };
  });
  for (const m of groupMarks(lines)) {
    rows.push({
      A: 1,
      B: docNumber,
      C: rows.length + 1,
      D: m.factusolCode ?? "",
      E: markDescription(m),
      F: m.quantity,
      J: m.unitPrice,
      K: Math.round(m.unitPrice * m.quantity * 100) / 100,
      L: m.quantity,
      M: 0,
    });
  }
  if (shippingCost) {
    const net = shippingNet(shippingCost);
    rows.push({
      A: 1,
      B: docNumber,
      C: rows.length + 1,
      D: SHIPPING_ARTICLE,
      E: "Gastos de envío",
      F: 1,
      J: net,
      K: net,
      L: 1,
      M: 0,
    });
  }
  return rows;
}

// Comprobación pedida por Finanzas (2026-10-03): la suma de las líneas
// exportadas (prendas + marcaje + envío sin IVA, SRV-PORTES a 7 / 1,21 = 5,79) debe
// igualar la base del pedido (total / 1,21 + descuento), o el marcaje se
// estaría cobrando dos veces / faltaría. Tolerancia de 1 céntimo. Devuelve el
// aviso a enseñar a Finanzas o null si cuadra.
export function exportWarning(
  order: { id: string; total: number; shippingCost: number; discountAmount: number },
  lines: LineaSource[]
): string | null {
  const exported = lines.reduce((sum, line) => {
    const garment = garmentLineUnitPrice(line) * line.quantity;
    const marks = line.marks.reduce((s, m) => s + m.unitPrice * m.quantity, 0);
    return sum + garment + marks;
  }, 0) + (order.shippingCost ? shippingNet(order.shippingCost) : 0);
  const expected = order.total / 1.21 + order.discountAmount;
  const diff = Math.round((exported - expected) * 100) / 100;
  if (Math.abs(diff) <= 0.01) return null;
  return `Pedido ${order.id.slice(0, 8)}: las líneas exportadas suman ${exported.toFixed(2)} € y la base del pedido es ${expected.toFixed(2)} € (diferencia ${diff.toFixed(2)} €). Avisar a Finanzas antes de importar en FactuSol.`;
}

export function buildLineas(
  order: { shippingCost?: number },
  lines: LineaSource[],
  docNumber: number
): Promise<ExcelJS.Buffer> {
  return sheetFrom(LPC_HEADERS, lineaRows(docNumber, lines, order.shippingCost));
}

export function buildLineasBulk(
  rows: { docNumber: number; shippingCost?: number; lines: LineaSource[] }[]
): Promise<ExcelJS.Buffer> {
  const allRows = rows.flatMap(({ docNumber, shippingCost, lines }) => lineaRows(docNumber, lines, shippingCost));
  return sheetFrom(LPC_HEADERS, allRows);
}

export type { OrderDetail };
