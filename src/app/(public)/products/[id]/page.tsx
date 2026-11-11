import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Producto } from "@/interfaces/producto";
import ProductDetailContent from "./ProductDetailContent";

import { BACKEND_API_BASE } from "@/lib/backend";
import { idDeRuta } from "@/lib/id-ruta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // #54: sin un id válido no se le pide nada al back.
  const id = idDeRuta((await params).id);
  if (id === null) return { title: "Producto | Wave ARG" };
  try {
    const res = await fetch(`${BACKEND_API_BASE}/Productos/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: "Producto | Wave ARG" };
    const producto: Producto = await res.json();
    const title = `${producto.nombre} | Wave ARG`;
    const description =
      producto.descripcion?.trim() ||
      `Comprá ${producto.nombre} en Wave ARG. iPhones nuevos y usados con garantía.`;
    const image = producto.imagenes?.[0];
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(image ? { images: [{ url: image }] } : {}),
      },
    };
  } catch {
    return { title: "Producto | Wave ARG" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (idDeRuta((await params).id) === null) notFound();
  return <ProductDetailContent params={params} />;
}
