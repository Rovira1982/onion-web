"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarTanda, cancelarTanda, marcarPedidoManualEnviado } from "./actions";

export function ConfirmarTandaButton({ supplierOrderId }: { supplierOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      const result = await confirmarTanda(supplierOrderId);
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
        {pending ? "Confirmando…" : "Confirmar tanda"}
      </button>
      {error && <p className="mt-2 max-w-md text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CancelarTandaButton({ supplierOrderId }: { supplierOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    if (!confirm("¿Cancelar esta tanda? Las líneas quedarán libres para la siguiente.")) return;
    setError("");
    startTransition(async () => {
      const result = await cancelarTanda(supplierOrderId);
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
        className="cursor-pointer rounded-full border border-border px-5 py-2.5 font-display text-sm font-bold text-ink-soft transition-colors hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Cancelando…" : "Cancelar tanda"}
      </button>
      {error && <p className="mt-2 max-w-md text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function MarcarManualEnviadoButton({ supplierOrderId }: { supplierOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      const result = await marcarPedidoManualEnviado(supplierOrderId, code || undefined);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Nº de pedido del proveedor (opcional)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="rounded border border-border px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="cursor-pointer rounded-full bg-brand px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Ya lo pedí a mano"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
