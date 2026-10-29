import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccesorioVariantesService,
  ApiError,
  CODIGO_VINCULAR_GOOGLE,
  loginUser,
  loginWithGoogle,
  stockActualSiCambio,
  VariantesService,
  vincularGoogle,
} from "./api";
import { useAuthStore } from "@/store/useAuthStore";

const fetchMock = vi.fn();

function respuesta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("login con Google y vinculación de cuentas (api.ts)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("un 409 VINCULAR_GOOGLE llega como ApiError con el status y el código", async () => {
    fetchMock.mockResolvedValue(
      respuesta(409, { codigo: CODIGO_VINCULAR_GOOGLE, email: "ana@test.local", message: "¿Querés unificarla?" }),
    );

    const error = await loginWithGoogle("id-token").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "¿Querés unificarla?",
      data: { codigo: CODIGO_VINCULAR_GOOGLE, email: "ana@test.local" },
    });
  });

  it("vincularGoogle manda el mismo idToken al endpoint de vinculación", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { token: "jwt", rol: "Cliente" }));

    const response = await vincularGoogle("id-token");

    expect(response.token).toBe("jwt");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/Auth\/google\/vincular$/);
    expect(JSON.parse(init.body)).toEqual({ idToken: "id-token" });
  });
});

describe("login con email y contraseña (api.ts)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // fetchFromApi sólo desloguea en el navegador.
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("un login fallido muestra el mensaje del back y no cierra la sesión", async () => {
    const logout = vi.fn();
    vi.spyOn(useAuthStore, "getState").mockReturnValue({ ...useAuthStore.getState(), logout });
    fetchMock.mockResolvedValue(respuesta(400, { message: "Email o contraseña incorrectos." }));

    const error = await loginUser({ email: "ana@test.local", contraseña: "mala" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "Email o contraseña incorrectos." });
    expect(logout).not.toHaveBeenCalled();
  });

  it("un 401 de otro endpoint sí cierra la sesión", async () => {
    const logout = vi.fn();
    vi.spyOn(useAuthStore, "getState").mockReturnValue({ ...useAuthStore.getState(), logout });
    fetchMock.mockResolvedValue(respuesta(401, {}));

    await loginUser({ email: "ana@test.local", contraseña: "x" }).catch(() => {});

    expect(logout).toHaveBeenCalledOnce();
  });
});

describe("edición de stock desde el admin (api.ts)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda el stock que el admin vio al abrir el formulario", async () => {
    fetchMock.mockResolvedValue(respuesta(200, {}));

    await VariantesService.update(7, { precio: 100, stock: 5, stockAnterior: 3, color: "Negro", memoria: "128GB" });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ id: 7, stock: 5, stockAnterior: 3 });
  });

  it("si hubo ventas en el medio, el 409 trae el stock actual", async () => {
    fetchMock.mockResolvedValue(
      respuesta(409, { message: "El stock cambió mientras editabas (hubo ventas): ahora hay 2.", stockActual: 2 }),
    );

    const error = await AccesorioVariantesService.update(9, {
      precio: 10,
      stock: 5,
      stockAnterior: 3,
      color: "Negro",
      especificacion: "USB-C",
    }).catch((e: unknown) => e);

    expect(stockActualSiCambio(error)).toBe(2);
    expect(error).toMatchObject({ message: "El stock cambió mientras editabas (hubo ventas): ahora hay 2." });
  });

  it("otros errores no se confunden con un cambio de stock", () => {
    expect(stockActualSiCambio(new ApiError("Ya existe", 409, { message: "Ya existe" }))).toBeNull();
    expect(stockActualSiCambio(new ApiError("Error", 500, { stockActual: 2 }))).toBeNull();
    expect(stockActualSiCambio(new Error("red"))).toBeNull();
  });
});

describe("errores de validación del back (api.ts)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // #28: el 400 de validación del back trae el mensaje por campo; el admin ve ese, no el título genérico.
  it("un precio o stock inválido llega con el mensaje del back", async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, {
        title: "One or more validation errors occurred.",
        status: 400,
        errors: { Precio: ["El precio tiene que ser mayor a 0."], Stock: ["El stock no puede ser negativo."] },
      }),
    );

    const error = await VariantesService.create({
      productoId: 1,
      color: "Negro",
      memoria: "128GB",
      precio: 0,
      stock: -1,
      esUsado: false,
      detalleEstado: "Nuevo",
      fotoEstadoUrl: "",
      imagenes: [],
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 400,
      message: "El precio tiene que ser mayor a 0. El stock no puede ser negativo.",
    });
  });
});
