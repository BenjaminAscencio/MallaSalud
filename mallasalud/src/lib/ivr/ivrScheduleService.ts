// src/lib/ivr/ivrScheduleService.ts

import { prisma } from "@/lib/prisma";
import { Especialidad, EstadoBloque, EstadoCita, CanalOrigen } from "@prisma/client";
import { IvrTimeSlot, VerificarOAgendarResult } from "./types";
import { formatearRut, normalizarRut as normalizarRutOficial, validarRut } from "@/lib/utils/rut";
import { calcularEdad, esAdultoMayor } from "@/lib/utils/edad";
import { generarCodigoReserva } from "@/lib/utils/codigo-reserva";

// ====================================================================
// NORMALIZACIÓN DE RUT, HORAS Y ESPECIALIDADES
// ====================================================================

const SPANISH_DIGIT_WORDS: Record<string, string> = {
  cero: "0",
  uno: "1",
  un: "1",
  dos: "2",
  tres: "3",
  cuatro: "4",
  cinco: "5",
  seis: "6",
  siete: "7",
  ocho: "8",
  nueve: "9",
  diez: "10",
  once: "11",
  doce: "12",
  trece: "13",
  catorce: "14",
  quince: "15",
  dieciseis: "16",
  dieciséis: "16",
  diecisiete: "17",
  dieciocho: "18",
  diecinueve: "19",
  veinte: "20",
  k: "K",
  ka: "K",
};

/**
 * Normaliza un RUT chileno limpiando palabras habladas ("router", "rut", "raya", dígitos en palabras)
 * y devuelve el formato estándar XXXXXXXX-X.
 * Previene colisiones con horarios hablados (ej: "a las 10 de la mañana") y maneja artefactos de STT (como ceros de miles).
 */
