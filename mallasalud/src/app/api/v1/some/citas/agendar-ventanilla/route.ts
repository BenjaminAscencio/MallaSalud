import { NextRequest, NextResponse } from "next/server";
import { agendarCitaVentanilla, VentanillaError } from "@/lib/services/ventanilla.service";

/**
 * POST /api/v1/some/citas/agendar-ventanilla
 * HU-006: Agendamiento presencial de cita médica en ventanilla SOME con emisión de comprobante y SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paciente_id, bloque_id } = body;

    if (!paciente_id || !bloque_id) {
      return NextResponse.json(
        {
          error: "Faltan parámetros obligatorios.",
          campos_requeridos: ["paciente_id", "bloque_id"],
        },
        { status: 400 }
      );
    }

    const resultado = await agendarCitaVentanilla({
      paciente_id,
      bloque_id,
    });

    return NextResponse.json(
      {
        mensaje: "Cita médica agendada exitosamente en ventanilla SOME.",
        ...resultado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof VentanillaError) {
      return NextResponse.json(
        {
          error: error.message,
          codigo_error: error.name,
        },
        { status: error.statusCode }
      );
    }

    console.error("Error al agendar cita en ventanilla SOME:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el agendamiento." },
      { status: 500 }
    );
  }
}
