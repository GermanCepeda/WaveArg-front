// URL del backend .NET para código que corre en el servidor (route handlers, server components,
// sitemap). INTERNAL_API_BASE permite usar una URL distinta de la pública si hiciera falta.
// El cliente no llama al backend directo: usa el proxy /api/backend (ver lib/api.ts).
export const BACKEND_API_BASE =
  process.env.INTERNAL_API_BASE ??
  process.env.NEXT_PUBLIC_API_BASE ??
  "http://localhost:5075/api";

// Base que usa el navegador para llamar al backend: el proxy /api/backend (ver app/api/backend).
export const API_PROXY_BASE = process.env.NEXT_PUBLIC_API_PROXY_BASE ?? "/api/backend";
