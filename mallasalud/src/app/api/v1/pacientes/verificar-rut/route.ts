import { NextRequest, NextResponse } from "next/server";
import {
  verificarPacientePorRut,
  RutInvalidoError,
  PacienteNotFoundError,
} from "@/lib/services/pacientes.service";

/**
 * POST /api/v1/pacientes/verificar-rut
 * HU-001: Valida el RUT del paciente según Módulo 11 y verifica su inscripción en el CESFAM.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rut } = body;

    if (!rut || typeof rut !== "string") {
      return NextResponse.json(
        { error: "Debe ingresar un RUT para realizar la verificación." },
        { status: 400 }
      );
    }

    const resultado = await verificarPacientePorRut(rut);

    return NextResponse.json(
      {
        valido: true,
        paciente: resultado,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof RutInvalidoError) {
      return NextResponse.json(
        {
          error: "RUT inválido",
          mensaje: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof PacienteNotFoundError) {
      return NextResponse.json(
        {
          error: "Paciente no inscrito",
          mensaje: error.message,
          acudir_some: true,
        },
        { status: 404 }
      );
    }

    console.error("Error inesperado en verificar-rut:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
