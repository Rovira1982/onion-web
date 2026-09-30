"use server";

import { prisma } from "@/lib/db";
import { type QuoteInput } from "@/lib/pricing";
import { personalizedUnitPrice, PERSONALIZED_EXTRA_MARGIN } from "@/lib/line-price";
import { selectGarmentTier } from "@/lib/garment-price";
import { groupQuantityTotals } from "@/lib/design-group";
import { validateDiscountCode, type DiscountCheckResult } from "@/lib/discounts";

// Envío al cliente — 6€ fijo, gratis desde 300€ de importe final (con
// descuento e IVA incluidos, sin contar el propio envío). Decisión del
// dueño, 2026-09-30.
const SHIPPING_COST = 6;
const FREE_SHIPPING_THRESHOLD = 300;

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
  // Varias tallas del mismo producto+diseño añadidas juntas comparten este
  // id — el precio de marcaje se calcula sobre la cantidad TOTAL del grupo
  // (ver groupQuantityTotals), nunca sobre la de una talla sola.
  designGroupId?: string;
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
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { unitsPerPack: true, unitsPerCase: true, incompleteData: true } } },
  });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  // Normalize quantities first so grouping sums the same clamped numbers
  // used for pricing below, then sum each design group's total once — see
  // src/lib/design-group.ts. The marking price for every line in a group
  // (several sizes of the same personalization) is priced off that TOTAL,
  // never off any single size's own quantity, matching what the cart
  // already computed client-side (never trusted as-is, just mirrored here).
  const normalizedItems = input.items.map((item) => ({ ...item, quantity: Math.max(1, Math.floor(item.quantity)) }));
  const groupTotals = groupQuantityTotals(normalizedItems);

  const lines: {
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    garmentCost: number;
    markingCost: number | null;
    priceTier: string;
    design?: { create: CheckoutDesign };
  }[] = [];
  for (const [idx, item] of normalizedItems.entries()) {
    const variant = variantById.get(item.productVariantId);
    if (!variant) return { error: "Uno de los productos del carrito ya no está disponible." };

    // Vinilo has no online price — the product page routes it to "pide
    // presupuesto" instead of "añadir al carrito", but that's a UI-only
    // gate, so the server must refuse it too in case a line reaches here
    // some other way (direct call, stale client, etc).
    if (item.marking && item.marking.technique === "Vinilo") {
      return { error: "La técnica Vinilo requiere presupuesto a medida — no se puede pedir online." };
    }

    const quantity = item.quantity;
    // Garment tier (unidad/pack/caja) and the fixed business margin always
    // come from the server (DB data) — the browser only decides technique,
    // zones and quantity, never a cost, margin or tier.
    const garmentPricing = selectGarmentTier(
      {
        price: parseFloat(variant.price.toString()),
        pricePack: variant.pricePack ? parseFloat(variant.pricePack.toString()) : null,
        priceBox: variant.priceBox ? parseFloat(variant.priceBox.toString()) : null,
        unitsPerPack: variant.product.unitsPerPack,
        unitsPerCase: variant.product.unitsPerCase,
        incompleteData: variant.product.incompleteData,
      },
      quantity
    );

    let unitPrice: number | null = garmentPricing.price;
    let markingCost: number | null = null;
    if (item.marking) {
      unitPrice = personalizedUnitPrice(
        {
          ...item.marking,
          quantity: groupTotals[idx],
          extraMargin: PERSONALIZED_EXTRA_MARGIN,
          garmentUnitCost: garmentPricing.price,
        },
        garmentPricing.price
      );
      if (unitPrice !== null) markingCost = Math.round((unitPrice - garmentPricing.price) * 100) / 100;
    }
    if (unitPrice === null) {
      return { error: "Una de las técnicas de marcaje elegidas no tiene precio online para esa cantidad — pide presupuesto." };
    }

    lines.push({
      productVariantId: item.productVariantId,
      quantity,
      unitPrice,
      garmentCost: garmentPricing.price,
      markingCost,
      priceTier: garmentPricing.tier,
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

      const totalBeforeShipping = (subtotal - discountAmount) * 1.21; // IVA incl. — matches what the checkout page shows the customer
      const shippingCost = totalBeforeShipping >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
      const total = totalBeforeShipping + shippingCost;

      return tx.order.create({
        data: {
          status: "pendiente_pago",
          paymentMethod: input.paymentMethod,
          paymentStatus: "pendiente",
          total,
          shippingCost,
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
