import { describe, expect, it } from "vitest";
import { idDeRuta } from "./id-ruta";

// #54
describe("idDeRuta", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    ["2147483647", 2147483647],
  ])("acepta %s", (valor, esperado) => {
    expect(idDeRuta(valor)).toBe(esperado);
  });

  it.each([
    "../../swagger/index.html",
    "..",
    "%2e%2e",
    "1/../../swagger",
    "1?x=1",
    "0",
    "-1",
    "01",
    "1.5",
    "1e3",
    " 1",
    "",
    "2147483648",
    "99999999999999999999",
  ])("rechaza %j", (valor) => {
    expect(idDeRuta(valor)).toBeNull();
  });
});
