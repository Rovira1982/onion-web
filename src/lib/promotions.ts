import "server-only";
import { prisma } from "./db";

export type Promotion = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string;
  ctaLabel: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
};

// The one promotion currently live on the homepage, if any — active flag on
// plus today falling inside [startDate, endDate]. Ties broken by most
// recently created (no manual priority ordering to manage).
export async function getActivePromotion(): Promise<Promotion | null> {
  const now = new Date();
  return prisma.promotion.findFirst({
    where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPromotions(): Promise<Promotion[]> {
  return prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getPromotionById(id: string): Promise<Promotion | null> {
  return prisma.promotion.findUnique({ where: { id } });
}
