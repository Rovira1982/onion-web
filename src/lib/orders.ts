import "server-only";
import { prisma } from "./db";
import { requireAdmin } from "./auth";

export type OrderDetail = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  shippingCost: number;
  invoiceName: string;
  invoiceTaxId: string;
  invoiceAddress: string;
  invoicePostalCode: string;
  invoiceCity: string;
  invoiceProvince: string;
  contactEmail: string;
  contactPhone: string | null;
  discountCode: string | null;
  discountAmount: number;
  createdAt: Date;
  lines: {
    id: string;
    quantity: number;
    unitPrice: number;
    garmentCost: number | null;
    markingCost: number | null;
    priceTier: string | null;
    productName: string;
    previewImageUrl: string | null;
    supplierModelCode: string;
    // Código de artículo para FactuSol (máx. 13 caracteres) — factusolCode
    // si el maestro lo recortó, si no supplierCode tal cual; null cuando el
    // maestro de precios aún no ha pasado por este producto (ver
    // import-maestro-precios.ts), en cuyo caso buildLineas() cae a supplierSku.
    factusolArticleCode: string | null;
    supplierSku: string | null;
    size: string;
    color: string;
  }[];
};

export type OrderSummary = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  invoiceName: string;
  createdAt: Date;
  lineCount: number;
  discountCode: string | null;
  factusolExported: boolean;
};

// Minimal listing for the admin panel — just enough to find an order,
// mark it paid, and trigger its FactuSol export.
export async function listOrders(): Promise<OrderSummary[]> {
  await requireAdmin();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } }, discountCode: { select: { code: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: parseFloat(o.total.toString()),
    invoiceName: o.invoiceName,
    createdAt: o.createdAt,
    lineCount: o._count.lines,
    discountCode: o.discountCode?.code ?? null,
    factusolExported: o.factusolExportedAt != null,
  }));
}

async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: {
      include: {
        productVariant: {
          include: { product: { select: { name: true, factusolCode: true, supplierCode: true, supplierSku: true } } },
        },
        design: true,
      },
    },
      discountCode: { select: { code: true } },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: parseFloat(order.total.toString()),
    shippingCost: parseFloat(order.shippingCost.toString()),
    invoiceName: order.invoiceName,
    invoiceTaxId: order.invoiceTaxId,
    invoiceAddress: order.invoiceAddress,
    invoicePostalCode: order.invoicePostalCode,
    invoiceCity: order.invoiceCity,
    invoiceProvince: order.invoiceProvince,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    discountCode: order.discountCode?.code ?? null,
    discountAmount: parseFloat(order.discountAmount.toString()),
    createdAt: order.createdAt,
    lines: order.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPrice: parseFloat(line.unitPrice.toString()),
      garmentCost: line.garmentCost ? parseFloat(line.garmentCost.toString()) : null,
      markingCost: line.markingCost ? parseFloat(line.markingCost.toString()) : null,
      priceTier: line.priceTier,
      productName: line.productVariant?.product.name ?? "Producto retirado del catálogo",
      previewImageUrl: line.design?.previewImageUrl ?? null,
      supplierModelCode: line.productVariant?.supplierModelCode ?? "",
      factusolArticleCode: line.productVariant?.product.factusolCode ?? line.productVariant?.product.supplierCode ?? null,
      supplierSku: line.productVariant?.product.supplierSku ?? null,
      size: line.productVariant?.size ?? "",
      color: line.productVariant?.color ?? "",
    })),
  };
}

// Panel de admin — requiere sesión de admin.
export async function getOrderById(id: string): Promise<OrderDetail | null> {
  await requireAdmin();
  return fetchOrderDetail(id);
}

// Página pública "gracias" tras el checkout — sin login (el checkout mismo
// tampoco lo exige). El id del pedido es un UUID no adivinable, así que
// hace de token de acceso, igual que en el resto del flujo de compra. Bug
// real encontrado en directo, 2026-09-30: getOrderById exigía admin desde
// que se cerró el TODO de la Fase 0 de "tandas", así que esta página
// llevaba desde entonces dando error 500 a cualquier cliente real que
// terminara un pedido.
export async function getOrderConfirmation(id: string): Promise<OrderDetail | null> {
  return fetchOrderDetail(id);
}
