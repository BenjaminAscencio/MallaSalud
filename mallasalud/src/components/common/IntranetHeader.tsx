"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  BuildingStorefrontIcon,
  PhoneIcon,
  ClipboardDocumentCheckIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import "./IntranetHeader.css";

interface AuthUser {
  sub: string;
  rol: "SOME" | "PROFESIONAL";
  nombre: string;
  email: string;
  rut: string;
  profesionalId: string | null;
}

export default function IntranetHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [modoOscuro, setModoOscuro] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("mallasalud_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModoOscuro(true);
      document.documentElement.classList.add("dark");
    }

    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const toggleModoOscuro = () => {
    const nuevoModo = !modoOscuro;
    setModoOscuro(nuevoModo);
    if (nuevoModo) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("mallasalud_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("mallasalud_theme", "light");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const enlacesSome = [
    {
      label: "Agendas SOME",
      href: "/some/agendas",
      icon: CalendarDaysIcon,
    },
    {
      label: "Ventanilla Presencial",
      href: "/some/ventanilla",
      icon: BuildingStorefrontIcon,
    },
    {
      label: "Central Telefónica (IVR)",
      href: "/ivr",
      icon: PhoneIcon,
    },
  ];

  const enlacesDoctor = [
    {
      label: "Mi Box Clínico",
      href: "/doctor",
      icon: ClipboardDocumentCheckIcon,
    },
  ];

  const links =
    user?.rol === "PROFESIONAL"
      ? enlacesDoctor
      : user?.rol === "SOME"
      ? enlacesSome
      : pathname.startsWith("/doctor")
      ? enlacesDoctor
      : enlacesSome;

  return (
    <header className="intranet-header">
      <div className="intranet-header-container">
        <div className="intranet-header-row">
          <div className="intranet-brand">
            <div className="intranet-logo-box">
              <Image
                src="/logo-mallasalud.png"
                alt="Logo MallaSalud"
                width={32}
                height={32}
                style={{ width: "auto", height: "auto" }}
                className="object-contain max-w-full max-h-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="intranet-title">
                MALLA<span className="text-teal-primary dark:text-teal-accent">SALUD</span>
              </span>
              <span className="intranet-badge">Intranet Institucional</span>
            </div>
          </div>

          <nav className="intranet-nav" aria-label="Navegación institucional">
            {links.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "intranet-nav-link-active" : "intranet-nav-link"}
                >
                  <Icon className="w-4 h-4 text-teal-primary dark:text-teal-accent shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="intranet-actions">
            {user && (
              <div className="intranet-user-chip">
                <span className="intranet-role-tag">
                  {user.rol === "PROFESIONAL" ? "Box Clínico" : "SOME"}
                </span>
                <span className="font-semibold text-text-main dark:text-white truncate max-w-[180px]">
                  {user.nombre}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleModoOscuro}
              className="intranet-theme-btn"
              title={modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label="Alternar modo oscuro"
            >
              {modoOscuro ? (
                <SunIcon className="w-4 h-4 text-amber-300" />
              ) : (
                <MoonIcon className="w-4 h-4 text-teal-deep" />
              )}
            </button>

            <Link href="/" className="intranet-portal-link" title="Ver portal público de pacientes">
              Portal Paciente ↗
            </Link>

            <button
              type="button"
              id="btn-logout-intranet"
              onClick={handleLogout}
              className="intranet-logout-btn"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
