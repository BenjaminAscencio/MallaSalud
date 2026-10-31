import crypto from "crypto";

/**
 * Genera un código alfanumérico legible y único para comprobante de reserva.
 * Ejemplo: "MS-8K39X2"
 */
export function generarCodigoReserva(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Caracteres sin ambigüedades (sin 0, 1, I, O)
  const bytes = crypto.randomBytes(6);
  let result = "MS-";
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
