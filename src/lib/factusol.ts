import "server-only";
import ExcelJS from "exceljs";
import type { OrderDetail } from "./orders";

// Generates the 3 files FactuSol needs to import a web order as a "Pedido de
// cliente": CLI.xlsx (customer), PCL.xlsx (order header), LPC.xlsx (order
// lines). Column layout is taken verbatim from FactuSol's own technical
// import spec (FACTUSOL_-_Importacion_Excel_Calc.pdf, "Gestión completa"
// edition) — column letters/names/types below match that document exactly.
//
// Open assumptions, flagged for review rather than guessed silently:
// - Client code (CLI col. A, PCL col. G): FactuSol requires a unique
//   *numeric* code here. We don't have a persistent "customer" record (the
//   checkout is guest-only), so we derive a stable 6-digit code from a hash
//   of the customer's NIF — the same NIF always maps to the same code,
//   which lets repeat customers reuse one FactuSol client across orders
//   instead of creating a new one each time. Confirm this doesn't collide
//   with client codes already in use in FactuSol.
// - Document type/number (PCL & LPC col. A/B): same hash approach, derived
//   from the order id, so re-exporting the same order is idempotent instead
//   of creating a duplicate under a new number. FactuSol's own numbering
//   series (Tipo de documento) is configured per-installation — confirm
//   which "tipo" value (currently defaulted to 1) matches your setup.
// - Forma de pago (PCL col. BL): we write "TAR"/"BIZ"/"TRA" — these need to
//   match codes you've actually configured in FactuSol's Formas de pago
//   (FPA) table, or the import will leave the field blank/wrong.
// - Artículo (LPC col. D): uses the variant's own `supplierModelCode`. This
//   only resolves correctly if that same code already exists as an Artículo
//   in FactuSol — i.e. the catalog needs its own ART.xlsx sync first (not
//   built yet). Until then, importing LPC will likely fail to match lines
//   to articles.
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

export function clientCodeFor(order: OrderDetail & { invoiceTaxId: string }): string {
  return hashToCode(order.invoiceTaxId, 6);
}

function docNumberFor(orderId: string): string {
  return hashToCode(orderId, 6);
}

async function sheetFrom(headers: string[], row: (string | number)[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");
  ws.addRow(headers);
  ws.addRow(row);
  return wb.xlsx.writeBuffer();
}

// --- CLI.xlsx — Clientes ----------------------------------------------------
const CLI_HEADERS = [
  "Código", "Código para contabilidad", "NIF", "Nombre fiscal", "Nombre comercial",
  "Domicilio", "Población", "Código postal", "Provincia", "País", "Teléfono",
];

export async function buildCliente(order: {
  invoiceTaxId: string;
  invoiceName: string;
  invoiceAddress: string;
  invoiceCity: string;
  invoicePostalCode: string;
  invoiceProvince: string;
  contactPhone: string | null;
}): Promise<ExcelJS.Buffer> {
  const code = hashToCode(order.invoiceTaxId, 6);
  return sheetFrom(CLI_HEADERS, [
    code, "", order.invoiceTaxId, order.invoiceName, order.invoiceName,
    order.invoiceAddress, order.invoiceCity, order.invoicePostalCode,
    order.invoiceProvince, "España", order.contactPhone ?? "",
  ]);
}

// --- PCL.xlsx — Pedido de cliente (cabecera) --------------------------------
const PCL_HEADERS = [
  "Tipo de documento", "Número de documento", "Referencia", "Fecha", "Código del proveedor",
  "Código de cliente", "Nombre del cliente", "Domicilio del cliente", "Población",
  "Código postal", "Provincia", "N.I.F.", "Tipo de IVA", "Estado",
  "Importe neto 1", "Base imponible 1", "Porcentaje de IVA 1", "Importe de IVA 1",
  "Total", "Forma de pago", "Pedido por",
];

export async function buildPedido(order: OrderDetail & {
  invoiceTaxId: string;
  invoiceName: string;
  invoiceAddress: string;
  invoiceCity: string;
  invoicePostalCode: string;
  invoiceProvince: string;
}): Promise<ExcelJS.Buffer> {
  const clientCode = hashToCode(order.invoiceTaxId, 6);
  const docNumber = docNumberFor(order.id);
  const subtotal = Math.round((order.total / 1.21) * 100) / 100;
  const vatAmount = Math.round((order.total - subtotal) * 100) / 100;

  return sheetFrom(PCL_HEADERS, [
    1, docNumber, order.id.slice(0, 8), formatDate(order.createdAt), "",
    clientCode, order.invoiceName, order.invoiceAddress, order.invoiceCity,
    order.invoicePostalCode, order.invoiceProvince, order.invoiceTaxId, 0, 0,
    subtotal, subtotal, 21, vatAmount,
    order.total, PAYMENT_CODE[order.paymentMethod] ?? "", "Web",
  ]);
}

// --- LPC.xlsx — Líneas de pedido de cliente ---------------------------------
const LPC_HEADERS = [
  "Tipo de documento", "Número de documento", "Posición de la línea", "Artículo",
  "Descripción", "Cantidad", "Precio del artículo", "Total", "Tipo de IVA", "Talla", "Color",
];

export async function buildLineas(
  order: { id: string; shippingCost?: number },
  lines: { productName: string; quantity: number; unitPrice: number; supplierModelCode: string; size: string; color: string }[]
): Promise<ExcelJS.Buffer> {
  const docNumber = docNumberFor(order.id);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");
  ws.addRow(LPC_HEADERS);
  lines.forEach((line, i) => {
    ws.addRow([
      1, docNumber, i + 1, line.supplierModelCode,
      line.productName, line.quantity, line.unitPrice,
      Math.round(line.unitPrice * line.quantity * 100) / 100, 0, line.size, line.color,
    ]);
  });
  // Envío como línea propia — requiere un Artículo "GASTOS-ENVIO" dado de
  // alta en FactuSol; el código exacto a usar está por confirmar con Josep.
  if (order.shippingCost) {
    ws.addRow([
      1, docNumber, lines.length + 1, "GASTOS-ENVIO",
      "Gastos de envío", 1, order.shippingCost, order.shippingCost, 0, "", "",
    ]);
  }
  return wb.xlsx.writeBuffer();
}
