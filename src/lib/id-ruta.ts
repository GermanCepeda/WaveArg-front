// #54: id de una ruta dinámica que se usa para armar una URL del back. Next lo entrega decodificado ("..%2f" es
// "../"), así que antes de usarlo tiene que ser un entero positivo que entre en el int del back (Int32);
// cualquier otra cosa es null y quien lo usa responde 404 sin llamar al back.
const MAX_INT32 = 2_147_483_647;

export function idDeRuta(valor: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(valor)) return null;
  const id = Number(valor);
  return id <= MAX_INT32 ? id : null;
}
