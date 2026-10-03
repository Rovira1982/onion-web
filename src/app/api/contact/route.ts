import { NextRequest, NextResponse } from "next/server";

// Sends the contact form via Resend (https://resend.com). Requires
// RESEND_API_KEY and CONTACT_TO_EMAIL in .env.local. Until those are set,
// this returns a clear 503 instead of silently pretending to send.
export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  // Acepta "Nombre <correo>" (como está en Railway) o solo el correo.
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !toEmail) {
    return NextResponse.json(
      {
        error:
          "El envío de correo no está configurado todavía (falta RESEND_API_KEY / CONTACT_TO_EMAIL en .env.local).",
      },
      { status: 503 }
    );
  }

  let body: {
    nombre?: string;
    email?: string;
    empresa?: string;
    telefono?: string;
    mensaje?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { nombre, email, empresa, telefono, mensaje } = body;
  if (!nombre?.trim() || !email?.trim() || !mensaje?.trim()) {
    return NextResponse.json(
      { error: "Nombre, email y mensaje son obligatorios." },
      { status: 400 }
    );
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

  const html = `
    <h2>Nueva solicitud de presupuesto — Onion and Back</h2>
    <p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${empresa ? `<p><strong>Empresa:</strong> ${escapeHtml(empresa)}</p>` : ""}
    ${telefono ? `<p><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>` : ""}
    <p><strong>Mensaje:</strong></p>
    <p>${escapeHtml(mensaje).replace(/\n/g, "<br/>")}</p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail.includes("<") ? fromEmail : `Onion and Back <${fromEmail}>`,
      to: [toEmail],
      reply_to: email,
      subject: `Nueva solicitud de presupuesto de ${nombre}`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje. Inténtalo de nuevo en unos minutos.", detail },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
