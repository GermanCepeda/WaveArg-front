import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions } from "@/lib/auth-cookie";
import { verificarSesion } from "@/lib/sesion";
import { confirmarSesionConBack } from "@/lib/sesion-back";

export async function POST(req: NextRequest) {
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  // Sólo se guarda un token que firmó el back y que no venció.
  const sesion = await verificarSesion(token);
  const maxAge = sesion ? sesion.exp - Math.floor(Date.now() / 1000) : 0;
  if (maxAge <= 0) {
    return NextResponse.json({ error: "Token invalido o expirado" }, { status: 400 });
  }

  // #49: y que el back lo acepte. Una firma válida no alcanza si se filtró la Jwt:Key.
  let delBack;
  try {
    delBack = await confirmarSesionConBack(token);
  } catch (error) {
    console.error("[auth/session]", error);
    return NextResponse.json({ error: "No se pudo confirmar la sesion. Proba de nuevo." }, { status: 503 });
  }
  if (!delBack) {
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
