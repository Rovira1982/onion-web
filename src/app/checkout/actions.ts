"use server";

import { prisma } from "@/lib/db";
import { type QuoteInput } from "@/lib/pricing";
import { buildMarkRows, type MarkColors, type MarkRow } from "@/lib/order-marks";
import { personalizedUnitPrice, PERSONALIZED_EXTRA_MARGIN } from "@/lib/line-price";
import { selectGarmentTier } from "@/lib/garment-price";
import { groupQuantityTotals, markingSignature } from "@/lib/design-group";
import { validateDiscountCode, type DiscountCheckResult } from "@/lib/discounts";
import { getPack, type PackDefinition } from "@/lib/packs";
import { slugify } from "@/lib/product-format";
import { sendCapiEvent } from "@/lib/meta-capi";
import { cookies, headers } from "next/headers";
import { rateLimited } from "@/lib/rate-limit";

// Debe coincidir exactamente con MARKETING_CONSENT_COOKIE en src/lib/consent.ts
// (no se importa de ahí directamente — ese módulo es "use client"). Parche de
// cumplimiento RGPD, Guardian P0, 2026-10-02: el CAPI se mandaba siempre, sin
// mirar si el cliente aceptó cookies de marketing.
const MARKETING_CONSENT_COOKIE = "oab_marketing_consent";

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
  markColors?: MarkColors;
  // Código de pack de precio cerrado (ver src/lib/packs.ts) — si está
  // presente, el servidor IGNORA marking para el precio y usa el total fijo
  // del pack. Nunca se confía en un precio enviado por el cliente para
  // ningún caso, y esto no es una excepción: el precio sale de PACKS, no
  // del carrito.
  packCode?: string;
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
  // Sin esto, los 4 mensajes de error distintos de validateDiscountCode (ya
  // colapsados a uno solo) se podían sondear sin límite para enumerar
  // códigos reales — parche de seguridad, Guardian P6, 2026-10-02.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`discount:${ip}`, 20, 60_000)) {
    return { valid: false, error: "Demasiados intentos. Prueba de nuevo en un minuto." };
  }
  return validateDiscountCode(code, subtotal, email);
}

