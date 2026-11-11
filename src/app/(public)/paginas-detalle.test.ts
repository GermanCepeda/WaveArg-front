import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #54: las páginas de detalle no le piden nada al back con un id inválido y responden 404.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// El contenido es un componente de cliente: acá sólo importa que la página llegue a renderizarlo.
vi.mock("@/app/(public)/products/[id]/ProductDetailContent", () => ({ default: () => null }));
vi.mock("@/app/(public)/accesorios/[id]/AccesorioDetailContent", () => ({ default: () => null }));

const fetchMock = vi.fn();

const paginas = [
  { nombre: "producto", modulo: () => import("@/app/(public)/products/[id]/page"), endpoint: "/Productos/7" },
  { nombre: "accesorio", modulo: () => import("@/app/(public)/accesorios/[id]/page"), endpoint: "/Accesorios/7" },
];

const conId = (id: string) => ({ params: Promise.resolve({ id }) });

describe.each(paginas)("página de detalle de $nombre", ({ modulo, endpoint }) => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["..%2f..%2fswagger", "../../swagger", "abc", "0"])("con el id %j responde 404 sin llamar al back", async (id) => {
    const { default: Pagina, generateMetadata } = await modulo();

    await expect(Pagina(conId(id))).rejects.toThrow("NEXT_NOT_FOUND");
    await generateMetadata(conId(id));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con un id válido pide el detalle al back y renderiza", async () => {
    fetchMock.mockResolvedValue(Response.json({ nombre: "iPhone 16", imagenes: [] }));
    const { default: Pagina, generateMetadata } = await modulo();

    const metadata = await generateMetadata(conId("7"));
    expect(await Pagina(conId("7"))).toBeTruthy();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(new RegExp(`${endpoint}$`));
    expect(metadata.title).toMatch(/iPhone 16/);
  });
});
