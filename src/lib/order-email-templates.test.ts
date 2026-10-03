import { describe, expect, it } from "vitest";
import {
  buildNewOrderNotice,
  buildOrderConfirmation,
  buildPaymentReceived,
  TRANSFER_PAYMENT_DEADLINE_DAYS,
  type EmailOrder,
} from "./order-email-templates";

const order: EmailOrder = {
  id: "abcdef12-0000-0000-0000-000000000000",
  contactEmail: "cliente@example.com",
  contactPhone: null,
  invoiceName: "Ana <b>Pérez</b>",
  paymentMethod: "transferencia",
  total: 123.4,
  shippingCost: 0,
  discountAmount: 0,
  lines: [{ quantity: 3, productName: "Camiseta Atomic", size: "M", color: "Negro", marks: [{ zone: "manga_izquierda", technique: "DTF" }] }],
};

describe("correos de pedido", () => {
  it("la confirmación lleva asunto, nº, marcaje, total y plazo de transferencia", () => {
    const m = buildOrderConfirmation(order);
    expect(m.subject).toBe("Hemos recibido tu pedido nº abcdef12");
    expect(m.text).toContain("manga izquierda (DTF)");
    expect(m.text).toContain("123,40 €");
    expect(m.text).toContain(`${TRANSFER_PAYMENT_DEADLINE_DAYS} días naturales`);
  });

  it("escapa el HTML del nombre del cliente", () => {
    expect(buildOrderConfirmation(order).html).not.toContain("<b>");
  });

  it("con tarjeta no menciona el plazo de transferencia", () => {
    expect(buildOrderConfirmation({ ...order, paymentMethod: "tarjeta" }).text).not.toContain("días naturales");
  });

  it("pago recibido y aviso interno", () => {
    expect(buildPaymentReceived(order).subject).toBe("Pago recibido, nos ponemos manos a la obra");
    expect(buildNewOrderNotice(order, "https://x/admin/pedidos/1").text).toContain("https://x/admin/pedidos/1");
  });
});
