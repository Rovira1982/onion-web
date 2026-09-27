"use client";

import { useRouter } from "next/navigation";
import type { ProductVariant } from "@/lib/products";

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function sortSizes(sizes: string[]) {
  return sizes.slice().sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

export default function VariantPicker({
  variants,
  currentSlug,
}: {
  variants: ProductVariant[];
  currentSlug: string;
}) {
  const router = useRouter();
  const current = variants.find((v) => v.slug === currentSlug) ?? variants[0];

  const sizes = sortSizes(Array.from(new Set(variants.map((v) => v.size).filter(Boolean))));
  const colors = Array.from(new Set(variants.map((v) => v.colorLabel).filter(Boolean)));

  if (sizes.length <= 1 && colors.length <= 1) return null;

  function findVariant(size: string, colorLabel: string): ProductVariant | undefined {
    return (
      variants.find((v) => v.size === size && v.colorLabel === colorLabel) ??
      variants.find((v) => v.size === size) ??
      variants.find((v) => v.colorLabel === colorLabel)
    );
  }

  function goTo(size: string, colorLabel: string) {
    const next = findVariant(size, colorLabel);
    if (next) router.push(`/producto/${next.slug}`);
  }

  return (
    <div className="grid max-w-xs gap-4 sm:grid-cols-2">
      {sizes.length > 1 && (
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink-soft">Talla</span>
          <select
            value={current.size}
            onChange={(e) => goTo(e.target.value, current.colorLabel)}
            className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}

      {colors.length > 1 && (
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink-soft">Color</span>
          <select
            value={current.colorLabel}
            onChange={(e) => goTo(current.size, e.target.value)}
            className="rounded-lg border border-border px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
