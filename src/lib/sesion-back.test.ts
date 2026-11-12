import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmarSesionConBack } from "@/lib/sesion-back";

// #49 (P-07): el front sólo verifica la firma del JWT; el back sabe si el usuario existe, si la
// contraseña cambió y qué rol tiene hoy.
const fetchMock = vi.fn();

describe("confirmarSesionConBack", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("le pasa el token a GET /Auth/sesion y devuelve el rol vigente", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 42, email: "admin@wave.local", rol: "Admin" }));

    expect(await confirmarSesionConBack("el-token")).toEqual({ id: 42, email: "admin@wave.local", rol: "Admin" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/Auth\/sesion$/);
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer el-token");
  });

  it.each([401, 403])("con %i del back no hay sesión", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    expect(await confirmarSesionConBack("el-token")).toBeNull();
  });

  it("si el back falla o no responde, lanza: no es lo mismo que una sesión rechazada", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(confirmarSesionConBack("el-token")).rejects.toThrow();

    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(confirmarSesionConBack("el-token")).rejects.toThrow();

    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    await expect(confirmarSesionConBack("el-token")).rejects.toThrow();
  });
});
