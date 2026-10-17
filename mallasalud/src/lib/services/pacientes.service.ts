import prisma from "@/lib/prisma";
import { validarRut, normalizarRut, formatearRut } from "@/lib/utils/rut";
import { esAdultoMayor, calcularEdad } from "@/lib/utils/edad";

export class PacienteNotFoundError extends Error {
  constructor(message = "El paciente no se encuentra inscrito en el establecimiento. Acérquese a ventanilla SOME.") {
    super(message);
    this.name = "PacienteNotFoundError";
  }
}

export class RutInvalidoError extends Error {
  constructor(message = "El RUT ingresado no es válido según el algoritmo Módulo 11 chileno.") {
    super(message);
    this.name = "RutInvalidoError";
  }
}

export class PacienteYaExisteError extends Error {
  constructor(message = "Ya existe un paciente registrado con este RUT en el sistema.") {
    super(message);
    this.name = "PacienteYaExisteError";
  }
}

export interface PacienteVerificado {
  id: string;
  rut: string;
  rut_formateado: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  edad: number;
  telefono: string;
  es_adulto_mayor: boolean;
  tiene_inasistencias: boolean;
  contador_inasistencias: number;
  estado_inscripcion: boolean;
}

export interface AltaRapidaDTO {
  rut: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | Date;
  telefono: string;
}

/**
 * HU-001: Verificación de paciente por RUT con comprobación de Módulo 11,
 * cálculo de prioridad Adulto Mayor (>= 60 años) y alerta de inasistencias.
 */
export async function verificarPacientePorRut(rutInput: string): Promise<PacienteVerificado> {
  if (!validarRut(rutInput)) {
    throw new RutInvalidoError();
  }

  const rutNormalizado = normalizarRut(rutInput);

  const paciente = await prisma.paciente.findUnique({
    where: { rut: rutNormalizado },
  });

  if (!paciente || !paciente.estado_inscripcion) {
    throw new PacienteNotFoundError();
  }

  const edad = calcularEdad(paciente.fecha_nacimiento);
  const esMayor = esAdultoMayor(paciente.fecha_nacimiento, paciente.rut);
  const tieneInasistencias = paciente.contador_inasistencias > 0;

  return {
    id: paciente.id,
    rut: paciente.rut,
    rut_formateado: formatearRut(paciente.rut),
    nombres: paciente.nombres,
    apellidos: paciente.apellidos,
    nombre_completo: `${paciente.nombres} ${paciente.apellidos}`,
    fecha_nacimiento: paciente.fecha_nacimiento.toISOString().split("T")[0],
    edad,
    telefono: paciente.telefono,
    es_adulto_mayor: esMayor,
    tiene_inasistencias: tieneInasistencias,
    contador_inasistencias: paciente.contador_inasistencias,
    estado_inscripcion: paciente.estado_inscripcion,
  };
}

/**
 * HU-006: Consulta detallada de paciente para mesón SOME.
 */
export async function obtenerPacientePorRut(rutInput: string) {
  if (!validarRut(rutInput)) {
    throw new RutInvalidoError();
  }

  const rutNormalizado = normalizarRut(rutInput);

  const paciente = await prisma.paciente.findUnique({
    where: { rut: rutNormalizado },
    include: {
      citas: {
        orderBy: { created_at: "desc" },
        take: 5,
        include: {
          profesional: true,
          bloque: true,
        },
      },
    },
  });

  if (!paciente) {
    throw new PacienteNotFoundError();
  }

  const edad = calcularEdad(paciente.fecha_nacimiento);
  const esMayor = esAdultoMayor(paciente.fecha_nacimiento, paciente.rut);

  return {
    ...paciente,
    rut_formateado: formatearRut(paciente.rut),
    edad,
    es_adulto_mayor: esMayor,
  };
}

/**
 * HU-006: Alta rápida de paciente nuevo en ventanilla SOME.
 */
export async function altaRapidaPaciente(dto: AltaRapidaDTO) {
  if (!validarRut(dto.rut)) {
    throw new RutInvalidoError();
  }

  const rutNormalizado = normalizarRut(dto.rut);

  const existente = await prisma.paciente.findUnique({
    where: { rut: rutNormalizado },
  });

  if (existente) {
    throw new PacienteYaExisteError();
  }

  const fechaNac = typeof dto.fecha_nacimiento === "string" ? new Date(dto.fecha_nacimiento) : dto.fecha_nacimiento;
  if (isNaN(fechaNac.getTime())) {
    throw new Error("Fecha de nacimiento inválida.");
  }

  const nuevoPaciente = await prisma.paciente.create({
    data: {
      rut: rutNormalizado,
      nombres: dto.nombres.trim(),
      apellidos: dto.apellidos.trim(),
      fecha_nacimiento: fechaNac,
      telefono: dto.telefono.trim(),
      estado_inscripcion: true,
      contador_inasistencias: 0,
    },
  });

  return {
    ...nuevoPaciente,
    rut_formateado: formatearRut(nuevoPaciente.rut),
    edad: calcularEdad(nuevoPaciente.fecha_nacimiento),
    es_adulto_mayor: esAdultoMayor(nuevoPaciente.fecha_nacimiento, nuevoPaciente.rut),
  };
}
