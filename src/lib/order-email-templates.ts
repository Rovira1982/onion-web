// Plantillas de los correos de pedido (puras, sin base de datos ni red — el
// envío está en order-emails.ts). Transaccionales: sin publicidad ni casillas
// de marketing. Sin plazos de entrega ni fechas (aún no medimos tiempos).

// Plazo para pagar una transferencia antes de que se cancele el pedido
// (Finanzas lo cierra en los Términos — cámbialo solo aquí).
export const TRANSFER_PAYMENT_DEADLINE_DAYS = 3;

export type EmailOrder = {
  id: string;
  contactEmail: string;
  contactPhone: string | null;
  invoiceName: string;
  paymentMethod: "tarjeta" | "bizum" | "transferencia" | string;
  total: number;
  shippingCost: number;
  discountAmount: number;
  lines: {
    quantity: number;
    productName: string;
    size: string;
    color: string;
    marks: { zone: string; technique: string }[];
  }[];
};

export type EmailContent = { subject: string; text: string; html: string };

const BRAND = "#EF7904";
const INK = "#141110";

export const orderNumber = (id: string) => id.slice(0, 8);
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const zoneLabel = (zone: string) => zone.replace(/_/g, " ");

// Bloque de pago — sección intercambiable. Mientras no haya pasarela (TPV) el
// texto es genérico; cuando exista, se sustituye aquí por el enlace o el IBAN
// reales (y se retira el aviso de plazo si ya no aplica).
export function paymentBlock(method: string): { text: string; html: string } {
  const how = "En breve te indicamos cómo pagar.";
  const deadline =
    method === "transferencia"
      ? ` Si eliges transferencia, tienes ${TRANSFER_PAYMENT_DEADLINE_DAYS} días naturales para hacerla; pasado ese plazo el pedido se cancela.`
      : "";
  const methodLabel = { tarjeta: "tarjeta", bizum: "Bizum", transferencia: "transferencia" }[method] ?? method;
  const text = `Forma de pago elegida: ${methodLabel}. ${how}${deadline}`;
  return { text, html: escapeHtml(text) };
}

function summary(order: EmailOrder) {
  const text = order.lines
    .map((l) => {
      const marks = l.marks.length ? ` · marcaje: ${l.marks.map((m) => `${zoneLabel(m.zone)} (${m.technique})`).join(", ")}` : "";
      return `- ${l.quantity} × ${l.productName} (talla ${l.size}, ${l.color})${marks}`;
    })
    .join("\n");
  const html = order.lines
    .map((l) => {
      const marks = l.marks.length
        ? `<br><span style="color:#6b625c">Marcaje: ${escapeHtml(l.marks.map((m) => `${zoneLabel(m.zone)} (${m.technique})`).join(", "))}</span>`
        : "";
      return `<li style="margin:0 0 8px">${l.quantity} × <strong>${escapeHtml(l.productName)}</strong> (talla ${escapeHtml(l.size)}, ${escapeHtml(l.color)})${marks}</li>`;
    })
    .join("");
  const totals = [
    order.discountAmount > 0 ? `Descuento: -${eur(order.discountAmount)}` : null,
    `Envío: ${order.shippingCost > 0 ? eur(order.shippingCost) : "gratis"}`,
    `Total (IVA incluido): ${eur(order.total)}`,
  ].filter(Boolean) as string[];
  return { text: `${text}\n\n${totals.join("\n")}`, html, totals };
}

function wrapHtml(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${INK};max-width:560px;margin:0 auto;padding:16px;line-height:1.5">
<div style="border-bottom:3px solid ${BRAND};padding-bottom:8px;margin-bottom:16px;font-size:18px;font-weight:bold;color:${BRAND}">Onion and Back</div>
${body}
<p style="margin-top:24px;color:#6b625c;font-size:13px">Puedes responder a este correo para cualquier duda.</p>
</div>`;
}

export function buildOrderConfirmation(order: EmailOrder): EmailContent {
  const n = orderNumber(order.id);
  const s = summary(order);
  const pay = paymentBlock(order.paymentMethod);
  const name = order.invoiceName.split(" ")[0] || "";
  const text = `Hola${name ? ` ${name}` : ""}, ¡gracias por tu pedido!

Hemos recibido tu pedido nº ${n}. Este es el resumen:

${s.text}

${pay.text}

Cuando recibamos el pago nos ponemos manos a la obra.

Un abrazo,
El equipo de Onion and Back`;
  const html = wrapHtml(`<p>Hola${name ? ` ${escapeHtml(name)}` : ""}, ¡gracias por tu pedido!</p>
<p>Hemos recibido tu pedido <strong>nº ${n}</strong>. Este es el resumen:</p>
<ul style="padding-left:18px">${s.html}</ul>
<p>${s.totals.map(escapeHtml).join("<br>")}</p>
<p>${pay.html}</p>
<p>Cuando recibamos el pago nos ponemos manos a la obra.</p>
<p>Un abrazo,<br>El equipo de Onion and Back</p>`);
  return { subject: `Hemos recibido tu pedido nº ${n}`, text, html };
}

export function buildPaymentReceived(order: EmailOrder): EmailContent {
  const n = orderNumber(order.id);
  const name = order.invoiceName.split(" ")[0] || "";
  const text = `Hola${name ? ` ${name}` : ""}, ¡pago recibido!

Hemos recibido el pago de tu pedido nº ${n} y nos ponemos manos a la obra.

Si falta algo por tu parte (por ejemplo tu logo o los datos de las prendas), responde a este correo y lo adjuntas.

Un abrazo,
El equipo de Onion and Back`;
  const html = wrapHtml(`<p>Hola${name ? ` ${escapeHtml(name)}` : ""}, ¡pago recibido!</p>
<p>Hemos recibido el pago de tu pedido <strong>nº ${n}</strong> y nos ponemos manos a la obra.</p>
<p>Si falta algo por tu parte (por ejemplo tu logo o los datos de las prendas), responde a este correo y lo adjuntas.</p>
<p>Un abrazo,<br>El equipo de Onion and Back</p>`);
  return { subject: "Pago recibido, nos ponemos manos a la obra", text, html };
}

// Aviso interno (a CONTACT_TO_EMAIL) con cada pedido nuevo.
export function buildNewOrderNotice(order: EmailOrder, adminUrl: string): EmailContent {
  const n = orderNumber(order.id);
  const lines = [
    `Pedido nº ${n}`,
    `Cliente: ${order.invoiceName} <${order.contactEmail}>${order.contactPhone ? ` · ${order.contactPhone}` : ""}`,
    `Importe: ${eur(order.total)} (IVA incluido)`,
    `Forma de pago: ${order.paymentMethod}`,
    `Ver en el admin: ${adminUrl}`,
  ];
  return {
    subject: `Nuevo pedido ${n} — ${order.invoiceName} — ${eur(order.total)}`,
    text: lines.join("\n"),
    html: wrapHtml(lines.map((l) => `<p style="margin:4px 0">${escapeHtml(l)}</p>`).join("")),
  };
}
