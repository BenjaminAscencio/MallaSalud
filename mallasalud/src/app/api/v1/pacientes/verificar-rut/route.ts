import { NextRequest, NextResponse } from "next/server";
import {
  verificarPacientePorRut,
  RutInvalidoError,
  PacienteNotFoundError,
} from "@/lib/services/pacientes.service";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 60;

declare global {
  // eslint-disable-next-line no-var
  var __VERIFICAR_RUT_RATE__: Map<string, { count: number; resetAt: number }> | undefined;
}

function checkRateLimit(ip: string): boolean {
  if (!globalThis.__VERIFICAR_RUT_RATE__) {
    globalThis.__VERIFICAR_RUT_RATE__ = new Map();
  }
  const map = globalThis.__VERIFICAR_RUT_RATE__;
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || entry.resetAt <= now) {
    map.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQ) {
    return false;
  }

  entry.count += 1;
  return true;
}

/**
 * POST /api/v1/pacientes/verificar-rut
 * HU-001: Valida el RUT del paciente según Módulo 11 y verifica su inscripción en el CESFAM.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes de verificación. Intente nuevamente en un minuto." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { rut } = body;

    if (!rut || typeof rut !== "string") {
      return NextResponse.json(
        { error: "Debe ingresar un RUT para realizar la verificación." },
        { status: 400 }
      );
    }

    const resultado = await verificarPacientePorRut(rut);

    return NextResponse.json(
      {
        valido: true,
        paciente: resultado,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof RutInvalidoError) {
      return NextResponse.json(
        {
          error: "RUT inválido",
          mensaje: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof PacienteNotFoundError) {
      return NextResponse.json(
        {
          error: "Paciente no inscrito",
          mensaje: error.message,
          acudir_some: true,
        },
        { status: 404 }
      );
    }

    console.error("Error inesperado en verificar-rut:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
