// Estados de pedido: la misma lista que Data/Entities/EstadosPedido.cs del backend.
// La máquina de estados (transiciones válidas y quién las dispara) está en
// WAVEARGDEFINITIVO/docs/pedidos-estados.md. Las transiciones manuales permitidas para cada
// pedido las manda el backend en `transicionesPermitidas`; el front no las recalcula.
import type { Pedido } from "@/lib/api";

export const ESTADOS_PEDIDO = [
  "Pendiente",
  "Pagado",
  "Enviado",
  "Entregado",
  "Cancelado",
  "Vencido",
  "Reembolsado",
  "Contracargado",
  "RequiereRevision",
  "Sobreventa",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

const INFO: Record<EstadoPedido, { label: string; clase: string }> = {
  Pendiente: { label: "Pendiente de pago", clase: "bg-yellow-100 text-yellow-800" },
  Pagado: { label: "Pagado", clase: "bg-emerald-100 text-emerald-800" },
  Enviado: { label: "Enviado", clase: "bg-blue-100 text-blue-800" },
  Entregado: { label: "Entregado", clase: "bg-green-100 text-green-800" },
  Cancelado: { label: "Cancelado", clase: "bg-gray-100 text-gray-600" },
  Vencido: { label: "Vencido", clase: "bg-gray-100 text-gray-600" },
  Reembolsado: { label: "Reembolsado", clase: "bg-purple-100 text-purple-800" },
  Contracargado: { label: "Contracargado", clase: "bg-red-100 text-red-800" },
  RequiereRevision: { label: "Requiere revisión", clase: "bg-orange-100 text-orange-800" },
  Sobreventa: { label: "Sobreventa", clase: "bg-red-100 text-red-800" },
};

// Pedidos anteriores a la Fase 3 pueden venir en minúscula o como "procesando" (= Pagado).
export function normalizarEstado(estado: string): EstadoPedido | null {
  if (estado.toLowerCase() === "procesando") return "Pagado";
  return ESTADOS_PEDIDO.find((e) => e.toLowerCase() === estado.toLowerCase()) ?? null;
}

export function estadoLabel(estado: string): string {
  const normalizado = normalizarEstado(estado);
  return normalizado ? INFO[normalizado].label : estado;
}

export function estadoClase(estado: string): string {
  const normalizado = normalizarEstado(estado);
  return normalizado ? INFO[normalizado].clase : "bg-gray-100 text-gray-700";
}

// Pedidos en curso desde el punto de vista del cliente (contador del perfil).
export function esPedidoActivo(estado: string): boolean {
  const normalizado = normalizarEstado(estado);
  return normalizado === "Pendiente" || normalizado === "Pagado" || normalizado === "Enviado";
}

// Estados que el admin tiene que resolver a mano.
export function requiereAtencion(estado: string): boolean {
  const normalizado = normalizarEstado(estado);
  return normalizado === "RequiereRevision" || normalizado === "Sobreventa";
}

// Aviso de "ya despachado" en el panel: hace falta cuando el estado no lo dice (p. ej. un pedido
// enviado que pasó a RequiereRevision o se reembolsó). Ese pedido no devuelve stock.
export function mostrarDespachado(pedido: Pick<Pedido, "estado" | "despachado">): boolean {
  const normalizado = normalizarEstado(pedido.estado);
  return !!pedido.despachado && normalizado !== "Enviado" && normalizado !== "Entregado";
}
