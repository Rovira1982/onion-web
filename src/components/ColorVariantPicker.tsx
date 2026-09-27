"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";

export default function ColorVariantPicker({
  variants,
  currentSlug,
}: {
  variants: Product[];
  currentSlug: string;
}) {
  const router = useRouter();

  if (variants.length <= 1) return null;

  return (
    <label className="flex flex-col gap-2">
      <span className="font-display text-sm font-semibold text-ink-soft">Color</span>
      <select
        value={currentSlug}
        onChange={(e) => router.push(`/producto/${e.target.value}`)}
        className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {variants.map((v) => (
          <option key={v.slug} value={v.slug} disabled={v.stock === 0}>
            {v.color || v.model}
            {v.stock === 0 ? " (sin stock)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
