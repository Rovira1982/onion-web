import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import PromotionForm from "../PromotionForm";

export default async function NuevaPromocionPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/admin/promociones" className="text-xs font-semibold text-ink-soft hover:text-brand">
        ← Volver a promociones
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">Nueva promoción</h1>
      <div className="mt-6">
        <PromotionForm />
      </div>
    </div>
  );
}
