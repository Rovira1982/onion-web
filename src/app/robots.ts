import type { MetadataRoute } from "next";
import { isLaunched } from "@/lib/launch";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  // Mientras dura la cuenta atrás de prelanzamiento, bloqueado por completo
  // — se quita solo en cuanto pasa LAUNCH_AT, sin desplegar nada.
  if (!isLaunched()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
