"use server";

import { prisma } from "@/lib/db";
import { type QuoteInput } from "@/lib/pricing";
import { personalizedUnitPrice, PERSONALIZED_EXTRA_MARGIN } from "@/lib/line-price";
import { validateDiscountCode, type DiscountCheckResult } from "@/lib/discounts";

export type CheckoutDesign = {
  logoFileUrl: string;
  markings: Partial<
    Record<
      "pecho" | "espalda" | "manga_izquierda" | "manga_derecha",
      { x: number; y: number; scale: number; rotation: number; colorName?: string }
    >
  >;
  previewImageUrl: string;
};

export type CheckoutCartItem = {
  productVariantId: string;
  quantity: number;
  marking: QuoteInput | null;
  design: CheckoutDesign | null;
};

export type CheckoutInput = {
  items: CheckoutCartItem[];
  invoiceName: string;
  invoiceTaxId: string;
  invoiceAddress: string;
  invoicePostalCode: string;
  invoiceCity: string;
  invoiceProvince: string;
  contactEmail: string;
  contactPhone: string;
  paymentMethod: "tarjeta" | "bizum" | "transferencia";
  discountCode?: string;
};

export type CheckoutResult = { orderId: string } | { error: string };

// Read-only preview for the checkout page's "Aplicar" button — doesn't
// consume the code's use. The real check (with an atomic use-claim) happens
// again inside crearPedido, which never trusts this result from the client.
export async function comprobarCodigoDescuento(
  code: string,
  subtotal: number,
  email: string
): Promise<DiscountCheckResult> {
  return validateDiscountCode(code, subtotal, email);
}

// The client only sends the *configuration* of each line (variant, quantity,
// marking) — never trust a price from the browser. Every line is repriced
// here from real data (the variant's current DB price, or calculateQuote for
// personalized lines) before the order is written.
export async function crearPedido(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.items.length === 0) return { error: "El carrito está vacío." };
  if (
    !input.invoiceName.trim() ||
    !input.invoiceTaxId.trim() ||
    !input.invoiceAddress.trim() ||
    !input.invoicePostalCode.trim() ||
    !input.invoiceCity.trim() ||
    !input.invoiceProvince.trim() ||
    !input.contactEmail.trim()
  ) {
    return { error: "Faltan datos obligatorios de facturación o contacto." };
  }

  const variantIds = input.items.map((i) => i.productVariantId);
  const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const lines: {
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    design?: { create: CheckoutDesign };
  }[] = [];
  for (const item of input.items) {
    const variant = variantById.get(item.productVariantId);
    if (!variant) return { error: "Uno de los productos del carrito ya no está disponible." };

    const quantity = Math.max(1, Math.floor(item.quantity));
    // Garment price and margin always come from the server (DB variant price,
    // fixed business margin) — the browser only decides technique, zones and
    // quantity, never a cost or margin.
    const variantPrice = parseFloat(variant.price.toString());
    const unitPrice = item.marking
      ? personalizedUnitPrice(
          { ...item.marking, quantity, extraMargin: PERSONALIZED_EXTRA_MARGIN, garmentUnitCost: variantPrice },
          variantPrice
        )
      : variantPrice;

    lines.push({
      productVariantId: item.productVariantId,
      quantity,
      unitPrice,
      ...(item.design ? { design: { create: item.design } } : {}),
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  try {
    const order = await prisma.$transaction(async (tx) => {
      let discountCodeId: string | null = null;
      let discountAmount = 0;

      if (input.discountCode?.trim()) {
        const normalized = input.discountCode.trim().toUpperCase();
        const found = await tx.discountCode.findUnique({ where: { code: normalized } });
        if (!found || !found.active) throw new Error("Código no válido.");
        if (found.expiresAt && found.expiresAt < new Date()) throw new Error("Este código ha caducado.");
        if (
          found.type === "cliente_habitual" &&
          found.customerEmail &&
          found.customerEmail.toLowerCase() !== input.contactEmail.trim().toLowerCase()
        ) {
          throw new Error("Este código no está asociado a tu email.");
        }

        // Atomic claim: only succeeds if the code still has uses left at the
        // moment of writing, preventing two simultaneous orders from both
        // spending the same single-use code.
        const claim = await tx.discountCode.updateMany({
          where: {
            id: found.id,
            active: true,
            OR: [{ maxUses: null }, { usesCount: { lt: found.maxUses ?? 0 } }],
          },
          data: { usesCount: { increment: 1 } },
        });
        if (claim.count === 0) throw new Error("Este código ya no está disponible.");

        discountCodeId = found.id;
        discountAmount = subtotal * (found.percentage / 100);
      }

      const total = (subtotal - discountAmount) * 1.21; // IVA incl. — matches what the checkout page shows the customer

      return tx.order.create({
        data: {
          status: "pendiente_pago",
          paymentMethod: input.paymentMethod,
          paymentStatus: "pendiente",
          total,
          discountCodeId,
          discountAmount,
          invoiceName: input.invoiceName,
          invoiceTaxId: input.invoiceTaxId,
          invoiceAddress: input.invoiceAddress,
          invoicePostalCode: input.invoicePostalCode,
          invoiceCity: input.invoiceCity,
          invoiceProvince: input.invoiceProvince,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone || null,
          lines: { create: lines },
        },
      });
    });

    return { orderId: order.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el pedido." };
  }
}
