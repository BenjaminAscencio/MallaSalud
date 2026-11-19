// src/lib/core/authServer.ts
// Helpers de autenticación y autorización RBAC para Route Handlers del servidor.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SessionPayload,
  RolSistema,
  verifySessionToken,
} from "./sessionToken";

/**
 * Extrae y verifica la sesión desde una NextRequest o desde las cookies del request actual.
 */
export async function getSessionFromRequest(req?: NextRequest | Request): Promise<SessionPayload | null> {
  if (req && "cookies" in req && typeof req.cookies?.get === "function") {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    return verifySessionToken(token);
  }

  if (req) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      const value = decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
      return verifySessionToken(value);
    }
    return null;
  }

  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * Valida sesión activa y pertenencia a uno de los roles permitidos.
 * Retorna `{ session }` si es válido, o `{ errorResponse }` (401 / 403) en caso contrario.
 */
export async function requireRole(
  req: NextRequest | Request,
  allowedRoles: RolSistema[]
): Promise<{ session: SessionPayload; errorResponse?: never } | { session?: never; errorResponse: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: "No autenticado. Inicie sesión en el portal de funcionarios." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(session.rol)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Acceso denegado. Su rol no tiene permisos para esta operación." },
        { status: 403 }
      ),
    };
  }

  return { session };
}
