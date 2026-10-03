import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, canMoveToStatus, isOrderStatus } from "./order-status";

describe("estados del pedido", () => {
  it("todos los estados tienen etiqueta", () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABEL[s]).toBeTruthy();
  });

  it("reconoce solo estados válidos", () => {
    expect(isOrderStatus("en_produccion")).toBe(true);
    expect(isOrderStatus("cualquier_cosa")).toBe(false);
  });

  it("un pedido sin pagar no puede avanzar", () => {
    expect(canMoveToStatus("pendiente", "en_produccion")).toBe(false);
    expect(canMoveToStatus("pendiente", "pendiente_pago")).toBe(true);
  });

  it("un pedido pagado puede ir a cualquier estado", () => {
    for (const s of ORDER_STATUSES) expect(canMoveToStatus("pagado", s)).toBe(true);
  });
});
