"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/check-in", label: "Control de ingreso" },
  { href: "/admin/funciones", label: "Funciones" },
  { href: "/admin/peliculas", label: "Películas" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/configuracion", label: "Configuración" },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiPost("/api/auth/logout");
    router.push("/admin/login");
  }

  return (
    <nav className="flex h-full flex-col border-r border-line bg-ink-soft p-4">
      <p className="mb-6 px-2 font-display text-xl text-cream">Cine Respiro</p>
      <ul className="flex flex-1 flex-col gap-1">
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-gold text-ink font-semibold" : "text-cream-dim hover:bg-ink-card"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line pt-3 text-xs text-muted">
        <p className="px-2">{adminName}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-cream-dim hover:bg-ink-card"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
