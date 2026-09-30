"use client";

import { useState } from "react";

export default function CopyManualList({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-ink">Lista para pedir a mano (SKU;cantidad)</p>
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer font-display text-xs font-bold text-brand hover:text-brand-dark"
        >
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs text-ink-soft">{text}</pre>
    </div>
  );
}
