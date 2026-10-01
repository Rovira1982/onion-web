import "server-only";
import { createHash } from "node:crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const GRAPH_API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// E.164-ish normalization (digits only, Meta hashes the raw digit string —
// no leading "+"). Good enough for the phone numbers this checkout collects
// (Spanish numbers, optionally with +34).
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

type CapiEventInput = {
  eventName: "Purchase" | "PageView";
  eventId: string; // shared with the matching client-side fbq() call for dedup
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
};

// Server-side mirror of the browser Pixel, via Meta's Conversions API.
// Needed because browsers (Safari/iOS ITP in particular) block a growing
// share of the client-side Pixel's cookie-based tracking — CAPI sends the
// same event from the server so Meta still sees it. Never throws: a Meta
// outage or bad token must not break checkout, so failures are swallowed
// (logged) rather than propagated.
export async function sendCapiEvent(input: CapiEventInput): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const userData: Record<string, string[]> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.phone) userData.ph = [sha256(normalizePhone(input.phone))];

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (input.value != null) {
    event.custom_data = { value: input.value, currency: input.currency ?? "EUR" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      }
    );
    if (!res.ok) {
      console.error("Meta CAPI event failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Meta CAPI event failed:", err);
  }
}
