import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/session/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";
import { SECRETO_TEST, tokenFirmado } from "@/test/jwt-fixtures";

// #49 (P-07): /api/auth/session sólo guarda la cookie si el back acepta el token.
const fetchMock = vi.fn();

function guardar(token: string) {
  return POST(
    new NextRequest("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
}

const cookieGuardada = (response: Response) =>
  response.headers.getSetCookie().some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`) && !c.startsWith(`${AUTH_COOKIE_NAME}=;`));

describe("POST /api/auth/session", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRETO_TEST;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("guarda la cookie si el back acepta el token", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 42, rol: "Cliente" }));

    const response = await guardar(await tokenFirmado("Cliente"));

    expect(response.status).toBe(200);
    expect(cookieGuardada(response)).toBe(true);
  });

  it("no guarda un token con firma válida que el back rechaza", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await guardar(await tokenFirmado("Admin"));

    expect(response.status).toBe(400);
    expect(cookieGuardada(response)).toBe(false);
  });

  it("si el back no responde, no guarda la cookie y responde 503", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await guardar(await tokenFirmado("Cliente"));

    expect(response.status).toBe(503);
    expect(cookieGuardada(response)).toBe(false);
  });

  it("con firma inválida responde 400 sin preguntarle al back", async () => {
    const response = await guardar(await tokenFirmado("Cliente", { secreto: "otra-clave-de-al-menos-32-bytes!!!!!" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
