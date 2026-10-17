import { NextRequest, NextResponse } from "next/server";
import { listarCuposDisponibles } from "@/lib/services/ventanilla.service";
import { Especialidad } from "@prisma/client";

/**
 * GET /api/v1/some/cupos-disponibles
 * HU-006: Consulta de cupos disponibles en tiempo real para agendamiento en ventanilla SOME.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const especialidadParam = searchParams.get("especialidad");
    const fecha = searchParams.get("fecha") ?? undefined;
    const esAdultoMayorParam = searchParams.get("es_adulto_mayor");

    let especialidad: Especialidad | undefined;
    if (especialidadParam && Object.values(Especialidad).includes(especialidadParam as Especialidad)) {
      especialidad = especialidadParam as Especialidad;
    }

    let esAdultoMayor: boolean | undefined;
    if (esAdultoMayorParam !== null) {
      esAdultoMayor = esAdultoMayorParam === "true" || esAdultoMayorParam === "1";
    }

    const cupos = await listarCuposDisponibles({
      especialidad,
      fecha,
      esAdultoMayor,
    });

    return NextResponse.json(
      {
        total: cupos.length,
        cupos,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error al obtener cupos disponibles:", error);
    return NextResponse.json(
      { error: "Error al recuperar cupos disponibles", detalle },
      { status: 500 }
    );
  }
}
