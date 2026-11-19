import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/core/authServer";
import { obtenerCitasHoyBox, BoxError } from "@/lib/web/services/box.service";

/**
 * GET /api/v1/box/citas-hoy
 * HU-007: Lista la nómina operativa del día exclusivamente para el profesional autenticado.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["PROFESIONAL"]);
  if (auth.errorResponse) return auth.errorResponse;

  if (!auth.session.profesionalId) {
    return NextResponse.json(
      { error: "Su cuenta no está vinculada a un profesional de box clínico." },
      { status: 403 }
    );
  }

  try {
    const data = await obtenerCitasHoyBox(auth.session.profesionalId);
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof BoxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/box/citas-hoy:", error);
    return NextResponse.json(
      { error: "Error interno al recuperar citas del box clínico." },
      { status: 500 }
    );
  }
}
