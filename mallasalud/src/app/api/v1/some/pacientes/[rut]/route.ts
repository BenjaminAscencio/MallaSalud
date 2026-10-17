import { NextRequest, NextResponse } from "next/server";
import {
  obtenerPacientePorRut,
  RutInvalidoError,
  PacienteNotFoundError,
} from "@/lib/services/pacientes.service";

/**
 * GET /api/v1/some/pacientes/[rut]
 * HU-006: Consulta de paciente por RUT para atención en ventanilla/mesón SOME.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ rut: string }> }
) {
  try {
    const { rut } = await context.params;

    if (!rut) {
      return NextResponse.json(
        { error: "Debe ingresar el RUT del paciente." },
        { status: 400 }
      );
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

    console.error("Error al obtener paciente en SOME:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar paciente." },
      { status: 500 }
    );
  }
}
