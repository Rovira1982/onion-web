// CLI standalone de la tanda de pedido a proveedor — ver
// prisma/supplier-batch-runner.ts para la lógica (reutilizada desde el
// admin en la Fase 2). Programado con Railway Cron Schedule, 10:00/15:00.
//
// Run with: npx tsx prisma/run-supplier-batch.ts
import { runBatch, disconnect } from "./supplier-batch-runner";

const batchRunAt = new Date();
console.log(`\n=== Tanda de pedido a proveedor — ${batchRunAt.toISOString()} ===`);

runBatch(batchRunAt)
  .then(({ created, skippedNoLines }) => {
    console.log(`Tandas creadas: ${created}.`);
    if (skippedNoLines.length > 0) {
      console.log(`Proveedores sin líneas pendientes: ${skippedNoLines.join(", ")}.`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error generando tandas:", err);
    process.exit(1);
  })
  .finally(() => disconnect());
