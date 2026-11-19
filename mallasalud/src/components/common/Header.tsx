"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import "./Header.css";

export default function Header() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [fontGrande, setFontGrande] = useState(false);
  const [modoOscuro, setModoOscuro] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("mallasalud_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModoOscuro(true);
      document.documentElement.classList.add("dark");
    } else {
      setModoOscuro(false);
      document.documentElement.classList.remove("dark");
    }

    const savedFont = localStorage.getItem("mallasalud_font");
    if (savedFont === "grande") {
      setFontGrande(true);
      document.documentElement.classList.add("font-accessible-lg");
    } else {
      setFontGrande(false);
      document.documentElement.classList.remove("font-accessible-lg");
    }
  }, []);

  const toggleTamanoTexto = (esGrande: boolean) => {
    setFontGrande(esGrande);
    if (esGrande) {
      document.documentElement.classList.add("font-accessible-lg");
      localStorage.setItem("mallasalud_font", "grande");
    } else {
      document.documentElement.classList.remove("font-accessible-lg");
      localStorage.setItem("mallasalud_font", "normal");
    }
  };

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuAbierto(false);
  }, [pathname]);

  const navLinks = [
    { label: "Inicio", href: "/" },
    { label: "Especialidades", href: "/#especialidades" },
    { label: "Cómo Funciona", href: "/#como-funciona" },
    { label: "Preguntas Frecuentes", href: "/#faq" },
  ];

  return (
    <header className="site-header">
      <div className="site-header-container">
        <div className="site-header-row">
          {/* 1. Logo y Nombre Institucional */}
          <Link href="/" className="site-header-brand group">
            <div className="site-header-logo-box">
              <Image
                src="/logo-mallasalud.png"
                alt="Logo MallaSalud"
                width={44}
                height={44}
                priority
                style={{ width: "auto", height: "auto" }}
                className="site-header-logo-img"
              />
            </div>
            <div className="site-header-brand-text">
              <div className="site-header-brand-top">
                <span className="site-header-brand-title">
                  MALLA<span className="site-header-brand-highlight">SALUD</span>
                </span>
                <span className="site-header-brand-badge">CESFAM</span>
              </div>
              <span className="site-header-brand-subtitle">
                Red de Salud Pública Primaria
              </span>
            </div>
          </Link>

          {/* 2. Enlaces de Navegación Portal Paciente */}
          <nav className="site-header-nav">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={isActive ? "site-header-nav-link-active" : "site-header-nav-link"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* 3. Acciones de Paciente: Accesibilidad + Modo Oscuro + Reservar */}
          <div className="site-header-actions">
            <button
              type="button"
              onClick={() => toggleTamanoTexto(!fontGrande)}
              className={fontGrande ? "site-header-a11y-toggle-active" : "site-header-a11y-toggle"}
              title={fontGrande ? "Volver a letra normal" : "Aumentar tamaño de letra"}
              aria-label={fontGrande ? "Volver a letra normal" : "Aumentar tamaño de letra"}
              aria-pressed={fontGrande}
            >
              {fontGrande ? "A+" : "A"}
            </button>

            <button
              type="button"
              onClick={toggleModoOscuro}
              className="site-header-theme-btn"
              title={modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label="Alternar modo oscuro"
            >
              {modoOscuro ? (
                <SunIcon className="site-header-theme-icon-sun" />
              ) : (
                <MoonIcon className="site-header-theme-icon-moon" />
              )}
            </button>

            <Link href="/" className="site-header-cta-btn">
              <CalendarDaysIcon className="site-header-cta-icon" />
              <span>Reservar Hora</span>
            </Link>

            <button
              type="button"
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="site-header-mobile-menu-btn"
              aria-label="Abrir menú de navegación"
              aria-expanded={menuAbierto}
            >
              {menuAbierto ? (
                <XMarkIcon className="site-header-mobile-menu-icon" />
              ) : (
                <Bars3Icon className="site-header-mobile-menu-icon" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Menú Móvil Desplegable */}
      {menuAbierto && (
        <div className="site-header-mobile-drawer">
          <div className="site-header-mobile-drawer-inner">
            <div className="site-header-mobile-controls">
              <button
                type="button"
                onClick={() => toggleTamanoTexto(!fontGrande)}
                className={
                  fontGrande
                    ? "site-header-mobile-a11y-btn-active"
                    : "site-header-mobile-a11y-btn"
                }
                aria-pressed={fontGrande}
              >
                {fontGrande ? "A+" : "A"}
              </button>

              <button
                type="button"
                onClick={toggleModoOscuro}
                className="site-header-mobile-theme-btn"
              >
                {modoOscuro ? (
                  <>
                    <SunIcon className="site-header-theme-icon-sun" />
                    <span>Claro</span>
                  </>
                ) : (
                  <>
                    <MoonIcon className="site-header-theme-icon-moon" />
                    <span>Oscuro</span>
                  </>
                )}
              </button>
            </div>

            <nav className="site-header-mobile-nav-list">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuAbierto(false)}
                    className={
                      isActive ? "site-header-mobile-nav-link-active" : "site-header-mobile-nav-link"
                    }
                  >
                    <span>{link.label}</span>
                    <span className="site-header-mobile-nav-arrow">→</span>
                  </Link>
                );
              })}
            </nav>

            <div className="site-header-mobile-cta-wrap">
              <Link
                href="/"
                onClick={() => setMenuAbierto(false)}
                className="site-header-mobile-cta-btn"
              >
                <CalendarDaysIcon className="site-header-cta-icon" />
                <span>Reservar Hora Médica</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
