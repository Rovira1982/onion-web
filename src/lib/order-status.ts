// Estados del pedido en el orden en que avanzan (ver enum OrderStatus en
// prisma/schema.prisma). Puro y sin base de datos: lo usan el panel de admin
// (cliente y servidor) y los tests.
export const ORDER_STATUSES = [
  "pendiente_pago",
  "pagado",
  "en_diseno",
  "en_aprobacion",
  "en_produccion",
  "terminado",
  "entregado",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  en_diseno: "En diseño",
  en_aprobacion: "En aprobación",
  en_produccion: "En producción",
  terminado: "Terminado",
  entregado: "Entregado",
};

export function isOrderStatus(value: string): value is OrderStatusValue {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

// Un pedido sin pagar no puede pasar a diseño/producción: solo puede quedarse
// pendiente de pago. Evita empezar a producir algo que no está cobrado.
export function canMoveToStatus(paymentStatus: string, target: OrderStatusValue): boolean {
  if (paymentStatus === "pagado") return true;
  return target === "pendiente_pago";
}
