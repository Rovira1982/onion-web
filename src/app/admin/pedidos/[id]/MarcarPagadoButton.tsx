"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPedidoPagado } from "./actions";

export default function MarcarPagadoButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      const result = await marcarPedidoPagado(orderId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="cursor-pointer rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Marcar como pagado"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
