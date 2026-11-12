import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";
import { SECRETO_TEST, tokenFirmado } from "@/test/jwt-fixtures";

// #49 (P-07): con la Jwt:Key filtrada se puede firmar un token de Admin que el front acepta. El
// layout de /admin le pregunta al back antes de renderizar.
let cookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nombre: string) => (nombre === AUTH_COOKIE_NAME && cookie ? { value: cookie } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT ${destino}`);
  },
}));
vi.mock("@/app/admin/components/AdminShell", () => ({ default: () => null }));

const fetchMock = vi.fn();

async function renderizar() {
  const { default: AdminLayout } = await import("@/app/admin/layout");
  return AdminLayout({ children: null });
}

describe("layout de /admin", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRETO_TEST;
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    cookie = await tokenFirmado("Admin");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renderiza si el back confirma que la sesión es de un admin", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 42, rol: "Admin" }));

    const elemento = await renderizar();

    expect(elemento.props.sesion).toEqual({ email: "cliente@wave.local", rol: "Admin" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("manda a /login si el back rechaza un token con firma válida", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(renderizar()).rejects.toThrow("REDIRECT /login");
  });

  it("manda a /account/profile si el token dice Admin pero el back dice Cliente", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 42, rol: "Cliente" }));

    await expect(renderizar()).rejects.toThrow("REDIRECT /account/profile");
  });

  it("no renderiza el panel si el back no responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(renderizar()).rejects.toThrow(/sesión/);
  });

  it("sin una firma válida no le pregunta al back", async () => {
    cookie = await tokenFirmado("Admin", { secreto: "otra-clave-de-al-menos-32-bytes!!!!!" });

    await expect(renderizar()).rejects.toThrow("REDIRECT /login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
