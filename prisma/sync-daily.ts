// Recurring sync job — run on a schedule (e.g. Railway Cron Schedule) to
// keep stock and prices up to date. Runs each supplier import as its own
// subprocess (not an in-process import) so a crash in one script can't take
// down the others, and each gets its own clean Prisma connection instead of
// three PrismaClients competing for the same pool concurrently (see the
// connection-pool exhaustion incident from the manual Valento/Cifra run).
//
// Gorfactory (Roly/Stamina) is deliberately excluded until their real API
// rate limits are confirmed — running it unattended on a schedule risks
// tripping a limit we don't know yet.
import { execFileSync } from "node:child_process";

const SCRIPTS = ["import-cifra.ts", "import-valento.ts", "import-toptex.ts"];

let failures = 0;

// Un fallo pasajero del proveedor (p. ej. TopTex con 504 durante minutos, la
// noche del 2026-10-03) no debe marcar toda la ejecución como caída: cada
// script se reintenta una vez tras 5 minutos antes de darlo por fallido.
const RETRY_WAIT_MS = 5 * 60_000;
const sleepSync = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (const script of SCRIPTS) {
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    console.log(`\n=== ${script} (intento ${attempt}/2) — ${new Date().toISOString()} ===`);
    try {
      execFileSync("npx", ["tsx", `prisma/${script}`], { stdio: "inherit", shell: true });
      ok = true;
    } catch (err) {
      console.error(`✗ ${script} falló en el intento ${attempt}.`, err instanceof Error ? err.message : err);
      if (attempt < 2) {
        console.log(`  Reintento en ${RETRY_WAIT_MS / 60_000} min...`);
        sleepSync(RETRY_WAIT_MS);
      }
    }
  }
  if (!ok) {
    failures++;
    console.error(`✗ ${script} falló dos veces, continuando con el siguiente proveedor.`);
  }
}

// Los importadores reescriben el nombre de cada producto con el del proveedor
// (que repite nombres de colección): se vuelve a diferenciarlos al terminar.
console.log(`\n=== disambiguate-names.ts — ${new Date().toISOString()} ===`);
try {
  execFileSync("npx", ["tsx", "prisma/disambiguate-names.ts", "--apply"], { stdio: "inherit", shell: true });
} catch (err) {
  failures++;
  console.error("✗ disambiguate-names.ts falló.", err instanceof Error ? err.message : err);
}

console.log(`\nSync completo — ${new Date().toISOString()} (${failures} proveedor(es) con fallo)`);
process.exit(failures > 0 ? 1 : 0);
