import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";

async function cabecerasDeTodasLasRutas(): Promise<Record<string, string>> {
  const reglas = (await nextConfig.headers?.()) ?? [];
  const todas = reglas.find((r) => r.source === "/(.*)");
  return Object.fromEntries((todas?.headers ?? []).map((h) => [h.key, h.value]));
}

function directivas(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter(([nombre]) => nombre)
      .map(([nombre, ...valores]) => [nombre, valores]),
  );
}

describe("headers de seguridad (next.config)", () => {
  it("todas las rutas mandan HSTS", async () => {
    const hsts = (await cabecerasDeTodasLasRutas())["Strict-Transport-Security"];
    expect(hsts).toMatch(/max-age=\d{8,}/); // al menos ~1 año
    expect(hsts).toContain("includeSubDomains");
  });

  it("todas las rutas mandan una CSP que permite Google y nada más de afuera para scripts", async () => {
    const csp = (await cabecerasDeTodasLasRutas())["Content-Security-Policy"];
    expect(csp).toBeDefined();
    const d = directivas(csp);

    expect(d["default-src"]).toEqual(["'self'"]);
    expect(d["script-src"]).toContain("https://accounts.google.com/gsi/client");
    expect(d["script-src"].filter((s) => s.startsWith("https:") || s === "*")).toEqual([
      "https://accounts.google.com/gsi/client",
    ]);
    expect(d["frame-src"]).toContain("https://accounts.google.com/");
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
  });
});

// #7: sin el secreto, el webhook de MP respondería 500 a todo. Mejor que falle el deploy (Vercel avisa y
// sigue sirviendo el anterior) que publicar un sitio que no registra pagos.
describe("deploy de producción en Vercel (next.config)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function cargarConfig(env: Record<string, string>) {
    vi.resetModules();
    for (const [clave, valor] of Object.entries(env)) vi.stubEnv(clave, valor);
    return import("../next.config");
  }

  it("sin MERCADOPAGO_WEBHOOK_SECRET falla el build", async () => {
    await expect(cargarConfig({ VERCEL_ENV: "production", MERCADOPAGO_WEBHOOK_SECRET: "" })).rejects.toThrow(
      /MERCADOPAGO_WEBHOOK_SECRET/,
    );
  });

  it("con el secreto, o fuera de producción (previews, CI), el build sigue", async () => {
    await expect(cargarConfig({ VERCEL_ENV: "production", MERCADOPAGO_WEBHOOK_SECRET: "x" })).resolves.toBeDefined();
    await expect(cargarConfig({ VERCEL_ENV: "preview", MERCADOPAGO_WEBHOOK_SECRET: "" })).resolves.toBeDefined();
  });
});