// The client only sends the *configuration* of each line (variant, quantity,
// marking) — never trust a price from the browser. Every line is repriced
// here from real data (the variant's current DB price, or calculateQuote for
// personalized lines) before the order is written.
// Coste real de proveedor por unidad en el tramo aplicado (unidad/pack/caja),
// con repliegue al de unidad. Se guarda en la línea para poder calcular el
// margen real después: el coste de la variante cambia en cada sincronización.
function supplierCostForTier(
  variant: { costUnit: { toString(): string } | null; costPack: { toString(): string } | null; costBox: { toString(): string } | null },
  tier: string
): number | null {
  const raw = tier === "caja" ? variant.costBox : tier === "pack" ? variant.costPack : variant.costUnit;
  const value = raw ?? variant.costUnit;
  return value == null ? null : parseFloat(value.toString());
}

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
    include: {
      product: { select: { name: true, supplierSku: true, unitsPerPack: true, unitsPerCase: true, incompleteData: true } },
    },
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
  const groupKey = (item: (typeof normalizedItems)[number], idx: number) => item.designGroupId ?? `__solo_${idx}`;

  // Un designGroupId agrupa líneas para sumar su cantidad y cobrar el
  // marcaje por el total (ver groupQuantityTotals arriba) — sin esto, dos
  // líneas con técnica/zonas distintas podrían compartir designGroupId para
  // inflar el tramo de precio con cantidad de un diseño que en realidad no
  // comparten. Los grupos de pack ya se validan aparte, más abajo. Parche de
  // seguridad, Guardian P5, 2026-10-02.
  const markingGroupSignatures = new Map<string, string>();
  for (const [idx, item] of normalizedItems.entries()) {
    if (item.packCode || !item.marking) continue;
    const key = groupKey(item, idx);
    const sig = markingSignature(item.marking);
    const seen = markingGroupSignatures.get(key);
    if (seen === undefined) {
      markingGroupSignatures.set(key, sig);
      continue;
    }
    if (seen !== sig) {
      return { error: "Las líneas agrupadas bajo el mismo diseño deben tener la misma técnica y configuración de marcaje." };
    }
  }

  // Packs de precio cerrado (ver src/lib/packs.ts) — el precio NUNCA sale
  // del cliente ni de calculateQuote: sale de PACKS, validado aquí contra
  // el producto real y la cantidad exacta exigida. unitPrice per group is
  // the same pre-IVA figure for every line/unit in it — small per-unit
  // rounding (cents) is accepted, same tolerance the rest of the pricing
  // pipeline already has (mround to 0.05/0.01 elsewhere).
  const packUnitPriceByGroup = new Map<string, number>();
  const packDefByGroup = new Map<string, PackDefinition>();
  const seenPackGroups = new Set<string>();
  for (const [idx, item] of normalizedItems.entries()) {
    if (!item.packCode) continue;
    const key = groupKey(item, idx);
    if (seenPackGroups.has(key)) continue;
    seenPackGroups.add(key);

    const pack = getPack(item.packCode);
    if (!pack) return { error: "Código de pack no válido." };

    const groupIndices = normalizedItems.map((_, i) => i).filter((i) => groupKey(normalizedItems[i], i) === key);
    if (!groupIndices.every((i) => normalizedItems[i].packCode === item.packCode)) {
      return { error: "Un pack de precio cerrado no se puede combinar con otras líneas en el mismo grupo." };
    }
    const groupQty = groupIndices.reduce((sum, i) => sum + normalizedItems[i].quantity, 0);
    if (groupQty !== pack.quantity) {
      return { error: `Este pack requiere exactamente ${pack.quantity} unidades (hay ${groupQty}).` };
    }

    const variant = variantById.get(item.productVariantId);
    if (!variant) return { error: "Uno de los productos del carrito ya no está disponible." };
    const variantSlug = slugify(`${variant.product.name}-${variant.product.supplierSku}`);
    if (variantSlug !== pack.productSlug) {
      return { error: "Este código de pack no es válido para este producto." };
    }

    packUnitPriceByGroup.set(key, Math.round((pack.totalPrice / 1.21 / pack.quantity) * 100) / 100);
    packDefByGroup.set(key, pack);
  }

  // Redondear cada unidad a céntimos hace que (unitPrice × qty) × 1.21 no
  // caiga exactamente en pack.totalPrice (p.ej. 69,00€ real puede salir en
  // 68,97€) — se corrige aquí, sumada directamente al total con IVA, para
  // que el pedido cobre SIEMPRE el precio anunciado del pack, céntimo
  // exacto.
  let packVatCorrection = 0;
  for (const [key, unitPrice] of packUnitPriceByGroup) {
    const pack = packDefByGroup.get(key)!;
    const computed = Math.round(unitPrice * pack.quantity * 1.21 * 100) / 100;
    packVatCorrection += Math.round((pack.totalPrice - computed) * 100) / 100;
  }

  const lines: {
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    garmentCost: number;
    supplierUnitCost: number | null;
    markingCost: number | null;
    priceTier: string;
    design?: { create: CheckoutDesign };
    marks?: { create: MarkRow[] };
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
    if (item.packCode) {
      // Precio fijo del pack, ya validado arriba — nunca pasa por
      // personalizedUnitPrice ni por el marcaje que mande el cliente.
      unitPrice = packUnitPriceByGroup.get(groupKey(item, idx))!;
      markingCost = Math.round((unitPrice - garmentPricing.price) * 100) / 100;
    } else if (item.marking) {
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
      supplierUnitCost: supplierCostForTier(variant, garmentPricing.tier),
      markingCost,
      priceTier: garmentPricing.tier,
      ...(item.design ? { design: { create: item.design } } : {}),
      // Los packs de precio cerrado no desglosan zonas (precio fijo del pack).
      ...(item.marking && !item.packCode
        ? { marks: { create: buildMarkRows(item.marking, item.design, quantity, groupTotals[idx], item.markColors) } }
        : {}),
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
      // Los packs ya NO absorben el envío (decisión del dueño, 2026-10-01,
      // vía Finanzas — el precio de 79€ del pack Racing no lo incluye, se
      // cobra aparte como cualquier pedido). Sigue la regla normal.
      const shippingCost = totalBeforeShipping >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
      const total = totalBeforeShipping + shippingCost + packVatCorrection;

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

    // Fire-and-forget: never let a Meta/CAPI hiccup slow down or fail the
    // checkout response — sendCapiEvent already swallows its own errors.
    // event_id = order.id so the client-side Purchase fired on the gracias
    // page (see PurchasePixel) dedupes with this one in Meta's eyes.
    // Solo si el cliente aceptó cookies de marketing (Guardian P0,
    // 2026-10-02) — antes se mandaba siempre, incluso rechazando el banner.
    const marketingConsent = (await cookies()).get(MARKETING_CONSENT_COOKIE)?.value === "1";
    if (marketingConsent) {
      void sendCapiEvent({
        eventName: "Purchase",
        eventId: order.id,
        email: input.contactEmail,
        phone: input.contactPhone || undefined,
        value: parseFloat(order.total.toString()),
        currency: "EUR",
      });
    }

    return { orderId: order.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el pedido." };
  }
}
