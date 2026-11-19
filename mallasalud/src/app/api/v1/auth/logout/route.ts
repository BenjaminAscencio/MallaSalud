import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/core/sessionToken";

/**
 * POST /api/v1/auth/logout
 * Cierra la sesión institucional eliminando la cookie de sesión.
 */
export async function POST() {
  const res = NextResponse.json({ authenticated: false }, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
