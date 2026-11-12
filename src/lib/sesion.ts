// Verifica el JWT de la cookie auth-token del lado servidor (src/proxy.ts y layout de admin), con
// la misma clave que lo firma el back (Jwt__Key → JWT_SECRET). Usa Web Crypto, disponible en el
// runtime de proxy.ts y en Node, sin dependencias.
//
// Un token adulterado, firmado con otra clave, vencido o de otro tipo (ej. el de reset de
// contraseña) es lo mismo que no tener sesión.

export interface Sesion {
  id: string;
  email: string;
  rol: string;
  exp: number;
}

// Iguales a Jwt:Issuer y Jwt:Audience del back (appsettings.json).
const ISSUER = process.env.JWT_ISSUER ?? "WaveArg";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "WaveArgFrontend";

function base64UrlABytes(valor: string): Uint8Array<ArrayBuffer> {
  const b64 = valor.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function leerJson(parte: string): Record<string, unknown> | null {
  try {
    const valor = JSON.parse(new TextDecoder().decode(base64UrlABytes(parte)));
    return typeof valor === "object" && valor !== null ? valor : null;
  } catch {
    return null;
  }
}

// La clave se importa una sola vez por secreto: proxy.ts verifica en cada request.
let claveCache: { secreto: string; clave: Promise<CryptoKey> } | null = null;

function obtenerClave(secreto: string): Promise<CryptoKey> {
  if (claveCache?.secreto !== secreto) {
    const clave = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secreto),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    clave.catch(() => (claveCache = null));
    claveCache = { secreto, clave };
  }
  return claveCache.clave;
}

let avisoSinSecreto = false;

export async function verificarSesion(token: string | undefined): Promise<Sesion | null> {
  const secreto = process.env.JWT_SECRET;
  if (!secreto && !avisoSinSecreto) {
    // Sin la clave ninguna sesión es válida: nadie puede loguearse y todos ven el sitio deslogueado.
    console.error("[sesion] JWT_SECRET no está configurado: se rechazan todas las sesiones.");
    avisoSinSecreto = true;
  }
  if (!token || !secreto) return null;

  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [headerB64, payloadB64, firmaB64] = partes;

  const header = leerJson(headerB64);
  if (header?.alg !== "HS256") return null;

  let firmaValida = false;
  try {
    const clave = await obtenerClave(secreto);
    firmaValida = await crypto.subtle.verify(
      "HMAC",
      clave,
      base64UrlABytes(firmaB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
  } catch {
    return null;
  }
  if (!firmaValida) return null;

  const p = leerJson(payloadB64);
  if (!p) return null;
  const ahora = Math.floor(Date.now() / 1000);
  const audiencias = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (typeof p.exp !== "number" || p.exp < ahora) return null;
  if (p.iss !== ISSUER || !audiencias.includes(AUDIENCE)) return null;
  if (typeof p.id !== "string" || typeof p.rol !== "string") return null;

  return { id: p.id, email: typeof p.email === "string" ? p.email : "", rol: p.rol, exp: p.exp };
}

export function esAdmin(sesion: Pick<Sesion, "rol"> | null): boolean {
  // Igual que en el cliente: el back sólo emite el rol "Admin" (Politicas.Admin).
  return sesion?.rol.toLowerCase() === "admin";
}
