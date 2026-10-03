"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatusValue } from "@/lib/order-status";
import { cambiarEstadoPedido } from "./actions";

export default function EstadoSelect({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notify, setNotify] = useState(true);

  function save() {
    setError("");
    startTransition(async () => {
      const result = await cambiarEstadoPedido(orderId, value, notify);
      if ("error" in result) {
        setError(result.error);
        setValue(current);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s as OrderStatusValue]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={pending || value === current}
          className="cursor-pointer rounded-full bg-brand px-3 py-1.5 font-display text-xs font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Avisar al cliente por correo
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
