// #54: el id de /products/[id] y /accesorios/[id] llega decodificado ("..%2f" es "../") y las páginas lo usan
// para pedirle el producto al back desde el servidor. Sólo un entero positivo que entra en el int del back
// (Int32) puede ser un id; cualquier otra cosa es null y la página responde 404 sin llamar al back.
const MAX_INT32 = 2_147_483_647;

export function idDeRuta(valor: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(valor)) return null;
  const id = Number(valor);
  return id <= MAX_INT32 ? id : null;
}
