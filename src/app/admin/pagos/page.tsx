"use client";

import { useEffect, useState } from "react";
import { AdminService, PagoSinConciliar, ResolucionPagoSinConciliar } from "@/lib/api";
import { estadoClase, estadoLabel } from "@/lib/pedidos";
import { formatearPrecio } from "@/lib/precio";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Pagos aprobados que el pedido no absorbió (ya estaba en revisión, sobrevendido, reembolsado o
// contracargado). El pedido no cambia: se atienden en MercadoPago, normalmente reembolsando el pago,
// y después se marcan acá como resueltos para sacarlos de la lista.
// Ver WAVEARGDEFINITIVO/docs/pedidos-estados.md, "Pagos sin conciliar".

const CONFIRMACIONES: Record<ResolucionPagoSinConciliar, string> = {
  Cumplido: "Entregaste lo que se cobró.",
  Reembolsado: "Ya devolviste la plata en MercadoPago.",
};

// No se puede deshacer, por eso pide confirmación.
function ResolverPago({ pagoId, onResuelto }: { pagoId: number; onResuelto: () => void }) {
  const [aConfirmar, setAConfirmar] = useState<ResolucionPagoSinConciliar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolver(resolucion: ResolucionPagoSinConciliar) {
    setAConfirmar(null);
    setLoading(true);
    setError(null);
    try {
      await AdminService.resolverPagoSinConciliar(pagoId, resolucion);
      onResuelto();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loader2 size={16} strokeWidth={1.75} className="animate-spin text-blue-500" />;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {(Object.keys(CONFIRMACIONES) as ResolucionPagoSinConciliar[]).map((r) => (
          <button
            key={r}
            onClick={() => setAConfirmar(r)}
            className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            {r}
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-red-500 max-w-[180px]">{error}</p>}

      <AlertDialog open={aConfirmar !== null} onOpenChange={(open) => !open && setAConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar el pago como {aConfirmar?.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {aConfirmar && CONFIRMACIONES[aConfirmar]} Sale de la lista y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => aConfirmar && resolver(aConfirmar)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
            Plata cobrada que ningún pedido absorbió. Atendelos en MercadoPago (normalmente reembolsando el pago) y marcalos como resueltos.
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
                <th className="py-3 px-4 text-left">Resolver</th>
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
                  <td className="py-3 px-4">
                    <ResolverPago pagoId={pago.id} onResuelto={cargarPagos} />
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
