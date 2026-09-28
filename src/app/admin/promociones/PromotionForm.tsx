"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subirLogo } from "@/app/producto/[slug]/actions";
import { crearPromocion, actualizarPromocion, eliminarPromocion, type PromotionInput } from "./actions";
import type { Promotion } from "@/lib/promotions";

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function PromotionForm({ promotion }: { promotion?: Promotion }) {
  const router = useRouter();
  const [title, setTitle] = useState(promotion?.title ?? "");
  const [subtitle, setSubtitle] = useState(promotion?.subtitle ?? "");
  const [imageUrl, setImageUrl] = useState(promotion?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(promotion?.linkUrl ?? "/catalogo");
  const [ctaLabel, setCtaLabel] = useState(promotion?.ctaLabel ?? "Ver ofertas");
  const [startDate, setStartDate] = useState(promotion ? toDateInput(promotion.startDate) : "");
  const [endDate, setEndDate] = useState(promotion ? toDateInput(promotion.endDate) : "");
  const [active, setActive] = useState(promotion?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const result = await subirLogo(formData);
    setUploading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setImageUrl(result.url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const input: PromotionInput = { title, subtitle, imageUrl, linkUrl, ctaLabel, startDate, endDate, active };
    const result = promotion ? await actualizarPromocion(promotion.id, input) : await crearPromocion(input);

    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push("/admin/promociones");
    router.refresh();
  }

  async function handleDelete() {
    if (!promotion) return;
    if (!confirm(`¿Eliminar la promoción "${promotion.title}"?`)) return;
    await eliminarPromocion(promotion.id);
    router.push("/admin/promociones");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-semibold text-ink">Título *</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Regalos para el Día del Padre"
          className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-semibold text-ink">Subtítulo</span>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Hasta un 20% de descuento en artículos seleccionados"
          className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <div>
        <span className="font-display text-sm font-semibold text-ink">Imagen (opcional)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleImageSelect}
          className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
        {uploading && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
        {imageUrl && <img src={imageUrl} alt="Vista previa" className="mt-3 h-32 rounded-xl border border-border object-contain" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Enlace *</span>
          <input
            required
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/catalogo?categoria=navidad"
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Texto del botón</span>
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Desde *</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-display text-sm font-semibold text-ink">Hasta *</span>
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-brand"
        />
        <span className="text-sm text-ink">Activa</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer rounded-full bg-brand px-7 py-3 font-display text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando…" : promotion ? "Guardar cambios" : "Crear promoción"}
        </button>
        {promotion && (
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
