import { describe, expect, it } from "vitest";
import {
  ESTADOS_PEDIDO,
  esPedidoActivo,
  estadoClase,
  estadoLabel,
  normalizarEstado,
  requiereAtencion,
  mostrarDespachado,
} from "@/lib/pedidos";

describe("estados de pedido", () => {
  it("tiene los 10 estados del backend", () => {
    expect(ESTADOS_PEDIDO).toEqual([
      "Pendiente", "Pagado", "Enviado", "Entregado", "Cancelado",
      "Vencido", "Reembolsado", "Contracargado", "RequiereRevision", "Sobreventa",
    ]);
  });

  it.each(ESTADOS_PEDIDO)("%s tiene etiqueta y color propios", (estado) => {
    expect(estadoLabel(estado)).not.toBe("");
    expect(estadoClase(estado)).not.toBe("bg-gray-100 text-gray-700");
  });

  it("muestra los pedidos viejos 'procesando' como Pagado", () => {
    expect(normalizarEstado("procesando")).toBe("Pagado");
    expect(estadoLabel("procesando")).toBe("Pagado");
  });

  it("es tolerante a mayúsculas de datos viejos", () => {
    expect(normalizarEstado("enviado")).toBe("Enviado");
  });

  it("un estado desconocido se muestra tal cual con estilo neutro", () => {
    expect(estadoLabel("Raro")).toBe("Raro");
    expect(estadoClase("Raro")).toBe("bg-gray-100 text-gray-700");
  });

  it("RequiereRevision se muestra con tilde", () => {
    expect(estadoLabel("RequiereRevision")).toBe("Requiere revisión");
  });

  it.each([
    ["Pendiente", true],
    ["Pagado", true],
    ["Enviado", true],
    ["Entregado", false],
    ["Cancelado", false],
    ["Vencido", false],
    ["Reembolsado", false],
  ])("esPedidoActivo(%s) = %s", (estado, esperado) => {
    expect(esPedidoActivo(estado)).toBe(esperado);
  });

  it("solo RequiereRevision y Sobreventa requieren atención del admin", () => {
    expect(ESTADOS_PEDIDO.filter(requiereAtencion)).toEqual(["RequiereRevision", "Sobreventa"]);
  });

  it("avisa que está despachado sólo cuando el estado no lo dice", () => {
    expect(mostrarDespachado({ estado: "RequiereRevision", despachado: true })).toBe(true);
    expect(mostrarDespachado({ estado: "Reembolsado", despachado: true })).toBe(true);
    expect(mostrarDespachado({ estado: "Enviado", despachado: true })).toBe(false);
    expect(mostrarDespachado({ estado: "RequiereRevision", despachado: false })).toBe(false);
    expect(mostrarDespachado({ estado: "RequiereRevision" })).toBe(false);
  });
});
