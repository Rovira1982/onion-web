import "server-only";
import ExcelJS from "exceljs";
import { prisma } from "./db";
import type { OrderDetail } from "./orders";

// Generates the 3 files FactuSol needs to import a web order as a "Pedido de
// cliente": CLI.xlsx (customer), PCL.xlsx (order header), LPC.xlsx (order
// lines).
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
// - Document type/number (PCL & LPC col. A/B): hash-derived from the order
//   id, so re-exporting the same order is idempotent instead of creating a
//   duplicate under a new number. FactuSol's own numbering series (Tipo de
//   documento) is configured per-installation — confirm which "tipo" value
//   (currently defaulted to 1) matches your setup.
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

function hashToCode(input: string, digits: number): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const max = 10 ** digits;
  return String(100 + (hash % (max - 100))).padStart(digits, "0");
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const PAYMENT_CODE: Record<string, string> = { tarjeta: "TAR", bizum: "BIZ", transferencia: "TRA" };

// No existe un artículo "GASTOS-ENVIO" en FACTUSOL — el envío va como el
// servicio puntual SRV-PORTES (Finanzas, 2026-10-02).
const SHIPPING_ARTICLE = "SRV-PORTES";

function docNumberFor(orderId: string): string {
  return hashToCode(orderId, 6);
}

// Último código real confirmado por Josep (2026-10-02): 181 — el contador
// no vive en una fila aparte, se deriva del máximo ya guardado (o 181 si la
// tabla está vacía) para no arrastrar un contador que se desincronice.
const LAST_KNOWN_FACTUSOL_CODE = 181;

// Resuelve el código de cliente de FactuSol para un NIF: reutiliza el que
// ya tuviera asignado (asignado automáticamente en un pedido anterior, o
// corregido a mano por Josep desde la página del pedido), o asigna el
// siguiente libre y lo guarda. `isNew` indica si FactuSol necesita el
// CLI.xlsx (cliente nunca visto antes) o no (ya existe, reusar el código
// basta — reimportar su CLI no aporta nada y FactuSol lo trataría como
// una actualización de un cliente que no ha cambiado).
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

// Escribe una fila por letra de columna en vez de por posición consecutiva
// — el layout real de FactuSol tiene huecos grandes entre columnas (ver
// PCL/LPC más abajo), así que un array posicional sin más se desalinea en
// cuanto falta una.
function writeRowByColumn(ws: ExcelJS.Worksheet, rowNumber: number, values: Record<string, string | number>) {
  for (const [col, value] of Object.entries(values)) {
    ws.getCell(`${col}${rowNumber}`).value = value;
  }
}

async function newWorkbook(): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  return wb.addWorksheet("Hoja1");
}

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
};

export async function buildCliente(
  order: {
    invoiceTaxId: string;
    invoiceName: string;
    invoiceAddress: string;
    invoiceCity: string;
    invoicePostalCode: string;
    invoiceProvince: string;
    contactPhone: string | null;
  },
  clientCode: number
): Promise<ExcelJS.Buffer> {
  const ws = await newWorkbook();
  writeRowByColumn(ws, 1, CLI_HEADERS);
  writeRowByColumn(ws, 2, {
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
  });
  return ws.workbook.xlsx.writeBuffer();
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

export async function buildPedido(
  order: OrderDetail & {
    invoiceTaxId: string;
    invoiceName: string;
    invoiceAddress: string;
    invoiceCity: string;
    invoicePostalCode: string;
    invoiceProvince: string;
  },
  clientCode: number
): Promise<ExcelJS.Buffer> {
  const ws = await newWorkbook();
  const docNumber = Number(docNumberFor(order.id));
  const subtotal = Math.round((order.total / 1.21) * 100) / 100;
  const vatAmount = Math.round((order.total - subtotal) * 100) / 100;

  writeRowByColumn(ws, 1, PCL_HEADERS);
  writeRowByColumn(ws, 2, {
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
  });
  return ws.workbook.xlsx.writeBuffer();
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

export async function buildLineas(
  order: { id: string; shippingCost?: number },
  lines: {
    productName: string;
    quantity: number;
    unitPrice: number;
    factusolArticleCode: string | null;
    supplierSku: string | null;
    size: string;
    color: string;
  }[]
): Promise<ExcelJS.Buffer> {
  const ws = await newWorkbook();
  const docNumber = Number(docNumberFor(order.id));
  writeRowByColumn(ws, 1, LPC_HEADERS);

  let row = 2;
  lines.forEach((line, i) => {
    const total = Math.round(line.unitPrice * line.quantity * 100) / 100;
    const description = [line.productName, line.size, line.color].filter(Boolean).join(" ");
    writeRowByColumn(ws, row++, {
      A: 1,
      B: docNumber,
      C: i + 1,
      D: line.factusolArticleCode ?? line.supplierSku ?? "",
      E: description,
      F: line.quantity,
      J: line.unitPrice,
      K: total,
      L: line.quantity,
      M: 0,
    });
  });

  if (order.shippingCost) {
    writeRowByColumn(ws, row++, {
      A: 1,
      B: docNumber,
      C: lines.length + 1,
      D: SHIPPING_ARTICLE,
      E: "Gastos de envío",
      F: 1,
      J: order.shippingCost,
      K: order.shippingCost,
      L: 1,
      M: 0,
    });
  }

  return ws.workbook.xlsx.writeBuffer();
}
