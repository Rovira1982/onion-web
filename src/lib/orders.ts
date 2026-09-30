import "server-only";
import { prisma } from "./db";

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
    size: string;
    color: string;
  }[];
};

export type OrderSummary = {
  id: string;
  status: string;
  total: number;
  invoiceName: string;
  createdAt: Date;
  lineCount: number;
  discountCode: string | null;
};

// Minimal listing for the (not-yet-built) admin panel — just enough to find
// an order and trigger its FactuSol export. No auth guard yet: this route
// must not go to production before the admin area is gated.
export async function listOrders(): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true } }, discountCode: { select: { code: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    total: parseFloat(o.total.toString()),
    invoiceName: o.invoiceName,
    createdAt: o.createdAt,
    lineCount: o._count.lines,
    discountCode: o.discountCode?.code ?? null,
  }));
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { include: { productVariant: { include: { product: true } }, design: true } },
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
      size: line.productVariant?.size ?? "",
      color: line.productVariant?.color ?? "",
    })),
  };
}
