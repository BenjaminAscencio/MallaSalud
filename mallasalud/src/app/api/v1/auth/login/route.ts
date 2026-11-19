import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/core/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionToken,
  RolSistema,
} from "@/lib/core/sessionToken";
import { normalizarRut, validarRut } from "@/lib/utils/rut";

/**
 * POST /api/v1/auth/login
 * Autentica funcionarios institucionales (SOME o PROFESIONAL en Box Clínico)
 * y emite una cookie HttpOnly firmada con HMAC-SHA256.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawIdentificador = String(body.identificador || body.email || body.rut || "").trim();
    const password = String(body.password || "");

    if (!rawIdentificador || !password) {
      return NextResponse.json(
        { error: "Debe ingresar su identificador (correo o RUT) y contraseña." },
        { status: 400 }
      );
    }

    const emailCandidate = rawIdentificador.toLowerCase();
    const rutCandidate = validarRut(rawIdentificador)
      ? normalizarRut(rawIdentificador)
      : rawIdentificador.replace(/\./g, "").toUpperCase();

    const usuario = await prisma.usuarioSistema.findFirst({
      where: {
        activo: true,
        OR: [{ email: emailCandidate }, { rut: rutCandidate }],
      },
      include: {
        profesional: true,
      },
    });

    if (!usuario || !verifyPassword(password, usuario.password_hash)) {
      return NextResponse.json(
        { error: "Credenciales inválidas. Verifique su correo/RUT y contraseña." },
        { status: 401 }
      );
    }

    const rol = usuario.rol as RolSistema;
    if (rol === "PROFESIONAL" && !usuario.profesional_id) {
      return NextResponse.json(
        { error: "La cuenta profesional no tiene box ni profesional asignado." },
        { status: 403 }
      );
    }

    const token = await signSessionToken({
      sub: usuario.id,
      rol,
      nombre: usuario.nombre_completo,
      email: usuario.email,
      rut: usuario.rut,
      profesionalId: usuario.profesional_id,
    });

    const redirectTo = rol === "SOME" ? "/some/agendas" : "/doctor";
    const res = NextResponse.json(
      {
        authenticated: true,
        redirectTo,
        user: {
          sub: usuario.id,
          rol,
          nombre: usuario.nombre_completo,
          email: usuario.email,
          rut: usuario.rut,
          profesionalId: usuario.profesional_id,
        },
      },
      { status: 200 }
    );

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https://");

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
      secure: isHttps,
    });

    return res;
  } catch (error) {
    console.error("Error en POST /api/v1/auth/login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al iniciar sesión." },
      { status: 500 }
    );
  }
}
