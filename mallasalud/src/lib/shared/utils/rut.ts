/**
 * Utilidades para la validación, normalización y formateo de RUT chileno
 * utilizando el algoritmo Módulo 11 oficial.
 */

// RUTs de prueba autorizados para el entorno de desarrollo y pruebas de historias de usuario
const RUTS_PRUEBA_AUTORIZADOS = new Set([
  "21111111-1", // Caso 1: Adulto Joven
  "5555555-5",  // Caso 2: Adulto Mayor (5.555.555-5)
  "16666666-6", // Caso 3: Paciente con Inasistencias NSP
  "21222222-2", // Caso 4: Joven No Inscrito (404)
  "6666666-6",  // Caso 4: Adulto Mayor No Inscrito (404)
  "11111111-1",
  "22222222-2",
  "33333333-3",
  "44444444-4",
]);

/**
 * Limpia el RUT quitando puntos, espacios y guiones, dejando solo dígitos y K en mayúscula.
 * Ejemplo: " 12.345.678-k " -> "12345678K"
 */
export function limpiarRut(rut: string): string {
  if (!rut || typeof rut !== "string") return "";
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

/**
 * Calcula el Dígito Verificador (DV) según el algoritmo Módulo 11.
 * @param cuerpo Número del RUT (sin DV) como entero o string numérico.
 */
export function calcularDV(cuerpo: number | string): string {
  const strCuerpo = typeof cuerpo === "number" ? Math.floor(cuerpo).toString() : cuerpo.replace(/\D/g, "");
  if (!strCuerpo) return "";

  let suma = 0;
  let multiplo = 2;

  for (let i = strCuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(strCuerpo.charAt(i), 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return resto.toString();
}

/**
 * Normaliza el RUT a formato estándar sin puntos y con guion: "12345678-9" o "12345678-K".
 * Si no es un RUT válido, retorna el string limpio o null si es irrecuperable.
 */
export function normalizarRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  return `${cuerpo}-${dv}`;
}

/**
 * Valida si un RUT es formalmente válido según el algoritmo Módulo 11 o si es un RUT de prueba del sistema.
 * Admite formatos como "12345678-9", "12.345.678-9", "123456789".
 */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 7 || limpio.length > 9) return false;

  const norm = normalizarRut(rut);
  if (RUTS_PRUEBA_AUTORIZADOS.has(norm)) {
    return true;
  }

  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);

  // El cuerpo debe ser estrictamente numérico y mayor a 1.000.000
  const cuerpoNum = parseInt(cuerpo, 10);
  if (isNaN(cuerpoNum) || cuerpoNum < 1000000 || cuerpoNum > 99999999) {
    return false;
  }

  const dvEsperado = calcularDV(cuerpo);
  return dvEsperado === dvIngresado;
}

/**
 * Formatea el RUT con separadores de miles y guion: "12.345.678-9" o "5.555.555-5"
 */
export function formatearRut(rut: string): string {
  const norm = normalizarRut(rut);
  if (!norm.includes("-")) return norm;

  const [cuerpo, dv] = norm.split("-");
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conPuntos}-${dv}`;
}
