"use client";

import { useEffect, useState } from "react";
import { PedidosService, Pedido, PedidoItem } from "@/lib/api";
import { ESTADOS_PEDIDO, estadoClase, estadoLabel, mostrarDespachado, requiereAtencion } from "@/lib/pedidos";
import {
  Package,
  AlertCircle,
  ChevronDown,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ================================================================
// HELPERS
// ================================================================
function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonto(n: number | undefined | null) {
  if (n == null) return "-";
  return `$${n.toLocaleString("es-AR")}`;
}

// Extrae un resumen de los items del pedido
function resumeItems(items: PedidoItem[]): string {
  if (!items || items.length === 0) return "-";
  const first = items[0];
  // Filtramos color y memoria por si vienen null desde el backend
  const variante = [first.color, first.memoria].filter(Boolean).join(" ");
  const label = variante
    ? `${first.nombreProducto} — ${variante} x${first.cantidad}`
    : `${first.nombreProducto} x${first.cantidad}`;
  const extra = items.length > 1 ? ` (+${items.length - 1} más)` : "";
  return `${label}${extra}`;
}

// ================================================================
// SKELETON
// ================================================================
function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2 mt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

// ================================================================
// SELECTOR DE ESTADO (dropdown inline con PATCH)
// Solo ofrece las transiciones que el backend permite para este pedido
// (ver WAVEARGDEFINITIVO/docs/pedidos-estados.md).
// ================================================================
function EstadoSelector({
  pedidoId,
  estadoActual,
  transiciones,
  onUpdated,
}: {
  pedidoId: number;
  estadoActual: string;
  transiciones: string[];
  onUpdated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevoEstado = e.target.value;
    if (nuevoEstado === estadoActual) return;
    setLoading(true);
    setError(null);
    try {
      await PedidosService.updateEstado(pedidoId, nuevoEstado);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err instanceof Error ? err.message : String(err) : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  }

  // Sin transiciones manuales (p. ej. Vencido, Reembolsado): solo el badge.
  if (transiciones.length === 0) {
    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${estadoClase(estadoActual)}`}>
        {estadoLabel(estadoActual)}
      </span>
    );
  }

  const opciones = [estadoActual, ...transiciones];

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center">
        {loading ? (
          <Loader2 size={16} className="animate-spin text-blue-500" />
        ) : (
          <>
            <select
              value={estadoActual}
              onChange={handleChange}
              aria-label={`Estado del pedido ${pedidoId}`}
              className={`appearance-none pr-7 pl-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${estadoClase(estadoActual)}`}
            >
              {opciones.map((e) => (
                <option key={e} value={e}>
                  {e === estadoActual ? estadoLabel(e) : `→ ${estadoLabel(e)}`}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-1.5 pointer-events-none opacity-60"
            />
          </>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-red-500 max-w-[140px]">{error}</p>
      )}
    </div>
  );
}

// ================================================================
// PÁGINA PRINCIPAL
// ================================================================
export default function OrdersPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargarPedidos(estado?: string) {
    setLoading(true);
    setError(null);
    PedidosService.getAll(estado)
      .then((data) => {
        setPedidos(data);
      })
      .catch((err: Error) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarPedidos(filtroEstado || undefined);
  }, [filtroEstado]);

  // Se recarga en vez de actualizar en el lugar: el cambio de estado modifica las
  // transiciones permitidas (y puede sacar el pedido del filtro actual).
  function handleEstadoUpdated() {
    cargarPedidos(filtroEstado || undefined);
  }

  const enRevision = pedidos.filter((p) => requiereAtencion(p.estado)).length;

  return (
    <div className="my-8 px-2 md:px-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-color-principal">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading
              ? "Cargando..."
              : `${pedidos.length} pedido${pedidos.length !== 1 ? "s" : ""}`}
            {!loading && enRevision > 0 && (
              <span className="ml-2 font-semibold text-orange-700">
                · {enRevision} para revisar
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_PEDIDO.map((e) => (
              <option key={e} value={e}>
                {estadoLabel(e)}
              </option>
            ))}
          </select>

          <button
            onClick={() => cargarPedidos(filtroEstado || undefined)}
            disabled={loading}
            title="Actualizar"
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
          <AlertCircle size={36} />
          <p className="text-sm font-medium text-center max-w-xs">{error}</p>
          <button
            onClick={() => cargarPedidos(filtroEstado || undefined)}
            className="text-xs underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* SKELETON */}
      {loading && <TableSkeleton />}

      {/* EMPTY */}
      {!loading && !error && pedidos.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
          <Package size={40} className="text-gray-300" />
          <p className="text-sm">
            {filtroEstado
              ? `No hay pedidos con estado "${estadoLabel(filtroEstado)}"`
              : "No hay pedidos todavía"}
          </p>
        </div>
      )}

      {/* TABLA */}
      {!loading && !error && pedidos.length > 0 && (
        <div className="bg-white shadow-sm rounded-xl overflow-x-auto border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-xs leading-normal border-b border-gray-100">
                <th className="py-3 px-4 text-left">#</th>
                <th className="py-3 px-4 text-left">Cliente</th>
                <th className="py-3 px-4 text-left">Producto</th>
                <th className="py-3 px-4 text-left">Total</th>
                <th className="py-3 px-4 text-left">Dirección</th>
                <th className="py-3 px-4 text-left">Fecha</th>
                <th className="py-3 px-4 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pedidos.map((pedido) => (
                <tr
                  key={pedido.id}
                  className={`transition-colors ${requiereAtencion(pedido.estado) ? "bg-orange-50 hover:bg-orange-100" : "hover:bg-gray-50"}`}
                >
                  <td className="py-3 px-4 font-mono text-xs text-gray-500">
                    #{pedido.id}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">
                      {pedido.usuario?.nombre ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pedido.usuario?.email ?? "—"}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate">
                    {resumeItems(pedido.items)}
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-800">
                    {formatMonto(pedido.total)}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {pedido.direccionEnvio ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {formatFecha(pedido.fecha)}
                  </td>
                  <td className="py-3 px-4">
                    <EstadoSelector
                      pedidoId={pedido.id}
                      estadoActual={pedido.estado}
                      transiciones={pedido.transicionesPermitidas ?? []}
                      onUpdated={handleEstadoUpdated}
                    />
                    {mostrarDespachado(pedido) && (
                      <p
                        className="mt-1 text-[10px] font-semibold text-blue-800"
                        title={pedido.despachadoEn ? `Despachado el ${formatFecha(pedido.despachadoEn)}` : undefined}
                      >
                        Ya despachado: no devuelve stock
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
