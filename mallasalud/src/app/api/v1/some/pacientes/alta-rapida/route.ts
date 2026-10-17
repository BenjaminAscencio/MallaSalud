import { NextRequest, NextResponse } from "next/server";
import {
  altaRapidaPaciente,
  RutInvalidoError,
  PacienteYaExisteError,
} from "@/lib/services/pacientes.service";

/**
 * POST /api/v1/some/pacientes/alta-rapida
 * HU-006: Alta rápida de paciente nuevo en ventanilla SOME.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rut, nombres, apellidos, fecha_nacimiento, telefono } = body;

    if (!rut || !nombres || !apellidos || !fecha_nacimiento || !telefono) {
      return NextResponse.json(
        {
          error: "Faltan campos obligatorios.",
          campos_requeridos: ["rut", "nombres", "apellidos", "fecha_nacimiento", "telefono"],
        },
        { status: 400 }
      );
    }

    const nuevoPaciente = await altaRapidaPaciente({
      rut,
      nombres,
      apellidos,
      fecha_nacimiento,
      telefono,
    });

    return NextResponse.json(
      {
        mensaje: "Paciente registrado e inscrito exitosamente.",
        paciente: nuevoPaciente,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof RutInvalidoError) {
      return NextResponse.json(
        { error: "RUT inválido", mensaje: error.message },
        { status: 400 }
      );
    }

    if (error instanceof PacienteYaExisteError) {
      return NextResponse.json(
        { error: "Paciente ya registrado", mensaje: error.message },
        { status: 409 }
      );
    }

    console.error("Error en alta rápida de paciente:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al dar de alta al paciente." },
      { status: 500 }
    );
  }
}
