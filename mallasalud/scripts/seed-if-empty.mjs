// scripts/seed-if-empty.mjs
// Inicializa automáticamente los datos base (RBAC, profesionales, boxes, pacientes y agendas)
// únicamente cuando la base de datos aún no tiene registros, evitando sobrescribir cambios previos.

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const [usuariosCount, pacientesCount] = await Promise.all([
      prisma.usuarioSistema.count(),
      prisma.paciente.count(),
    ]);

    if (usuariosCount === 0 && pacientesCount === 0) {
      console.log("[Auto-Seed] Base de datos vacía detectada. Ejecutando npm run db:seed...");
      execSync("npm run db:seed", { stdio: "inherit" });
      console.log("[Auto-Seed] Datos iniciales cargados correctamente.");
    } else if (usuariosCount === 0) {
      console.log("[Auto-Seed] Sin usuarios RBAC detectados. Ejecutando npm run db:seed...");
      execSync("npm run db:seed", { stdio: "inherit" });
    } else {
      console.log(
        `[Auto-Seed] Base de datos ya inicializada (${usuariosCount} usuarios RBAC, ${pacientesCount} pacientes). Omitiendo seed.`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Auto-Seed] Error verificando/poblando la base de datos:", err);
  process.exit(1);
});
