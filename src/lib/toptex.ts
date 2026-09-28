// Server-only client for the TopTex API v3 (https://api.toptex.io).
//
// Requires TOPTEX_USERNAME / TOPTEX_PASSWORD (developer account,
// format codigoEmpresa_codigoCliente) and TOPTEX_API_KEY (subscribed
// "TopTex API - Prod" key, from portal.toptex.io -> My Dashboard) in
// .env.local. Never import this file from a "use client" component — it
// reads server-only env vars and holds the auth token in memory for the
// life of the server process.
import "server-only";

const BASE_URL = process.env.TOPTEX_BASE_URL ?? "https://api.toptex.io";

type TokenCache = { token: string; expiresAt: number } | null;
let tokenCache: TokenCache = null;

async function login(): Promise<string> {
  const username = process.env.TOPTEX_USERNAME;
  const password = process.env.TOPTEX_PASSWORD;
  const apiKey = process.env.TOPTEX_API_KEY;

  if (!username || !password || !apiKey) {
    throw new Error("TOPTEX_USERNAME / TOPTEX_PASSWORD / TOPTEX_API_KEY no configurados en .env.local");
  }

  const res = await fetch(`${BASE_URL}/v3/authenticate`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`TopTex login falló: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { token: string; expiry_time: string };
  tokenCache = { token: data.token, expiresAt: new Date(data.expiry_time).getTime() };
  return data.token;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  return login();
}

async function toptexFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.TOPTEX_API_KEY;
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "x-api-key": apiKey ?? "",
      "x-toptex-authorization": token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (res.status === 401) {
    // Token expired/invalid mid-flight: retry once with a fresh login.
    tokenCache = null;
    const freshToken = await login();
    const retry = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        "x-api-key": apiKey ?? "",
        "x-toptex-authorization": freshToken,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!retry.ok) {
      throw new Error(`TopTex ${path} falló: ${retry.status} ${await retry.text()}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    throw new Error(`TopTex ${path} falló: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// --- Catalog ----------------------------------------------------------

export function getAttributes() {
  return toptexFetch(`/v3/attributes`);
}

// usage_right: "b2b_uniquement" (catálogo mayorista) o "b2b_b2c".
export function getProductBySku(sku: string, usageRight = "b2b_uniquement") {
  const q = new URLSearchParams({ sku, usage_right: usageRight });
  return toptexFetch(`/v3/products?${q}`);
}

export function getProductsByCatalogReference(catalogReference: string, usageRight = "b2b_uniquement") {
  const q = new URLSearchParams({ catalog_reference: catalogReference, usage_right: usageRight });
  return toptexFetch(`/v3/products?${q}`);
}

export function getAllProducts(params: {
  usageRight?: string;
  brand?: string;
  family?: string;
  subfamily?: string;
  modifiedSince?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams({ usage_right: params.usageRight ?? "b2b_uniquement" });
  if (params.brand) q.set("brand", params.brand);
  if (params.family) q.set("family", params.family);
  if (params.subfamily) q.set("subfamily", params.subfamily);
  if (params.modifiedSince) q.set("modified_since", params.modifiedSince);
  if (params.pageNumber) q.set("page_number", String(params.pageNumber));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  return toptexFetch(`/v3/products/all?${q}`);
}

export function getDeletedProducts(params: { deletedSince: string; pageNumber?: number; pageSize?: number }) {
  const q = new URLSearchParams({ deleted_since: params.deletedSince });
  if (params.pageNumber) q.set("page_number", String(params.pageNumber));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  return toptexFetch(`/v3/products/deleted?${q}`);
}

// --- Inventory & pricing -----------------------------------------------

export function getInventoryBySku(sku: string) {
  return toptexFetch(`/v3/products/${sku}/inventory`);
}

export function getInventory(params: {
  catalogReference?: string;
  color?: string;
  brand?: string;
  family?: string;
  subfamily?: string;
  modifiedSince?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params.catalogReference) q.set("catalog_reference", params.catalogReference);
  if (params.color) q.set("color", params.color);
  if (params.brand) q.set("brand", params.brand);
  if (params.family) q.set("family", params.family);
  if (params.subfamily) q.set("subfamily", params.subfamily);
  if (params.modifiedSince) q.set("modified_since", params.modifiedSince);
  if (params.pageNumber) q.set("page_number", String(params.pageNumber));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  return toptexFetch(`/v3/products/inventory?${q}`);
}

export type ToptexPriceTier = { quantity: string; price: number; modificationDate: string };
export type ToptexPrice = {
  sku: string;
  catalogReference: string;
  designation: string;
  colorCode: string;
  sizeCode: string;
  color: string;
  size: string;
  packaging: number;
  publicPrice: number;
  prices: ToptexPriceTier[];
};

export function getPriceBySku(sku: string) {
  return toptexFetch<ToptexPrice>(`/v3/products/${sku}/price`);
}

export function getPrices(params: {
  catalogReference?: string;
  color?: string;
  brand?: string;
  family?: string;
  subfamily?: string;
  modifiedSince?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams();
  if (params.catalogReference) q.set("catalog_reference", params.catalogReference);
  if (params.color) q.set("color", params.color);
  if (params.brand) q.set("brand", params.brand);
  if (params.family) q.set("family", params.family);
  if (params.subfamily) q.set("subfamily", params.subfamily);
  if (params.modifiedSince) q.set("modified_since", params.modifiedSince);
  if (params.pageNumber) q.set("page_number", String(params.pageNumber));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  return toptexFetch<{ items: ToptexPrice[] }>(`/v3/products/price?${q}`);
}

// --- Orders --------------------------------------------------------------

export type ToptexOrderLine = { sku: string; quantity: number; lineNumber?: string; comment?: string };
export type ToptexOrderInput = {
  orderReference: string;
  myOrderId?: string;
  comment?: string;
  orderManagement?: 0 | 1;
  waitForFreeShipping?: 0 | 1;
  expressShipping?: string;
  neutralDeliveryNote?: 0 | 1;
  expectedDeliveryDate?: string;
  deliveryAddress: {
    addressTitle: string;
    street1: string;
    street2?: string;
    postCode: string;
    city: string;
    country: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  orderLines: ToptexOrderLine[];
  testMode?: boolean;
};

export function getOrders() {
  return toptexFetch(`/v3/orders`);
}

export function getOrder(orderId: string) {
  return toptexFetch(`/v3/orders/${orderId}`);
}

// Places a real purchase order with TopTex — never call without human
// confirmation (same rule as Gorfactory's placeOrder). Pass testMode: true
// while integrating.
export function createOrder(input: ToptexOrderInput) {
  return toptexFetch(`/v3/orders`, { method: "POST", body: JSON.stringify(input) });
}

export function updatePackingList(orderId: string, pdfBase64: string) {
  return toptexFetch(`/v3/orders/${orderId}/pdfpacking`, {
    method: "PUT",
    body: JSON.stringify({ pdf: pdfBase64 }),
  });
}

// --- Invoices & deliveries -------------------------------------------------

export function getInvoices() {
  return toptexFetch(`/v3/invoices`);
}

export function getInvoice(invoiceId: string) {
  return toptexFetch(`/v3/invoices/${invoiceId}`);
}

export function getInvoicePdf(invoiceId: string) {
  return toptexFetch(`/v3/invoices/${invoiceId}/pdf`);
}

export function getDeliveries() {
  return toptexFetch(`/v3/deliveries`);
}

export function getDelivery(deliveryId: string) {
  return toptexFetch(`/v3/deliveries/${deliveryId}`);
}

export function getDeliveryPdf(deliveryId: string) {
  return toptexFetch(`/v3/deliveries/${deliveryId}/pdf`);
}
