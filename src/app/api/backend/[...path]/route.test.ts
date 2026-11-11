import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const fetchMock = vi.fn();

// Los segmentos como los entrega Next al route handler: ya decodificados, así que pueden traer "/" adentro.
function pedirSegmentos(segmentos: string[]) {
  return GET(new NextRequest(new URL(`/api/backend/${segmentos.join("/")}`, "http://localhost:3000")), {
    params: Promise.resolve({ path: segmentos }),
  });
}

function pedir(path: string) {
  return pedirSegmentos(path.split("/"));
}

// Un back que nunca contesta: sólo termina si se aborta la request.
function backColgado(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });
}

describe("proxy /api/backend", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("BACKEND_TIMEOUT_MS", "50");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("si el back no responde a tiempo, corta y responde 504 con un mensaje", async () => {
    fetchMock.mockImplementation(backColgado);

    const res = await pedir("Productos");

    expect(res.status).toBe(504);
    expect((await res.json()).message).toMatch(/tard/i);
  });

  it("un POST no se corta por timeout: el back podría terminar de crear el pedido igual", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 7 }, { status: 201 }));

    const res = await POST(
      new NextRequest(new URL("/api/backend/Pedidos", "http://localhost:3000"), {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["Pedidos"] }) },
    );

    expect(res.status).toBe(201);
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });

  // #46 (P-02 del pentest).
  it.each([
    [["..", "swagger", "index.html"]],
    [["../../swagger/index.html"]],
    [["Productos", "..", "..", "swagger"]],
    [[".", "Productos"]],
    [["..\\..\\swagger"]],
    // Doble encoding: pasa el filtro de segmentos y lo corta la verificación de que la URL quede en la base.
    [["%2e%2e", "swagger"]],
  ])("no sale de la base del back: %j responde 400 sin llamarlo", async (segmentos) => {
    const res = await pedirSegmentos(segmentos);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una ruta anidada normal sigue llegando al back", async () => {
    fetchMock.mockResolvedValue(Response.json([], { status: 200 }));

    await pedir("Pedidos/mis-pedidos");

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/Pedidos\/mis-pedidos$/);
  });

  it("si el back responde, pasa el status y el cuerpo tal cual", async () => {
    fetchMock.mockResolvedValue(Response.json([{ id: 2 }], { status: 200 }));

    const res = await pedir("Productos");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 2 }]);
  });
});
