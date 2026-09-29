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

for (const script of SCRIPTS) {
  console.log(`\n=== ${script} — ${new Date().toISOString()} ===`);
  try {
    execFileSync("npx", ["tsx", `prisma/${script}`], { stdio: "inherit", shell: true });
  } catch (err) {
    failures++;
    console.error(`✗ ${script} falló, continuando con el siguiente proveedor.`, err instanceof Error ? err.message : err);
  }
}

console.log(`\nSync completo — ${new Date().toISOString()} (${failures} proveedor(es) con fallo)`);
process.exit(failures > 0 ? 1 : 0);
