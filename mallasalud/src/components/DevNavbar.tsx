"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DevNavbar() {
  const pathname = usePathname();
  const [expandido, setExpandido] = useState(false);

  const navItems = [
    {
      label: "HU-001/002: Portal Paciente (Reserva)",
      href: "/",
      badge: "Web / Móvil",
    },
    {
      label: "HU-005: Agendas SOME",
      href: "/some/agendas",
      badge: "Admin",
    },
    {
      label: "HU-006: Ventanilla SOME",
      href: "/some/ventanilla",
      badge: "Mesón",
    },
  ];

  return (
    <aside className="print:hidden z-40 bg-neutral-900 text-white text-[11px] font-mono border-b border-neutral-800">
      <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Modo Evaluación Capstone
          </span>
          <span className="text-neutral-400 hidden sm:inline">
            Duoc UC APT122
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="text-neutral-300 hover:text-white underline text-[11px] flex items-center gap-1"
          >
            <span>{expandido ? "Ocultar accesos rápidos HU ▲" : "Accesos rápidos HU ▼"}</span>
          </button>
        </div>
      </div>

      {expandido && (
        <div className="bg-neutral-950 border-t border-neutral-800 px-4 sm:px-8 lg:px-12 xl:px-16 py-2">
          <div className="w-full flex flex-wrap items-center gap-2">
            <span className="text-neutral-500 mr-1">Rutas directas:</span>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#0F766E] text-white font-semibold"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[9px] opacity-70 bg-neutral-900 px-1 py-0.2 rounded">
                    {item.badge}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
