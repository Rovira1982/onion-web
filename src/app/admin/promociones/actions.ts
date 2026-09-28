"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export type PromotionInput = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  ctaLabel: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

export type PromotionResult = { id: string } | { error: string };

function validate(input: PromotionInput): string | null {
  if (!input.title.trim()) return "El título es obligatorio.";
  if (!input.linkUrl.trim()) return "El enlace es obligatorio.";
  if (!input.startDate || !input.endDate) return "Faltan las fechas.";
  if (new Date(input.startDate) > new Date(input.endDate)) {
    return "La fecha de inicio no puede ser posterior a la de fin.";
  }
  return null;
}

export async function crearPromocion(input: PromotionInput): Promise<PromotionResult> {
  await requireAdmin();
  const error = validate(input);
  if (error) return { error };

  const promo = await prisma.promotion.create({
    data: {
      title: input.title,
      subtitle: input.subtitle || null,
      imageUrl: input.imageUrl || null,
      linkUrl: input.linkUrl,
      ctaLabel: input.ctaLabel || "Ver ofertas",
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      active: input.active,
    },
  });
  return { id: promo.id };
}

export async function actualizarPromocion(id: string, input: PromotionInput): Promise<PromotionResult> {
  await requireAdmin();
  const error = validate(input);
  if (error) return { error };

  const promo = await prisma.promotion.update({
    where: { id },
    data: {
      title: input.title,
      subtitle: input.subtitle || null,
      imageUrl: input.imageUrl || null,
      linkUrl: input.linkUrl,
      ctaLabel: input.ctaLabel || "Ver ofertas",
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      active: input.active,
    },
  });
  return { id: promo.id };
}

export async function eliminarPromocion(id: string): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  await prisma.promotion.delete({ where: { id } });
  return { ok: true };
}
