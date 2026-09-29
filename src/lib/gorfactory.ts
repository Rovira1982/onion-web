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

  // The API returns { "token": "<jwt>" } — confirmed live 2026-09-29 (was
  // previously assumed to be a bare/JSON-quoted JWT string, which sent the
  // whole envelope as the bearer token and made every call 401).
  const raw = (await res.text()).trim();
  let token: string;
  try {
    token = JSON.parse(raw).token;
  } catch {
    token = raw.startsWith('"') ? JSON.parse(raw) : raw;
  }
  if (!token) {
    throw new Error(`Gorfactory login: respuesta sin token: ${raw.slice(0, 200)}`);
  }
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
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES", brand: params.brand });
  return gorfactoryFetch<GorfactoryCategory[]>(`/api/v1/item/categories?${q}`);
}

export function getCategoriesTree(params: { lang?: string; brand: string; category?: string }) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES", brand: params.brand });
  if (params.category) q.set("category", params.category);
  return gorfactoryFetch(`/api/v1/item/categories/tree?${q}`);
}

// One row per SKU (product+size+color) — itemcode is the unique SKU, same
// role as productcode in the pricelist and sku in getuserstock.
export type GorfactoryCatalogItem = {
  itemcode: string;
  itemname: string;
  modelcode: string;
  modelname: string;
  description: string;
  composition: string;
  family: string;
  sizename: string;
  colorname: string;
  productimage: string;
  modelimage: string;
  brand: string;
  [key: string]: unknown;
};

export function getCatalog(params: { lang?: string; brand?: string; category?: string }) {
  const q = new URLSearchParams();
  q.set("lang", params.lang ?? "es-ES");
  if (params.brand) q.set("brand", params.brand);
  if (params.category) q.set("category", params.category);
  return gorfactoryFetch<{ item: GorfactoryCatalogItem[] }>(`/api/v1/item/getcatalog?${q}`);
}

export function getItem(params: { itemcode: string; lang?: string }) {
  const q = new URLSearchParams({ itemcode: params.itemcode, lang: params.lang ?? "es-ES" });
  return gorfactoryFetch(`/api/v1/item/get?${q}`);
}

export type GorfactoryStockItem = {
  sku: string;
  description: string;
  onhand: string; // numeric string, e.g. "140"
  incoming: string | null;
  state: string;
  canteco: string;
  brand: string;
};

export function getUserStock(params: { whscode?: string; brand?: string } = {}) {
  // multipart/form-data, like pricelist — the API rejects a JSON body here.
  // whscode is required by the API (warehouse code, e.g. "01" — the main
  // one; confirmed live, other codes 400 with "Warehouse wrong code").
  const form = new FormData();
  if (params.whscode) form.set("whscode", params.whscode);
  if (params.brand) form.set("brand", params.brand);
  return gorfactoryFetch<{ stock: GorfactoryStockItem[] | null }>(`/api/v1/stock/getuserstock`, {
    method: "POST",
    body: form,
  });
}

export function getModelsIdList(params: { brand: string }) {
  const q = new URLSearchParams({ brand: params.brand });
  return gorfactoryFetch<string[]>(`/api/v1/item/getmodelsidlist?${q}`);
}

export function getCategoryInfo(params: { lang?: string; category: string }) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES", category: params.category });
  return gorfactoryFetch(`/api/v1/item/categories/get?${q}`);
}

export function getModels(params: { lang?: string; brand?: string } = {}) {
  const q = new URLSearchParams();
  q.set("lang", params.lang ?? "es-ES");
  if (params.brand) q.set("brand", params.brand);
  return gorfactoryFetch(`/api/v1/model/get?${q}`);
}

// --- Pricing & printing (Gorfactory's own marking-cost system) ------------
// These mirror our presupuestador (src/lib/pricing.ts) but for Gorfactory's
// own catalog — kept as separate, additive endpoints rather than merged into
// our pricing engine, since the two are for different supplier catalogs and
// shouldn't silently cross-pollinate assumptions about margins/floors.

export type GorfactoryPrintPriceTier = {
  limitinf: number;
  limitsup: number;
  pricearea: number;
  baseprice: number;
  additionalcolorprice: number;
};

export type GorfactoryPrintTechnique = {
  technique: string;
  techniquedescription: string;
  rangemode: string;
  rangeprice: boolean;
  piercingprice: boolean;
  colorprice: boolean;
  areaprice: boolean;
  sideprice: boolean;
  segmentsprice: boolean;
  stitches: number;
  maxarea: number;
  namebyname: number;
  requirebase: boolean;
  cliche: number;
  clicherepeat: number;
  minimunwork: number;
  ironedprice: number;
  handlingprice: number;
  minworkbysize: number;
  minworkembroidery: number;
  prices: GorfactoryPrintPriceTier[];
};

// Full technique+price tier table — global, not per-model (no modelList
// param in the spec). Same shape as printtechniques below; kept as two
// functions to match the API's own two distinct endpoints.
export function getPrintPrices(params: { lang?: string } = {}) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES" });
  return gorfactoryFetch<{ printprices: GorfactoryPrintTechnique[] }>(`/api/v1/item/printprices?${q}`);
}

