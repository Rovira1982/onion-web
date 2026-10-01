import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiscountCodeById } from "@/lib/discounts";
import { requireAdmin } from "@/lib/auth";
import CodeForm from "../CodeForm";

export default async function EditarCodigoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const discountCode = await getDiscountCodeById(id);
  if (!discountCode) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin/codigos" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Volver a códigos
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Editar código de descuento</h1>
      <div className="mt-6">
        <CodeForm discountCode={discountCode} />
      </div>
    </div>
  );
}
