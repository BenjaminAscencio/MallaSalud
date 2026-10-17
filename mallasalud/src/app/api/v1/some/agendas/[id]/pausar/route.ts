import { NextRequest, NextResponse } from "next/server";
import { pausarAgenda, AgendaValidationError } from "@/lib/services/agendas.service";

/**
 * PUT /api/v1/some/agendas/[id]/pausar
 * HU-005: Pausa una agenda activa, bloqueando los cupos disponibles y alertando sobre citas reservadas.
 */
export async function PUT(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Debe proporcionar el ID de la agenda." },
        { status: 400 }
      );
    }

    const resultado = await pausarAgenda(id);

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AgendaValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    console.error("Error al pausar agenda:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al pausar la agenda." },
      { status: 500 }
    );
  }
}
