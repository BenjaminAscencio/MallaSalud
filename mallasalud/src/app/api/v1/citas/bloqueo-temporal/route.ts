import { NextRequest, NextResponse } from "next/server";
import {
  adquirirBloqueoTemporal,
  liberarBloqueoTemporal,
  BloqueoError,
} from "@/lib/web/services/bloqueo.service";

/**
 * POST /api/v1/citas/bloqueo-temporal
 * HU-002: Adquiere una retención atómica temporal de 120 segundos sobre un cupo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bloque_id, rut } = body;

    const resultado = await adquirirBloqueoTemporal(String(bloque_id || ""), String(rut || ""));
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof BloqueoError) {
      return NextResponse.json(
        { error: error.message, mensaje: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en POST /api/v1/citas/bloqueo-temporal:", error);
    return NextResponse.json(
      { error: "Error interno al bloquear temporalmente el bloque horario." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/citas/bloqueo-temporal
 * Libera anticipadamente un bloqueo temporal retenido por el paciente.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const bloque_id = String(body.bloque_id || searchParams.get("bloque_id") || "");
    const rut = String(body.rut || searchParams.get("rut") || "");

    const res = await liberarBloqueoTemporal(bloque_id, rut);
    return NextResponse.json(res, { status: 200 });
  } catch (error) {
    console.error("Error en DELETE /api/v1/citas/bloqueo-temporal:", error);
    return NextResponse.json(
      { error: "Error al liberar bloqueo temporal." },
      { status: 500 }
    );
  }
}
