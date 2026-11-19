import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/core/sessionToken";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  const esRutaSome = pathname.startsWith("/some");
  const esRutaIvr = pathname.startsWith("/ivr");
  const esRutaDoctor = pathname.startsWith("/doctor");
  const esLogin = pathname === "/login";

  if (esRutaSome || esRutaIvr) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.rol !== "SOME") {
      return NextResponse.redirect(new URL("/doctor", req.url));
    }
  }

  if (esRutaDoctor) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.rol !== "PROFESIONAL") {
      return NextResponse.redirect(new URL("/some/agendas", req.url));
    }
  }

  if (esLogin && session) {
    const dest = session.rol === "SOME" ? "/some/agendas" : "/doctor";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/some/:path*", "/ivr/:path*", "/doctor/:path*", "/login"],
};
