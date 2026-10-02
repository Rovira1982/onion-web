"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "relevancia", label: "Relevancia" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "nombre_asc", label: "Nombre: A-Z" },
  { value: "nombre_desc", label: "Nombre: Z-A" },
];

export default function SortSelect({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "relevancia") {
      params.delete("orden");
    } else {
      params.set("orden", e.target.value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/catalogo?${qs}` : "/catalogo");
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Ordenar por</span>
      <select
        value={current}
        onChange={handleChange}
        className="cursor-pointer rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
