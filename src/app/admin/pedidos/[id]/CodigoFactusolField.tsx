"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarCodigoFactusol } from "./actions";

export default function CodigoFactusolField({ nif, currentCode }: { nif: string; currentCode: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentCode?.toString() ?? "");
  const [error, setError] = useState("");

  function handleSave() {
    setError("");
    const code = parseInt(value, 10);
    if (!value.trim() || Number.isNaN(code)) {
      setError("Introduce un número.");
      return;
    }
    startTransition(async () => {
      const result = await actualizarCodigoFactusol(nif, code);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={currentCode == null ? "se asigna al descargar el ZIP" : ""}
          className="w-40 rounded-xl border border-border px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
