import prisma from "@/lib/prisma";
import { EstadoCita } from "@prisma/client";
import { formatearRut } from "@/lib/utils/rut";
import { calcularEdad } from "@/lib/utils/edad";

export const MINUTOS_TOLERANCIA_NSP = 15;

export class BoxError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "BoxError";
    this.statusCode = statusCode;
  }
}

/**
 * HU-007: Obtiene la nómina operativa del día para el profesional autenticado en Box Clínico.
 */
export async function obtenerCitasHoyBox(profesionalId: string) {
  const profesional = await prisma.profesional.findUnique({
    where: { id: profesionalId },
  });

  if (!profesional) {
    throw new BoxError("Profesional no encontrado en el sistema.", 404);
  }

  const ahora = new Date();
  const startOfDay = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);

  const agendasHoy = await prisma.agendaMedica.findMany({
    where: {
      profesional_id: profesionalId,
      fecha: { gte: startOfDay, lte: endOfDay },
    },
    include: { box: true },
    orderBy: { created_at: "asc" },
  });

  const citasRaw = await prisma.cita.findMany({
    where: {
      profesional_id: profesionalId,
      estado_cita: {
        in: [EstadoCita.AGENDADA, EstadoCita.ATENDIDA, EstadoCita.NO_ASISTE],
      },
      bloque: {
        hora_inicio: { gte: startOfDay, lte: endOfDay },
      },
    },
    include: {
      paciente: true,
      bloque: {
        include: {
          agenda: {
            include: { box: true },
          },
        },
      },
    },
    orderBy: {
      bloque: { hora_inicio: "asc" },
    },
  });

  const pad = (n: number) => String(n).padStart(2, "0");

  const citas = citasRaw.map((c) => {
    const hIni = new Date(c.bloque.hora_inicio);
    const hFin = new Date(c.bloque.hora_fin);
    const diffMs = ahora.getTime() - hIni.getTime();
    const minutosDesdeInicio = Math.floor(diffMs / 60000);

    const esAgendada = c.estado_cita === EstadoCita.AGENDADA;
    const yaInicio = diffMs >= 0;
    const cumplioToleranciaNsp = diffMs >= MINUTOS_TOLERANCIA_NSP * 60 * 1000;

    return {
      id: c.id,
      codigo_reserva: c.codigo_reserva,
      estado_cita: c.estado_cita,
      canal_origen: c.canal_origen,
      especialidad: c.especialidad,
      hora_inicio: `${pad(hIni.getHours())}:${pad(hIni.getMinutes())}`,
      hora_fin: `${pad(hFin.getHours())}:${pad(hFin.getMinutes())}`,
      timestamp_inicio: hIni.toISOString(),
      timestamp_atencion: c.hora_atencion ? new Date(c.hora_atencion).toISOString() : null,
      box_numero: c.bloque.agenda.box?.numero || agendasHoy[0]?.box?.numero || "Box Clínico",
      minutos_desde_inicio: minutosDesdeInicio,
      puede_marcar_atendida: esAgendada && yaInicio,
      puede_marcar_no_asiste: esAgendada && cumplioToleranciaNsp,
      minutos_restantes_nsp:
        esAgendada && !cumplioToleranciaNsp
          ? Math.max(1, MINUTOS_TOLERANCIA_NSP - minutosDesdeInicio)
          : 0,
      paciente: {
        id: c.paciente.id,
        rut: c.paciente.rut,
        rut_formateado: formatearRut(c.paciente.rut),
        nombre_completo: `${c.paciente.nombres} ${c.paciente.apellidos}`,
        edad: calcularEdad(c.paciente.fecha_nacimiento),
        telefono: c.paciente.telefono,
        contador_inasistencias: c.paciente.contador_inasistencias,
      },
    };
  });

  const contadores = {
    total: citas.length,
    pendientes: citas.filter((c) => c.estado_cita === EstadoCita.AGENDADA).length,
    atendidas: citas.filter((c) => c.estado_cita === EstadoCita.ATENDIDA).length,
    no_asiste: citas.filter((c) => c.estado_cita === EstadoCita.NO_ASISTE).length,
  };

  return {
    profesional: {
      id: profesional.id,
      rut: profesional.rut,
      rut_formateado: formatearRut(profesional.rut),
      nombre_completo: `${profesional.nombres} ${profesional.apellidos}`,
      especialidad: profesional.especialidad,
    },
    box_principal: agendasHoy[0]?.box?.numero || citas[0]?.box_numero || "Box Clínico",
    fecha: startOfDay.toISOString().split("T")[0],
    ahora_iso: ahora.toISOString(),
    contadores,
    citas,
  };
}

/**
 * HU-007: Registra asistencia (ATENDIDA) o inasistencia tras tolerancia (NO_ASISTE)
 * con verificación RBAC de pertenencia del profesional y actualización atómica de NSP.
 */
export async function registrarAsistenciaBox(
  citaId: string,
  profesionalId: string,
  estado: "ATENDIDA" | "NO_ASISTE"
) {
  if (!citaId || !profesionalId) {
    throw new BoxError("Identificador de cita o profesional inválido.", 400);
  }

  const cita = await prisma.cita.findUnique({
    where: { id: citaId },
    include: {
      bloque: true,
      paciente: true,
    },
  });

  if (!cita) {
    throw new BoxError("La cita médica no existe.", 404);
  }

  if (cita.profesional_id !== profesionalId) {
    throw new BoxError("No tiene permisos para modificar citas de otro profesional.", 403);
  }

  if (cita.estado_cita !== EstadoCita.AGENDADA) {
    throw new BoxError(
      `La cita ya fue procesada previamente con estado ${cita.estado_cita}.`,
      409
    );
  }

  const ahora = new Date();
  const hInicio = new Date(cita.bloque.hora_inicio);
  const diffMs = ahora.getTime() - hInicio.getTime();

  if (diffMs < 0) {
    throw new BoxError(
      "No es posible registrar asistencia o inasistencia sobre citas futuras aún no iniciadas.",
      422
    );
  }

  if (estado === "NO_ASISTE" && diffMs < MINUTOS_TOLERANCIA_NSP * 60 * 1000) {
    const minTranscurridos = Math.max(0, Math.floor(diffMs / 60000));
    const minFaltantes = MINUTOS_TOLERANCIA_NSP - minTranscurridos;
    throw new BoxError(
      `Debe esperar la tolerancia reglamentaria de ${MINUTOS_TOLERANCIA_NSP} minutos antes de marcar No Asistió (faltan ${minFaltantes} min).`,
      422
    );
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const citaActualizada = await tx.cita.update({
      where: { id: cita.id },
      data: {
        estado_cita: estado === "ATENDIDA" ? EstadoCita.ATENDIDA : EstadoCita.NO_ASISTE,
        hora_atencion: estado === "ATENDIDA" ? ahora : null,
      },
    });

    let contadorActualizado = cita.paciente.contador_inasistencias;
    if (estado === "NO_ASISTE") {
      const pacActualizado = await tx.paciente.update({
        where: { id: cita.paciente_id },
        data: {
          contador_inasistencias: { increment: 1 },
        },
      });
      contadorActualizado = pacActualizado.contador_inasistencias;
    }

    return {
      cita: citaActualizada,
      contador_inasistencias: contadorActualizado,
    };
  });

  return {
    mensaje:
      estado === "ATENDIDA"
        ? "Asistencia registrada como ATENDIDA."
        : `Inasistencia registrada (NO_ASISTE). Contador NSP del paciente actualizado a ${resultado.contador_inasistencias}.`,
    ...resultado,
  };
}
