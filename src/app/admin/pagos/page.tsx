"use client";

import { useEffect, useState } from "react";
import { AdminService, PagoSinConciliar } from "@/lib/api";
import { estadoClase, estadoLabel } from "@/lib/pedidos";
import { formatearPrecio } from "@/lib/precio";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

// Pagos aprobados que el pedido no absorbió (ya estaba en revisión, sobrevendido, reembolsado o
// contracargado). El pedido no cambia: se resuelven en MercadoPago, normalmente reembolsando el pago.
// Ver WAVEARGDEFINITIVO/docs/pedidos-estados.md, "Pagos sin conciliar".

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonto(pago: PagoSinConciliar) {
  if (pago.monto == null) return "-";
  const monto = formatearPrecio(pago.monto);
  return pago.moneda && pago.moneda !== "ARS" ? `${monto} ${pago.moneda}` : monto;
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2 mt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
      ))}
    </div>
  );
}

export default function PagosSinConciliarPage() {
  const [pagos, setPagos] = useState<PagoSinConciliar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargarPagos() {
    setLoading(true);
    setError(null);
    AdminService.getPagosSinConciliar()
      .then(setPagos)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarPagos();
  }, []);

  return (
    <div className="my-8 px-2 md:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-color-principal">Pagos sin conciliar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plata cobrada que ningún pedido absorbió. Resolvelos en MercadoPago (normalmente reembolsando el pago).
          </p>
        </div>

        <button
          onClick={cargarPagos}
          disabled={loading}
          title="Actualizar"
          className="self-start sm:self-auto p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={16} strokeWidth={1.75} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && !loading && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-500">
          <AlertCircle size={36} strokeWidth={1.75} />
          <p className="text-sm font-medium text-center max-w-xs">{error}</p>
          <button onClick={cargarPagos} className="text-xs underline">
            Reintentar
          </button>
        </div>
      )}

      {loading && <TableSkeleton />}

      {!loading && !error && pagos.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
          <CheckCircle2 size={40} strokeWidth={1.75} className="text-gray-300" />
          <p className="text-sm">No hay pagos sin conciliar</p>
        </div>
      )}

      {!loading && !error && pagos.length > 0 && (
        <div className="bg-white shadow-sm rounded-xl overflow-x-auto border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-xs leading-normal border-b border-gray-100">
                <th className="py-3 px-4 text-left">Pedido</th>
                <th className="py-3 px-4 text-left">Pago MP</th>
                <th className="py-3 px-4 text-left">Monto</th>
                <th className="py-3 px-4 text-left">Motivo</th>
                <th className="py-3 px-4 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagos.map((pago) => (
                <tr key={pago.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-gray-500">#{pago.pedidoId}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${estadoClase(pago.estadoPedido)}`}>
                      {estadoLabel(pago.estadoPedido)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-600">{pago.mercadoPagoPaymentId}</td>
                  <td className="py-3 px-4 font-semibold text-gray-800">{formatMonto(pago)}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs max-w-[320px]">{pago.motivo}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{formatFecha(pago.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
