"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./DevNavbar.css";

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
    <aside className="dev-navbar">
      <div className="dev-navbar-bar">
        <div className="dev-navbar-brand">
          <span className="dev-navbar-badge">
            Modo Evaluación Capstone
          </span>
          <span className="dev-navbar-subtitle">
            Duoc UC APT122
          </span>
        </div>

        <div className="dev-navbar-actions">
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="dev-navbar-toggle"
          >
            <span>{expandido ? "Ocultar accesos rápidos HU ▲" : "Accesos rápidos HU ▼"}</span>
          </button>
        </div>
      </div>

      {expandido && (
        <div className="dev-navbar-drawer">
          <div className="dev-navbar-links">
            <span className="dev-navbar-links-label">Rutas directas:</span>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "dev-navbar-link-active" : "dev-navbar-link"}
                >
                  <span>{item.label}</span>
                  <span className="dev-navbar-link-badge">
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
