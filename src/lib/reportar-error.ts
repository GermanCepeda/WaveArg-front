import { API_PROXY_BASE, BACKEND_API_BASE } from "@/lib/backend";

// #7: el front no tiene mail propio. Sus errores no manejados van al back (POST /api/Alertas/front),
// que avisa al admin con un tope de un mail cada 15 min. Desde el servidor de Next se llama directo al
// back; desde el navegador, por el proxy /api/backend.
export type OrigenDelError = "servidor" | "navegador";

const TIMEOUT_MS = 5_000;

function mensajeDe(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }
  return String(error);
}

export async function reportarError(
  origen: OrigenDelError,
  error: unknown,
  { url, digest }: { url?: string; digest?: string } = {},
): Promise<void> {
  const base = origen === "servidor" ? BACKEND_API_BASE : API_PROXY_BASE;
  try {
    await fetch(`${base}/Alertas/front`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Sin la query: /reset-password?token=... no puede terminar en un mail.
      body: JSON.stringify({ origen, mensaje: mensajeDe(error), url: url?.split("?")[0], digest }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (fallo) {
    // Si el back tampoco responde, lo detecta el monitor de uptime: acá sólo queda el log.
    console.error("[reportarError] No se pudo avisar al back:", fallo);
  }
}
