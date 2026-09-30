// Varias líneas de carrito (una por talla) pueden compartir el mismo diseño
// — mismo logo, misma técnica y zonas — cuando el cliente pide varias tallas
// de una vez. El precio de marcaje debe salir de la cantidad TOTAL del
// diseño (así se factura el montaje real de la tirada), no de la cantidad
// de cada talla por separado; el precio de prenda (tramo unidad/pack/caja)
// sí sigue siendo por talla, porque ese tramo es real por SKU del proveedor.
// Compartido entre cart.tsx (cliente) y checkout/actions.ts (servidor) para
// no duplicar esta cuenta en dos sitios.
export function groupQuantityTotals(items: { quantity: number; designGroupId?: string }[]): number[] {
  const keys = items.map((item, idx) => item.designGroupId ?? `__solo_${idx}`);
  const totalsByKey = new Map<string, number>();
  keys.forEach((key, idx) => {
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + items[idx].quantity);
  });
  return keys.map((key) => totalsByKey.get(key)!);
}
