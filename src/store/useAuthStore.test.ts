import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/useAuthStore";

const fetchMock = vi.fn();
const usuario = { id: "42", email: "cliente@wave.local", rol: "Cliente" };

describe("useAuthStore.setAuth", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  // #49: /api/auth/session responde 503 si no pudo confirmar la sesión con el back. El login
  // muestra ese mensaje ("probá de nuevo") en vez de uno genérico.
  it("si el back no pudo confirmar la sesión, lanza con el mensaje de /api/auth/session", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "No pudimos confirmar tu sesión. Probá de nuevo." }, { status: 503 }));

    await expect(useAuthStore.getState().setAuth("el-token", usuario)).rejects.toThrow(
      "No pudimos confirmar tu sesión. Probá de nuevo.",
    );
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it("con otro error, lanza el mensaje genérico", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "Token invalido o expirado" }, { status: 400 }));

    await expect(useAuthStore.getState().setAuth("el-token", usuario)).rejects.toThrow("No se pudo iniciar la sesion.");
  });
});
