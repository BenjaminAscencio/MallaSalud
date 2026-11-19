import { NextRequest, NextResponse } from "next/server";
import { CanalOrigen } from "@prisma/client";
import { agendarCitaVentanilla, VentanillaError } from "@/lib/web/services/ventanilla.service";

/**
 * POST /api/v1/citas/confirmar
 * HU-002: Confirmación pública desde Portal Paciente con canal_origen = WEB.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { paciente_id, bloque_id } = body;

    if (!paciente_id || !bloque_id) {
      return NextResponse.json(
        {
          error: "Faltan parámetros obligatorios: paciente_id y bloque_id.",
        },
        { status: 400 }
      );
    }

    const resultado = await agendarCitaVentanilla({
      paciente_id: String(paciente_id),
      bloque_id: String(bloque_id),
      canal_origen: CanalOrigen.WEB,
    });

    return NextResponse.json(
      {
        mensaje: "Cita médica confirmada exitosamente vía Portal Web.",
        ...resultado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof VentanillaError) {
      return NextResponse.json(
        { error: error.message, mensaje: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en POST /api/v1/citas/confirmar:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al confirmar la cita." },
      { status: 500 }
    );
  }
}
