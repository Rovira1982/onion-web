// Server-only client for the Valento catalog feed
// (https://www.valento.es/rest/). Authenticates via a URL-embedded token
// (&key=) instead of HTTP Basic — simpler than Gorfactory/TopTex, no login
// step or token expiry to manage.
//
// Requires VALENTO_KEY in .env.local (from your Valento client area ->
// Integración Catálogo). Never import this file from a "use client"
// component — it reads a server-only env var.
import "server-only";

const BASE_URL = process.env.VALENTO_BASE_URL ?? "https://www.valento.es/rest";

export type ValentoVariant = {
  cref: string;
  color_ref: string;
  color: string;
  size_ref: string;
  size: string;
  net_price: number;
  suggested_retail_price: number;
  currency: string;
  stock: number;
  arrival_date: string | null;
  image: string | null;
  image_web?: string | null;
  box_weight?: number;
  units_per_box?: number;
};

export type ValentoProduct = {
  article_ref: string;
  name: string;
  description: string;
  brand: string;
  categorie_ref: string;
  category_path: string[];
  item_group_id: string;
  units_per_package: number;
  country_of_manufacture?: string;
  taric_code?: string;
  characteristics: Record<string, string>;
  images: string[];
  images_web?: string[];
  variants: ValentoVariant[];
};

export type ValentoCatalogFeed = {
  catalog_id: string;
  generated_at: string;
  language: string;
  page: number;
  page_size: number;
  total: number;
  price_multiplier: number;
  products: ValentoProduct[];
};

function key(): string {
  const k = process.env.VALENTO_KEY;
  if (!k) throw new Error("VALENTO_KEY no configurado en .env.local");
  return k;
}

// multiplicador solo afecta a suggested_retail_price (sugerencia) — nuestro
// propio precio de venta se calcula aparte a partir de net_price, igual que
// con Gorfactory/TopTex.
export async function getCatalogFeed(params: {
  idioma?: string;
  categoria?: string;
  page?: number;
  pageSize?: number;
  soloStock?: boolean;
  modificadosDesde?: string;
} = {}): Promise<ValentoCatalogFeed> {
  const q = new URLSearchParams({ key: key() });
  q.set("idioma", params.idioma ?? "es");
  if (params.categoria) q.set("categoria", params.categoria);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("page_size", String(params.pageSize));
  if (params.soloStock) q.set("solo_stock", "1");
  if (params.modificadosDesde) q.set("modificados_desde", params.modificadosDesde);

  const res = await fetch(`${BASE_URL}/catalog_feed.php?${q}`);
  if (res.status === 429) {
    throw new Error(`Valento: límite de peticiones alcanzado (Retry-After: ${res.headers.get("Retry-After")})`);
  }
  if (!res.ok) {
    throw new Error(`Valento catalog_feed falló: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
