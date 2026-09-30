import type { Metadata } from "next";
import { Nunito_Sans, Rubik } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import MetaPixel from "@/components/MetaPixel";
import { CartProvider } from "@/lib/cart";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// Falls back to localhost in dev; set NEXT_PUBLIC_SITE_URL once the real
// domain is decided so absolute URLs (OG images, canonical, sitemap) resolve
// correctly in production.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Footer reads categories from the DB on every page. Force every route to
// render per-request instead of prerendering at build time — the build
// container has no route to the database (Railway's private networking is
// runtime-only), and static pages would show stale stock/prices anyway
// between syncs.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Onion and Back | Regalos de empresa y merchandising personalizado",
    template: "%s | Onion and Back",
  },
  description:
    "Regalos de empresa y artículos publicitarios personalizados con tu logo. Rapidez, calidad y trato cercano en cada pedido.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunitoSans.variable} ${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-ink">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
        <CookieBanner />
        <MetaPixel />
      </body>
    </html>
  );
}
