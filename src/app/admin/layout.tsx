import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";
import { esAdmin, verificarSesion } from "@/lib/sesion";
import { confirmarSesionConBack } from "@/lib/sesion-back";
import AdminShell from "@/app/admin/components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segunda capa, además de src/proxy.ts: verifica la firma del token antes de renderizar.
  // redirect() corta lanzando una excepción, así que no va dentro de un try/catch.
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const sesion = await verificarSesion(token);

  if (!token || !sesion) {
    redirect("/login");
  }

  if (!esAdmin(sesion)) {
    redirect("/account/profile");
  }

  // #49: la firma no alcanza (con la Jwt:Key filtrada cualquiera firma un token de Admin). El back
  // confirma que el usuario existe, que la contraseña no cambió y el rol que tiene hoy. Si el back
  // no responde, confirmarSesionConBack lanza y el panel no se muestra.
  const delBack = await confirmarSesionConBack(token);

  if (!delBack) {
    redirect("/login");
  }

  if (!esAdmin(delBack)) {
    redirect("/account/profile");
  }

  return <AdminShell sesion={{ email: sesion.email, rol: delBack.rol }}>{children}</AdminShell>;
}
