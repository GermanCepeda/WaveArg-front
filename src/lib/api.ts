// lib/api.ts
import { Producto, Variante, CreateProductoDTO, ImagenDetalle } from "@/interfaces/producto";
export type { ImagenDetalle };
import { LoginDTO, RegisterDTO, AuthResponse } from "@/interfaces/auth";
import { useAuthStore } from "@/store/useAuthStore";
import { Accesorio, AccesorioVariante, AccesorioImagenDetalle, CategoriaAccesorio, CATEGORIA_LABELS, CreateAccesorioDTO } from "@/interfaces/accesorio";

// Re-export for convenience
export type { Producto, Variante, CreateProductoDTO };
export type { Accesorio, AccesorioVariante, AccesorioImagenDetalle, CreateAccesorioDTO };
export { CategoriaAccesorio, CATEGORIA_LABELS };

// --- DTOs de escritura ---

export interface CreateVarianteDTO {
  productoId: number;
  color: string;
  memoria: string;
  precio: number;
  stock: number;
  esUsado: boolean;
  detalleEstado: string | null;
  fotoEstadoUrl: string;
  imagenes: string[];
}

// Edición de una variante desde el admin. `stockAnterior` es el stock que se vio al abrir el
// formulario: si hubo ventas en el medio, el back responde 409 en vez de pisarlas.
export interface UpdateVarianteDTO {
  precio: number;
  stock: number;
  stockAnterior: number;
  color: string;
  memoria: string;
}

export interface UpdateAccesorioVarianteDTO {
  precio: number;
  stock: number;
  stockAnterior: number;
  color: string;
  especificacion: string;
}

export interface UpdateProductoDTO {
  nombre: string;
  modelo: string;
  descripcion: string;
  imagenesUrls: string[];
}

export interface UpdateAccesorioDTO {
  nombre: string;
  modelo: string;
  descripcion: string;
  categoria: CategoriaAccesorio;
}

export interface CreateAccesorioVarianteDTO {
  accesorioId: number;
  color: string;
  especificacion: string;
  precio: number;
  stock: number;
  esUsado: boolean;
  detalleEstado: string | null;
  fotoEstadoUrl: string;
  imagenes: string[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_PROXY_BASE ?? "/api/backend";

/**
 * Error de la API con el status y el cuerpo de la respuesta, para los casos que el front
 * resuelve según el código (ej. 409 VINCULAR_GOOGLE). `message` es el texto para el usuario.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Si el error es el 409 de editar una variante cuyo stock cambió mientras el admin editaba,
 * devuelve el stock que hay ahora. Si no, null.
 */
export function stockActualSiCambio(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const stock = error.data.stockActual;
  return typeof stock === "number" ? stock : null;
}

/**
 * Lee el token desde la cookie auth-token (misma que usa src/proxy.ts y Zustand).
 * Una sola fuente de verdad para autenticación.
 */
export async function fetchFromApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Mezclamos los headers default con los que vengan en options
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "same-origin",
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);

    // Si el backend responde 401, el token probablemente expiró → limpiar auth (Zustand + cookie)
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        useAuthStore.getState().logout();
      }
      throw new Error("Es necesario que tengas una sesión iniciada. Por favor, iniciá sesión para continuar.");
    }

    if (!res.ok) {
      // Intentamos leer el body como texto primero para no perder info
      const rawText = await res.text().catch(() => "");

      // Luego intentamos parsearlo como JSON
      let errorData: Record<string, unknown> = {};
      try {
        if (rawText) errorData = JSON.parse(rawText);
      } catch {
        // No era JSON — usamos el texto crudo como mensaje
      }

      // Mensaje personalizado para error 500 de duplicado
      if (res.status === 500 && (errorData.message as string)?.includes("UNIQUE KEY")) {
        throw new Error("Este email ya está registrado. Usa otro email.");
      }

      // .NET ProblemDetails: { title, errors: { campo: ["msg"] } }
      // .NET custom: { message: "..." }
      let errorMessage =
        (errorData.message as string) ||
        (errorData.title as string) ||
        rawText ||
        `Error ${res.status}: ${res.statusText}`;

      // Si hay errores de validación de campo, los concatenamos
      if (errorData.errors && typeof errorData.errors === "object") {
        const detalles = Object.entries(errorData.errors)
          .map(([campo, msgs]) => `${campo}: ${(msgs as string[]).join(", ")}`)
          .join(" | ");
        errorMessage = `${errorMessage} → ${detalles}`;
      }

      throw new ApiError(errorMessage, res.status, errorData);
    }

    // Para endpoints que devuelven 204 No Content (como un DELETE exitoso)
    if (res.status === 204) return {} as T;

    // El backend podría devolver texto plano en lugar de JSON
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return (await res.json()) as T;
    } else {
      // Si es texto plano, lo convertimos a objeto con message
      const text = await res.text();
      return { message: text } as T;
    }
  } catch (error) {
    throw error;
  }
}

