"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DevNavbar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "1. Portal Paciente (HU-001)",
      href: "/",
      badge: "Web / Móvil",
    },
    {
      label: "2. Consola SOME: Agendas (HU-005)",
      href: "/some/agendas",
      badge: "Administrativo",
    },
    {
      label: "3. Ventanilla Presencial SOME (HU-006)",
      href: "/some/ventanilla",
      badge: "Mesón",
    },
  ];

  return (
    <header className="border-b-2 border-black bg-white print:hidden sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase px-1.5 py-0.5 bg-black text-white font-bold tracking-wider">
            CESFAM
          </span>
          <span className="font-bold text-sm tracking-tight text-black">
            MALLASALUD
          </span>
          <span className="text-xs text-neutral-500 hidden sm:inline font-mono">
            / Wireframe Funcional
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 border transition-colors ${
                  isActive
                    ? "bg-black text-white border-black font-semibold shadow-sm"
                    : "bg-white text-black border-neutral-300 hover:border-black hover:bg-neutral-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
