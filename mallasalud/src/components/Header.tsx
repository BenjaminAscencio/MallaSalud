"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  BuildingOffice2Icon,
  EyeIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import "./Header.css";

export default function Header() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [someDropdownAbierto, setSomeDropdownAbierto] = useState(false);

  // 1. Accesibilidad: Solo 2 niveles (Normal y Grande moderado para no romper la pantalla)
  const [fontGrande, setFontGrande] = useState(false);

  // 2. Modo Oscuro
  const [modoOscuro, setModoOscuro] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Inicializar tema y tamaño guardados
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

  // Alternar tamaño de texto entre Normal (100%) y Grande moderado (112%)
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

  // Alternar modo oscuro / claro
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

  // Cerrar menú y dropdowns al cambiar de ruta
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuAbierto(false);
    setSomeDropdownAbierto(false);
  }, [pathname]);

  // Cerrar dropdown si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSomeDropdownAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { label: "Inicio", href: "/" },
    { label: "Especialidades", href: "/#especialidades" },
    { label: "Cómo Funciona", href: "/#como-funciona" },
    { label: "Preguntas Frecuentes", href: "/#faq" },
  ];

  const enVistaSome = pathname.startsWith("/some");

  return (
    <header className="site-header">
      <div className="site-header-container">
        <div className="site-header-row">
          
          {/* 1. Logo y Nombre Institucional */}
          <Link
            href="/"
            className="site-header-brand group"
          >
            <div className="site-header-logo-box">
              <Image
                src="/logo-mallasalud.png"
                alt="Logo MallaSalud"
                width={44}
                height={44}
                priority
                className="site-header-logo-img"
              />
            </div>
            <div className="site-header-brand-text">
              <div className="site-header-brand-top">
                <span className="site-header-brand-title">
                  MALLA<span className="site-header-brand-highlight">SALUD</span>
                </span>
                <span className="site-header-brand-badge">
                  CESFAM
                </span>
              </div>
              <span className="site-header-brand-subtitle">
                Red de Salud Pública Primaria
              </span>
            </div>
          </Link>

          {/* 2. Enlaces de Navegación */}
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

          {/* 3. Acciones Integradas: Accesibilidad + Modo Oscuro + Área Funcionarios + Reservar */}
          <div className="site-header-actions">
            
            {/* Botón Único de Tamaño de Letra (Alterna Normal <-> Grande al hacer clic) */}
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

            {/* Botón Modo Oscuro / Modo Claro */}
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

            {/* Selector / Dropdown de Área Funcionarios */}
            <div className="site-header-dropdown-wrap" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setSomeDropdownAbierto(!someDropdownAbierto)}
                className={someDropdownAbierto || enVistaSome ? "site-header-some-btn-active" : "site-header-some-btn"}
                aria-expanded={someDropdownAbierto}
              >
                <BuildingOffice2Icon className={someDropdownAbierto || enVistaSome ? "site-header-some-icon-active" : "site-header-some-icon"} />
                <span className="site-header-some-label-desktop">Área Funcionarios</span>
                <span className="site-header-some-label-mobile">SOME</span>
                <ChevronDownIcon
                  className={someDropdownAbierto ? "site-header-chevron-open" : "site-header-chevron"}
                />
              </button>

              {/* Menú Desplegable con accesos a vistas */}
              {someDropdownAbierto && (
                <div className="site-header-dropdown-menu">
                  <div className="site-header-dropdown-header">
                    <p className="site-header-dropdown-title">
                      <EyeIcon className="site-header-dropdown-title-icon" />
                      Módulos Operativos CESFAM
                    </p>
                    <p className="site-header-dropdown-subtitle">
                      Acceso para gestión SOME y pruebas
                    </p>
                  </div>

                  <div className="site-header-dropdown-list">
                    <Link
                      href="/some/agendas"
                      className={`${
                        pathname === "/some/agendas"
                          ? "site-header-dropdown-item-active"
                          : "site-header-dropdown-item"
                      } group`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="site-header-dropdown-dot-teal" />
                      <div>
                        <p className="site-header-dropdown-item-title">
                          Consola SOME: Agendas
                        </p>
                        <p className="site-header-dropdown-item-desc">
                          Apertura de horarios, Matriz de Boxes y Cuota 60+
                        </p>
                      </div>
                    </Link>

                    <Link
                      href="/some/ventanilla"
                      className={`${
                        pathname === "/some/ventanilla"
                          ? "site-header-dropdown-item-active"
                          : "site-header-dropdown-item"
                      } group`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="site-header-dropdown-dot-amber" />
                      <div>
                        <p className="site-header-dropdown-item-title">
                          Ventanilla Presencial SOME
                        </p>
                        <p className="site-header-dropdown-item-desc">
                          Inscripción rápida, mesón y comprobante
                        </p>
                      </div>
                    </Link>

                    <Link
                      href="/"
                      className={`${
                        pathname === "/"
                          ? "site-header-dropdown-item-active"
                          : "site-header-dropdown-item"
                      } group`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="site-header-dropdown-dot-mint" />
                      <div>
                        <p className="site-header-dropdown-item-title">
                          Portal Pacientes (Reserva Web)
                        </p>
                        <p className="site-header-dropdown-item-desc">
                          Autoatención en línea y anulación de citas
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Botón Destacado 'Reservar Hora' con contraste WCAG AA */}
            <Link
              href="/"
              className="site-header-cta-btn"
            >
              <CalendarDaysIcon className="site-header-cta-icon" />
              <span>Reservar Hora</span>
            </Link>

            {/* Botón Menú Móvil */}
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
            
            {/* Controles en Móvil: Botón Único de Letra + Modo Oscuro */}
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

            {/* Enlaces de navegación */}
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

            {/* Botón Reservar en Móvil */}
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

            {/* Accesos de Funcionarios en Móvil */}
            <div className="site-header-mobile-some-wrap">
              <p className="site-header-mobile-some-label">
                Área Funcionarios / Vistas SOME:
              </p>
              <div className="site-header-mobile-some-grid">
                <Link
                  href="/some/agendas"
                  onClick={() => setMenuAbierto(false)}
                  className="site-header-mobile-some-link"
                >
                  Consola SOME (Agendas)
                </Link>
                <Link
                  href="/some/ventanilla"
                  onClick={() => setMenuAbierto(false)}
                  className="site-header-mobile-some-link"
                >
                  Ventanilla SOME (Mesón)
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
