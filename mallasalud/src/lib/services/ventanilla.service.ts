import prisma from "@/lib/prisma";
import { Especialidad, EstadoBloque, EstadoCita, CanalOrigen, Prisma } from "@prisma/client";
import { normalizarFecha } from "./agendas.service";
import { generarCodigoReserva } from "@/lib/utils/codigo-reserva";
import { formatearRut } from "@/lib/utils/rut";

export class VentanillaError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "VentanillaError";
    this.statusCode = statusCode;
  }
}

export interface ListarCuposFiltros {
  especialidad?: Especialidad;
  fecha?: string | Date;
  esAdultoMayor?: boolean;
}

export interface AgendarVentanillaDTO {
  paciente_id: string;
  bloque_id: string;
}

/**
 * HU-006: Lista cupos disponibles en tiempo real para el mesón SOME.
 * Si el paciente no es adulto mayor, se ocultan los cupos protegidos por cuota.
 */
export async function listarCuposDisponibles(filtros: ListarCuposFiltros = {}) {
  const where: Prisma.BloqueHorarioWhereInput = {
    estado_bloque: EstadoBloque.DISPONIBLE,
    agenda: {
      activa: true,
      ...(filtros.especialidad ? { especialidad: filtros.especialidad } : {}),
    },
  };

  if (filtros.fecha) {
    const fNorm = normalizarFecha(filtros.fecha);
    const fFin = new Date(fNorm);
    fFin.setDate(fFin.getDate() + 1);

    where.hora_inicio = {
      gte: fNorm,
      lt: fFin,
    };
  } else {
    // Si no se especifica fecha, excluir citas de días pasados
    const hoyNorm = normalizarFecha(new Date());
    where.hora_inicio = {
      gte: hoyNorm,
    };
  }

  // Si se especifica que NO es adulto mayor, ocultar los cupos de cuota protegida
  if (filtros.esAdultoMayor === false) {
    where.es_cuota_adulto_mayor = false;
  }

  const bloques = await prisma.bloqueHorario.findMany({
    where,
    orderBy: { hora_inicio: "asc" },
    include: {
      agenda: {
        include: {
          profesional: true,
          box: true,
        },
      },
      cita: true,
    },
  });

  const cuposMapeados = bloques.map((bloque) => {
    const inicio = new Date(bloque.hora_inicio);
    const fin = new Date(bloque.hora_fin);

    const pad = (n: number) => String(n).padStart(2, "0");
    const horaInicioStr = `${pad(inicio.getHours())}:${pad(inicio.getMinutes())}`;
    const horaFinStr = `${pad(fin.getHours())}:${pad(fin.getMinutes())}`;
    const esCancelacionReciente = bloque.cita?.estado_cita === EstadoCita.CANCELADA_OPORTUNA;

    return {
      id: bloque.id,
      agenda_id: bloque.agenda_id,
      especialidad: bloque.agenda.especialidad,
      fecha: bloque.agenda.fecha.toISOString().split("T")[0],
      hora_inicio: horaInicioStr,
      hora_fin: horaFinStr,
      timestamp_inicio: bloque.hora_inicio,
      timestamp_fin: bloque.hora_fin,
      es_cuota_adulto_mayor: bloque.es_cuota_adulto_mayor,
      es_cancelacion_reciente: esCancelacionReciente,
      estado_bloque: bloque.estado_bloque,
      profesional: {
        id: bloque.agenda.profesional.id,
        nombre_completo: `${bloque.agenda.profesional.nombres} ${bloque.agenda.profesional.apellidos}`,
        rut: bloque.agenda.profesional.rut,
        especialidad: bloque.agenda.profesional.especialidad,
      },
      box: {
        id: bloque.agenda.box.id,
        numero: bloque.agenda.box.numero,
      },
    };
  });

  // Priorizar cupos liberados por cancelación reciente (DoD HU-006)
  return cuposMapeados.sort((a, b) => {
    if (a.es_cancelacion_reciente && !b.es_cancelacion_reciente) return -1;
    if (!a.es_cancelacion_reciente && b.es_cancelacion_reciente) return 1;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });
}

/**
 * HU-006: Agendamiento presencial en ventanilla SOME en una transacción atómica.
 * Valida disponibilidad, regla de no doble cita en el mismo día por especialidad,
 * reserva el bloque, crea la cita y emite el registro SMS / comprobante.
 */
