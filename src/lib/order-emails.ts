import "server-only";
import { prisma } from "./db";
import {
  buildNewOrderNotice,
  buildOrderConfirmation,
  buildPaymentReceived,
  type EmailContent,
  type EmailOrder,
} from "./order-email-templates";
import { buildStatusEmail, isStatusMailKey } from "./order-status-emails";

// Respuestas de los clientes a estos correos van a comercial@ (no a info@,
// cuyo buzón está casi lleno).
const REPLY_TO = "comercial@onionandback.com";

type NotifStatus = "pendiente_pago" | "pagado" | "en_diseno" | "en_aprobacion" | "en_produccion" | "terminado" | "entregado";

// Reserva el aviso (pedido, estado): la clave única impide enviarlo dos veces.
// Si la tabla falla se envía igualmente (mejor un duplicado que perder el aviso).
async function claim(orderId: string, status: NotifStatus): Promise<boolean> {
  try {
    await prisma.orderNotification.create({ data: { orderId, status } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    console.error("[order-email] no se pudo registrar el aviso:", err);
    return true;
  }
}

async function release(orderId: string, status: NotifStatus): Promise<void> {
  await prisma.orderNotification.deleteMany({ where: { orderId, status } }).catch(() => {});
}

async function loadOrder(orderId: string): Promise<EmailOrder | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lines: {
        include: {
          productVariant: { include: { product: { select: { name: true } } } },
          marks: { orderBy: { id: "asc" }, select: { zone: true, technique: true } },
        },
      },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    contactEmail: o.contactEmail,
    contactPhone: o.contactPhone,
    invoiceName: o.invoiceName,
    paymentMethod: o.paymentMethod,
    total: parseFloat(o.total.toString()),
    shippingCost: parseFloat(o.shippingCost.toString()),
    discountAmount: parseFloat(o.discountAmount.toString()),
    lines: o.lines.map((l) => ({
      quantity: l.quantity,
      productName: l.productVariant?.product.name ?? "Producto",
      size: l.productVariant?.size ?? "",
      color: l.productVariant?.color ?? "",
      unitPrice: parseFloat(l.unitPrice.toString()),
      marks: l.marks,
    })),
  };
}

// Un fallo de envío nunca debe romper el pedido: se registra y se sigue.
async function send(to: string, mail: EmailContent, label: string): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error(`[order-email] ${label}: RESEND_API_KEY no configurada, no se envía.`);
      return false;
    }
    const fromEnv = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEnv.includes("<") ? fromEnv : `Onion and Back <${fromEnv}>`,
        to: [to],
        reply_to: REPLY_TO,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) {
      console.error(`[order-email] ${label}: Resend ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[order-email] ${label}:`, err);
    return false;
  }
}

// Al crear el pedido: confirmación al cliente + aviso interno.
export async function sendNewOrderEmails(orderId: string): Promise<void> {
  const order = await loadOrder(orderId).catch(() => null);
  if (!order) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const notifyTo = process.env.CONTACT_TO_EMAIL;
  const first = await claim(orderId, "pendiente_pago");
  await Promise.all([
    first
      ? send(order.contactEmail, buildOrderConfirmation(order), "confirmación").then((ok) => (ok ? undefined : release(orderId, "pendiente_pago")))
      : Promise.resolve(),
    notifyTo
      ? send(notifyTo, buildNewOrderNotice(order, `${siteUrl}/admin/pedidos/${order.id}`), "aviso interno")
      : Promise.resolve(),
  ]);
}

// Al marcar el pedido como pagado en el admin.
export async function sendPaymentReceivedEmail(orderId: string): Promise<void> {
  const order = await loadOrder(orderId).catch(() => null);
  if (!order || !(await claim(orderId, "pagado"))) return;
  if (!(await send(order.contactEmail, buildPaymentReceived(order), "pago recibido"))) await release(orderId, "pagado");
}

// Al cambiar el estado desde el admin (con "Avisar al cliente" marcado). Una
// sola vez por pedido y estado; nunca lanza.
export async function sendStatusChangeEmail(orderId: string, status: string): Promise<void> {
  try {
    if (status === "pagado") return await sendPaymentReceivedEmail(orderId);
    if (!isStatusMailKey(status)) return;
    const order = await loadOrder(orderId);
    if (!order || !(await claim(orderId, status))) return;
    // En diseño: ¿falta el logo de alguna línea con marcaje?
    const lines = await prisma.orderLine.findMany({
      where: { orderId },
      select: { marks: { select: { id: true } }, design: { select: { logoFileUrl: true } } },
    });
    const missingInfo = lines.some((l) => l.marks.length > 0 && !l.design?.logoFileUrl);
    if (!(await send(order.contactEmail, buildStatusEmail(status, order, missingInfo), "estado " + status))) {
      await release(orderId, status);
    }
  } catch (err) {
    console.error("[order-email] sendStatusChangeEmail:", err);
  }
}
