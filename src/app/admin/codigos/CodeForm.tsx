"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCodigo, actualizarCodigo, eliminarCodigo, type DiscountCodeInput } from "./actions";
import type { DiscountCode } from "@/lib/discounts";

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CodeForm({ discountCode }: { discountCode?: DiscountCode }) {
  const router = useRouter();
  const [code, setCode] = useState(discountCode?.code ?? "");
  const [type, setType] = useState<"un_solo_uso" | "cliente_habitual">(discountCode?.type ?? "un_solo_uso");
  const [percentage, setPercentage] = useState(discountCode?.percentage ?? 10);
  const [expiresAt, setExpiresAt] = useState(discountCode?.expiresAt ? toDateInput(discountCode.expiresAt) : "");
  const [active, setActive] = useState(discountCode?.active ?? true);
  const [customerEmail, setCustomerEmail] = useState(discountCode?.customerEmail ?? "");
  const [maxUses, setMaxUses] = useState(discountCode?.maxUses != null ? String(discountCode.maxUses) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const input: DiscountCodeInput = { code, type, percentage, expiresAt, active, customerEmail, maxUses };
    const result = discountCode ? await actualizarCodigo(discountCode.id, input) : await crearCodigo(input);

    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push("/admin/codigos");
    router.refresh();
  }

  async function handleDelete() {
    if (!discountCode) return;
    if (!confirm(`¿Eliminar el código "${discountCode.code}"?`)) return;
    await eliminarCodigo(discountCode.id);
    router.push("/admin/codigos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div>
        <span className="font-display text-sm font-semibold text-ink">Tipo</span>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setType("un_solo_uso")}
            className={`flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              type === "un_solo_uso" ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
            }`}
          >
            Un solo uso
          </button>
          <button
            type="button"
            onClick={() => setType("cliente_habitual")}
            className={`flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              type === "cliente_habitual" ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
            }`}
          >
            Cliente habitual
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Código *</span>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VERANO10"
            className="rounded-xl border border-border px-4 py-2.5 text-sm uppercase text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Porcentaje *</span>
          <input
            required
            type="number"
            min={1}
            max={100}
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value, 10) || 0)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      {type === "cliente_habitual" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-display text-sm font-semibold text-ink">Email del cliente *</span>
            <input
              required
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-display text-sm font-semibold text-ink">Límite de usos</span>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Vacío = ilimitado"
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-semibold text-ink">Caduca (opcional)</span>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="max-w-xs rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-brand"
        />
        <span className="text-sm text-ink">Activo</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando…" : discountCode ? "Guardar cambios" : "Crear código"}
        </button>
        {discountCode && (
          <button
            type="button"
            onClick={handleDelete}
            className="cursor-pointer font-display text-sm font-bold text-red-600 hover:text-red-700"
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
