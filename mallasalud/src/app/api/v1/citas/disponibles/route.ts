import { NextRequest, NextResponse } from "next/server";
import { listarCuposDisponibles } from "@/lib/web/services/ventanilla.service";
import { Especialidad } from "@prisma/client";

/**
 * GET /api/v1/citas/disponibles
 * Endpoint público para el Portal del Paciente (/): consulta cupos libres en tiempo real
 * liberando automáticamente cuotas 60+ (<= 30 min) y bloqueos temporales expirados (TTL 120s).
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

    return NextResponse.json({ total: cupos.length, cupos }, { status: 200 });
  } catch (error: unknown) {
    const detalle = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en GET /api/v1/citas/disponibles:", error);
    return NextResponse.json(
      { error: "Error al consultar cupos disponibles.", detalle },
      { status: 500 }
    );
  }
}
