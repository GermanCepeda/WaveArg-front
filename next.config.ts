import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// #7: en el deploy de producción de Vercel, sin el secreto el webhook de MP respondería 500 a todo
// (fail-closed) y los pagos no se registrarían. Falla el build: Vercel avisa y sigue sirviendo el
// deploy anterior. Los previews y el CI no lo necesitan.
if (process.env.VERCEL_ENV === "production" && !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
  throw new Error(
    "Falta MERCADOPAGO_WEBHOOK_SECRET en las variables de Production de Vercel: sin él, el webhook de MercadoPago rechaza todos los pagos.",
  );
}

// CSP (#17). Scripts: los propios de Next (inline, sin nonce para no volver dinámicas todas
// las páginas) y Google Identity Services. Imágenes y videos: cualquier https, porque las
// fotos de productos son URLs cargadas desde el admin. MercadoPago no necesita nada: el pago
// es una redirección, no un script ni un iframe. En dev, Next necesita eval y el websocket del HMR.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com/gsi/client`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' data:",
  `connect-src 'self' https://accounts.google.com/gsi/${isDev ? " ws:" : ""}`,
  "frame-src https://accounts.google.com/",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "store.storeimages.cdn-apple.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "http2.mlstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.sagitariodigital.com.ar",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.apple.com",
        pathname: "/**",
      },
    ],
  },
  allowedDevOrigins: ["192.168.100.160", "localhost"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
