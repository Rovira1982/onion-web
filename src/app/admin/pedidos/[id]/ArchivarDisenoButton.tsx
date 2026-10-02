"use client";
import { useState, useTransition } from "react";
import { archivarDisenoDeLinea } from "./actions";

export default function ArchivarDisenoButton({ orderLineId }: { orderLineId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      const result = await archivarDisenoDeLinea(orderLineId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) return <span className="text-xs font-semibold text-green-700">Guardado para futuros pedidos ✓</span>;
  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar logo para futuros pedidos"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
