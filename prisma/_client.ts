// Cliente de Prisma compartido por los scripts de prisma/ (importadores,
// auditoría, arreglos puntuales). Antes cada script montaba el suyo: 18
// copias del mismo adaptador. Carga .env.local aquí para que DATABASE_URL
// esté ya disponible cuando se construye el cliente.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
