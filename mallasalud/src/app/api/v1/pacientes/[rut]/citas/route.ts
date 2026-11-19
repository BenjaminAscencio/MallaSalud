import { NextRequest, NextResponse } from "next/server";
import {
  obtenerPacientePorRut,
  RutInvalidoError,
  PacienteNotFoundError,
} from "@/lib/web/services/pacientes.service";

/**
 * GET /api/v1/pacientes/[rut]/citas
 * Endpoint público para que el paciente consulte y administre/anule sus citas por RUT en /.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;
    if (!rut) {
      return NextResponse.json({ error: "Debe ingresar su RUT." }, { status: 400 });
    }

    const paciente = await obtenerPacientePorRut(decodeURIComponent(rut));
    return NextResponse.json({ paciente }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof RutInvalidoError) {
      return NextResponse.json(
        { error: "RUT inválido", mensaje: error.message },
        { status: 400 }
      );
    }
    if (error instanceof PacienteNotFoundError) {
      return NextResponse.json(
        { error: "Paciente no encontrado", mensaje: error.message },
        { status: 404 }
      );
    }
    console.error("Error en GET /api/v1/pacientes/[rut]/citas:", error);
    return NextResponse.json(
      { error: "Error interno al consultar las citas del paciente." },
      { status: 500 }
    );
  }
}