export function getPrintTechniques(params: { lang?: string } = {}) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES" });
  return gorfactoryFetch<{ printprices: GorfactoryPrintTechnique[] }>(`/api/v1/item/printtechniques?${q}`);
}

export type GorfactoryPrintPosition = {
  positioncode: string | null;
  positiondescription: string | null;
  darkbackground: boolean;
  image: string | null;
  techs: unknown[] | null;
};

export type GorfactoryPrintOptionsItem = {
  itemcode: string;
  modelcode: string;
  modelid: string;
  sizecode: string;
  sizename: string;
  colorcode: string;
  colorname: string;
  shop: string;
  positions: GorfactoryPrintPosition[];
};

// v1.3 is the latest revision of this endpoint per the live spec.
export function getPrintOptions(params: {
  lang?: string;
  modelList?: string;
  brand?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES" });
  if (params.modelList) q.set("modelList", params.modelList);
  if (params.brand) q.set("brand", params.brand);
  if (params.pageNumber) q.set("pageNumber", String(params.pageNumber));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return gorfactoryFetch<{ item: GorfactoryPrintOptionsItem[] }>(`/api/v1.3/item/printoptions?${q}`);
}

export function getPrintHandlings(params: { lang?: string; modelList?: string } = {}) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES" });
  if (params.modelList) q.set("modelList", params.modelList);
  return gorfactoryFetch<{
    handlingtypes: { id: string; name: string; price: number; minprice: number }[];
    models: { modelcode: string; modelid: string; availablehandlings: string[] }[];
  }>(`/api/v1/item/printhandlings?${q}`);
}

// productcode is the same SKU as itemcode in the catalog. price_unit is our
// wholesale net cost; price_unit_pvp is Gorfactory's own suggested retail
// (confirmed live: roughly cost × 2, in line with our own margin here).
export type GorfactoryPricelistItem = {
  productcode: string;
  model: string;
  price_unit: number;
  price_unit_conf: number;
  price_unit_pvp: number;
  [key: string]: unknown;
};

// Wholesale pricelist — POST multipart/form-data, unlike the GET-based
// catalog/item endpoints above (matches the live spec exactly).
export function getPricelist(params: {
  brand?: string;
  category?: string;
  model?: string;
  color?: string;
  size?: string;
  includeoutlet?: 0 | 1;
}) {
  const form = new FormData();
  if (params.brand) form.set("brand", params.brand);
  if (params.category) form.set("category", params.category);
  if (params.model) form.set("model", params.model);
  if (params.color) form.set("color", params.color);
  if (params.size) form.set("size", params.size);
  form.set("includeoutlet", String(params.includeoutlet ?? 0));
  return gorfactoryFetch<{ pricelist: GorfactoryPricelistItem[] }>(`/api/v1/item/pricelist`, {
    method: "POST",
    body: form,
  });
}

// "Jobsheet" — Gorfactory's own printable production sheet per model.
// Worth revisiting once we design our own admin work-sheet (Anexo A) —
// may be reusable as-is for Gorfactory-sourced order lines instead of
// building an equivalent from scratch.
export function getJobsheet(params: { lang?: string; brand?: string; models: string }) {
  const form = new FormData();
  form.set("lang", params.lang ?? "es-ES");
  if (params.brand) form.set("brand", params.brand);
  form.set("models", params.models);
  return gorfactoryFetch(`/api/v1/item/jobsheet`, { method: "POST", body: form });
}

// --- Docs (orders/invoices/delivery notes/tracking placed with Gorfactory) -
// doctype: "order" | "invoice" | "payment" | "deliverynote" | "tracking" |
// "expiration" | "report347" — see GOR_WSClients_ES.pdf §5 for the exact
// shape returned per doctype (they differ significantly).
export function getDocs(params: { doctype: string; datefrom?: string; dateto?: string }) {
  const q = new URLSearchParams();
  if (params.datefrom) q.set("datefrom", params.datefrom);
  if (params.dateto) q.set("dateto", params.dateto);
  return gorfactoryFetch(`/api/v1.1/doc/${params.doctype}?${q}`, {
    headers: { typeresponse: "json" },
  });
}

export function getDoc(params: { doctype: string; docnum: string }) {
  return gorfactoryFetch(`/api/v1.1/doc/${params.doctype}/${params.docnum}`, {
    headers: { typeresponse: "json" },
  });
}

// Returns a PDF binary, not JSON — do not route through gorfactoryFetch's
// res.json() parsing. Caller should fetch this URL directly (with a fresh
// bearer token) when it needs the actual file bytes.
export function docPdfUrl(params: { doctype: string; docnum: string; lang?: string }) {
  const q = new URLSearchParams({ lang: params.lang ?? "es-ES" });
  return `${BASE_URL}/api/v1/doc/${params.doctype}/${params.docnum}/pdf?${q}`;
}

// Status of orders we've already placed via placeOrder() — lets us poll
// Gorfactory's own tracking instead of only trusting our local Order.status.
export function getOrderInfo() {
  return gorfactoryFetch(`/api/v1.1/order/info`);
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
