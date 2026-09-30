"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarBultos } from "./actions";

export default function BultosSelector({ supplierOrderId, parcelCount }: { supplierOrderId: string; parcelCount: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleChange(value: string) {
    setError("");
    startTransition(async () => {
      const result = await actualizarBultos(supplierOrderId, Number(value));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <label className="font-display text-xs font-semibold text-ink-soft">Bultos</label>
      <select
        className="ml-2 rounded border border-border px-2 py-1 text-sm"
        value={parcelCount ?? 1}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value={1}>1 bulto</option>
        <option value={2}>2 bultos</option>
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
