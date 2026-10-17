import prisma from "@/lib/prisma";
import { Especialidad, EstadoBloque, Prisma } from "@prisma/client";
import { formatearRut } from "@/lib/utils/rut";

export class AgendaConflictError extends Error {
  constructor(message = "Existe un conflicto de horario: el profesional o el box ya tienen una agenda asignada en ese rango horario.") {
    super(message);
    this.name = "AgendaConflictError";
  }
}

export class AgendaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgendaValidationError";
  }
}

export interface GenerarAgendaDTO {
  profesional_id: string;
  box_id: string;
  especialidad: Especialidad;
  fecha: string | Date; // YYYY-MM-DD o Date
  hora_inicio: string;  // "HH:MM" ej: "08:00"
  hora_fin: string;     // "HH:MM" ej: "17:00"
  duracion_bloque_min: number; // ej: 20
  porcentaje_cuota_mayor?: number; // ej: 30
}

/**
 * Convierte un string "HH:MM" y una fecha en un objeto Date con la hora exacta.
 */
function construirTimestamp(fechaBase: Date, horaHHMM: string): Date {
  const [horas, minutos] = horaHHMM.split(":").map(Number);
  const d = new Date(fechaBase);
  d.setHours(horas, minutos, 0, 0);
  return d;
}

/**
 * Normaliza la fecha a medianoche (00:00:00.000) local para consistencia en la BD.
 */
export function normalizarFecha(fechaInput: string | Date): Date {
  const d = typeof fechaInput === "string" ? new Date(fechaInput) : new Date(fechaInput);
  if (isNaN(d.getTime())) {
    throw new AgendaValidationError("Fecha proporcionada inválida.");
  }
  // Normalizar a medianoche
  const fechaNormalizada = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  return fechaNormalizada;
}

/**
 * Comprueba si dos rangos horarios en minutos se solapan: [iniA, finA) y [iniB, finB)
 */
function seSolapan(iniA: number, finA: number, iniB: number, finB: number): boolean {
  return iniA < finB && iniB < finA;
}

function horaAMinutos(horaHHMM: string): number {
  const [h, m] = horaHHMM.split(":").map(Number);
  return h * 60 + m;
}

export interface ListarAgendasFiltros {
  fecha?: string | Date;
  fecha_desde?: string | Date;
  fecha_hasta?: string | Date;
  especialidad?: Especialidad;
  box_id?: string;
  profesional_id?: string;
}

/**
 * HU-005: Listar todas las agendas con detalle de profesional, box, estadísticas y bloques detallados.
 * Además incluye listas de profesionales y boxes activos para formularios SOME.
 */
