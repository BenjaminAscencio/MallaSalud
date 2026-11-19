import prisma from "./prisma";
import type { PrismaClient } from "@prisma/client";

/**
 * Garantiza la existencia del índice único parcial en PostgreSQL sobre citas(bloque_id)
 * únicamente para citas activas/efectivas (AGENDADA o ATENDIDA), permitiendo reciclar bloques
 * tras CANCELADA_OPORTUNA o NO_ASISTE sin perder el historial de auditoría.
 */
export async function ensurePartialUniqueCitaIndex(client: PrismaClient = prisma) {
  await client.$executeRawUnsafe(`
    DROP INDEX IF EXISTS "citas_bloque_id_key";
  `);
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_citas_bloque_activa_unique"
    ON "citas" ("bloque_id")
    WHERE "estado_cita" IN ('AGENDADA', 'ATENDIDA');
  `);
}
