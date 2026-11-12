import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "@/lib/auth-cookie";
import { verificarSesion } from "@/lib/sesion";
import { confirmarSesionConBack } from "@/lib/sesion-back";

export async function POST(req: NextRequest) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  // Sólo se guarda un token que firmó el back, que no venció y que el back acepta hoy (#49: una firma
  // válida no alcanza si se filtró la Jwt:Key). Lo local va primero para no consultar al back de más.
  const sesion = await verificarSesion(token);
  const maxAge = sesion ? sesion.exp - Math.floor(Date.now() / 1000) : 0;
  let aceptado = false;
  if (maxAge > 0) {
    try {
      aceptado = (await confirmarSesionConBack(token)) !== null;
    } catch (error) {
      console.error("[auth/session]", error);
      return NextResponse.json({ error: "No pudimos confirmar tu sesión. Probá de nuevo." }, { status: 503 });
    }
  }
  if (!aceptado) {
    return NextResponse.json({ error: "Token invalido o expirado" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...authCookieOptions(maxAge), value: token });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ ...authCookieOptions(0), value: "" });

  return response;
}
