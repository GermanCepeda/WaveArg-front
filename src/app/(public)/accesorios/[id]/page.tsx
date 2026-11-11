import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Accesorio } from "@/interfaces/accesorio";
import AccesorioDetailContent from "./AccesorioDetailContent";

import { BACKEND_API_BASE } from "@/lib/backend";
import { idDeRuta } from "@/lib/id-ruta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // #54: sin un id válido no se le pide nada al back.
  const id = idDeRuta((await params).id);
  if (id === null) return { title: "Accesorio | Wave ARG" };
  try {
    const res = await fetch(`${BACKEND_API_BASE}/Accesorios/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: "Accesorio | Wave ARG" };
    const accesorio: Accesorio = await res.json();
    const title = `${accesorio.nombre} | Wave ARG`;
    const description =
      accesorio.descripcion?.trim() ||
      `Comprá ${accesorio.nombre} en Wave ARG. Accesorios para iPhone con garantía.`;
    const image = accesorio.imagenes?.[0];
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
    return { title: "Accesorio | Wave ARG" };
  }
}

export default async function AccesorioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (idDeRuta((await params).id) === null) notFound();
  return <AccesorioDetailContent params={params} />;
}
