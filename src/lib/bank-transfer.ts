// Datos de la transferencia bancaria — único sitio (checkout, página de
// gracias y correos). IBAN confirmado por Josep desde su app del Santander
// (2026-10-03). No se muestra titular hasta confirmar el nombre exacto.
export const BANK_IBAN = "ES98 0049 6852 6729 9001 5097";
export const BANK_NAME = "Banco Santander";

// Plazo para pagar una transferencia antes de que se cancele el pedido
// (Finanzas lo cierra en los Términos — cámbialo solo aquí).
export const TRANSFER_PAYMENT_DEADLINE_DAYS = 3;

// Texto de las instrucciones. Sin nº de pedido (checkout, antes de crearlo) se
// indica que se le dará; con nº (correo, página de gracias) se pone ya.
export function transferInstruction(orderNumber?: string): string {
  const concept = orderNumber ? `el nº de pedido ${orderNumber}` : "el nº de pedido que te daremos al confirmar";
  return `Transfiere el total a IBAN ${BANK_IBAN} (${BANK_NAME}), indicando como concepto ${concept}. Tienes ${TRANSFER_PAYMENT_DEADLINE_DAYS} días naturales para hacerla; pasado ese plazo el pedido se cancela.`;
}
