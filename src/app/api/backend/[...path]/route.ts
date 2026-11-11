import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";
import { BACKEND_API_BASE } from "@/lib/backend";

// El backend ve todas las requests de este proxy con la IP de Vercel. Para que su rate limit
// distinga usuarios, le pasamos la IP del navegador junto con un secreto compartido
// (Proxy:ClientIpSecret en el backend); sin el secreto, el backend ignora el header.
const BACKEND_PROXY_SECRET = process.env.BACKEND_PROXY_SECRET;

// En Vercel, x-real-ip y el primer valor de x-forwarded-for los pone la plataforma.
function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

// Cuánto espera el proxy a que el back empiece a responder antes de cortar con 504
// (BACKEND_TIMEOUT_MS). 30 s por defecto: en Render free el back puede tardar en despertar.
// Sólo para GET/HEAD: cortar un POST/PUT no frena al back, que puede terminar de crear el pedido
// o la preferencia; un 504 invitaría a reintentar y duplicarlo.
const TIMEOUT_POR_DEFECTO_MS = 30_000;

function timeoutMs(): number {
  const valor = Number(process.env.BACKEND_TIMEOUT_MS);
  return Number.isFinite(valor) && valor > 0 ? valor : TIMEOUT_POR_DEFECTO_MS;
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

// #46: Next entrega los segmentos ya decodificados ("..%2f" llega como "../") y new URL resuelve "." y "..",
// también con "\" (en http vale como "/"). Un segmento así nunca es una ruta legítima de la API: se rechaza.
// Además la URL final tiene que quedar dentro de la base del back: un doble encoding ("%252e%252e") llega como
// "%2e%2e", pasa el filtro de segmentos y new URL lo resuelve igual como "..".
const BASE_DEL_BACK = new URL(BACKEND_API_BASE);
const PREFIJO_DEL_BACK = `${BASE_DEL_BACK.pathname.replace(/\/$/, "")}/`;

function urlDelBack(path: string[]): URL | null {
  const segmentoInvalido = (segmento: string) =>
    segmento === "." || segmento === ".." || segmento.includes("/") || segmento.includes("\\");
  if (path.some(segmentoInvalido)) return null;

  const url = new URL(`${BACKEND_API_BASE}/${path.join("/")}`);
  return url.origin === BASE_DEL_BACK.origin && url.pathname.startsWith(PREFIJO_DEL_BACK) ? url : null;
}

async function proxyRequest(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const backendUrl = urlDelBack(path);
  if (!backendUrl) {
    return NextResponse.json({ message: "Ruta inválida." }, { status: 400 });
  }
  backendUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const clientIp = getClientIp(req);

  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (BACKEND_PROXY_SECRET && clientIp) {
    headers.set("x-wave-client-ip", clientIp);
    headers.set("x-wave-proxy-secret", BACKEND_PROXY_SECRET);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  // El timeout cubre hasta que llegan los headers; el cuerpo se sigue transmitiendo sin límite.
  const idempotente = req.method === "GET" || req.method === "HEAD";
  const controller = new AbortController();
  const timer = idempotente ? setTimeout(() => controller.abort(), timeoutMs()) : undefined;
  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, {
      ...init,
      signal: idempotente ? controller.signal : undefined,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return NextResponse.json(
        { message: "El servidor está tardando en responder. Probá de nuevo en unos segundos." },
        { status: 504 },
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const responseHeaders = new Headers();
  const responseContentType = backendResponse.headers.get("content-type");

  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return proxyRequest(req, context);
}
