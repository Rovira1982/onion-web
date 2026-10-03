import "server-only";
import { prisma } from "./db";
import {
  buildNewOrderNotice,
  buildOrderConfirmation,
  buildPaymentReceived,
  type EmailContent,
  type EmailOrder,
} from "./order-email-templates";

// Respuestas de los clientes a estos correos van a comercial@ (no a info@,
// cuyo buzón está casi lleno).
const REPLY_TO = "comercial@onionandback.com";

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
      marks: l.marks,
    })),
  };
}

// Un fallo de envío nunca debe romper el pedido: se registra y se sigue.
async function send(to: string, mail: EmailContent, label: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error(`[order-email] ${label}: RESEND_API_KEY no configurada, no se envía.`);
      return;
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
    if (!res.ok) console.error(`[order-email] ${label}: Resend ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[order-email] ${label}:`, err);
  }
}

// Al crear el pedido: confirmación al cliente + aviso interno.
export async function sendNewOrderEmails(orderId: string): Promise<void> {
  const order = await loadOrder(orderId).catch(() => null);
  if (!order) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const notifyTo = process.env.CONTACT_TO_EMAIL;
  await Promise.all([
    send(order.contactEmail, buildOrderConfirmation(order), "confirmación"),
    notifyTo
      ? send(notifyTo, buildNewOrderNotice(order, `${siteUrl}/admin/pedidos/${order.id}`), "aviso interno")
      : Promise.resolve(),
  ]);
}

// Al marcar el pedido como pagado en el admin.
export async function sendPaymentReceivedEmail(orderId: string): Promise<void> {
  const order = await loadOrder(orderId).catch(() => null);
  if (order) await send(order.contactEmail, buildPaymentReceived(order), "pago recibido");
}
