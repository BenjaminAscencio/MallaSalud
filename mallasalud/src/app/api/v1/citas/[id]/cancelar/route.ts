import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { EstadoBloque, EstadoCita } from "@prisma/client";

/**
 * POST /api/v1/citas/[id]/cancelar
 * HU-001 / HU-002: Cancelación oportuna de cita médica desde el portal del paciente o ventanilla.
 * Libera el bloque horario inmediatamente con estado DISPONIBLE y marca la cita como CANCELADA_OPORTUNA.
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Debe especificar el identificador de la cita." },
        { status: 400 }
      );
    }

    const cita = await prisma.cita.findUnique({
      where: { id },
      include: { bloque: true, paciente: true },
    });

    if (!cita) {
      return NextResponse.json(
        { error: "La cita indicada no fue encontrada en el sistema." },
        { status: 404 }
      );
    }

    if (cita.estado_cita !== EstadoCita.AGENDADA) {
      return NextResponse.json(
        {
          error: `No es posible anular la cita porque su estado actual es ${cita.estado_cita}.`,
        },
        { status: 400 }
      );
    }

    // Ejecución atómica de cancelación oportuna y liberación de cupo
    const [citaActualizada] = await prisma.$transaction([
      prisma.cita.update({
        where: { id: cita.id },
        data: {
          estado_cita: EstadoCita.CANCELADA_OPORTUNA,
        },
      }),
      prisma.bloqueHorario.update({
        where: { id: cita.bloque_id },
        data: {
          estado_bloque: EstadoBloque.DISPONIBLE,
          bloqueado_hasta: null,
          bloqueado_por_rut: null,
        },
      }),
    ]);

    return NextResponse.json(
      {
        mensaje: "Cita médica cancelada oportunamente. El cupo ha sido liberado para la comunidad sin registro de inasistencia.",
        cita: citaActualizada,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error al cancelar cita:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la cancelación." },
      { status: 500 }
    );
  }
}
