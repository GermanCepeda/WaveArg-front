"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Package, Users, Wallet, X } from "lucide-react";

const navLinks = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Productos", href: "/admin/productos", icon: ShoppingBag },
  { name: "Accesorios", href: "/admin/accesorios", icon: Package },
  { name: "Pedidos", href: "/admin/orders", icon: Package },
  { name: "Pagos sin conciliar", href: "/admin/pagos", icon: Wallet },
  { name: "Usuarios", href: "/admin/users", icon: Users },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30
        w-64 bg-gray-800 text-white
        transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:flex md:flex-col md:shrink-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      aria-label="Menú de administración"
    >
      {/* Logo + botón cerrar (solo en mobile) */}
      <div className="flex items-center justify-between p-4 mb-4">
        <Link href="/admin" onClick={onClose}>
          <Image
            src="/waves6.svg"
            alt="Logo Wave Argentina Admin"
            width={130}
            height={36}
            priority
            className="mx-auto"
          />
        </Link>

        {/* Botón cerrar — solo visible en mobile */}
        <button
          onClick={onClose}
          className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;

            return (
              <li key={link.name}>
                <Link href={link.href} onClick={onClose}>
                  <span
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-colors duration-200
                      ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }
                    `}
                  >
                    <Icon
                      size={20}
                      className={isActive ? "text-white" : "text-gray-400"}
                    />
                    <span className="text-sm font-medium">{link.name}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer del sidebar */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Wave Arg · Panel Admin
        </p>
      </div>
    </aside>
  );
}
