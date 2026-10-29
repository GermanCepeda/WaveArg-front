"use client";

import { useEffect } from "react";
import { reportarError } from "@/lib/reportar-error";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Con digest, el error vino del servidor y ya lo reportó instrumentation.ts (#7).
    if (!error.digest) reportarError("navegador", error, { url: window.location.pathname });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-color-principal mb-4">500</p>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Error en el panel
      </h1>
      <p className="text-gray-500 max-w-sm mb-8">
        Ocurrió un error inesperado en el panel de administración.
      </p>
      <button
        onClick={reset}
        className="bg-color-principal text-white px-8 py-3 rounded-full font-semibold hover:bg-color-principal-oscuro transition"
      >
        Reintentar
      </button>
    </div>
  );
}