// --- Endpoints ---

export const ProductService = {
  getAll: (soloDisponibles = false) =>
    fetchFromApi<Producto[]>(
      `/Productos${soloDisponibles ? "?soloDisponibles=true" : ""}`,
    ),

  getById: (id: number | string) => fetchFromApi<Producto>(`/Productos/${id}`),

  create: (data: CreateProductoDTO) =>
    fetchFromApi<Producto>("/Productos", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateProductoDTO) =>
    fetchFromApi<Producto>(`/Productos`, {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  delete: (id: number) =>
    fetchFromApi<void>(`/Productos/${id}`, {
      method: "DELETE",
    }),
};

export const VariantesService = {
  create: (data: CreateVarianteDTO) =>
    fetchFromApi<Variante[]>("/Variantes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateVarianteDTO) =>
    fetchFromApi<Variante>(`/Variantes`, {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  delete: (id: number) =>
    fetchFromApi<void>(`/Variantes/${id}`, {
      method: "DELETE",
    }),
};

export const AccesoriosService = {
  getAll: (soloDisponibles = false) =>
    fetchFromApi<Accesorio[]>(
      `/Accesorios${soloDisponibles ? "?soloDisponibles=true" : ""}`,
    ),

  getById: (id: number | string) => fetchFromApi<Accesorio>(`/Accesorios/${id}`),

  create: (data: CreateAccesorioDTO) =>
    fetchFromApi<Accesorio>("/Accesorios", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateAccesorioDTO) =>
    fetchFromApi<Accesorio>(`/Accesorios`, {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  delete: (id: number) =>
    fetchFromApi<void>(`/Accesorios/${id}`, {
      method: "DELETE",
    }),
};

export const AccesorioVariantesService = {
  create: (data: CreateAccesorioVarianteDTO) =>
    fetchFromApi<AccesorioVariante[]>("/AccesorioVariantes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateAccesorioVarianteDTO) =>
    fetchFromApi<AccesorioVariante>(`/AccesorioVariantes`, {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    }),

  delete: (id: number) =>
    fetchFromApi<void>(`/AccesorioVariantes/${id}`, {
      method: "DELETE",
    }),
};
export const AccesorioImagenesService = {
  /**
   * Agrega una imagen a un accesorio existente.
   * POST /api/AccesorioImagenes
   */
  agregar: (accesorioId: number, url: string) =>
    fetchFromApi<{ message: string }>("/AccesorioImagenes", {
      method: "POST",
      body: JSON.stringify({ accesorioId, url }),
    }),

  /**
   * Elimina una imagen por su ID.
   * DELETE /api/AccesorioImagenes/{id}
   */
  eliminar: (imagenId: number) =>
    fetchFromApi<void>(`/AccesorioImagenes/${imagenId}`, {
      method: "DELETE",
    }),
};

export const ImagenesService = {
  /**
   * Agrega una imagen a un producto existente.
   * POST /api/Imagenes
   */
  agregar: (productoId: number, url: string) =>
    fetchFromApi<{ message: string }>("/Imagenes", {
      method: "POST",
      body: JSON.stringify({ productoId, url }),
    }),

  /**
   * Elimina una imagen de producto por su ID.
   * DELETE /api/Imagenes/{id}
   */
  eliminar: (imagenId: number) =>
    fetchFromApi<void>(`/Imagenes/${imagenId}`, {
      method: "DELETE",
    }),
};


export async function loginUser(data: LoginDTO) {
  return fetchFromApi<AuthResponse>("/Auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginWithGoogle(idToken: string) {
  return fetchFromApi<AuthResponse>("/Auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

// El usuario confirmó unificar su cuenta con contraseña con su cuenta de Google
// (después de un 409 VINCULAR_GOOGLE de loginWithGoogle).
export async function vincularGoogle(idToken: string) {
  return fetchFromApi<AuthResponse>("/Auth/google/vincular", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export const CODIGO_VINCULAR_GOOGLE = "VINCULAR_GOOGLE";

// 503 de crear-preferencia cuando el checkout está apagado (Interruptores__CheckoutHabilitado).
export const CODIGO_CHECKOUT_PAUSADO = "CHECKOUT_PAUSADO";

export function esCheckoutPausado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503 && error.data.codigo === CODIGO_CHECKOUT_PAUSADO;
}

export async function registerUser(data: RegisterDTO) {
  // Ahora usamos fetchFromApi para ser consistentes
  return fetchFromApi<{ message: string }>("/Auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function solicitarResetContrasena(email: string) {
  return fetchFromApi<{ message: string }>("/auth/solicitar-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetearContrasena(token: string, nuevaContrasena: string) {
  return fetchFromApi<{ message: string }>("/auth/resetear-contrasena", {
    method: "POST",
    body: JSON.stringify({ token, nuevaContrasena }),
  });
}

export interface CambiarContrasenaDTO {
  contrasenaActual: string;
  nuevaContrasena: string;
}

export async function cambiarContrasena(data: CambiarContrasenaDTO) {
  return fetchFromApi<{ message: string }>("/Auth/cambiar-contrasena", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Ejemplo de lo que necesitas para el catálogo
// lib/api.ts
export async function getProductos() {
  // Según tu Swagger es /api/Productos?soloDisponibles=true
  return fetchFromApi<Producto[]>("/Productos?soloDisponibles=true", {
    method: "GET",
  });
}

export async function getProductoById(id: number | string) {
  return fetchFromApi<Producto>(`/Productos/${id}`, {
    method: "GET",
  });
}

// --- Admin ---

export interface DashboardMetrics {
  totalVentas: number;
  pedidosNuevos: number;
  usuariosRegistrados: number;
  stockTotal: number;
}

export const AdminService = {
  getDashboard: () => fetchFromApi<DashboardMetrics>("/Admin/dashboard"),
};

// --- Pedidos ---

// Estados tal como los devuelve el backend
import type { EstadoPedido } from "@/lib/pedidos";
export type { EstadoPedido };

export interface PedidoUsuario {
  id: number;
  nombre: string | null;
  email: string;
}

export interface PedidoItem {
  id: number;
  productoId: number;
  productoVarianteId: number;
  cantidad: number;
  precioUnitario: number;
  nombreProducto: string;
  color: string;
  memoria: string;
}

export interface Pedido {
  id: number;
  direccionEnvio: string;
  envioCalle?: string | null;
  envioCiudad?: string | null;
  envioProvincia?: string | null;
  envioCodigoPostal?: string | null;
  estado: EstadoPedido;
  /** Transiciones manuales que el admin puede hacer (solo en los endpoints de admin). */
  transicionesPermitidas?: EstadoPedido[];
  /** La mercadería ya salió (solo admin). No depende de `estado`: sigue en true si después pasa a revisión. */
  despachado?: boolean;
  despachadoEn?: string | null;
  fecha: string;
  items: PedidoItem[];
  mercadoPagoId?: string;
  total: number;
  usuario: PedidoUsuario;
  usuarioId: number;
}

export const PedidosService = {
  getAll: (estado?: string) =>
    fetchFromApi<Pedido[]>(`/Pedidos${estado ? `?estado=${estado}` : ""}`),

  getById: (id: number) => fetchFromApi<Pedido>(`/Pedidos/${id}`),

  updateEstado: (id: number, estado: string) =>
    fetchFromApi<Pedido>(`/Pedidos/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }),

  /** Pedidos del usuario autenticado — el backend lee el userId del JWT */
  getMisPedidos: () => fetchFromApi<Pedido[]>("/Pedidos/mis-pedidos"),
};

// --- Usuarios ---

export interface Usuario {
  id: number | string;
  nombre: string | null;
  email: string;
  rol: string;
  fechaRegistro?: string;
}

export interface UpdateUsuarioDTO {
  nombre: string;
}

export const UsuariosService = {
  getAll: () => fetchFromApi<Usuario[]>("/Usuarios"),
  updateMe: (id: string | number, data: UpdateUsuarioDTO) =>
    fetchFromApi<Usuario>(`/Usuarios/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// --- MercadoPago ---

export interface MPPreferenciaItem {
  /** ID de la Variante (tanto para productos como accesorios) */
  productoId: number;
  nombre: string;
  cantidad: number;
  precio: number;
  /** true si el ítem es un AccesorioVariante, false si es una Variante de Producto */
  esAccesorio: boolean;
}

export interface DireccionEnvio {
  calle: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
}

export interface MPPreferenciaResponse {
  pedidoId?: number;
  url_real?: string;    // URL de pago producción
  url_prueba?: string;  // URL de pago sandbox
  [key: string]: unknown;
}

export const MercadoPagoService = {
  /**
   * Crea una preferencia de pago en MercadoPago a través del backend.
   * Devuelve la URL de pago (initPoint o sandboxInitPoint).
   */
  crearPreferencia: (items: MPPreferenciaItem[], direccionEnvio: DireccionEnvio) =>
    fetchFromApi<MPPreferenciaResponse>("/MercadoPago/crear-preferencia", {
      method: "POST",
      body: JSON.stringify({ items, direccionEnvio }),
    }),
};
