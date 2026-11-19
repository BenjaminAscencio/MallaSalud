// src/lib/ivr/ivrScheduleService.ts

import { prisma } from "@/lib/prisma";
import { Especialidad, EstadoBloque, EstadoCita, CanalOrigen } from "@prisma/client";
import {
  IvrCallSmsContext,
  IvrFranja,
  IvrFranjaOption,
  IvrTimeSlot,
  VerificarOAgendarResult,
} from "./types";
import { enviarSmsTicketTwilio } from "./twilioSms";
import { formatearRut, normalizarRut as normalizarRutOficial, validarRut } from "@/lib/utils/rut";
import { calcularEdad, esAdultoMayor } from "@/lib/utils/edad";
import { generarCodigoReserva } from "@/lib/utils/codigo-reserva";
import { construirSmsConfirmacion, construirSmsCancelacion } from "@/lib/utils/sms";

// ====================================================================
// NORMALIZACIÓN DE RUT, HORAS Y ESPECIALIDADES
// ====================================================================

const SPANISH_DIGIT_WORDS: Record<string, string> = {
  cero: "0",
  uno: "1",
  un: "1",
  una: "1",
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
  diecisiete: "17",
  dieciocho: "18",
  diecinueve: "19",
  veinte: "20",
  veintiuno: "21",
  veintiun: "21",
  veintidos: "22",
  veintitres: "23",
  veinticuatro: "24",
  veinticinco: "25",
  veintiseis: "26",
  veintisiete: "27",
  veintiocho: "28",
  veintinueve: "29",
  treinta: "30",
  cuarenta: "40",
  cincuenta: "50",
  sesenta: "60",
  setenta: "70",
  ochenta: "80",
  noventa: "90",
  cien: "100",
  ciento: "100",
  doscientos: "200",
  trescientos: "300",
  cuatrocientos: "400",
  quinientos: "500",
  seiscientos: "600",
  setecientos: "700",
  ochocientos: "800",
  novecientos: "900",
  k: "K",
  ka: "K",
  ca: "K",
};

