// Server-only client for the Gorfactory WSCLIENTS API
// (https://clientsws.gorfactory.es:2096/swagger/index.html).
//
// Requires GORFACTORY_USERNAME / GORFACTORY_PASSWORD in .env.local (an
// Extranet client account). Never import this file from a "use client"
// component — it reads server-only env vars and holds the bearer token
// in memory for the life of the server process.
import "server-only";

const BASE_URL = process.env.GORFACTORY_BASE_URL ?? "https://clientsws.gorfactory.es:2096";

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function login(): Promise<string> {
  const username = process.env.GORFACTORY_USERNAME;
  const password = process.env.GORFACTORY_PASSWORD;
  const scope = process.env.GORFACTORY_SCOPE ?? "";

  if (!username || !password) {
    throw new Error(
      "GORFACTORY_USERNAME / GORFACTORY_PASSWORD no configurados en .env.local"
    );
  }

  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  if (scope) form.set("scope", scope);

  const res = await fetch(`${BASE_URL}/api/v1/login`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Gorfactory login falló: ${res.status} ${await res.text()}`);
  }

  // The API returns the raw JWT string (or a JSON string) as the body.
  const raw = (await res.text()).trim();
  const token = raw.startsWith('"') ? JSON.parse(raw) : raw;
  return token;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  const token = await login();
  const exp = decodeJwtExp(token) ?? now + 15 * 60_000; // fallback: assume 15 min
  tokenCache = { token, expiresAt: exp };
  return token;
}

async function gorfactoryFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  if (res.status === 401) {
    // Token expired/invalid mid-flight: retry once with a fresh login.
    tokenCache = null;
    const freshToken = await getToken();
    const retry = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${freshToken}`,
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });
    if (!retry.ok) {
      throw new Error(`Gorfactory ${path} falló: ${retry.status} ${await retry.text()}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    throw new Error(`Gorfactory ${path} falló: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export type GorfactoryCategory = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export function getCategories(params: { lang?: string; brand: string }) {
  const q = new URLSearchParams({ lang: params.lang ?? "es", brand: params.brand });
  return gorfactoryFetch<GorfactoryCategory[]>(`/api/v1/item/categories?${q}`);
}

export function getCategoriesTree(params: { lang?: string; brand: string; category?: string }) {
  const q = new URLSearchParams({ lang: params.lang ?? "es", brand: params.brand });
  if (params.category) q.set("category", params.category);
  return gorfactoryFetch(`/api/v1/item/categories/tree?${q}`);
}

export function getCatalog(params: { lang?: string; brand?: string; category?: string }) {
  const q = new URLSearchParams();
  q.set("lang", params.lang ?? "es");
  if (params.brand) q.set("brand", params.brand);
  if (params.category) q.set("category", params.category);
  return gorfactoryFetch(`/api/v1/item/getcatalog?${q}`);
}

export function getItem(params: { itemcode: string; lang?: string }) {
  const q = new URLSearchParams({ itemcode: params.itemcode, lang: params.lang ?? "es" });
  return gorfactoryFetch(`/api/v1/item/get?${q}`);
}

export function getUserStock(body: Record<string, unknown> = {}) {
  return gorfactoryFetch(`/api/v1/stock/getuserstock`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type GorfactoryOrder = {
  reference: string;
  deliveryaddress: {
    addressname: string;
    address: string;
    city: string;
    postcode: string;
    county?: string;
    statecode?: string;
    state?: string;
    countrycode: string;
    country: string;
    phone?: string;
    email?: string;
    saveaddress?: string;
    attde?: string;
  };
  comments?: string;
  requireFullStock?: boolean;
  isAirShipping?: boolean;
  lines: { itemcode: string; quantity: string; warehouse?: string }[];
};

// Places a REAL order with Gorfactory. Never call this without explicit,
// per-order confirmation from a human — this is a live purchase, not a draft.
export function placeOrder(order: GorfactoryOrder) {
  return gorfactoryFetch(`/api/v1.1/order`, {
    method: "POST",
    body: JSON.stringify(order),
  });
}
