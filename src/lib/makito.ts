// Server-only client for the Makito B2B API (https://apis.makito.es).
// Modern JWT REST API — see https://data.makito.es/apis_b2b/index.html for
// the reference docs. Same base URL for test and production; only the
// clientId/clientSecret pair changes (the test account never processes
// real orders — see docs, "Entorno de pruebas").
//
// Requires MAKITO_CLIENT_ID / MAKITO_CLIENT_SECRET (production) and/or
// MAKITO_TEST_CLIENT_ID / MAKITO_TEST_CLIENT_SECRET (test) in .env.local.
// Never import this file from a "use client" component.
import "server-only";

const BASE_URL = process.env.MAKITO_BASE_URL ?? "https://apis.makito.es";

export type MakitoEnv = "prod" | "test";

function credentialsFor(env: MakitoEnv): { clientId: string; clientSecret: string } {
  const clientId = env === "test" ? process.env.MAKITO_TEST_CLIENT_ID : process.env.MAKITO_CLIENT_ID;
  const clientSecret = env === "test" ? process.env.MAKITO_TEST_CLIENT_SECRET : process.env.MAKITO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const prefix = env === "test" ? "MAKITO_TEST_CLIENT_ID / MAKITO_TEST_CLIENT_SECRET" : "MAKITO_CLIENT_ID / MAKITO_CLIENT_SECRET";
    throw new Error(`${prefix} no configurados en .env.local`);
  }
  return { clientId, clientSecret };
}

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

type TokenCache = { token: string; expiresAt: number };
const tokenCacheByEnv = new Map<MakitoEnv, TokenCache>();

async function login(env: MakitoEnv): Promise<string> {
  const { clientId, clientSecret } = credentialsFor(env);
  const res = await fetch(`${BASE_URL}/access/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    throw new Error(`Makito login (${env}) falló: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error(`Makito login (${env}): respuesta sin token.`);
  }
  return data.token;
}

async function getToken(env: MakitoEnv): Promise<string> {
  const now = Date.now();
  const cached = tokenCacheByEnv.get(env);
  if (cached && cached.expiresAt > now + 30_000) return cached.token;
  const token = await login(env);
  const exp = decodeJwtExp(token) ?? now + 15 * 60_000; // fallback: assume 15 min
  tokenCacheByEnv.set(env, { token, expiresAt: exp });
  return token;
}

type MakitoFetchOptions = RequestInit & { env?: MakitoEnv };

