import {
  catHtml,
  emailFooter,
  escapeHtml,
  orderNumber,
  wrapHtml,
  type EmailContent,
  type EmailOrder,
} from "./order-email-templates";

// Estados del pedido que tienen aviso propio (pendiente_pago = confirmación y
// pagado = pago recibido están en order-email-templates.ts). Ningún texto
// promete fechas ni plazos. Las frases de Isidoro las propone Operaciones;
// ajustables aquí.
export type StatusMailKey = "en_diseno" | "en_aprobacion" | "en_produccion" | "terminado" | "entregado";

type StatusMail = { subject: string; image: string; alt: string; phrase: string; body: string };

const STATUS_MAILS: Record<StatusMailKey, (missingInfo: boolean) => StatusMail> = {
  en_diseno: (missing) => ({
    subject: "Estamos preparando tu diseño",
    image: "gato-idea.png",
    alt: "Tu idea",
    phrase: missing ? "Isidoro necesita una idea tuya: responde a este correo." : "Isidoro está con tu diseño.",
    body: missing
      ? "Estamos preparando tu diseño y nos falta algo por tu parte (por ejemplo tu logo o los datos de las prendas). Responde a este correo y lo adjuntas."
      : "Estamos preparando tu diseño. Te avisaremos cuando esté listo para que lo veas.",
  }),
  en_aprobacion: () => ({
    subject: "Tu diseño está listo para que lo apruebes",
    image: "gato-todo-ok.png",
    alt: "Todo OK",
    phrase: "Isidoro ya lo ha repasado.",
    body: "Tu diseño está listo para que lo apruebes. Responde a este correo con tu OK o con los cambios que quieras y seguimos.",
  }),
  en_produccion: () => ({
    subject: "Tu pedido está en producción",
    image: "gato-obra.png",
    alt: "Manos a la obra",
    phrase: "Isidoro ya tiene la rasqueta en la pata.",
    body: "Tu pedido ya está en producción.",
  }),
  terminado: () => ({
    subject: "Tu pedido está listo y va de camino",
    image: "gato-enviado.png",
    alt: "Tu pedido va de camino",
    phrase: "Isidoro ha cerrado la caja. Va de camino.",
    body: "Tu pedido está listo y va de camino.",
  }),
  entregado: () => ({
    subject: "Gracias por confiar en nosotros",
    image: "gato-gracias.png",
    alt: "Gracias",
    phrase: "Gracias por confiar en nosotros. Isidoro te manda un abrazo.",
    body: "Tu pedido ya está entregado. Si algo no está como esperabas, responde a este correo y lo vemos.",
  }),
};

export function isStatusMailKey(s: string): s is StatusMailKey {
  return s in STATUS_MAILS;
}

export function buildStatusEmail(key: StatusMailKey, order: EmailOrder, missingInfo = false): EmailContent {
  const m = STATUS_MAILS[key](missingInfo);
  const n = orderNumber(order.id);
  const text = `Hola, pedido nº ${n}:

${m.body}

${m.phrase}

Un abrazo,
El equipo de Onion and Back${emailFooter().text}`;
  const html = wrapHtml(`${catHtml(m.image, m.alt)}<p>Hola, pedido <strong>nº ${n}</strong>:</p>
<p>${escapeHtml(m.body)}</p>
<p><em>${escapeHtml(m.phrase)}</em></p>
<p>Un abrazo,<br>El equipo de Onion and Back</p>`);
  return { subject: m.subject, text, html };
}
