import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { EstadoBloque, EstadoCita } from "@prisma/client";
import { construirSmsCancelacion } from "@/lib/utils/sms";

export const MINUTOS_ANTICIPACION_CANCELACION = 30;

/**
 * POST /api/v1/citas/[id]/cancelar
 * HU-008: Cancelación oportuna (>= 30 minutos antes) desde el portal del paciente o ventanilla.
 * Valida ventana temporal, libera el bloque horario a DISPONIBLE, marca CANCELADA_OPORTUNA y registra SMS GSM-7.
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
      include: {
        bloque: {
          include: {
            agenda: true,
          },
        },
        paciente: true,
      },
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

    // Regla estricta HU-008: al menos 30 minutos de anticipación antes de la hora de inicio
    const msRestantes = new Date(cita.bloque.hora_inicio).getTime() - Date.now();
    if (msRestantes < MINUTOS_ANTICIPACION_CANCELACION * 60 * 1000) {
      return NextResponse.json(
        {
          error: `Plazo expirado: solo se permite anular con al menos ${MINUTOS_ANTICIPACION_CANCELACION} minutos de anticipación. Por favor comuníquese presencialmente o por teléfono con el SOME.`,
        },
        { status: 422 }
      );
    }

    const ini = new Date(cita.bloque.hora_inicio);
    const horaStr = `${String(ini.getHours()).padStart(2, "0")}:${String(ini.getMinutes()).padStart(2, "0")}`;
    const fechaStr = cita.bloque.agenda.fecha.toISOString().split("T")[0];
    const cuerpoSms = construirSmsCancelacion({
      codigoReserva: cita.codigo_reserva,
      especialidad: cita.especialidad,
      fechaStr,
      horaStr,
    });

    // Ejecución atómica de cancelación oportuna, liberación de cupo y respaldo SMS GSM-7
    const [citaActualizada, , smsCancelacion] = await prisma.$transaction([
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
      prisma.registroSms.create({
        data: {
          cita_id: cita.id,
          telefono_destino: cita.paciente.telefono,
          cuerpo_mensaje: cuerpoSms,
          longitud_caracteres: cuerpoSms.length,
          estado_envio: "CANCELACION_ENVIADA",
        },
      }),
    ]);

    return NextResponse.json(
      {
        mensaje:
          "Cita médica cancelada oportunamente. El cupo ha sido liberado para la comunidad sin registro de inasistencia.",
        cita: citaActualizada,
        notificacion_sms: smsCancelacion,
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