async function makitoFetch<T>(path: string, options: MakitoFetchOptions = {}): Promise<T> {
  const { env = "prod", ...init } = options;
  const token = await getToken(env);
  const isForm = init.body instanceof FormData;

  const doFetch = (bearer: string) =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${bearer}`,
        ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    tokenCacheByEnv.delete(env);
    const freshToken = await getToken(env);
    res = await doFetch(freshToken);
  }
  if (!res.ok) {
    throw new Error(`Makito ${path} falló: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// ---- Catálogo ----

export type MakitoProduct = {
  ref: string;
  web_reference: string;
  name: string;
  description: string;
  printcode?: string;
  image?: string;
  variant_image?: string;
  [key: string]: unknown;
};

export function getCatalog(params: { format?: "JSON" | "XML" | "CSV"; lang?: string; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  q.set("format", params.format ?? "JSON");
  if (params.lang) q.set("lang", params.lang);
  return makitoFetch<{ products: MakitoProduct[] }>(`/catalog/files?${q}`, { env: params.env });
}

export function catalogAssetUrl(prodReference: string, type: "principal" | "thumbnail", fileName: string, variantReference?: string) {
  const path = variantReference
    ? `/catalog/assets/${prodReference}/${variantReference}/${type}/${fileName}`
    : `/catalog/assets/${prodReference}/${type}/${fileName}`;
  return `${BASE_URL}${path}`;
}

// ---- Stock ----

export type MakitoStockRow = { material: string; quantity: number; availableDate?: string };

export function getStock(params: { format?: "JSON" | "XML" | "CSV"; plant?: string; storageLocation?: string; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  q.set("format", params.format ?? "JSON");
  if (params.plant) q.set("plant", params.plant);
  if (params.storageLocation) q.set("storageLocation", params.storageLocation);
  return makitoFetch<{ stocks: MakitoStockRow[] }>(`/stock/files?${q}`, { env: params.env });
}

// ---- Precios ----

export type MakitoPriceScale = { quantity: string; amount: string };
export type MakitoPriceRow = { material: string; currency: string; baseQuantity: string; scales: MakitoPriceScale[] };

export function getPriceList(params: { format?: "JSON" | "XML" | "CSV"; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  q.set("format", params.format ?? "JSON");
  return makitoFetch<{ generatedAt: string; priceList: MakitoPriceRow[] }>(`/price-list/files?${q}`, { env: params.env });
}

export type MakitoPrintPriceItem = { threshold: string; type: string; price: number };
export type MakitoPrintPrice = {
  id: string;
  category: string;
  code: string;
  name: string;
  prices: { setupPrice: number; additionalSetupPrice: number; items: MakitoPrintPriceItem[] };
};

export function getPrintPriceList(params: { format?: "JSON" | "XML" | "CSV"; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  q.set("format", params.format ?? "JSON");
  return makitoFetch<{ generatedAt: string; printPriceList: MakitoPrintPrice[] }>(`/print-price-list/files?${q}`, { env: params.env });
}

// ---- Marcaje (print config) ----

export function getPrintConfig(params: { format?: "JSON" | "XML" | "CSV"; lang?: string; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  q.set("format", params.format ?? "JSON");
  if (params.lang) q.set("lang", params.lang);
  return makitoFetch<{ generatedAt: string; lang: string; products: unknown[] }>(`/print-config/files?${q}`, { env: params.env });
}

export function printConfigAssetUrl(prodReference: string, metadataName: string, fileName: string) {
  return `${BASE_URL}/print-config/assets/${prodReference}/${metadataName}/${fileName}`;
}

// ---- Pedidos ----
// Nunca se llama a placeOrder() sin confirmación humana explícita para ese
// pedido concreto — mismo criterio que gorfactory.ts/toptex.ts.

export type MakitoOrderItem = {
  variant: string;
  quantity: number;
  observations?: string;
  availableDate?: string;
  printingJobs?: {
    area: string;
    technique: string;
    attachment: string;
    colors: string;
    doublePass?: boolean;
    width: number;
    height: number;
  }[];
};

export type MakitoOrderInput = {
  customerOrder: string;
  completeDelivery?: boolean;
  expressDelivery?: boolean;
  allowRepeatCustomer?: boolean;
  allowPartialOrder?: boolean;
  contact: { name: string; phoneNumber: string; email: string };
  shippingAddress: {
    company: string;
    name?: string;
    street: string;
    postalCode: string;
    city: string;
    region: string;
    country: string;
    phone?: string;
  };
  items: MakitoOrderItem[];
};

export function placeOrder(order: MakitoOrderInput, files: { fileName: string; data: Blob }[] = [], options: { env?: MakitoEnv; sandboxBehavior?: string } = {}) {
  const form = new FormData();
  form.append("order", new Blob([JSON.stringify(order)], { type: "application/json" }));
  for (const f of files) form.append("files", f.data, f.fileName);

  return makitoFetch<{
    customerOrder: string;
    items: { product: string; variant: string; quantity: number; status: string; availableDate?: string }[];
    documents: { documentNumber: string; link: string }[];
  }>(`/orders`, {
    method: "POST",
    body: form,
    env: options.env,
    headers: options.sandboxBehavior ? { "sandbox-behavior": options.sandboxBehavior } : undefined,
  });
}

export type MakitoOrderStatus =
  | "RECEIVED"
  | "PENDING_DESIGN"
  | "PENDING_DESIGN_CONFIRMATION"
  | "IN_PREPARATION"
  | "PREPARED"
  | "SENT";

export function getSalesOrders(
  params: { customerOrder?: string; companyCode?: string; status?: MakitoOrderStatus; fromDate?: string; toDate?: string; expand?: boolean; env?: MakitoEnv } = {}
) {
  const q = new URLSearchParams();
  if (params.customerOrder) q.set("customerOrder", params.customerOrder);
  if (params.companyCode) q.set("companyCode", params.companyCode);
  if (params.status) q.set("status", params.status);
  if (params.fromDate) q.set("fromDate", params.fromDate);
  if (params.toDate) q.set("toDate", params.toDate);
  if (params.expand != null) q.set("expand", String(params.expand));
  return makitoFetch<unknown[]>(`/orders/sales-order?${q}`, { env: params.env });
}

export function getSalesOrderById(id: string, env?: MakitoEnv) {
  return makitoFetch<unknown>(`/orders/sales-order/${id}`, { env });
}

export function getDeliveries(params: { customerOrder?: string; fromDate?: string; toDate?: string; env?: MakitoEnv } = {}) {
  const q = new URLSearchParams();
  if (params.customerOrder) q.set("customerOrder", params.customerOrder);
  if (params.fromDate) q.set("fromDate", params.fromDate);
  if (params.toDate) q.set("toDate", params.toDate);
  return makitoFetch<unknown>(`/orders/deliveries?${q}`, { env: params.env });
}

// ---- Metadatos ----

export function getRegions(env?: MakitoEnv) {
  return makitoFetch<unknown[]>(`/orders/regions`, { env });
}

export function getCountries(env?: MakitoEnv) {
  return makitoFetch<unknown[]>(`/orders/countries`, { env });
}

export function getColors(env?: MakitoEnv) {
  return makitoFetch<unknown[]>(`/orders/colors`, { env });
}
