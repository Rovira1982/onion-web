import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import OccasionPicker from "./OccasionPicker";

export default async function AdminOcasionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const occasion = await prisma.occasion.findUnique({ where: { slug } });
  if (!occasion) notFound();

  const assignments = await prisma.productOccasion.findMany({
    where: { occasionId: occasion.id },
    include: {
      product: {
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
      },
    },
  });

  const assigned = assignments.map((a) => ({
    id: a.product.id,
    name: a.product.name,
    supplierSku: a.product.supplierSku,
    image: a.product.images[0]?.url ?? null,
    category: a.product.category?.name ?? "",
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin/ocasiones" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Ocasiones
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink">{occasion.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Busca productos por nombre y añádelos. Aparecerán en{" "}
        <code className="text-xs">/catalogo?ocasion={occasion.slug}</code> y en el enlace correspondiente de la home.
      </p>

      <OccasionPicker occasionId={occasion.id} initialAssigned={assigned} />
    </div>
  );
}
