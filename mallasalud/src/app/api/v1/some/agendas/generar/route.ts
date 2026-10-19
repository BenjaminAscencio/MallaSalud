import { NextRequest, NextResponse } from "next/server";
import {
  generarAgendaConBloques,
  AgendaConflictError,
  AgendaValidationError,
} from "@/lib/services/agendas.service";
import { Especialidad } from "@prisma/client";

/**
 * POST /api/v1/some/agendas/generar
 * HU-005: Apertura y generación de bloques horarios para una agenda médica SOME.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      profesional_id,
      box_id,
      especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_bloque_min,
      porcentaje_cuota_mayor,
    } = body;

    // Validar parámetros obligatorios
    if (
      !profesional_id ||
      !box_id ||
      !especialidad ||
      !fecha ||
      !hora_inicio ||
      !hora_fin ||
      !duracion_bloque_min
    ) {
      return NextResponse.json(
        {
          error: "Faltan parámetros obligatorios.",
          campos_requeridos: [
            "profesional_id",
            "box_id",
            "especialidad",
            "fecha",
            "hora_inicio",
            "hora_fin",
            "duracion_bloque_min",
          ],
        },
        { status: 400 }
      );
    }

    if (!Object.values(Especialidad).includes(especialidad)) {
      return NextResponse.json(
        {
          error: "Especialidad inválida.",
          especialidades_permitidas: Object.values(Especialidad),
        },
        { status: 400 }
      );
    }

    const resultado = await generarAgendaConBloques({
      profesional_id,
      box_id,
      especialidad,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_bloque_min: Number(duracion_bloque_min),
      porcentaje_cuota_mayor:
        porcentaje_cuota_mayor !== undefined && porcentaje_cuota_mayor !== null
          ? Number(porcentaje_cuota_mayor)
          : undefined,
    });

    return NextResponse.json(
      {
        mensaje: "Agenda médica y bloques horarios generados exitosamente.",
        ...resultado,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AgendaConflictError) {
      return NextResponse.json(
        {
          error: "Conflicto de agenda",
          mensaje: error.message,
        },
        { status: 409 }
      );
    }

    if (error instanceof AgendaValidationError) {
      return NextResponse.json(
        {
          error: "Error de validación",
          mensaje: error.message,
        },
        { status: 400 }
      );
    }

    console.error("Error al generar agenda:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al generar agenda médica." },
      { status: 500 }
    );
  }
}
