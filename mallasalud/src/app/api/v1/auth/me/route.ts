import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/core/authServer";

/**
 * GET /api/v1/auth/me
 * Retorna el usuario autenticado actual desde la cookie HttpOnly firmada.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session }, { status: 200 });
}
