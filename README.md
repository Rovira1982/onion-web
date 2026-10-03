# Onion and Back — web

Tienda de regalos de empresa y merchandising personalizado. Next.js 16 (App Router), React 19, Tailwind v4, Prisma 7 sobre Postgres. Despliegue en Railway.

## Servicios en Railway

- **web** — la tienda y el panel `/admin`. Se despliega solo al hacer push a `main`.
- **sync-daily** — cron diario (`npm run sync:daily`): Cifra, Valento y TopTex, con un reintento por proveedor si falla.
- **Postgres** — base de datos.

## Comandos

```bash
npm run dev            # servidor local
npm test               # tests (vitest)
npm run sync:daily     # sincroniza los proveedores automáticos
npm run audit:catalogo # auditoría de calidad de datos (solo informa; --fix limpia lo seguro)
npm run batch:tandas   # consolida pedidos pagados en borradores de pedido a proveedor
```

## Proveedores

Importadores en `prisma/import-*.ts` (Roly/Stamina, Makito, Enyes, Anbor se lanzan a mano). Tras importar un proveedor nuevo, correr `npm run audit:catalogo` y revisar el informe antes de dar el catálogo por bueno. Los textos de proveedor se limpian al importar (`prisma/text-clean.ts`).

Visible en la tienda = con stock, con precio mayor que 0 y con al menos una foto (`VISIBLE` en `src/lib/products.ts`).

## Cuenta atrás de prelanzamiento

Mientras `LAUNCH_AT` (ISO 8601) esté en el futuro, todo salvo `/admin` muestra `/proximamente`. El equipo entra con `?preview=<LAUNCH_BYPASS_TOKEN>`. Sin `LAUNCH_AT` el sitio está abierto. Ver `src/lib/launch.ts` y `src/proxy.ts`.

## Variables de entorno

Ver `.env.local` (no se sube a git): base de datos, credenciales de proveedores, R2 (logos), Meta Pixel/CAPI, sesión de admin y `NEXT_PUBLIC_SITE_URL`.
