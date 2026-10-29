import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { BACKEND_API_BASE } from "@/lib/backend";
import { reportarError } from "@/lib/reportar-error";

const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const isProduction = process.env.NODE_ENV === "production";

/**
 * Valida la firma HMAC-SHA256 enviada por MercadoPago en el header x-signature.
 * Formato del header: "ts=<timestamp>,v1=<hash>"
 * El mensaje firmado es: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * Si falta data.id o x-request-id, MP omite ese tramo entero (igual que el backend en
 * FirmaWebhookMp.cs: los dos tienen que armar el mismo texto).
 */
function isValidSignature(req: NextRequest, dataId: string, secret: string): boolean {
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";

  const ts = xSignature.match(/ts=([^,]+)/)?.[1];
  const v1 = xSignature.match(/v1=([^,]+)/)?.[1];

  if (!ts || !v1) return false;

  const message =
    (dataId ? `id:${dataId};` : "") +
    (xRequestId ? `request-id:${xRequestId};` : "") +
    `ts:${ts};`;
  const expected = createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return expected === v1;
}

/**
 * Webhook receiver para MercadoPago.
 *
 * MercadoPago envía notificaciones a esta URL con los params:
 *   ?type=payment&data.id=<payment_id>
 *
 * Este handler valida la firma HMAC-SHA256 y reenvía la notificación al backend .NET.
 * Sin secret configurado: en producción rechaza todo (fail-closed); en dev omite la validación.
 */
export async function POST(req: NextRequest) {
  if (!MP_WEBHOOK_SECRET && isProduction) {
    console.error("[MP Webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado");
    // #7: no tendría que pasar (el build de producción falla sin el secreto, ver next.config.ts), pero
    // si pasa, los pagos no se registran: que le llegue al admin y no sólo al log de Vercel.
    await reportarError(
      "servidor",
      "MERCADOPAGO_WEBHOOK_SECRET no está configurado en Vercel: el webhook de MP responde 500 a todo y los pagos no se registran. " +
        "Cargarlo en Settings → Environment Variables, redeployar y reprocesar los pagos afectados (docs/alertas.md del back).",
      { url: "/api/mercadopago/webhook" },
    );
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const dataId = searchParams.get("data.id") ?? "";

  if (MP_WEBHOOK_SECRET && !isValidSignature(req, dataId, MP_WEBHOOK_SECRET)) {
    console.warn("[MP Webhook] Firma inválida — request rechazado");
    // #7: acá se corta antes del back, así que su alerta de firma rechazada nunca sale.
    await reportarError(
      "servidor",
      `Webhook de MP con firma inválida (data.id=${dataId}). Uno suelto puede ser alguien probando el endpoint; ` +
        "si se repite, MERCADOPAGO_WEBHOOK_SECRET de Vercel no es el secreto del panel de MP y los pagos no se registran.",
      { url: "/api/mercadopago/webhook" },
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backendUrl = `${BACKEND_API_BASE}/MercadoPago/webhook?type=${encodeURIComponent(type)}&data.id=${encodeURIComponent(dataId)}`;

    // El backend valida la misma firma (fail-closed): hay que reenviarle los headers de MP.
    // x-request-id sólo si vino: vacío y ausente firman distinto en el backend.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-signature": req.headers.get("x-signature") ?? "",
    };
    const xRequestId = req.headers.get("x-request-id");
    if (xRequestId) headers["x-request-id"] = xRequestId;

    const response = await fetch(backendUrl, { method: "POST", headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[MP Webhook] Backend respondió ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[MP Webhook] Error al reenviar al backend:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * MercadoPago a veces verifica el webhook con un GET.
 */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
