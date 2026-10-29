import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_API_BASE } from "./backend";
import { reportarError } from "./reportar-error";

describe("reportar errores al back (#7)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function enviado() {
    const [url, init] = fetchMock.mock.calls[0];
    return { url: String(url), init, cuerpo: JSON.parse(init.body) };
  }

  it("desde el servidor va directo al back, con el nombre y el mensaje del error", async () => {
    await reportarError("servidor", new TypeError("x is undefined"), { url: "/products/3", digest: "123" });

    const { url, init, cuerpo } = enviado();
    expect(url).toBe(`${BACKEND_API_BASE}/Alertas/front`);
    expect(init.method).toBe("POST");
    expect(cuerpo).toMatchObject({ origen: "servidor", url: "/products/3", digest: "123" });
    expect(cuerpo.mensaje).toContain("TypeError: x is undefined");
  });

  it("desde el navegador pasa por el proxy /api/backend", async () => {
    await reportarError("navegador", new Error("boom"), { url: "/cart" });

    expect(enviado().url).toBe("/api/backend/Alertas/front");
    expect(enviado().cuerpo.origen).toBe("navegador");
  });

  it("no manda la query de la URL (puede traer el token de reset de contraseña)", async () => {
    await reportarError("navegador", new Error("boom"), { url: "/reset-password?token=secreto" });

    expect(enviado().cuerpo.url).toBe("/reset-password");
  });

  it("acepta cualquier cosa tirada, no sólo Error", async () => {
    await reportarError("servidor", "se tiró un string");

    expect(enviado().cuerpo.mensaje).toContain("se tiró un string");
  });

  it("si el back no responde no tira: reportar nunca rompe la página ni el webhook", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(reportarError("servidor", new Error("boom"))).resolves.toBeUndefined();
  });
});
