import { describe, expect, it } from "vitest";
import { buildStatusEmail, isStatusMailKey, type StatusMailKey } from "./order-status-emails";
import type { EmailOrder } from "./order-email-templates";

const order: EmailOrder = {
  id: "abcdef12-0000-0000-0000-000000000000",
  contactEmail: "c@example.com",
  contactPhone: null,
  invoiceName: "Ana",
  paymentMethod: "tarjeta",
  total: 35.04,
  shippingCost: 6,
  discountAmount: 0,
  lines: [],
};

const KEYS: StatusMailKey[] = ["en_diseno", "en_aprobacion", "en_produccion", "terminado", "entregado"];

describe("correos por estado", () => {
  it("solo los estados con aviso propio se reconocen", () => {
    for (const k of KEYS) expect(isStatusMailKey(k)).toBe(true);
    expect(isStatusMailKey("pagado")).toBe(false);
    expect(isStatusMailKey("pendiente_pago")).toBe(false);
  });

  it("todos llevan nº de pedido, pie legal, gato y ninguna fecha ni plazo", () => {
    for (const k of KEYS) {
      const m = buildStatusEmail(k, order);
      expect(m.text).toContain("abcdef12");
      expect(m.text).toContain("NIF 53214051D");
      expect(m.html).toContain("/email/gato-");
      expect(m.text).not.toMatch(/\d+ (días|horas)|mañana|lunes|viernes/i);
    }
  });

  it("en diseño cambia el texto si falta información del cliente", () => {
    expect(buildStatusEmail("en_diseno", order, true).text).toContain("nos falta algo");
    expect(buildStatusEmail("en_diseno", order, false).text).toContain("Isidoro está con tu diseño");
  });
});
