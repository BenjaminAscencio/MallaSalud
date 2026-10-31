import { limpiarRut } from "./rut";

/**
 * Utilidades para cálculo de edad y verificación de cuota preferente de Adulto Mayor,
 * incorporando coherencia demográfica chilena según el número correlativo del RUT.
 */

/**
 * Calcula la edad exacta en años cumplidos a partir de una fecha de nacimiento.
 */
export function calcularEdad(fechaNacimiento: Date | string): number {
  const fechaNac = typeof fechaNacimiento === "string" ? new Date(fechaNacimiento) : fechaNacimiento;
  if (isNaN(fechaNac.getTime())) {
    throw new Error("Fecha de nacimiento inválida");
  }

  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mesActual = hoy.getMonth();
  const mesNac = fechaNac.getMonth();

  if (mesActual < mesNac || (mesActual === mesNac && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }

  return Math.max(0, edad);
}

/**
 * Determina si el paciente clasifica como Adulto Mayor en el sistema de salud.
 * Criterios:
 * 1. Edad por fecha de nacimiento >= 60 años.
 * 2. O si se provee RUT, correlativo numérico <= 10.500.000 (10.5 millones o menos,
 *    que en Chile corresponde demográficamente a adultos mayores nacidos antes de 1965).
 */
export function esAdultoMayor(fechaNacimiento: Date | string, rut?: string): boolean {
  try {
    const edad = calcularEdad(fechaNacimiento);
    if (edad >= 60) return true;
  } catch {
    // Si la fecha es inválida, se evalúa exclusivamente por RUT si está presente
  }

  if (rut) {
    const limpio = limpiarRut(rut);
    if (limpio.length >= 2) {
      const cuerpo = parseInt(limpio.slice(0, -1), 10);
      if (!isNaN(cuerpo) && cuerpo > 0 && cuerpo <= 10500000) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Estima un año y fecha de nacimiento coherente según la serie de millones del RUT chileno:
 * - <= 9.9M (ej: 4M - 9M): Adultos Mayores nacidos entre 1945 y 1964 (60+ años).
 * - 10M - 15.9M: Adultos nacidos entre 1968 y 1984 (~40 a 58 años).
 * - 16M - 22M+: Adultos Jóvenes nacidos entre 1986 y 2005 (~20 a 39 años).
 */
export function estimarFechaNacimientoPorRut(rut: string): Date {
  const limpio = limpiarRut(rut);
  const cuerpo = parseInt(limpio.slice(0, -1), 10);

  let año = 1995;

  if (isNaN(cuerpo) || cuerpo <= 0) {
    año = 1990;
  } else if (cuerpo <= 3999999) {
    año = 1940;
  } else if (cuerpo <= 9999999) {
    // 4M a 10M -> 1945 a 1964
    const ratio = (cuerpo - 4000000) / 6000000;
    año = Math.round(1945 + ratio * 19);
  } else if (cuerpo <= 15999999) {
    // 10M a 16M -> 1968 a 1984
    const ratio = (cuerpo - 10000000) / 6000000;
    año = Math.round(1968 + ratio * 16);
  } else {
    // 16M a 24M -> 1986 a 2005
    const ratio = Math.min(1, Math.max(0, (cuerpo - 16000000) / 8000000));
    año = Math.round(1986 + ratio * 19);
  }

  return new Date(`${año}-05-15T00:00:00.000Z`);
}