function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Si el hablante dictó un número compuesto con magnitudes en español ("veintiún millones
 * setecientos cincuenta y ocho mil cuatrocientos sesenta y siete guión uno"), calcula el cuerpo numérico.
 */
function intentarParsearRutCompuestoHablado(segmentoRaw: string): string | null {
  const norm = stripAccents(segmentoRaw);
  if (!/\b(millon|millones|mil|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|veinti|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\b/.test(norm)) {
    return null;
  }

  // Separar parte cuerpo vs DV si hubo guion/raya/con o última palabra
  const tokensAll = norm
    .replace(/[.,]/g, " ")
    .replace(/\b(guion|raya|menos|con|digito|verificador)\b/g, " _SEP_ ")
    .split(/\s+/)
    .filter(Boolean);

  let bodyTokens: string[] = [];
  let dvChar = "";

  const sepIdx = tokensAll.lastIndexOf("_SEP_");
  if (sepIdx !== -1 && sepIdx < tokensAll.length - 1) {
    bodyTokens = tokensAll.slice(0, sepIdx);
    const dvTok = tokensAll[sepIdx + 1];
    dvChar = SPANISH_DIGIT_WORDS[dvTok] || dvTok.replace(/[^0-9kK]/g, "").toUpperCase();
  } else {
    bodyTokens = tokensAll.slice(0, -1);
    const lastTok = tokensAll[tokensAll.length - 1] || "";
    dvChar = SPANISH_DIGIT_WORDS[lastTok] || lastTok.replace(/[^0-9kK]/g, "").toUpperCase();
  }

  if (!/^[0-9K]$/.test(dvChar) || bodyTokens.length === 0) return null;

  let total = 0;
  let current = 0;
  for (const tok of bodyTokens) {
    if (tok === "y" || tok === "_SEP_") continue;
    if (tok === "millon" || tok === "millones") {
      total += (current || 1) * 1_000_000;
      current = 0;
    } else if (tok === "mil") {
      total += (current || 1) * 1_000;
      current = 0;
    } else if (/^\d+$/.test(tok)) {
      const n = parseInt(tok, 10);
      current = current > 0 && n < 100 && current % 10 === 0 ? current + n : current + n;
    } else if (SPANISH_DIGIT_WORDS[tok] && /^\d+$/.test(SPANISH_DIGIT_WORDS[tok])) {
      current += parseInt(SPANISH_DIGIT_WORDS[tok], 10);
    }
  }
  total += current;

  if (total < 1_000_000 || total > 99_999_999) return null;
  const candidate = `${total}-${dvChar}`;
  return validarRut(candidate) ? candidate : null;
}

/**
 * Normaliza un RUT chileno limpiando palabras habladas ("router", "rut", "raya", dígitos o montos en español)
 * y devuelve el formato estándar XXXXXXXX-X.
 */
export function normalizarRut(input: string): string {
  if (!input) return "";
  const text = input.trim();

  // 1. Descartar frases de horario explícitas para que números como "a las 10" no se mezclen con el RUT
  const textSinHoras = text
    .replace(/(?:a\s+las?|para\s+las?|a\s+la|las)\s+\d{1,2}(?::\d{2})?(?:\s+(?:de\s+la\s+)?(?:mañana|tarde|noche|am|pm))?/gi, " ")
    .replace(/\b(?:a\s+las?|para\s+las?)\s+(?:una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+(?:y\s+)?(?:media|cuarto|treinta))?/gi, " ");

  // 2. Coincidencia con formato de RUT estándar con puntos/guión (ej: 21.758.467-1)
  const regexNum = /\b(\d{1,2})[.\s]?(\d{3})[.\s]?(\d{3})[-‐‑–—\s]?([0-9kK])\b/i;
  const matchNum = textSinHoras.match(regexNum);
  if (matchNum) {
    const cuerpo = matchNum[1] + matchNum[2] + matchNum[3];
    const dv = matchNum[4].toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  // 3. RUTs de 7 dígitos (<10M, ej: 5.842.319-K)
  const regexNum7 = /\b(\d{1})[.\s]?(\d{3})[.\s]?(\d{3})[-‐‑–—\s]?([0-9kK])\b/i;
  const matchNum7 = textSinHoras.match(regexNum7);
  if (matchNum7) {
    const cuerpo = matchNum7[1] + matchNum7[2] + matchNum7[3];
    const dv = matchNum7[4].toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  // Búsqueda contextual: identificar mención de "rut", "router", "root", "lut", "cedula", "carnet"
  const rutMatches = [...textSinHoras.matchAll(/(?:rut|router|r\.u\.t|root|ruth|lud|lut|cedula|cédula|carnet)\s*(?:es|de|:)?\s*([^\n;]+)/gi)];
  let candidateSegment = "";
  for (const m of rutMatches) {
    if (/[0-9kK]/.test(m[1]) || /uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|cero|veinti|treinta|millon/i.test(m[1])) {
      candidateSegment = m[1];
      break;
    }
  }

  if (!candidateSegment) {
    candidateSegment = textSinHoras;
  }

  // 4.1 Intentar parseo compuesto en español ("veintiun millones ... guion uno")
  const compuesto = intentarParsearRutCompuestoHablado(candidateSegment);
  if (compuesto) return compuesto;

  // 5. Limpieza de separadores hablados y artefactos de STT dígito a dígito
  const cleaned = stripAccents(candidateSegment)
    .replace(/\b(?:guion|raya|menos|digito\s+verificador)\s+que\b/g, " K ")
    .replace(/guion|raya|menos|punto|coma/g, " ")
    .replace(/\b000\b/g, " ")
    .replace(/[.\s-]/g, " ");

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const converted = tokens.map((t) => SPANISH_DIGIT_WORDS[t] || t).join("");
  let onlyDigitsAndK = converted.replace(/[^0-9kK]/g, "");

  if (onlyDigitsAndK.length > 9 && /0{3,}/.test(onlyDigitsAndK)) {
    const candidate = onlyDigitsAndK.replace(/0{3,}/g, "");
    if (candidate.length >= 7 && candidate.length <= 9) {
      onlyDigitsAndK = candidate;
    }
  }

  // Si tiene > 9 caracteres, buscar primero subcadena válida por Módulo 11 (9, luego 8, luego 7)
  if (onlyDigitsAndK.length > 9) {
    for (const len of [9, 8, 7]) {
      for (let start = 0; start <= onlyDigitsAndK.length - len; start++) {
        const sub = onlyDigitsAndK.slice(start, start + len);
        const formatted = `${sub.slice(0, -1)}-${sub.slice(-1).toUpperCase()}`;
        if (validarRut(formatted)) return formatted;
      }
    }
    const tail = onlyDigitsAndK.slice(-9);
    return `${tail.slice(0, -1)}-${tail.slice(-1).toUpperCase()}`;
  }

  if (onlyDigitsAndK.length >= 7 && onlyDigitsAndK.length <= 9) {
    const cuerpo = onlyDigitsAndK.slice(0, -1);
    const dv = onlyDigitsAndK.slice(-1).toUpperCase();
    return `${cuerpo}-${dv}`;
  }

  return "";
}

/**
 * Extrae fragmentos numéricos de un RUT dictado por partes cuando Twilio corta por pausa
 * (ej: "Mi router es 21.758." -> "21758", "4671" -> "4671").
 */
export function extraerFragmentoNumericoRut(input: string, minDigits = 2): string {
  if (!input) return "";
  const sinHoras = input
    .replace(/(?:a\s+las?|para\s+las?|a\s+la|las)\s+\d{1,2}(?::\d{2})?(?:\s+(?:de\s+la\s+)?(?:mañana|tarde|noche|am|pm))?/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .trim();

  const rutMatch = sinHoras.match(/(?:rut|router|r\.u\.t|root|ruth|lud|lut|cedula|cédula|carnet)\s*(?:es|de|:)?\s*([^\n;]+)/i);
  const segmento = rutMatch ? rutMatch[1] : sinHoras;

  const tokens = stripAccents(segmento)
    .replace(/\b(?:guion|raya|menos|digito\s+verificador)\s+que\b/g, " K ")
    .replace(/guion|raya|menos|punto|coma/g, " ")
    .replace(/[.\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const soloDigitos = tokens
    .map((t) => SPANISH_DIGIT_WORDS[t] || (/^[\dkK]+$/.test(t) ? t : ""))
    .join("")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase();

  if (soloDigitos.length >= minDigits && soloDigitos.length <= 8) {
    return soloDigitos;
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

  // 2. Limpiar patrones genéricos o parciales de RUT (ej: 21.758.467-1, Mi router es 21.758, 4671)
  text = text.replace(/\b(?:rut|router|r\.u\.t|root|ruth|lud|lut)\s*[:\s]*[\w\s.-]{2,20}\b/gi, " ");
  text = text.replace(/\b\d{1,2}\.\d{3}(?:\.\d{3})?(?:[-kK0-9])?\b/g, " ");
  text = text.replace(/\b\d{4,9}[-kK]?\b/g, " ");
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
  const text = stripAccents(raw);

  if (
    text.includes("dental") ||
    text.includes("denta") ||
    text.includes("dentista") ||
    text.includes("diente") ||
    text.includes("odontol") ||
    text.includes("muela") ||
    /\bboca\b/.test(text)
  ) {
    return Especialidad.DENTAL;
  }

  if (
    text.includes("matrona") ||
    text.includes("matlona") ||
    text.includes("matron") ||
    text.includes("matloneria") ||
    text.includes("gineco") ||
    text.includes("obstet") ||
    text.includes("embarazo") ||
    /\bpap\b/.test(text)
  ) {
    return Especialidad.MATRONERIA;
  }

  if (
    text.includes("medicina") ||
    text.includes("general") ||
    text.includes("geneal") ||
    text.includes("genelal") ||
    text.includes("medico") ||
    text.includes("doctor") ||
    text.includes("doctora") ||
    text.includes("doctol") ||
    /\bconsulta\b/.test(text)
  ) {
    return Especialidad.MEDICINA_GENERAL;
  }

  return null;
}

export function detectarFranja(raw: string): IvrFranja | null {
  if (!raw) return null;
  const text = stripAccents(raw)
    .replace(/buenos?\s+dias?/g, " ")
    .replace(/buenas?\s+tardes?/g, " ")
    .replace(/buenas?\s+noches?/g, " ")
    .trim();

  if (/\b(?:media\s+manana|mediodia|medio\s+dia|mitad\s+de\s+manana)\b/.test(text)) {
    return "MEDIA_MANANA";
  }
  if (/\b(?:primera\s+disponible|plimera|lo\s+antes\s+posible|cualquier\s+hora|cualquiera|la\s+que\s+haya|mas\s+temprano|proxima)\b/.test(text)) {
    return "PRIMERA_DISPONIBLE";
  }
  if (/\b(?:manana|temprano|templano|primera\s+hora)\b/.test(text)) {
    return "MANANA";
  }
  if (/\b(?:tarde|taide|talde|despues\s+de\s+almuerzo)\b/.test(text)) {
    return "TARDE";
  }
  return null;
}

export function nombreFranjaLegible(franja: IvrFranja): string {
  switch (franja) {
    case "MANANA":
      return "mañana temprano";
    case "MEDIA_MANANA":
      return "media mañana";
    case "TARDE":
      return "la tarde";
    default:
      return "primera hora disponible";
  }
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

  // Bloques de demostración (distribuidos con horas disponibles antes y después de bloques ocupados)
  const slotConfigs = [
    { hora: "09:00", estado: EstadoBloque.RESERVADO, rut: "15492817-0", cuota: false },
    { hora: "09:30", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: true },
    { hora: "10:00", estado: EstadoBloque.RESERVADO, rut: "15492817-0", cuota: false },
    { hora: "10:30", estado: EstadoBloque.DISPONIBLE, rut: null, cuota: false },
    { hora: "11:00", estado: EstadoBloque.RESERVADO, rut: "15492817-0", cuota: false },
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
      paciente = await prisma.paciente.findFirst({ where: { rut: "5842319-K" } });
    } else if (lower.includes("ignacio") || lower.includes("morales")) {
      paciente = await prisma.paciente.findFirst({ where: { rut: "21758467-1" } });
    } else if (lower.includes("matías") || lower.includes("matias") || lower.includes("rojas")) {
      paciente = await prisma.paciente.findFirst({ where: { rut: "16842915-0" } });
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

export function perteneceAFranja(horaMin: number, franja: IvrFranja): boolean {
  switch (franja) {
    case "MANANA":
      return horaMin >= 480 && horaMin <= 620; // 08:00 - 10:20
    case "MEDIA_MANANA":
      return horaMin >= 640 && horaMin <= 760; // 10:40 - 12:40
    case "TARDE":
      return horaMin >= 840 && horaMin <= 1020; // 14:00 - 17:00
    case "PRIMERA_DISPONIBLE":
    default:
      return true;
  }
}

async function buscarCitaActivaHoy(pacienteId: string, especialidad: Especialidad) {
  const { startOfDay, endOfDay } = getStartAndEndOfToday();
  return prisma.cita.findFirst({
    where: {
      paciente_id: pacienteId,
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
}

async function cargarBloquesHoyEspecialidad(especialidad: Especialidad) {
  const { startOfDay, endOfDay } = getStartAndEndOfToday();
  await ensureTodayAgendaExists(especialidad);
  return prisma.bloqueHorario.findMany({
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
      citas: {
        where: { estado_cita: { in: [EstadoCita.AGENDADA, EstadoCita.ATENDIDA] } },
      },
    },
    orderBy: {
      hora_inicio: "asc",
    },
  });
}

function esBloqueElegiblePaciente(
  b: Awaited<ReturnType<typeof cargarBloquesHoyEspecialidad>>[0],
  esMayor: boolean
): boolean {
  if (b.estado_bloque !== EstadoBloque.DISPONIBLE || b.citas.length > 0) return false;
  if (b.es_cuota_adulto_mayor && !esMayor) {
    const msRestantes = new Date(b.hora_inicio).getTime() - Date.now();
    if (msRestantes > 30 * 60 * 1000) return false;
  }
  return true;
}

function construirResultadoCitaDuplicada(params: {
  citaExistente: NonNullable<Awaited<ReturnType<typeof buscarCitaActivaHoy>>>;
  paciente: NonNullable<Awaited<ReturnType<typeof buscarPacienteEnPadron>>>;
  especialidad: Especialidad;
  elegibles: Awaited<ReturnType<typeof cargarBloquesHoyEspecialidad>>;
  horaSolicitadaNorm?: string;
}): VerificarOAgendarResult {
  const { citaExistente, paciente, especialidad, elegibles, horaSolicitadaNorm } = params;
  const nombreEsp = nombreEspecialidadLegible(especialidad);
  const horaExistente = formatHora(citaExistente.bloque.hora_inicio);
  const profNombre = `Dr(a). ${citaExistente.profesional.nombres} ${citaExistente.profesional.apellidos}`;
  const bloqueReagendar =
    (horaSolicitadaNorm && elegibles.find((b) => formatHora(b.hora_inicio) === horaSolicitadaNorm)) ||
    elegibles[0];

  return {
    status: "CITA_DUPLICADA",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    horaExistente,
    citaExistenteId: citaExistente.id,
    bloqueReagendarId: bloqueReagendar?.id,
    horaReagendar: bloqueReagendar ? formatHora(bloqueReagendar.hora_inicio) : undefined,
    profesionalNombre: profNombre,
    especialidad,
    especialidadNombre: nombreEsp,
    codigoReserva: citaExistente.codigo_reserva,
    message: `Ya cuentas con una cita agendada para hoy a las ${horaExistente} en ${nombreEsp} con ${profNombre}.`,
  };
}

export interface FranjaOpcionesResult {
  status: "OK" | "NO_INSCRITO" | "CITA_DUPLICADA" | "SIN_DISPONIBILIDAD";
  rut: string;
  pacienteNombre?: string;
  esAdultoMayor?: boolean;
  especialidad: Especialidad;
  especialidadNombre: string;
  franja: IvrFranja;
  franjaNombre: string;
  opciones: IvrFranjaOption[];
  otrasFranjasDisponibles: IvrFranja[];
  duplicada?: VerificarOAgendarResult;
}

/**
 * Obtiene hasta 4 horarios disponibles en la franja solicitada (Mañana temprano,
 * Media mañana, Tarde o Primera disponible), respetando Padrón, Cita Única y Cuota 60+.
 */
export async function obtenerOpcionesPorFranjaPorVoz(
  rutInput: string,
  especialidadInput: Especialidad | null | undefined,
  franja: IvrFranja
): Promise<FranjaOpcionesResult> {
  const especialidad = especialidadInput || Especialidad.MEDICINA_GENERAL;
  const nombreEsp = nombreEspecialidadLegible(especialidad);
  const franjaNombre = nombreFranjaLegible(franja);

  const paciente = await buscarPacienteEnPadron(rutInput);
  if (!paciente) {
    return {
      status: "NO_INSCRITO",
      rut: normalizarRut(rutInput) || rutInput,
      especialidad,
      especialidadNombre: nombreEsp,
      franja,
      franjaNombre,
      opciones: [],
      otrasFranjasDisponibles: [],
    };
  }

  const [citaExistente, bloques] = await Promise.all([
    buscarCitaActivaHoy(paciente.id, especialidad),
    cargarBloquesHoyEspecialidad(especialidad),
  ]);

  const elegibles = bloques.filter((b) => esBloqueElegiblePaciente(b, paciente.es_adulto_mayor));

  if (citaExistente) {
    const enFranja = elegibles.filter((b) =>
      perteneceAFranja(timeToMinutes(formatHora(b.hora_inicio)), franja)
    );
    const preferida = enFranja[0] ? formatHora(enFranja[0].hora_inicio) : undefined;
    return {
      status: "CITA_DUPLICADA",
      rut: paciente.rut,
      pacienteNombre: paciente.nombres,
      esAdultoMayor: paciente.es_adulto_mayor,
      especialidad,
      especialidadNombre: nombreEsp,
      franja,
      franjaNombre,
      opciones: [],
      otrasFranjasDisponibles: [],
      duplicada: construirResultadoCitaDuplicada({
        citaExistente,
        paciente,
        especialidad,
        elegibles,
        horaSolicitadaNorm: preferida,
      }),
    };
  }

  const enFranja = elegibles.filter((b) =>
    perteneceAFranja(timeToMinutes(formatHora(b.hora_inicio)), franja)
  );

  // Deduplicar por HH:mm para ofrecer horarios distintos
  const vistos = new Set<string>();
  const opciones: IvrFranjaOption[] = [];
  for (const b of enFranja) {
    const hora = formatHora(b.hora_inicio);
    if (vistos.has(hora)) continue;
    vistos.add(hora);
    opciones.push({
      bloqueId: b.id,
      hora,
      profesionalNombre: `Dr(a). ${b.agenda.profesional.nombres} ${b.agenda.profesional.apellidos}`,
      boxNumero: b.agenda.box?.numero || "Box 101",
    });
    if (opciones.length >= 4) break;
  }

  const otrasFranjasDisponibles: IvrFranja[] = [];
  if (opciones.length === 0 && elegibles.length > 0) {
    for (const f of ["MANANA", "MEDIA_MANANA", "TARDE"] as IvrFranja[]) {
      if (
        f !== franja &&
        elegibles.some((b) => perteneceAFranja(timeToMinutes(formatHora(b.hora_inicio)), f))
      ) {
        otrasFranjasDisponibles.push(f);
      }
    }
  }

  return {
    status: opciones.length > 0 ? "OK" : "SIN_DISPONIBILIDAD",
    rut: paciente.rut,
    pacienteNombre: paciente.nombres,
    esAdultoMayor: paciente.es_adulto_mayor,
    especialidad,
    especialidadNombre: nombreEsp,
    franja,
    franjaNombre,
    opciones,
    otrasFranjasDisponibles,
  };
}

async function despacharSmsSiLlamadaReal(
  smsId: string,
  telefonoDestino: string,
  cuerpoMensaje: string,
  estadoFallback: string,
  contexto?: IvrCallSmsContext
): Promise<boolean> {
  const res = await enviarSmsTicketTwilio({
    callSid: contexto?.callSid,
    telefonoDestino,
    cuerpoMensaje,
    estadoFallback,
  });

  if (res.attempted && res.estadoEnvio !== estadoFallback) {
    try {
      await prisma.registroSms.update({
        where: { id: smsId },
        data: { estado_envio: res.estadoEnvio },
      });
    } catch (err) {
      console.warn("[RegistroSms] No se pudo actualizar estado de envío Twilio:", err);
    }
  }

  return res.sent;
}

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
  especialidadInput?: Especialidad | null,
  contextoLlamada?: IvrCallSmsContext
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

  // 2. REGLA DE CITA DUPLICADA: Solo 1 cita activa por especialidad al día
  const citaExistente = await buscarCitaActivaHoy(paciente.id, especialidad);

  if (citaExistente) {
    const bloquesHoy = await cargarBloquesHoyEspecialidad(especialidad);
    const horaSolicitadaNorm = horaInput ? normalizarHora(horaInput, paciente.rut) || horaInput : undefined;
    const elegibles = bloquesHoy.filter((b) => esBloqueElegiblePaciente(b, paciente.es_adulto_mayor));

    return construirResultadoCitaDuplicada({
      citaExistente,
      paciente,
      especialidad,
      elegibles,
      horaSolicitadaNorm,
    });
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

  // 4. Consultar bloques de hoy para la especialidad
  const bloques = await cargarBloquesHoyEspecialidad(especialidad);

  // Filtrar disponibilidad considerando cuota adulto mayor
  const targetSlot = bloques.find((b) => formatHora(b.hora_inicio) === horaDeseada);
  const esBloqueValidoParaPaciente = (b: typeof bloques[0]) =>
    esBloqueElegiblePaciente(b, paciente.es_adulto_mayor);

  // CASO A: El bloque exacto existe y está DISPONIBLE
  if (targetSlot && esBloqueValidoParaPaciente(targetSlot)) {
    const profesional = targetSlot.agenda.profesional;
    const profesionalNombre = `Dr(a). ${profesional.nombres} ${profesional.apellidos}`;
    const codigoReserva = generarCodigoReserva();
    const boxRaw = targetSlot.agenda.box?.numero || "Box 101";
    const boxNumero = boxRaw.split("-")[0].trim();
    const telefonoDestino =
      contextoLlamada?.telefonoLlamada ||
      paciente.telefono ||
      process.env.DEFAULT_TO_NUMBER ||
      "+56900000000";

    const smsReg = await prisma.$transaction(async (tx) => {
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

      // 3. Crear Registro SMS GSM-7 <= 160 chars
      const fechaStr = targetSlot.agenda.fecha.toISOString().split("T")[0];
      const cuerpoSms = construirSmsConfirmacion({
        codigoReserva,
        especialidad: targetSlot.agenda.especialidad,
        fechaStr,
        horaStr: horaDeseada,
        boxNumero: boxRaw,
        profesionalNombre,
      });
      return tx.registroSms.create({
        data: {
          cita_id: cita.id,
          telefono_destino: telefonoDestino,
          cuerpo_mensaje: cuerpoSms,
          longitud_caracteres: cuerpoSms.length,
          estado_envio: "CONFIRMADO_IVR",
        },
      });
    });

    const smsEnviadoTwilio = await despacharSmsSiLlamadaReal(
      smsReg.id,
      telefonoDestino,
      smsReg.cuerpo_mensaje,
      "CONFIRMADO_IVR",
      contextoLlamada
    );

    return {
      status: "AGENDADO",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      horaConfirmada: formatHora(targetSlot.hora_inicio),
      profesionalNombre,
      especialidad,
      especialidadNombre: nombreEsp,
      boxNumero,
      codigoReserva,
      smsEnviadoTwilio,
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

  // Calcular alternativa más cercana ANTES, DESPUÉS y global
  const targetMinutes = timeToMinutes(horaDeseada);
  const bloquesAntes = bloquesDisponibles.filter(
    (b) => timeToMinutes(formatHora(b.hora_inicio)) < targetMinutes
  );
  const bloquesDespues = bloquesDisponibles.filter(
    (b) => timeToMinutes(formatHora(b.hora_inicio)) > targetMinutes
  );

  const bloqueAntes = bloquesAntes.length > 0 ? bloquesAntes[bloquesAntes.length - 1] : undefined;
  const bloqueDespues = bloquesDespues.length > 0 ? bloquesDespues[0] : undefined;

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
    horaSugeridaAntes: bloqueAntes ? formatHora(bloqueAntes.hora_inicio) : undefined,
    bloqueSugeridoAntesId: bloqueAntes?.id,
    horaSugeridaDespues: bloqueDespues ? formatHora(bloqueDespues.hora_inicio) : undefined,
    bloqueSugeridoDespuesId: bloqueDespues?.id,
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
  rutInput: string,
  contextoLlamada?: IvrCallSmsContext
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
  const boxRaw = bloque.agenda.box?.numero || "Box 101";
  const boxNumero = boxRaw.split("-")[0].trim();
  const telefonoDestino =
    contextoLlamada?.telefonoLlamada ||
    paciente.telefono ||
    process.env.DEFAULT_TO_NUMBER ||
    "+56900000000";

  // Transacción atómica
  const smsReg = await prisma.$transaction(async (tx) => {
    // 1. Pasar bloque a RESERVADO con guard atómico
    const locked = await tx.bloqueHorario.updateMany({
      where: { id: bloque.id, estado_bloque: EstadoBloque.DISPONIBLE },
      data: {
        estado_bloque: EstadoBloque.RESERVADO,
        bloqueado_por_rut: paciente.rut,
      },
    });
    if (locked.count === 0) {
      throw new Error("El bloque horario sugerido acaba de ser reservado por otro canal.");
    }

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

    // 3. Crear Registro SMS GSM-7 <= 160 chars
    const fechaStr = bloque.agenda.fecha.toISOString().split("T")[0];
    const cuerpoSms = construirSmsConfirmacion({
      codigoReserva,
      especialidad: bloque.agenda.especialidad,
      fechaStr,
      horaStr: horaConfirmada,
      boxNumero: boxRaw,
      profesionalNombre,
    });
    return tx.registroSms.create({
      data: {
        cita_id: cita.id,
        telefono_destino: telefonoDestino,
        cuerpo_mensaje: cuerpoSms,
        longitud_caracteres: cuerpoSms.length,
        estado_envio: "CONFIRMADO_IVR",
      },
    });
  });

  const smsEnviadoTwilio = await despacharSmsSiLlamadaReal(
    smsReg.id,
    telefonoDestino,
    smsReg.cuerpo_mensaje,
    "CONFIRMADO_IVR",
    contextoLlamada
  );

  return {
    status: "AGENDADO",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    horaConfirmada,
    profesionalNombre,
    especialidad: bloque.agenda.especialidad,
    especialidadNombre: nombreEsp,
    boxNumero,
    codigoReserva,
    smsEnviadoTwilio,
  };
}

/**
 * Cancela la cita activa anterior (CANCELADA_OPORTUNA + libera bloque)
 * y agenda en el nuevo bloque horario dentro de una única transacción atómica.
 */
export async function reagendarCancelandoAnteriorPorVoz(
  citaAnteriorId: string,
  bloqueNuevoId: string,
  rutInput: string,
  contextoLlamada?: IvrCallSmsContext
): Promise<VerificarOAgendarResult> {
  const paciente = await buscarPacienteEnPadron(rutInput);
  if (!paciente) {
    throw new Error("El paciente no se encuentra inscrito en el padrón.");
  }

  const citaAnterior = await prisma.cita.findUnique({
    where: { id: citaAnteriorId },
    include: { bloque: true },
  });

  if (!citaAnterior || citaAnterior.estado_cita !== EstadoCita.AGENDADA) {
    throw new Error("La cita anterior ya no está activa para reagendar.");
  }

  const bloqueNuevo = await prisma.bloqueHorario.findUnique({
    where: { id: bloqueNuevoId },
    include: {
      agenda: {
        include: {
          profesional: true,
          box: true,
        },
      },
    },
  });

  if (!bloqueNuevo || bloqueNuevo.estado_bloque !== EstadoBloque.DISPONIBLE) {
    throw new Error("El nuevo bloque horario ya no está disponible.");
  }

  const nombreEsp = nombreEspecialidadLegible(bloqueNuevo.agenda.especialidad);
  const horaExistente = formatHora(citaAnterior.bloque.hora_inicio);
  const horaConfirmada = formatHora(bloqueNuevo.hora_inicio);
  const profesional = bloqueNuevo.agenda.profesional;
  const profesionalNombre = `Dr(a). ${profesional.nombres} ${profesional.apellidos}`;
  const codigoReserva = generarCodigoReserva();
  const boxRaw = bloqueNuevo.agenda.box?.numero || "Box 101";
  const boxNumero = boxRaw.split("-")[0].trim();
  const telefonoDestino =
    contextoLlamada?.telefonoLlamada ||
    paciente.telefono ||
    process.env.DEFAULT_TO_NUMBER ||
    "+56900000000";

  const smsReg = await prisma.$transaction(async (tx) => {
    // 1. Marcar cita anterior como CANCELADA_OPORTUNA y liberar su bloque
    await tx.cita.update({
      where: { id: citaAnterior.id },
      data: { estado_cita: EstadoCita.CANCELADA_OPORTUNA },
    });
    await tx.bloqueHorario.update({
      where: { id: citaAnterior.bloque_id },
      data: {
        estado_bloque: EstadoBloque.DISPONIBLE,
        bloqueado_hasta: null,
        bloqueado_por_rut: null,
      },
    });

    // 2. Reservar nuevo bloque y crear cita VOZ_IVR
    await tx.bloqueHorario.update({
      where: { id: bloqueNuevo.id },
      data: {
        estado_bloque: EstadoBloque.RESERVADO,
        bloqueado_por_rut: paciente.rut,
      },
    });
    const nuevaCita = await tx.cita.create({
      data: {
        codigo_reserva: codigoReserva,
        paciente_id: paciente.id,
        profesional_id: bloqueNuevo.agenda.profesional_id,
        bloque_id: bloqueNuevo.id,
        especialidad: bloqueNuevo.agenda.especialidad,
        estado_cita: EstadoCita.AGENDADA,
        canal_origen: CanalOrigen.VOZ_IVR,
        hora_atencion: bloqueNuevo.hora_inicio,
      },
    });

    const fechaStr = bloqueNuevo.agenda.fecha.toISOString().split("T")[0];
    const cuerpoSms = construirSmsConfirmacion({
      codigoReserva,
      especialidad: bloqueNuevo.agenda.especialidad,
      fechaStr,
      horaStr: horaConfirmada,
      boxNumero: boxRaw,
      profesionalNombre,
    });
    return tx.registroSms.create({
      data: {
        cita_id: nuevaCita.id,
        telefono_destino: telefonoDestino,
        cuerpo_mensaje: cuerpoSms,
        longitud_caracteres: cuerpoSms.length,
        estado_envio: "CONFIRMADO_REAGENDAMIENTO_IVR",
      },
    });
  });

  const smsEnviadoTwilio = await despacharSmsSiLlamadaReal(
    smsReg.id,
    telefonoDestino,
    smsReg.cuerpo_mensaje,
    "CONFIRMADO_REAGENDAMIENTO_IVR",
    contextoLlamada
  );

  return {
    status: "AGENDADO",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    horaExistente,
    horaConfirmada,
    profesionalNombre,
    especialidad: bloqueNuevo.agenda.especialidad,
    especialidadNombre: nombreEsp,
    boxNumero,
    codigoReserva,
    smsEnviadoTwilio,
  };
}

/**
 * Cancela oportunamente (>= 30 minutos antes) la cita activa del paciente por voz,
 * libera el bloque a DISPONIBLE y registra el SMS de confirmación GSM-7.
 */
export async function cancelarCitaActivaPorVoz(
  rutInput: string,
  especialidad?: Especialidad,
  contextoLlamada?: IvrCallSmsContext
): Promise<VerificarOAgendarResult> {
  const paciente = await buscarPacienteEnPadron(rutInput);
  if (!paciente) {
    return {
      status: "NO_INSCRITO",
      rut: normalizarRut(rutInput) || rutInput,
      message: "El RUT indicado no se encuentra inscrito en el padrón del CESFAM.",
    };
  }

  const { startOfDay } = getStartAndEndOfToday();
  const ahora = new Date();
  const includeCancel = {
    bloque: {
      include: { agenda: true },
    },
    profesional: true,
  };

  let cita = await prisma.cita.findFirst({
    where: {
      paciente_id: paciente.id,
      estado_cita: EstadoCita.AGENDADA,
      ...(especialidad ? { especialidad } : {}),
      bloque: {
        hora_inicio: { gte: ahora },
      },
    },
    include: includeCancel,
    orderBy: {
      bloque: { hora_inicio: "asc" },
    },
  });

  if (!cita) {
    cita = await prisma.cita.findFirst({
      where: {
        paciente_id: paciente.id,
        estado_cita: EstadoCita.AGENDADA,
        ...(especialidad ? { especialidad } : {}),
        bloque: {
          hora_inicio: { gte: startOfDay },
        },
      },
      include: includeCancel,
      orderBy: {
        bloque: { hora_inicio: "desc" },
      },
    });
  }

  if (!cita) {
    return {
      status: "SIN_DISPONIBILIDAD",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      message: "No registramos citas médicas activas pendientes para su RUT.",
    };
  }

  const nombreEsp = nombreEspecialidadLegible(cita.especialidad);
  const horaExistente = formatHora(cita.bloque.hora_inicio);
  const msRestantes = new Date(cita.bloque.hora_inicio).getTime() - Date.now();

  if (msRestantes < 30 * 60 * 1000) {
    return {
      status: "CANCELACION_EXPIRADA",
      pacienteNombre: paciente.nombres,
      rut: paciente.rut,
      esAdultoMayor: paciente.es_adulto_mayor,
      especialidad: cita.especialidad,
      especialidadNombre: nombreEsp,
      horaExistente,
      codigoReserva: cita.codigo_reserva,
      message: `No es posible anular la cita de las ${horaExistente} automáticamente porque faltan menos de 30 minutos. Debe comunicarse con ventanilla SOME.`,
    };
  }

  const fechaStr = cita.bloque.agenda.fecha.toISOString().split("T")[0];
  const cuerpoSms = construirSmsCancelacion({
    codigoReserva: cita.codigo_reserva,
    especialidad: cita.especialidad,
    fechaStr,
    horaStr: horaExistente,
  });
  const telefonoDestino =
    contextoLlamada?.telefonoLlamada ||
    paciente.telefono ||
    process.env.DEFAULT_TO_NUMBER ||
    "+56900000000";

  const [, , smsReg] = await prisma.$transaction([
    prisma.cita.update({
      where: { id: cita.id },
      data: { estado_cita: EstadoCita.CANCELADA_OPORTUNA },
    }),
    prisma.bloqueHorario.update({
      where: { id: cita.bloque_id },
      data: {
        estado_bloque: EstadoBloque.DISPONIBLE,
        bloqueado_hasta: null,
        bloqueado_por_rut: null,
      },
    }),
    prisma.registroSms.create({
      data: {
        cita_id: cita.id,
        telefono_destino: telefonoDestino,
        cuerpo_mensaje: cuerpoSms,
        longitud_caracteres: cuerpoSms.length,
        estado_envio: "CANCELACION_IVR",
      },
    }),
  ]);

  const smsEnviadoTwilio = await despacharSmsSiLlamadaReal(
    smsReg.id,
    telefonoDestino,
    cuerpoSms,
    "CANCELACION_IVR",
    contextoLlamada
  );

  return {
    status: "CANCELADO",
    pacienteNombre: paciente.nombres,
    rut: paciente.rut,
    esAdultoMayor: paciente.es_adulto_mayor,
    especialidad: cita.especialidad,
    especialidadNombre: nombreEsp,
    horaExistente,
    codigoReserva: cita.codigo_reserva,
    smsEnviadoTwilio,
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
      citas: {
        where: { estado_cita: EstadoCita.AGENDADA },
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
    const citaActiva = b.citas[0] || null;
    const pacName = citaActiva?.paciente
      ? `${citaActiva.paciente.nombres} ${citaActiva.paciente.apellidos}`
      : null;

    return {
      id: b.id,
      hora,
      estado: b.estado_bloque,
      rut: b.bloqueado_por_rut || citaActiva?.paciente?.rut || null,
      pacienteNombre: pacName,
      profesionalNombre: profName,
      especialidad: b.agenda.especialidad,
      boxNumero: b.agenda.box?.numero || null,
      codigoReserva: citaActiva?.codigo_reserva || null,
      canalOrigen: citaActiva?.canal_origen || null,
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

  // 1. Eliminar Citas con canal_origen VOZ_IVR de hoy (conservando citas demo MS-BOX de Box Clínico)
  const citasIvr = await prisma.cita.findMany({
    where: {
      canal_origen: CanalOrigen.VOZ_IVR,
      created_at: { gte: startOfDay, lte: endOfDay },
      NOT: { codigo_reserva: { startsWith: "MS-BOX" } },
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

  // 2. Restablecer bloques de demostración de hoy (sin tocar citas activas de Portal Web / Box Clínico / Ventanilla)
  const bloques = await prisma.bloqueHorario.findMany({
    where: {
      hora_inicio: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      citas: {
        where: { estado_cita: EstadoCita.AGENDADA },
      },
    },
  });

  for (const b of bloques) {
    if (b.citas.length > 0) continue;
    const hora = formatHora(b.hora_inicio);
    if (hora === "09:00" || hora === "10:00" || hora === "11:00") {
      await prisma.bloqueHorario.update({
        where: { id: b.id },
        data: {
          estado_bloque: EstadoBloque.RESERVADO,
          bloqueado_por_rut: "15492817-0",
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
