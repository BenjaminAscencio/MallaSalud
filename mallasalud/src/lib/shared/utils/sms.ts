// src/lib/shared/utils/sms.ts
// Normalización GSM-7 (sin tildes ni ñ, máximo 160 caracteres) para SMS transaccionales CESFAM.

const MAPA_ESPECIALIDAD_CORTO: Record<string, string> = {
  MEDICINA_GENERAL: "Med.Gen",
  DENTAL: "Dental",
  MATRONERIA: "Matron.",
};

/**
 * Normaliza un texto al alfabeto GSM-7 sin tildes, eñes ni emojis, truncado a <= 160 caracteres.
 */
export function normalizarGsm7(texto: string, maxLen = 160): string {
  const sinDiacriticos = (texto || "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Filtrar caracteres seguros ASCII imprimibles compatibles con GSM-7
  const limpio = sinDiacriticos
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (limpio.length <= maxLen) return limpio;
  return limpio.slice(0, maxLen).trimEnd();
}

export interface DatosSmsCita {
  codigoReserva: string;
  especialidad: string;
  fechaStr: string;
  horaStr: string;
  boxNumero: string;
  profesionalNombre?: string;
}

function formatearFechaCortaChile(fechaStr: string): string {
  const m = (fechaStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}`;
  return fechaStr;
}

/**
 * Construye SMS de confirmación GSM-7 <= 160 chars con ticket, hora, box y aviso de reagendamiento/anulación llamando.
 */
export function construirSmsConfirmacion(datos: DatosSmsCita): string {
  const espCorta = MAPA_ESPECIALIDAD_CORTO[datos.especialidad] || datos.especialidad.slice(0, 12);
  const fechaCorta = formatearFechaCortaChile(datos.fechaStr);
  const boxCorto = datos.boxNumero.split("-")[0].trim();

  const mensaje = `MallaSalud Ticket ${datos.codigoReserva}: ${espCorta} ${fechaCorta} ${datos.horaStr} ${boxCorto}. Para reagendar o anular (30m antes) llame al CESFAM o use web.`;
  return normalizarGsm7(mensaje, 160);
}

/**
 * Construye SMS de cancelación oportuna GSM-7 <= 160 chars.
 */
export function construirSmsCancelacion(datos: {
  codigoReserva: string;
  especialidad: string;
  fechaStr: string;
  horaStr: string;
}): string {
  const espCorta = MAPA_ESPECIALIDAD_CORTO[datos.especialidad] || datos.especialidad.slice(0, 12);
  const fechaCorta = formatearFechaCortaChile(datos.fechaStr);
  const mensaje = `MallaSalud: Cita ${espCorta} ${fechaCorta} ${datos.horaStr} (Ticket ${datos.codigoReserva}) anulada sin NSP. Cupo liberado. Para nueva hora llame al CESFAM.`;
  return normalizarGsm7(mensaje, 160);
}
