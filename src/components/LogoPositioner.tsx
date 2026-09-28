"use client";

import { useCallback, useRef, useState } from "react";
import { MOCKUP_VIEWBOX, ZONE_VIEW, type MarkZone } from "@/lib/garment-mockup";

export type LogoTransform = { x: number; y: number; scale: number; rotation: number };
export type ZoneTransforms = Partial<Record<MarkZone, LogoTransform>>;

const DEFAULT_TRANSFORM: LogoTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

export default function LogoPositioner({
  zones,
  logoUrl,
  onChange,
}: {
  zones: MarkZone[];
  logoUrl: string;
  onChange: (t: ZoneTransforms) => void;
}) {
  const [activeZone, setActiveZone] = useState<MarkZone>(zones[0]);
  const [transforms, setTransforms] = useState<ZoneTransforms>(() =>
    Object.fromEntries(zones.map((z) => [z, { ...DEFAULT_TRANSFORM }]))
  );
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const transform = transforms[activeZone] ?? DEFAULT_TRANSFORM;

  const update = useCallback(
    (zone: MarkZone, next: LogoTransform) => {
      setTransforms((prev) => {
        const merged = { ...prev, [zone]: next };
        onChange(merged);
        return merged;
      });
    },
    [onChange]
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    update(activeZone, { ...transform, x: dragState.current.origX + dx, y: dragState.current.origY + dy });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragState.current = null;
  }

  const view = ZONE_VIEW[activeZone];
  const ZONE_LABEL: Record<MarkZone, string> = { pecho: "Pecho", espalda: "Espalda", mangas: "Mangas" };

  return (
    <div>
      {zones.length > 1 && (
        <div className="mb-3 flex gap-2">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setActiveZone(z)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                activeZone === z ? "border-brand bg-brand text-white" : "border-border text-ink-soft hover:border-brand"
              }`}
            >
              {ZONE_LABEL[z]}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl border border-border bg-muted"
        onPointerMove={handlePointerMove}
      >
        <svg viewBox={MOCKUP_VIEWBOX} className="h-full w-full p-6">
          <path d={view.path} fill="#e8e5df" stroke="#c9c4ba" strokeWidth={2} />
        </svg>
        <p className="pointer-events-none absolute left-3 top-3 text-xs font-semibold text-ink-soft">{view.label}</p>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="absolute left-1/2 top-1/2 flex h-20 w-20 cursor-grab items-center justify-center active:cursor-grabbing"
          style={{
            transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
          }}
        >
          <img src={logoUrl} alt="Tu logo" className="max-h-full max-w-full select-none" draggable={false} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Tamaño</span>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.05}
            value={transform.scale}
            onChange={(e) => update(activeZone, { ...transform, scale: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-soft">Rotación</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={transform.rotation}
            onChange={(e) => update(activeZone, { ...transform, rotation: Number(e.target.value) })}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Arrastra el logo para colocarlo{zones.length > 1 ? " en esta zona" : ""}.
      </p>
    </div>
  );
}
