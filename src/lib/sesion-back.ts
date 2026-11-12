import { BACKEND_API_BASE, backendTimeoutMs } from "@/lib/backend";

// #49 (P-07): verificarSesion (lib/sesion.ts) sólo mira la firma del JWT. Quien tenga la Jwt:Key
// puede firmar un token de Admin que el front acepta. El back además exige la huella de la
// contraseña, que el usuario exista y toma el rol de la base (SesionJwt). Se le pregunta antes de
// renderizar /admin y de guardar la cookie; proxy.ts no, porque corre en cada request.

export interface SesionDelBack {
  id: number;
  email: string;
  rol: string;
}

// null si el back rechaza el token (401/403). Si no se pudo saber (back caído, 5xx, respuesta
// rara) lanza: no es lo mismo que una sesión rechazada, y tampoco alcanza para dar acceso.
export async function confirmarSesionConBack(token: string): Promise<SesionDelBack | null> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API_BASE}/Auth/sesion`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(backendTimeoutMs()),
    });
  } catch (error) {
    throw new Error(`No se pudo confirmar la sesión con el back: ${String(error)}`);
  }

  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`No se pudo confirmar la sesión con el back: respondió ${res.status}.`);

  const body = (await res.json().catch(() => null)) as Partial<SesionDelBack> | null;
  if (typeof body?.id !== "number" || typeof body?.email !== "string" || typeof body?.rol !== "string") {
    throw new Error("No se pudo confirmar la sesión con el back: la respuesta no trae id, email y rol.");
  }
  return { id: body.id, email: body.email, rol: body.rol };
}
