import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/core/authServer";
import { registrarAsistenciaBox, BoxError } from "@/lib/web/services/box.service";

/**
 * PATCH /api/v1/box/citas/[id]/asistencia
 * HU-007: Registra ATENDIDA o NO_ASISTE (+1 NSP atómico y validación tolerancia 15 min) con RBAC estricto.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["PROFESIONAL"]);
  if (auth.errorResponse) return auth.errorResponse;

  if (!auth.session.profesionalId) {
    return NextResponse.json(
      { error: "Cuenta sin identificador de profesional asociado." },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const estado = String(body.estado_cita || "").toUpperCase();

    if (estado !== "ATENDIDA" && estado !== "NO_ASISTE") {
      return NextResponse.json(
        { error: "Estado inválido. Use 'ATENDIDA' o 'NO_ASISTE'." },
        { status: 400 }
      );
    }

    const resultado = await registrarAsistenciaBox(
      id,
      auth.session.profesionalId,
      estado
    );
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof BoxError) {
      return NextResponse.json(
        { error: error.message, mensaje: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en PATCH /api/v1/box/citas/[id]/asistencia:", error);
    return NextResponse.json(
      { error: "Error interno al registrar asistencia en box." },
      { status: 500 }
    );
  }
}
