import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "@/lib/auth-cookie";

// #49: el layout de /admin redirige acá cuando el back rechaza un token con firma válida (usuario
// borrado, contraseña cambiada, Jwt:Key filtrada). Un Server Component no puede borrar cookies, y
// con la cookie viva proxy.ts trata al usuario como logueado y rebota /login a /account/profile.
// Es GET para poder redirigir; lo peor que logra un link ajeno es cerrarte la sesión.
export function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.set({ ...authCookieOptions(0), value: "" });
  return response;
}