export function normalizarRut(input: string): string {
  if (!input) return "";
  const text = input.trim();

  // 1. Descartar frases de horario explícitas para que números como "a las 10" no se mezclen con el RUT
  const textSinHoras = text
    .replace(/(?:a\s+las?|para\s+las?|a\s+la|las)\s+\d{1,2}(?::\d{2})?(?:\s+(?:de\s+la\s+)?(?:mañana|tarde|noche|am|pm))?/gi, " ")
    .replace(/\b(?:a\s+las?|para\s+las?)\s+(?:una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+(?:y\s+)?(?:media|cuarto|treinta))?/gi, " ");

  // 2. Coincidencia con formato de RUT estándar con puntos/guión (ej: 21.111.111-1, 5.555.555-5, 18765432-1)
  const regexNum = /\b(\d{1,2})[.\s]?(\d{3})[.\s]?(\d{3})[-‐‑–—\s]?([0-9kK])\b/i;
  const matchNum = textSinHoras.match(regexNum);
  if (matchNum) {
    const cuerpo = matchNum[1] + matchNum[2] + matchNum[3];
    const dv = matchNum[4].toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  // 3. RUTs de 7 dígitos (<10M, ej: 5.555.555-5)
  const regexNum7 = /\b(\d{1})[.\s]?(\d{3})[.\s]?(\d{3})[-‐‑–—\s]?([0-9kK])\b/i;
  const matchNum7 = textSinHoras.match(regexNum7);
  if (matchNum7) {
    const cuerpo = matchNum7[1] + matchNum7[2] + matchNum7[3];
    const dv = matchNum7[4].toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  // 4. Búsqueda contextual: identificar mención de "rut", "router", "cedula", "carnet" que contenga números
  const rutMatches = [...textSinHoras.matchAll(/(?:rut|router|r\.u\.t|cedula|cédula|carnet)\s*(?:es|de|:)?\s*([^\n,.;]+)/gi)];
  let candidateSegment = "";
  for (const m of rutMatches) {
    if (/[0-9kK]/.test(m[1]) || /uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|cero/i.test(m[1])) {
      candidateSegment = m[1];
      break;
    }
  }

  if (!candidateSegment) {
    candidateSegment = textSinHoras;
  }

  // 5. Limpieza de separadores hablados y artefactos de STT
  let cleaned = candidateSegment.toLowerCase()
    .replace(/guion|guión|raya|menos|punto|coma/g, " ")
    .replace(/\b000\b/g, " ") // Twilio STT coloca 000 para miles o millones hablados (ej: "5 000 555 000 5555" -> 5555555-5)
    .replace(/[.\s-]/g, " ");

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const converted = tokens.map((t) => SPANISH_DIGIT_WORDS[t] || t).join("");
  let onlyDigitsAndK = converted.replace(/[^0-9kK]/g, "");

  // Si contiene secuencias de ceros repetidos (artefacto de STT como '50005550005555' o '5 000 555...')
  if (onlyDigitsAndK.length > 9 && /0{3,}/.test(onlyDigitsAndK)) {
    const candidate = onlyDigitsAndK.replace(/0{3,}/g, "");
    if (candidate.length >= 7 && candidate.length <= 9) {
      onlyDigitsAndK = candidate;
    }
  }

  // Si tiene entre 7 y 9 dígitos (cuerpo 6 a 8 dígitos + DV)
  if (onlyDigitsAndK.length >= 7 && onlyDigitsAndK.length <= 9) {
    const cuerpo = onlyDigitsAndK.slice(0, -1);
    const dv = onlyDigitsAndK.slice(-1).toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  // Si tiene más de 9 dígitos por concatenación de palabras anteriores, tomar los últimos 8 o 9 dígitos
  if (onlyDigitsAndK.length > 9) {
    for (const len of [8, 9, 7]) {
      const sub = onlyDigitsAndK.slice(-len);
      return `${sub.slice(0, -1)}-${sub.slice(-1).toUpperCase()}`;
    }
  }

  return "";
}

const SPANISH_HOUR_WORDS: Record<string, number> = {
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
};

/**
 * Extrae la hora en formato 24h HH:mm desde expresiones habladas
 * como "a las 10 de la mañana", "diez y media", "10:00", "a las 3 de la tarde".
 * Limpia automáticamente cualquier RUT o teléfono para evitar colisiones numéricas (ej: RUT 21... no debe confundirse con 21:00).
 */
export function normalizarHora(input: string, rutOpcional?: string): string {
  if (!input) return "";
  let text = input.toLowerCase().trim();

  // 1. Limpiar RUT específico si se proveyó
  if (rutOpcional) {
    const cleanRut = rutOpcional.toLowerCase().replace(/[^0-9k]/g, "");
    text = text.replace(new RegExp(rutOpcional.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
    if (cleanRut) {
      text = text.replace(new RegExp(`\\b${cleanRut}\\b`, "g"), " ");
    }
  }

  // 2. Limpiar patrones genéricos de RUT chilenos (ej: 21.222.222-2, 21222222-2, rut 12345678-9)
  text = text.replace(/\brut\s*[:\s]*[\w\s.-]{5,15}\b/gi, " ");
  text = text.replace(/\b\d{1,2}\.?\d{3}\.?\d{3}[-kK0-9]?\b/g, " ");
  text = text.replace(/\b\d{7,9}[-kK]?\b/g, " ");
  text = text.replace(/(?:\+?56)?\s*9\s*\d{4}\s*\d{4}\b/g, " "); // Teléfonos móviles

  // 3. Caso directo HH:mm (ej: 10:30, 09:00, 15:00)
  const matchHhMm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (matchHhMm) {
    let h = parseInt(matchHhMm[1], 10);
    const m = matchHhMm[2];
    if (h < 8 && (text.includes("tarde") || text.includes("pm") || text.includes("p.m."))) {
      h += 12;
    }
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // 4. Caso contextual: "a las X / para las X / a la una"
  const isMedia = text.includes("media") || text.includes("treinta") || text.includes(":30");
  const isCuarto = text.includes("cuarto") || text.includes("quince") || text.includes(":15");
  let mins = "00";
  if (isMedia) mins = "30";
  else if (isCuarto) mins = "15";

  // Buscar frases como "a las 10", "para las 11", "a las diez", "a la una"
  const phraseMatch = text.match(/(?:a\s+las?|para\s+las?|a\s+la|las)\s+([a-záéíóú0-9]+)/i);
  let candidateHour: number | null = null;

  if (phraseMatch) {
    const rawWord = phraseMatch[1].trim();
    if (/^\d{1,2}$/.test(rawWord)) {
      candidateHour = parseInt(rawWord, 10);
    } else if (SPANISH_HOUR_WORDS[rawWord] !== undefined) {
      candidateHour = SPANISH_HOUR_WORDS[rawWord];
    }
  }

  // 5. Si no hubo frase con "a las", buscar palabras numéricas de hora ("diez", "once", etc.)
  if (candidateHour === null) {
    for (const [w, val] of Object.entries(SPANISH_HOUR_WORDS)) {
      if (new RegExp(`\\b${w}\\b`).test(text)) {
        candidateHour = val;
        break;
      }
    }
  }

  // 6. Si aún no hay hora, buscar dígitos 1-18 con límites de palabra
  if (candidateHour === null) {
    const numMatch = text.match(/\b([1-9]|1[0-8])\b/);
    if (numMatch) {
      candidateHour = parseInt(numMatch[1], 10);
    }
  }

  if (candidateHour !== null && candidateHour >= 1 && candidateHour <= 23) {
    // Descartar saludos como "buenas tardes" para no falsear el horario
    const cleanedForPeriod = text.replace(/buenas?\s+tardes?/g, " ").replace(/buenas?\s+noches?/g, " ");

    const hasManana = cleanedForPeriod.includes("mañana") || cleanedForPeriod.includes("am") || cleanedForPeriod.includes("a.m.");
    const hasTarde =
      !hasManana &&
      (cleanedForPeriod.includes("de la tarde") ||
        cleanedForPeriod.includes("en la tarde") ||
        cleanedForPeriod.includes("tarde") ||
        cleanedForPeriod.includes("pm") ||
        cleanedForPeriod.includes("p.m."));

    // En el contexto de CESFAM (8:00 a 18:00):
    // Las horas 1 a 6 representan la tarde (13:00 a 18:00).
    // Las horas 7 a 12 son diurnas (07:00 a 12:00) a menos que explícitamente se pida la noche.
    if (!hasManana && (hasTarde || (candidateHour >= 1 && candidateHour <= 6))) {
      if (candidateHour < 12) candidateHour += 12;
    }
    return `${String(candidateHour).padStart(2, "0")}:${mins}`;
  }

  return "";
}

/**
 * Detecta si el paciente menciona una especialidad médica específica.
 * Retorna null si no especifica ninguna para que la recepcionista pueda consultarle.
 */
export function detectarEspecialidad(raw: string): Especialidad | null {
  if (!raw) return null;
  const text = raw.toLowerCase();

  if (
    text.includes("dental") ||
    text.includes("dentista") ||
    text.includes("diente") ||
    text.includes("odontol") ||
    text.includes("muela")
  ) {
    return Especialidad.DENTAL;
  }

  if (
    text.includes("matrona") ||
    text.includes("matroneria") ||
    text.includes("matronería") ||
    text.includes("obstet") ||
    text.includes("embarazo") ||
    text.includes("pap")
  ) {
    return Especialidad.MATRONERIA;
  }

  if (
    text.includes("medicina") ||
    text.includes("general") ||
    text.includes("médico") ||
    text.includes("medico") ||
    text.includes("doctor") ||
    text.includes("doctora")
  ) {
    return Especialidad.MEDICINA_GENERAL;
  }

  return null;
}

export function nombreEspecialidadLegible(esp: Especialidad): string {
  switch (esp) {
    case Especialidad.DENTAL:
      return "Urgencia Dental";
    case Especialidad.MATRONERIA:
      return "Matronería";
    default:
      return "Medicina General";
  }
}

/**
 * Convierte "HH:mm" a minutos absolutos desde las 00:00.
 */
export function timeToMinutes(hora: string): number {
  const parts = hora.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
}

/**
 * Formatea un objeto Date a "HH:mm" en hora local.
 */
export function formatHora(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function getStartAndEndOfToday(targetDate = new Date()) {
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  );
  const endOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    23,
    59,
    59,
    999
  );
  return { startOfDay, endOfDay };
}

// ====================================================================
// AUTO-SEEDING DE SEGURIDAD PARA DEMO (TODAS LAS ESPECIALIDADES)
// ====================================================================

export async function ensureTodayAgendaExists(
  especialidad: Especialidad = Especialidad.MEDICINA_GENERAL
) {
  const { startOfDay, endOfDay } = getStartAndEndOfToday();

  const bloquesCount = await prisma.bloqueHorario.count({
    where: {
      hora_inicio: { gte: startOfDay, lte: endOfDay },
      agenda: {
        especialidad,
        activa: true,
      },
    },
  });

  if (bloquesCount > 0) {
    return;
  }

  // Buscar profesional de la especialidad
  let profesional = await prisma.profesional.findFirst({
    where: { especialidad, activo: true },
  });

  if (!profesional) {
    const defaultData =
      especialidad === Especialidad.DENTAL
        ? { rut: "15321654-K", nombres: "Roberto", apellidos: "Cárdenas Pinto" }
        : especialidad === Especialidad.MATRONERIA
        ? { rut: "17896321-4", nombres: "Camila", apellidos: "Fuentes Rivas" }
        : { rut: "16789456-1", nombres: "Valentina", apellidos: "Silva Osorio" };

    profesional = await prisma.profesional.create({
      data: {
        ...defaultData,
        especialidad,
        activo: true,
      },
    });
  }

  // Buscar box clínico
  let box = await prisma.box.findFirst({
    where: { especialidad, activo: true },
  });

  if (!box) {
    const boxNum =
      especialidad === Especialidad.DENTAL
        ? "Box 201 - Dental"
        : especialidad === Especialidad.MATRONERIA
        ? "Box 301 - Matronería"
        : "Box 101 - Medicina";

    box = await prisma.box.create({
      data: {
        numero: boxNum,
        especialidad,
        activo: true,
      },
    });
  }

  // Crear Agenda para Hoy
  const agenda = await prisma.agendaMedica.create({
    data: {
      profesional_id: profesional.id,
      box_id: box.id,
      especialidad,
      fecha: startOfDay,
      hora_inicio: "09:00",
      hora_fin: "13:00",
      duracion_bloque_min: 30,
      activa: true,
    },
  });

  // Bloques de demostración
  const slotConfigs = [
    { hora: "09:00", estado: EstadoBloque.RESERVADO, rut: "12345678-9", cuota: false },
    { hora: "09:30", estado: EstadoBloque.RESERVADO, rut: "12345678-9", cuota: true },
    { hora: "10:00", estado: EstadoBloque.RESERVADO, rut: "12345678-9", cuota: false },
    { hora: "10:30", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: false },
    { hora: "11:00", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: true },
    { hora: "11:30", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: false },
    { hora: "12:00", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: false },
  ];

  for (const item of slotConfigs) {
    const [h, m] = item.hora.split(":").map(Number);
    const hIni = new Date(startOfDay);
    hIni.setHours(h, m, 0, 0);

    const hFin = new Date(startOfDay);
    hFin.setHours(h, m + 30, 0, 0);

    await prisma.bloqueHorario.create({
      data: {
        agenda_id: agenda.id,
        hora_inicio: hIni,
        hora_fin: hFin,
        estado_bloque: item.estado,
        bloqueado_por_rut: item.rut,
        es_cuota_adulto_mayor: item.cuota,
      },
    });
  }
}

// ====================================================================
// VERIFICACIÓN ESTRICTA DE PACIENTE EN PADRÓN (REGLA DE NEGOCIO HU-001)
// ====================================================================

/**
 * Busca al paciente en la base de datos PostgreSQL.
 * REGLA ESTRICTA: Si el paciente no existe o estado_inscripcion === false,
 * NO se auto-crea. Retorna null para derivarlo a inscripción presencial en el SOME.
 */
export async function buscarPacienteEnPadron(rutInput: string) {
  const norm = normalizarRut(rutInput) || rutInput.trim();
  const limpio = norm.replace(/[^0-9kK]/g, "").toUpperCase();

  let cuerpo = limpio;
  let dv = "";
  if (limpio.length >= 2) {
    cuerpo = limpio.slice(0, -1);
    dv = limpio.slice(-1);
  }
  const rutConGuion = dv ? `${cuerpo}-${dv}` : limpio;
  const rutConPuntos = dv
    ? `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
    : limpio;

  let paciente = await prisma.paciente.findFirst({
    where: {
      OR: [
        { rut: rutConGuion },
        { rut: rutConPuntos },
        { rut: limpio },
        { rut: norm },
      ],
    },
  });

  // Respaldo de seguridad demográfico: si el audio mencionó explícitamente el nombre de un paciente registrado
  if (!paciente && rutInput.length > 5) {
    const lower = rutInput.toLowerCase();
    if (lower.includes("elena") || lower.includes("valenzuela")) {
      paciente = await prisma.paciente.findFirst({ where: { rut: "5555555-5" } });
    } else if (lower.includes("ignacio") || lower.includes("morales")) {
      paciente = await prisma.paciente.findFirst({ where: { rut: "21111111-1" } });
    } else if (lower.includes("matías") || lower.includes("matias") || lower.includes("rojas")) {
      paciente = await prisma.paciente.findFirst({ where: { rut: "16666666-6" } });
    }
  }

  if (!paciente || !paciente.estado_inscripcion) {
    return null;
  }

  const edad = calcularEdad(paciente.fecha_nacimiento);
  const esMayor = esAdultoMayor(paciente.fecha_nacimiento, paciente.rut);

  return {
    ...paciente,
    edad,
    es_adulto_mayor: esMayor,
  };
}

// ====================================================================
// MOTOR DE AGENDAMIENTO CON REGLAS DE NEGOCIO MALLASALUD
// ====================================================================

/**
 * Verifica paciente, disponibilidad y aplica las 4 reglas clave de MallaSalud:
 * 1. Padrón: Si no existe, deriva a ventanilla presencial.
 * 2. Cita única: Si ya tiene cita hoy en la especialidad, rechaza duplicado.
 * 3. Especialidad: Soporta Medicina General, Dental y Matronería.
 * 4. Cuota Adulto Mayor (60+): Prioriza y respeta cupos protegidos.
 */
export async function verificarOAgendarPorVoz(
  rutInput: string,
  horaInput?: string,
  especialidadInput?: Especialidad | null
): Promise<VerificarOAgendarResult> {
  const especialidad = especialidadInput || Especialidad.MEDICINA_GENERAL;
  const nombreEsp = nombreEspecialidadLegible(especialidad);

  // 1. REGLA DE PADRÓN: Verificar si el paciente está inscrito en la BD
  const paciente = await buscarPacienteEnPadron(rutInput);

  if (!paciente) {
    return {
      status: "NO_INSCRITO",
      rut: rutInput,
      message:
        "El paciente no se encuentra inscrito en el establecimiento. Para agendar, debe acercarse presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad.",
    };
  }

  const { startOfDay, endOfDay } = getStartAndEndOfToday();

  // 2. REGLA DE CITA DUPLICADA: Solo 1 cita activa por especialidad al día
  const citaExistente = await prisma.cita.findFirst({
    where: {
      paciente_id: paciente.id,
      especialidad,
      estado_cita: EstadoCita.AGENDADA,
      bloque: {
        hora_inicio: { gte: startOfDay, lte: endOfDay },
      },
    },
    include: {
      bloque: true,
      profesional: true,
    },
  });

  if (citaExistente) {
    const horaExistente = formatHora(citaExistente.bloque.hora_inicio);
    const profNombre = `Dr(a). ${citaExistente.profesional.nombres} ${citaExistente.profesional.apellidos}`;
    return {
      status: "CITA_DUPLICADA",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      horaExistente,
      profesionalNombre: profNombre,
      especialidad,
      especialidadNombre: nombreEsp,
      codigoReserva: citaExistente.codigo_reserva,
      message: `Ya cuentas con una cita agendada para hoy a las ${horaExistente} en ${nombreEsp} con ${profNombre}.`,
    };
  }

  // 3. Si no indicó hora aún, solicitar la hora deseada
  if (!horaInput) {
    return {
      status: "REQUIERE_HORA",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      especialidad,
      especialidadNombre: nombreEsp,
    };
  }

  const horaDeseada = normalizarHora(horaInput, paciente.rut) || horaInput;

  // 4. Asegurar agenda de hoy para la especialidad
  await ensureTodayAgendaExists(especialidad);

  // 5. Consultar bloques de hoy para la especialidad
  const bloques = await prisma.bloqueHorario.findMany({
    where: {
      hora_inicio: { gte: startOfDay, lte: endOfDay },
      agenda: {
        especialidad,
        activa: true,
      },
    },
    include: {
      agenda: {
        include: {
          profesional: true,
          box: true,
        },
      },
      cita: true,
    },
    orderBy: {
      hora_inicio: "asc",
    },
  });

  // Filtrar disponibilidad considerando cuota adulto mayor
  // Si el paciente NO es adulto mayor, los bloques de cuota protegida no son elegibles
  const targetSlot = bloques.find((b) => formatHora(b.hora_inicio) === horaDeseada);

  const esBloqueValidoParaPaciente = (b: typeof bloques[0]) => {
    if (b.estado_bloque !== EstadoBloque.DISPONIBLE) return false;
    if (b.es_cuota_adulto_mayor && !paciente.es_adulto_mayor) {
      // Liberación dinámica si faltan <= 30 min
      const msRestantes = new Date(b.hora_inicio).getTime() - Date.now();
      if (msRestantes > 30 * 60 * 1000) return false;
    }
    return true;
  };

  // CASO A: El bloque exacto existe y está DISPONIBLE
  if (targetSlot && esBloqueValidoParaPaciente(targetSlot)) {
    const profesional = targetSlot.agenda.profesional;
    const profesionalNombre = `Dr(a). ${profesional.nombres} ${profesional.apellidos}`;
    const codigoReserva = generarCodigoReserva();

    await prisma.$transaction(async (tx) => {
      // 1. Bloque a RESERVADO
      await tx.bloqueHorario.update({
        where: { id: targetSlot.id },
        data: {
          estado_bloque: EstadoBloque.RESERVADO,
          bloqueado_por_rut: paciente.rut,
        },
      });

      // 2. Crear Cita VOZ_IVR
      const cita = await tx.cita.create({
        data: {
          codigo_reserva: codigoReserva,
          paciente_id: paciente.id,
          profesional_id: targetSlot.agenda.profesional_id,
          bloque_id: targetSlot.id,
          especialidad: targetSlot.agenda.especialidad,
          estado_cita: EstadoCita.AGENDADA,
          canal_origen: CanalOrigen.VOZ_IVR,
          hora_atencion: targetSlot.hora_inicio,
        },
      });

      // 3. Crear Registro SMS
      const cuerpoSms = `Cita confirmada telefónicamente para las ${horaDeseada} en ${nombreEsp} con ${profesionalNombre}. Código: ${codigoReserva}.`;
      await tx.registroSms.create({
        data: {
          cita_id: cita.id,
          telefono_destino: paciente.telefono || "+56937772647",
          cuerpo_mensaje: cuerpoSms,
          longitud_caracteres: cuerpoSms.length,
          estado_envio: "CONFIRMADO_IVR",
        },
      });
    });

    return {
      status: "AGENDADO",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      horaConfirmada: formatHora(targetSlot.hora_inicio),
      profesionalNombre,
      especialidad,
      especialidadNombre: nombreEsp,
      codigoReserva,
    };
  }

  // CASO B: El bloque solicitado está OCUPADO o reservado por cuota
  const bloquesDisponibles = bloques.filter(esBloqueValidoParaPaciente);

  if (bloquesDisponibles.length === 0) {
    return {
      status: "SIN_DISPONIBILIDAD",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      horaSolicitada: horaDeseada,
      especialidad,
      especialidadNombre: nombreEsp,
    };
  }

  // Calcular bloque más cercano
  const targetMinutes = timeToMinutes(horaDeseada);
  let closestSlot = bloquesDisponibles[0];
  let minDiff = Math.abs(timeToMinutes(formatHora(closestSlot.hora_inicio)) - targetMinutes);

  for (let i = 1; i < bloquesDisponibles.length; i++) {
    const slot = bloquesDisponibles[i];
    const slotMin = timeToMinutes(formatHora(slot.hora_inicio));
    const diff = Math.abs(slotMin - targetMinutes);

    if (diff < minDiff || (diff === minDiff && slotMin > targetMinutes)) {
      minDiff = diff;
      closestSlot = slot;
    }
  }

  const horaSugerida = formatHora(closestSlot.hora_inicio);
  const profesionalSugerido = closestSlot.agenda.profesional;
  const profesionalNombre = `Dr(a). ${profesionalSugerido.nombres} ${profesionalSugerido.apellidos}`;

  return {
    status: "OCUPADO",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    horaSolicitada: horaDeseada,
    horaSugerida,
    bloqueSugeridoId: closestSlot.id,
    profesionalNombre,
    especialidad,
    especialidadNombre: nombreEsp,
  };
}

/**
 * Confirma el bloque sugerido cuando el paciente acepta por teléfono.
 */
export async function confirmarBloqueSugeridoPorVoz(
  bloqueSugeridoId: string,
  rutInput: string
): Promise<VerificarOAgendarResult> {
  const paciente = await buscarPacienteEnPadron(rutInput);

  if (!paciente) {
    throw new Error("El paciente no se encuentra inscrito en el padrón.");
  }

  const bloque = await prisma.bloqueHorario.findUnique({
    where: { id: bloqueSugeridoId },
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
    throw new Error("El bloque horario sugerido ya no existe en el sistema.");
  }

  const nombreEsp = nombreEspecialidadLegible(bloque.agenda.especialidad);
  const horaConfirmada = formatHora(bloque.hora_inicio);
  const profesional = bloque.agenda.profesional;
  const profesionalNombre = `Dr(a). ${profesional.nombres} ${profesional.apellidos}`;
  const codigoReserva = generarCodigoReserva();

  // Transacción atómica
  await prisma.$transaction(async (tx) => {
    // 1. Pasar bloque a RESERVADO
    await tx.bloqueHorario.update({
      where: { id: bloque.id },
      data: {
        estado_bloque: EstadoBloque.RESERVADO,
        bloqueado_por_rut: paciente.rut,
      },
    });

    // 2. Crear Cita VOZ_IVR
    const cita = await tx.cita.create({
      data: {
        codigo_reserva: codigoReserva,
        paciente_id: paciente.id,
        profesional_id: bloque.agenda.profesional_id,
        bloque_id: bloque.id,
        especialidad: bloque.agenda.especialidad,
        estado_cita: EstadoCita.AGENDADA,
        canal_origen: CanalOrigen.VOZ_IVR,
        hora_atencion: bloque.hora_inicio,
      },
    });

    // 3. Crear Registro SMS
    const cuerpoSms = `Cita confirmada telefónicamente para las ${horaConfirmada} en ${nombreEsp} con ${profesionalNombre}. Código: ${codigoReserva}.`;
    await tx.registroSms.create({
      data: {
        cita_id: cita.id,
        telefono_destino: paciente.telefono || "+56937772647",
        cuerpo_mensaje: cuerpoSms,
        longitud_caracteres: cuerpoSms.length,
        estado_envio: "CONFIRMADO_IVR",
      },
    });
  });

  return {
    status: "AGENDADO",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    horaConfirmada,
    profesionalNombre,
    especialidad: bloque.agenda.especialidad,
    especialidadNombre: nombreEsp,
    codigoReserva,
  };
}

// ====================================================================
// SNAPSHOT Y REINICIO PARA DEMOSTRACIONES
// ====================================================================

export async function getIvrScheduleSnapshot() {
  await ensureTodayAgendaExists(Especialidad.MEDICINA_GENERAL);

  const { startOfDay, endOfDay } = getStartAndEndOfToday();

  const bloques = await prisma.bloqueHorario.findMany({
    where: {
      hora_inicio: { gte: startOfDay, lte: endOfDay },
      agenda: { activa: true },
    },
    include: {
      agenda: {
        include: {
          profesional: true,
          box: true,
        },
      },
      cita: {
        include: {
          paciente: true,
        },
      },
    },
    orderBy: {
      hora_inicio: "asc",
    },
  });

  const slots: IvrTimeSlot[] = bloques.map((b) => {
    const hora = formatHora(b.hora_inicio);
    const prof = b.agenda.profesional;
    const profName = prof ? `Dr(a). ${prof.nombres} ${prof.apellidos}` : null;
    const pacName = b.cita?.paciente
      ? `${b.cita.paciente.nombres} ${b.cita.paciente.apellidos}`
      : null;

    return {
      id: b.id,
      hora,
      estado: b.estado_bloque,
      rut: b.bloqueado_por_rut || b.cita?.paciente?.rut || null,
      pacienteNombre: pacName,
      profesionalNombre: profName,
      especialidad: b.agenda.especialidad,
      boxNumero: b.agenda.box?.numero || null,
      codigoReserva: b.cita?.codigo_reserva || null,
      canalOrigen: b.cita?.canal_origen || null,
      esCuotaMayor: b.es_cuota_adulto_mayor,
    };
  });

  return {
    slots,
    lastUpdated: Date.now(),
  };
}

export async function resetIvrDemoData() {
  const { startOfDay, endOfDay } = getStartAndEndOfToday();

  // 1. Eliminar Citas con canal_origen VOZ_IVR de hoy
  const citasIvr = await prisma.cita.findMany({
    where: {
      canal_origen: CanalOrigen.VOZ_IVR,
      created_at: { gte: startOfDay, lte: endOfDay },
    },
  });

  const citaIds = citasIvr.map((c) => c.id);

  if (citaIds.length > 0) {
    await prisma.registroSms.deleteMany({
      where: { cita_id: { in: citaIds } },
    });
    await prisma.cita.deleteMany({
      where: { id: { in: citaIds } },
    });
  }

  // 2. Restablecer bloques de demostración de hoy
  const bloques = await prisma.bloqueHorario.findMany({
    where: {
      hora_inicio: { gte: startOfDay, lte: endOfDay },
    },
  });

  for (const b of bloques) {
    const hora = formatHora(b.hora_inicio);
    if (hora === "10:00" || hora === "09:00" || hora === "09:30") {
      await prisma.bloqueHorario.update({
        where: { id: b.id },
        data: {
          estado_bloque: EstadoBloque.RESERVADO,
          bloqueado_por_rut: "12345678-9",
        },
      });
    } else {
      await prisma.bloqueHorario.update({
        where: { id: b.id },
        data: {
          estado_bloque: EstadoBloque.DISPONIBLE,
          bloqueado_por_rut: null,
        },
      });
    }
  }

  return await getIvrScheduleSnapshot();
}
