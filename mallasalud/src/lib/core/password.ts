// src/lib/core/password.ts
// Hashing seguro con scrypt (Node.js crypto nativo, sin dependencias externas).

import crypto from "crypto";

const KEY_LEN = 64;

/**
 * Genera un hash scrypt salteado en formato saltHex:derivedHex.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Verifica una contraseña contra su hash scrypt salteado en tiempo constante.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = (storedHash || "").split(":");
  if (!salt || !keyHex) return false;

  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, KEY_LEN);
  if (keyBuf.length !== derivedBuf.length) return false;

  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}
