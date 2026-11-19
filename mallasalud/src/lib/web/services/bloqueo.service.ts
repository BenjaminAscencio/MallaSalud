import prisma from "@/lib/prisma";
import { EstadoBloque, Prisma } from "@prisma/client";
import { normalizarRut, validarRut } from "@/lib/utils/rut";
import { esAdultoMayor } from "@/lib/utils/edad";
import { MINUTOS_LIBERACION_CUOTA_MAYOR } from "./agendas.service";

export const BLOQUEO_TEMPORAL_SEGUNDOS = 120;

export class BloqueoError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "BloqueoError";
    this.statusCode = statusCode;
  }
}

/**
 * Libera automáticamente todos los bloqueos temporales cuyo TTL de 120s haya expirado.
 */
export async function liberarBloquesTemporalesExpirados(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const res = await tx.bloqueHorario.updateMany({
    where: {
      estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
      bloqueado_hasta: {
        lt: new Date(),
      },
    },
    data: {
      estado_bloque: EstadoBloque.DISPONIBLE,
      bloqueado_hasta: null,
      bloqueado_por_rut: null,
    },
  });
  return res.count;
}

/**
 * Adquiere una retención temporal atómica de 120 segundos sobre un bloque horario para evitar
 * condiciones de carrera entre canales (Web, Ventanilla SOME e IVR).
 */
export async function adquirirBloqueoTemporal(bloqueId: string, rutInput: string) {
  if (!bloqueId || !rutInput) {
    throw new BloqueoError("Debe indicar bloque_id y rut del paciente.", 400);
  }
  if (!validarRut(rutInput)) {
    throw new BloqueoError("El RUT ingresado no es válido.", 400);
  }

  const rutNorm = normalizarRut(rutInput);
  const ahora = new Date();
  const expiraEn = new Date(ahora.getTime() + BLOQUEO_TEMPORAL_SEGUNDOS * 1000);

  return await prisma.$transaction(async (tx) => {
    await liberarBloquesTemporalesExpirados(tx);

    const paciente = await tx.paciente.findUnique({
      where: { rut: rutNorm },
    });
    if (!paciente || !paciente.estado_inscripcion) {
      throw new BloqueoError("El paciente no se encuentra inscrito o activo en el CESFAM.", 404);
    }

    const bloque = await tx.bloqueHorario.findUnique({
      where: { id: bloqueId },
      include: { agenda: true },
    });

    if (!bloque) {
      throw new BloqueoError("El bloque horario seleccionado no existe.", 404);
    }

    if (!bloque.agenda.activa) {
      throw new BloqueoError("La agenda asociada fue pausada o inactivada por SOME.", 409);
    }

    if (bloque.es_cuota_adulto_mayor) {
      const esMayor = esAdultoMayor(paciente.fecha_nacimiento, paciente.rut);
      const msRestantes = new Date(bloque.hora_inicio).getTime() - ahora.getTime();
      if (!esMayor && msRestantes > MINUTOS_LIBERACION_CUOTA_MAYOR * 60 * 1000) {
        throw new BloqueoError(
          `Este cupo corresponde a cuota protegida para Adulto Mayor (60+). Se liberará ${MINUTOS_LIBERACION_CUOTA_MAYOR} minutos antes si no es utilizado.`,
          403
        );
      }
    }

    // Liberar cualquier bloqueo temporal previo del mismo paciente en otro bloque
    await tx.bloqueHorario.updateMany({
      where: {
        estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
        bloqueado_por_rut: rutNorm,
        id: { not: bloqueId },
      },
      data: {
        estado_bloque: EstadoBloque.DISPONIBLE,
        bloqueado_hasta: null,
        bloqueado_por_rut: null,
      },
    });

    // Intento atómico condicional sobre DISPONIBLE
    const lockRes = await tx.bloqueHorario.updateMany({
      where: {
        id: bloqueId,
        estado_bloque: EstadoBloque.DISPONIBLE,
      },
      data: {
        estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
        bloqueado_hasta: expiraEn,
        bloqueado_por_rut: rutNorm,
      },
    });

    if (lockRes.count === 0) {
      // Permitir renovación si ya estaba retenido por el mismo RUT y sigue vigente
      const renewRes = await tx.bloqueHorario.updateMany({
        where: {
          id: bloqueId,
          estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
          bloqueado_por_rut: rutNorm,
        },
        data: {
          bloqueado_hasta: expiraEn,
        },
      });

      if (renewRes.count === 0) {
        throw new BloqueoError(
          "El cupo acaba de ser retenido o reservado por otro usuario. Seleccione otro horario disponible.",
          409
        );
      }
    }

    return {
      bloque_id: bloqueId,
      rut: rutNorm,
      estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
      ttl_segundos: BLOQUEO_TEMPORAL_SEGUNDOS,
      bloqueado_hasta: expiraEn.toISOString(),
    };
  });
}

/**
 * Libera explícitamente un bloqueo temporal retenido por un paciente.
 */
export async function liberarBloqueoTemporal(bloqueId: string, rutInput: string) {
  if (!bloqueId || !rutInput) return { liberado: false };
  const rutNorm = validarRut(rutInput) ? normalizarRut(rutInput) : rutInput.trim().toUpperCase();

  const res = await prisma.bloqueHorario.updateMany({
    where: {
      id: bloqueId,
      estado_bloque: EstadoBloque.BLOQUEO_TEMPORAL,
      bloqueado_por_rut: rutNorm,
    },
    data: {
      estado_bloque: EstadoBloque.DISPONIBLE,
      bloqueado_hasta: null,
      bloqueado_por_rut: null,
    },
  });

  return { liberado: res.count > 0 };
}
