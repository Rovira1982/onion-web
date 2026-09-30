"use client";

import { usePathname } from "next/navigation";

// /packs ya lleva su propia nota de "IVA incluido" — mostrar aquí también
// "Precios sin IVA" contradice esa nota (feedback del Diseñador gráfico,
// 2026-09-30).
export default function FooterVatNote() {
  const pathname = usePathname();
  if (pathname === "/packs") return null;

  return <p>Precios sin IVA. La personalización se cobra aparte, según técnica y cantidad.</p>;
}
