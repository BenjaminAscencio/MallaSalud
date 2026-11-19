// src/lib/core/sessionToken.ts
// Utilidad Edge-compatible (Web Crypto API) para firma y verificación de tokens de sesión RBAC.
// No importar módulos Node.js ni Prisma aquí para permitir su ejecución en src/middleware.ts.

export type RolSistema = "SOME" | "PROFESIONAL";

export interface SessionPayload {
  sub: string;
  rol: RolSistema;
  nombre: string;
  email: string;
  rut: string;
  profesionalId: string | null;
  exp: number;
}

export const SESSION_COOKIE_NAME = "mallasalud_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

function getSecret(): string {
  return process.env.SESSION_SECRET || "mallasalud-cesfam-capstone-2026-hmac-secret";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const padLen = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function stringToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

function base64UrlToString(b64: string): string {
  return new TextDecoder().decode(base64UrlToBytes(b64));
}

async function importHmacKey(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(getSecret());
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Firma un payload de sesión con HMAC-SHA256 usando Web Crypto API.
 */
export async function signSessionToken(
  payload: Omit<SessionPayload, "exp">,
  ttlSeconds = SESSION_TTL_SECONDS
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = stringToBase64Url(JSON.stringify(fullPayload));
  const key = await importHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );
  const encodedSig = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${encodedPayload}.${encodedSig}`;
}

/**
 * Verifica firma HMAC-SHA256 y expiración de un token de sesión.
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  try {
    const key = await importHmacKey();
    const expectedBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload)
    );
    const expectedSig = bytesToBase64Url(new Uint8Array(expectedBuffer));
    if (!constantTimeEquals(expectedSig, encodedSig)) return null;

    const parsed = JSON.parse(base64UrlToString(encodedPayload)) as SessionPayload;
    if (!parsed || !parsed.sub || !parsed.rol || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

    return parsed;
  } catch {
    return null;
  }
}
