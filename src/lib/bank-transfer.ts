// Datos de la transferencia bancaria — único sitio (checkout, página de
// gracias y correos). IBAN confirmado por Josep desde su app del Santander
// (2026-10-03). Titular confirmado por Josep con captura de la app.
export const BANK_IBAN = "ES98 0049 6852 6729 9001 5097";
export const BANK_NAME = "Banco Santander";
// Titular tal como figura en la app del banco (Rovira Soler Josep Antoni).
export const BANK_HOLDER = "Josep Antoni Rovira Soler";

// Plazo para pagar una transferencia antes de que se cancele el pedido
// (Finanzas lo cierra en los Términos — cámbialo solo aquí).
export const TRANSFER_PAYMENT_DEADLINE_DAYS = 3;

// Texto de las instrucciones. Sin nº de pedido (checkout, antes de crearlo) se
// indica que se le dará; con nº (correo, página de gracias) se pone ya.
export function transferInstruction(orderNumber?: string): string {
  const concept = orderNumber ? `el nº de pedido ${orderNumber}` : "el nº de pedido que te daremos al confirmar";
  return `Transfiere el total a IBAN ${BANK_IBAN} (${BANK_NAME}, titular ${BANK_HOLDER}), indicando como concepto ${concept}. Tienes ${TRANSFER_PAYMENT_DEADLINE_DAYS} días naturales para hacerla; pasado ese plazo el pedido se cancela.`;
}
