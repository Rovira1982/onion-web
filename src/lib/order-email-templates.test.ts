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
  total: 36.04,
  shippingCost: 6,
  discountAmount: 0,
  lines: [{ unitPrice: 8, quantity: 3, productName: "Camiseta Atomic", size: "M", color: "Negro", marks: [{ zone: "manga_izquierda", technique: "DTF" }] }],
};

describe("correos de pedido", () => {
  it("la confirmación lleva asunto, nº, marcaje, total y plazo de transferencia", () => {
    const m = buildOrderConfirmation(order);
    expect(m.subject).toBe("Hemos recibido tu pedido nº abcdef12");
    expect(m.text).toContain("manga izquierda (DTF)");
    expect(m.text).toContain("8,00 €/ud + IVA = 24,00 € + IVA");
    expect(m.text).toContain("IVA (21 %): 6,04 €");
    expect(m.text).toContain("Total: 36,04 €");
    expect(m.text).toContain(`Tienes ${TRANSFER_PAYMENT_DEADLINE_DAYS} días naturales`);
    expect(m.text).toContain("IBAN ES98 0049 6852 6729 9001 5097 (Banco Santander, titular Josep Antoni Rovira Soler)");
    expect(m.text).toContain("concepto el nº de pedido abcdef12");
    expect(m.text).not.toContain("Si eliges transferencia");
  });

  it("escapa el HTML del nombre del cliente", () => {
    expect(buildOrderConfirmation(order).html).not.toContain("<b>");
  });

  it("con tarjeta no menciona el plazo de transferencia", () => {
    const card = buildOrderConfirmation({ ...order, paymentMethod: "tarjeta" }).text;
    expect(card).not.toContain("días naturales");
    expect(card).not.toContain("IBAN");
  });

  it("con el total que calcula el checkout, el IVA sale 21 % de la base", () => {
    // Misma fórmula que crearPedido: (base − descuento) × 1,21 + envío.
    const base = 24;
    const total = Math.round((base * 1.21 + 6) * 100) / 100; // 35,04
    const m = buildOrderConfirmation({ ...order, total, shippingCost: 6 });
    expect(m.text).toContain("Base imponible: 24,00 €");
    expect(m.text).toContain("IVA (21 %): 5,04 €");
    expect(m.text).toContain("Total: 35,04 €");
  });

  it("los tres correos llevan el pie legal", () => {
    for (const m of [buildOrderConfirmation(order), buildPaymentReceived(order), buildNewOrderNotice(order, "u")]) {
      expect(m.text).toContain("NIF 53214051D");
      expect(m.html).toContain("/privacidad");
    }
  });

  it("pago recibido y aviso interno", () => {
    expect(buildPaymentReceived(order).subject).toBe("Pago recibido, nos ponemos manos a la obra");
    expect(buildNewOrderNotice(order, "https://x/admin/pedidos/1").text).toContain("https://x/admin/pedidos/1");
  });
});
