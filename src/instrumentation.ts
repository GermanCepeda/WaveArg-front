import type { Instrumentation } from "next";
import { reportarError } from "@/lib/reportar-error";

// #7: todo error no manejado del servidor de Next (route handlers, server components, proxy) le llega
// al admin por las alertas del back. El navegador recibe sólo el digest; error.tsx no lo vuelve a reportar.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportarError("servidor", error, {
    url: `${request.method} ${request.path} (${context.routeType} ${context.routePath})`,
    digest: (error as { digest?: string }).digest,
  });
};
