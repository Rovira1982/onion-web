// Packs de precio cerrado para los anuncios de Meta/Facebook — el precio NO
// sale de calculateQuote(): es un precio fijo pactado con el dueño
// (2026-09-30), independiente de la tarifa de marcaje normal. El cliente
// entra por la ficha real del producto (con ?pack=<código> en la URL),
// elige color y reparte las unidades entre tallas, pero el total SIEMPRE es
// pack.totalPrice — nunca lo que calcularía el presupuestador para esas
// mismas zonas/tamaños.
export type PackDefinition = {
  code: string;
  productSlug: string; // el pack solo es válido sobre esta ficha de producto
  quantity: number; // unidades totales exigidas (repartidas entre tallas)
  totalPrice: number; // €, IVA y diseño incluidos — envío aparte, regla normal de la web
  // Lanzamiento escalonado (dueño, 2026-09-30): primero sale la web sola,
  // los packs se van activando uno a uno unos días después. `visible:
  // false` significa que /packs no lo lista, pero la ficha de producto con
  // ?pack=<code> sigue funcionando igual — el enlace solo se comparte
  // cuando el dueño decide publicarlo (anuncios, WhatsApp, etc).
  visible: boolean;
};

export const PACKS: Record<string, PackDefinition> = {
  racing69: {
    // Precio decidido por Josep 2026-10-01 (vía Finanzas): 7,90€/ud, 79€ el
    // pack — sube desde el 6,90€/69€ inicial tras contar coste real de
    // envío + gestión, que el cálculo original no incluía. El código
    // "racing69" se mantiene por historial aunque el precio ya no sea 69€.
    code: "racing69",
    productSlug: "racing-cavatop",
    quantity: 10,
    totalPrice: 79,
    // Destapado por Josep, 2026-10-01, directamente en conversación — listo
    // para el lanzamiento del cartel genérico que lleva a la portada.
    visible: true,
  },
};

export function getPack(code: string | null | undefined): PackDefinition | null {
  if (!code) return null;
  return PACKS[code] ?? null;
}

export function getVisiblePacks(): PackDefinition[] {
  return Object.values(PACKS).filter((p) => p.visible);
}