export async function listarAgendas(filtros?: ListarAgendasFiltros) {
  const where: Prisma.AgendaMedicaWhereInput = {};

  if (filtros?.fecha) {
    const fNorm = normalizarFecha(filtros.fecha);
    const fFin = new Date(fNorm);
    fFin.setDate(fFin.getDate() + 1);
    where.fecha = {
      gte: fNorm,
      lt: fFin,
    };
  } else if (filtros?.fecha_desde || filtros?.fecha_hasta) {
    const filtroFechaRange: Prisma.DateTimeFilter = {};
    if (filtros.fecha_desde) {
      filtroFechaRange.gte = normalizarFecha(filtros.fecha_desde);
    }
    if (filtros.fecha_hasta) {
      const fFin = normalizarFecha(filtros.fecha_hasta);
      fFin.setDate(fFin.getDate() + 1);
      filtroFechaRange.lt = fFin;
    }
    where.fecha = filtroFechaRange;
  }

  if (filtros?.especialidad) {
    where.especialidad = filtros.especialidad;
  }

  if (filtros?.box_id) {
    where.box_id = filtros.box_id;
  }

  if (filtros?.profesional_id) {
    where.profesional_id = filtros.profesional_id;
  }

  const [agendas, profesionales, boxes] = await Promise.all([
    prisma.agendaMedica.findMany({
      where,
      orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
      include: {
        profesional: true,
        box: true,
        bloques: {
          orderBy: { hora_inicio: "asc" },
          include: {
            cita: {
              include: {
                paciente: {
                  select: {
                    id: true,
                    rut: true,
                    nombres: true,
                    apellidos: true,
                    telefono: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.profesional.findMany({
      where: { activo: true },
      orderBy: { apellidos: "asc" },
    }),
    prisma.box.findMany({
      where: { activo: true },
      orderBy: { numero: "asc" },
    }),
  ]);

  const agendasResumen = agendas.map((agenda) => {
    const totalBloques = agenda.bloques.length;
    const disponibles = agenda.bloques.filter((b) => b.estado_bloque === EstadoBloque.DISPONIBLE).length;
    const reservados = agenda.bloques.filter((b) => b.estado_bloque === EstadoBloque.RESERVADO).length;
    const bloqueadosSome = agenda.bloques.filter((b) => b.estado_bloque === EstadoBloque.BLOQUEADO_SOME).length;
    const temporales = agenda.bloques.filter((b) => b.estado_bloque === EstadoBloque.BLOQUEO_TEMPORAL).length;
    const cuotaMayor = agenda.bloques.filter((b) => b.es_cuota_adulto_mayor).length;

    const bloquesDetalle = agenda.bloques.map((b) => {
      const ini = new Date(b.hora_inicio);
      const fin = new Date(b.hora_fin);
      const pad = (n: number) => String(n).padStart(2, "0");
      const hIniStr = `${pad(ini.getHours())}:${pad(ini.getMinutes())}`;
      const hFinStr = `${pad(fin.getHours())}:${pad(fin.getMinutes())}`;

      return {
        id: b.id,
        hora_inicio: hIniStr,
        hora_fin: hFinStr,
        timestamp_inicio: b.hora_inicio,
        timestamp_fin: b.hora_fin,
        estado_bloque: b.estado_bloque,
        es_cuota_adulto_mayor: b.es_cuota_adulto_mayor,
        cita: b.cita
          ? {
              codigo_reserva: b.cita.codigo_reserva,
              estado_cita: b.cita.estado_cita,
              paciente: b.cita.paciente
                ? {
                    id: b.cita.paciente.id,
                    rut: b.cita.paciente.rut,
                    rut_formateado: formatearRut(b.cita.paciente.rut),
                    nombre_completo: `${b.cita.paciente.nombres} ${b.cita.paciente.apellidos}`,
                    telefono: b.cita.paciente.telefono,
                  }
                : null,
            }
          : null,
      };
    });

    return {
      id: agenda.id,
      profesional_id: agenda.profesional_id,
      profesional_nombre: `${agenda.profesional.nombres} ${agenda.profesional.apellidos}`,
      profesional_rut: agenda.profesional.rut,
      box_id: agenda.box_id,
      box_numero: agenda.box.numero,
      especialidad: agenda.especialidad,
      fecha: agenda.fecha.toISOString().split("T")[0],
      hora_inicio: agenda.hora_inicio,
      hora_fin: agenda.hora_fin,
      duracion_bloque_min: agenda.duracion_bloque_min,
      activa: agenda.activa,
      estadisticas: {
        total: totalBloques,
        disponibles,
        reservados,
        bloqueados_some: bloqueadosSome,
        bloqueo_temporal: temporales,
        cuota_adulto_mayor: cuotaMayor,
      },
      bloques: bloquesDetalle,
      bloques_horarios: bloquesDetalle,
    };
  });

  return {
    agendas: agendasResumen,
    profesionales,
    boxes,
  };
}

/**
 * HU-005: Genera una agenda médica con bloques horarios de forma atómica.
 * Excluye automáticamente colación 13:00 - 14:00 y valida no-superposición de médico y box.
 */
export async function generarAgendaConBloques(dto: GenerarAgendaDTO) {
  const fechaNorm = normalizarFecha(dto.fecha);

  const minInicio = horaAMinutos(dto.hora_inicio);
  const minFin = horaAMinutos(dto.hora_fin);

  if (minInicio >= minFin) {
    throw new AgendaValidationError("La hora de inicio debe ser anterior a la hora de fin.");
  }

  if (dto.duracion_bloque_min <= 0 || dto.duracion_bloque_min > 120) {
    throw new AgendaValidationError("La duración del bloque debe ser entre 5 y 120 minutos.");
  }

  // 1. Validar existencia de Profesional y Box
  const [profesional, box] = await Promise.all([
    prisma.profesional.findUnique({ where: { id: dto.profesional_id } }),
    prisma.box.findUnique({ where: { id: dto.box_id } }),
  ]);

  if (!profesional || !profesional.activo) {
    throw new AgendaValidationError("El profesional seleccionado no existe o no se encuentra activo.");
  }

  if (!box || !box.activo) {
    throw new AgendaValidationError("El box seleccionado no existe o no se encuentra activo.");
  }

  // 2. Validar NO solapamiento para mismo profesional o mismo box en la misma fecha
  const fechaSiguiente = new Date(fechaNorm);
  fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);

  const agendasExistentes = await prisma.agendaMedica.findMany({
    where: {
      fecha: {
        gte: fechaNorm,
        lt: fechaSiguiente,
      },
      activa: true,
      OR: [
        { profesional_id: dto.profesional_id },
        { box_id: dto.box_id },
      ],
    },
    include: {
      profesional: true,
      box: true,
    },
  });

  for (const ag of agendasExistentes) {
    const agMinIni = horaAMinutos(ag.hora_inicio);
    const agMinFin = horaAMinutos(ag.hora_fin);

    if (seSolapan(minInicio, minFin, agMinIni, agMinFin)) {
      if (ag.profesional_id === dto.profesional_id) {
        throw new AgendaConflictError(
          `Conflicto: El profesional ${profesional.nombres} ${profesional.apellidos} ya tiene una agenda asignada (${ag.hora_inicio} a ${ag.hora_fin}) en esta fecha.`
        );
      }
      if (ag.box_id === dto.box_id) {
        throw new AgendaConflictError(
          `Conflicto: El box ${box.numero} ya se encuentra ocupado por otra agenda (${ag.hora_inicio} a ${ag.hora_fin}) en esta fecha.`
        );
      }
    }
  }

  // 3. Generar bloques horarios
  // Horario de colación: 13:00 (780 min) a 14:00 (840 min)
  const COLACION_INICIO = 13 * 60; // 780
  const COLACION_FIN = 14 * 60;    // 840

  interface BloqueTemporal {
    hora_inicio: Date;
    hora_fin: Date;
  }

  const bloquesParaCrear: BloqueTemporal[] = [];
  let currentMin = minInicio;

  while (currentMin + dto.duracion_bloque_min <= minFin) {
    const blockEndMin = currentMin + dto.duracion_bloque_min;

    // Verificar si el bloque intersecta la ventana de colación [13:00, 14:00)
    const seSolapaConColacion = seSolapan(currentMin, blockEndMin, COLACION_INICIO, COLACION_FIN);

    if (!seSolapaConColacion) {
      const hIniStr = `${String(Math.floor(currentMin / 60)).padStart(2, "0")}:${String(currentMin % 60).padStart(2, "0")}`;
      const hFinStr = `${String(Math.floor(blockEndMin / 60)).padStart(2, "0")}:${String(blockEndMin % 60).padStart(2, "0")}`;

      bloquesParaCrear.push({
        hora_inicio: construirTimestamp(fechaNorm, hIniStr),
        hora_fin: construirTimestamp(fechaNorm, hFinStr),
      });
    }

    currentMin += dto.duracion_bloque_min;
  }

  if (bloquesParaCrear.length === 0) {
    throw new AgendaValidationError("El rango horario y duración no permiten generar bloques válidos.");
  }

  // 4. Asignar cuota para Adulto Mayor (>= 60 años)
  const porcentaje = dto.porcentaje_cuota_mayor ?? 30;
  const cantidadCuotaMayor = Math.max(1, Math.round((bloquesParaCrear.length * porcentaje) / 100));

  // 5. Transacción atómica en PostgreSQL
  return await prisma.$transaction(async (tx) => {
    const agendaCreada = await tx.agendaMedica.create({
      data: {
        profesional_id: dto.profesional_id,
        box_id: dto.box_id,
        especialidad: dto.especialidad,
        fecha: fechaNorm,
        hora_inicio: dto.hora_inicio,
        hora_fin: dto.hora_fin,
        duracion_bloque_min: dto.duracion_bloque_min,
        activa: true,
      },
    });

    const dataBloques = bloquesParaCrear.map((b, idx) => ({
      agenda_id: agendaCreada.id,
      hora_inicio: b.hora_inicio,
      hora_fin: b.hora_fin,
      estado_bloque: EstadoBloque.DISPONIBLE,
      es_cuota_adulto_mayor: idx < cantidadCuotaMayor,
    }));

    await tx.bloqueHorario.createMany({
      data: dataBloques,
    });

    const bloquesInsertados = await tx.bloqueHorario.findMany({
      where: { agenda_id: agendaCreada.id },
      orderBy: { hora_inicio: "asc" },
    });

    return {
      agenda: agendaCreada,
      total_bloques: bloquesInsertados.length,
      bloques_cuota_mayor: cantidadCuotaMayor,
      bloques: bloquesInsertados,
    };
  });
}

/**
 * HU-005: Pausa una agenda activa.
 * Pasa los bloques DISPONIBLES a BLOQUEADO_SOME y retorna el número de citas ya agendadas.
 */
export async function pausarAgenda(agendaId: string) {
  const agenda = await prisma.agendaMedica.findUnique({
    where: { id: agendaId },
    include: {
      bloques: {
        include: {
          cita: true,
        },
      },
    },
  });

  if (!agenda) {
    throw new AgendaValidationError("La agenda no existe.");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Desactivar agenda
    await tx.agendaMedica.update({
      where: { id: agendaId },
      data: { activa: false },
    });

    // 2. Bloquear bloques disponibles
    const actualizados = await tx.bloqueHorario.updateMany({
      where: {
        agenda_id: agendaId,
        estado_bloque: EstadoBloque.DISPONIBLE,
      },
      data: {
        estado_bloque: EstadoBloque.BLOQUEADO_SOME,
      },
    });

    // 3. Contar citas ya reservadas/agendadas
    const citasAgendadas = agenda.bloques.filter((b) => b.cita && b.estado_bloque === EstadoBloque.RESERVADO);

    return {
      agenda_id: agendaId,
      activa: false,
      bloques_bloqueados_some: actualizados.count,
      citas_preexistentes: citasAgendadas.length,
      mensaje: `Agenda pausada exitosamente. Se bloquearon ${actualizados.count} cupos disponibles.${
        citasAgendadas.length > 0
          ? ` ALERTA: Existen ${citasAgendadas.length} citas previamente agendadas que deben ser gestionadas manualmente.`
          : ""
      }`,
    };
  });
}
