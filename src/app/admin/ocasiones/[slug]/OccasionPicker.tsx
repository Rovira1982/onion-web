"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { buscarProductos, asignarProducto, quitarProducto, type ProductPick } from "../actions";

export default function OccasionPicker({
  occasionId,
  initialAssigned,
}: {
  occasionId: string;
  initialAssigned: ProductPick[];
}) {
  const [assigned, setAssigned] = useState(initialAssigned);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  const assignedIds = new Set(assigned.map((p) => p.id));

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await buscarProductos(q);
    setResults(found);
    setSearching(false);
  }

  function handleAdd(product: ProductPick) {
    startTransition(async () => {
      const res = await asignarProducto(occasionId, product.id);
      if ("ok" in res) setAssigned((prev) => [...prev, product]);
    });
  }

  function handleRemove(productId: string) {
    startTransition(async () => {
      const res = await quitarProducto(occasionId, productId);
      if ("ok" in res) setAssigned((prev) => prev.filter((p) => p.id !== productId));
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div>
        <label htmlFor="q" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Buscar producto por nombre
        </label>
        <input
          id="q"
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Ej. camiseta, gorra, taza…"
          className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {searching && <p className="mt-3 text-sm text-ink-soft">Buscando…</p>}

        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                {p.image ? (
                  <Image src={p.image} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-ink-soft">{p.category}</p>
                </div>
                <button
                  type="button"
                  disabled={assignedIds.has(p.id) || pending}
                  onClick={() => handleAdd(p)}
                  className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink disabled:cursor-default disabled:opacity-40 hover:border-brand hover:text-brand"
                >
                  {assignedIds.has(p.id) ? "Ya añadido" : "Añadir"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Productos asignados ({assigned.length})
        </h2>
        {assigned.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Todavía no hay ningún producto en esta ocasión.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {assigned.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                {p.image ? (
                  <Image src={p.image} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-ink-soft">{p.category}</p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRemove(p.id)}
                  className="cursor-pointer text-xs font-bold text-ink-soft hover:text-red-600"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