export async function agendarCitaVentanilla(dto: AgendarVentanillaDTO) {
  if (!dto.paciente_id || !dto.bloque_id) {
    throw new VentanillaError("Faltan parámetros obligatorios: paciente_id y bloque_id.", 400);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Validar existencia y vigencia del paciente
    const paciente = await tx.paciente.findUnique({
      where: { id: dto.paciente_id },
    });

    if (!paciente) {
      throw new VentanillaError("Paciente no encontrado en el sistema.", 404);
    }

    if (!paciente.estado_inscripcion) {
      throw new VentanillaError("El paciente no se encuentra activo o inscrito en el CESFAM.", 403);
    }

    // 2. Validar estado del bloque y agenda
    const bloque = await tx.bloqueHorario.findUnique({
      where: { id: dto.bloque_id },
      include: {
        agenda: {
          include: {
            profesional: true,
            box: true,
          },
        },
      },
    });

    if (!bloque) {
      throw new VentanillaError("El bloque horario seleccionado no existe.", 404);
    }

    if (!bloque.agenda.activa) {
      throw new VentanillaError("La agenda médica asociada se encuentra pausada o inactiva.", 409);
    }

    if (bloque.estado_bloque !== EstadoBloque.DISPONIBLE) {
      throw new VentanillaError(
        `El bloque horario ya no se encuentra disponible (estado actual: ${bloque.estado_bloque}).`,
        409
      );
    }

    // 3. Regla de Negocio: El paciente NO puede tener otra cita agendada en la misma especialidad el mismo día
    const fechaInicioDia = normalizarFecha(bloque.agenda.fecha);
    const fechaFinDia = new Date(fechaInicioDia);
    fechaFinDia.setDate(fechaFinDia.getDate() + 1);

    const citaExistenteMismoDia = await tx.cita.findFirst({
      where: {
        paciente_id: paciente.id,
        especialidad: bloque.agenda.especialidad,
        estado_cita: EstadoCita.AGENDADA,
        bloque: {
          hora_inicio: {
            gte: fechaInicioDia,
            lt: fechaFinDia,
          },
        },
      },
    });

    if (citaExistenteMismoDia) {
      throw new VentanillaError(
        `El paciente ya tiene una cita agendada para ${bloque.agenda.especialidad} en esta misma fecha (${fechaInicioDia.toISOString().split("T")[0]}).`,
        409
      );
    }

    // 4. Generar código de reserva único
    let codigoReserva = generarCodigoReserva();
    let codigoExiste = await tx.cita.findUnique({ where: { codigo_reserva: codigoReserva } });
    while (codigoExiste) {
      codigoReserva = generarCodigoReserva();
      codigoExiste = await tx.cita.findUnique({ where: { codigo_reserva: codigoReserva } });
    }

    // 5. Actualizar estado del bloque a RESERVADO
    await tx.bloqueHorario.update({
      where: { id: bloque.id },
      data: {
        estado_bloque: EstadoBloque.RESERVADO,
        bloqueado_hasta: null,
        bloqueado_por_rut: paciente.rut,
      },
    });

    // 6. Crear la Cita médica
    const cita = await tx.cita.create({
      data: {
        codigo_reserva: codigoReserva,
        paciente_id: paciente.id,
        profesional_id: bloque.agenda.profesional_id,
        bloque_id: bloque.id,
        especialidad: bloque.agenda.especialidad,
        estado_cita: EstadoCita.AGENDADA,
        canal_origen: CanalOrigen.VENTANILLA_SOME,
      },
    });

    // 7. Generar registro de confirmación SMS
    const inicio = new Date(bloque.hora_inicio);
    const horaStr = `${String(inicio.getHours()).padStart(2, "0")}:${String(inicio.getMinutes()).padStart(2, "0")}`;
    const fechaStr = bloque.agenda.fecha.toISOString().split("T")[0];

    const cuerpoSms = `CESFAM MALLASALUD: Su cita de ${bloque.agenda.especialidad} fue agendada para el ${fechaStr} a las ${horaStr} en ${bloque.agenda.box.numero} con ${bloque.agenda.profesional.nombres} ${bloque.agenda.profesional.apellidos}. Codigo: ${codigoReserva}.`;

    const sms = await tx.registroSms.create({
      data: {
        cita_id: cita.id,
        telefono_destino: paciente.telefono,
        cuerpo_mensaje: cuerpoSms,
        longitud_caracteres: cuerpoSms.length,
        estado_envio: "ENVIADO",
      },
    });

    // 8. Retornar comprobante completo
    return {
      comprobante: {
        codigo_reserva: cita.codigo_reserva,
        cita_id: cita.id,
        canal_origen: cita.canal_origen,
        estado_cita: cita.estado_cita,
        created_at: cita.created_at,
        paciente: {
          id: paciente.id,
          rut: paciente.rut,
          rut_formateado: formatearRut(paciente.rut),
          nombre_completo: `${paciente.nombres} ${paciente.apellidos}`,
          telefono: paciente.telefono,
        },
        profesional: {
          id: bloque.agenda.profesional.id,
          nombre_completo: `${bloque.agenda.profesional.nombres} ${bloque.agenda.profesional.apellidos}`,
          rut: bloque.agenda.profesional.rut,
          especialidad: bloque.agenda.profesional.especialidad,
        },
        box: {
          id: bloque.agenda.box.id,
          numero: bloque.agenda.box.numero,
        },
        horario: {
          fecha: fechaStr,
          hora_inicio: horaStr,
          timestamp_inicio: bloque.hora_inicio,
          timestamp_fin: bloque.hora_fin,
        },
        notificacion_sms: {
          id: sms.id,
          telefono: sms.telefono_destino,
          mensaje: sms.cuerpo_mensaje,
          estado: sms.estado_envio,
        },
      },
    };
  });
}
