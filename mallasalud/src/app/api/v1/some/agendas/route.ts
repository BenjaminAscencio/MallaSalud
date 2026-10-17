import { NextRequest, NextResponse } from "next/server";
import { listarAgendas } from "@/lib/services/agendas.service";
import { Especialidad } from "@prisma/client";

/**
 * GET /api/v1/some/agendas
 * HU-005: Lista agendas existentes con detalle de bloques y catálogos de profesionales/boxes.
 * Soporta filtros por fecha puntual, rango de fechas (semanal), especialidad, box y profesional.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get("fecha") ?? undefined;
    const fecha_desde = searchParams.get("fecha_desde") ?? undefined;
    const fecha_hasta = searchParams.get("fecha_hasta") ?? undefined;
    const box_id = searchParams.get("box_id") ?? undefined;
    const profesional_id = searchParams.get("profesional_id") ?? undefined;
    const especialidadParam = searchParams.get("especialidad");

    let especialidad: Especialidad | undefined;
    if (especialidadParam && Object.values(Especialidad).includes(especialidadParam as Especialidad)) {
      especialidad = especialidadParam as Especialidad;
    }

    const resultado = await listarAgendas({
      fecha,
      fecha_desde,
      fecha_hasta,
      especialidad,
      box_id,
      profesional_id,
    });

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al listar agendas:", error);
    return NextResponse.json(
      { error: "Error al recuperar agendas médicas", detalle },
      { status: 500 }
    );
  }
}
